import {paymentUrls} from './config.js';
import { prisma } from './db.js';
import { locked, fail, bookingContext, availablePlan, dateString } from './salon.js';
import { queueConfirmation,scheduleNotificationDispatch } from './notifications.js';
export const paymentsConfigured = () => !!process.env.INFINITEPAY_HANDLE && !!process.env.INFINITEPAY_API_KEY;
export const webhookEnabled = () => (process.env.INFINITEPAY_WEBHOOK_PUBLIC ?? process.env.INFINITEPAY_WEBHOOK_ENABLED) === 'true';
export async function reconcileInterruptedCheckouts() {
  return prisma.payment.updateMany({
    where:{status:'Criando',createdAt:{lt:new Date(Date.now()-60000)}},
    data:{status:'Inconclusiva',reason:'A criação foi interrompida sem confirmação do provedor. Conferir a cobrança na InfinitePay antes de repetir.'}
  });
}
function providerFailure(message,uncertain=false) { const error=new Error(message);error.status=502;error.uncertain=uncertain;throw error; }
async function provider(path, body) {
  if (!paymentsConfigured()) fail('Configure a InfinitePay no servidor para aceitar pagamentos.',503);
  let response;
  try { response = await fetch(`https://api.checkout.infinitepay.io/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Api-Key': process.env.INFINITEPAY_API_KEY }, body: JSON.stringify({ handle: process.env.INFINITEPAY_HANDLE, ...body }), signal: AbortSignal.timeout(15000) }); }
  catch { providerFailure('Não foi possível obter uma resposta da InfinitePay. Confira o estado da cobrança antes de tentar novamente.',path==='links'); }
  if (!response.ok) providerFailure('A InfinitePay não aceitou a operação. Confira a configuração do checkout.',path==='links'&&response.status>=500);
  try { return await response.json(); } catch { providerFailure('A InfinitePay retornou uma resposta inconclusiva.',path==='links'); }
}
export async function checkout(bookingId, user, retry = false) {
  if (!Number.isInteger(bookingId)) fail('Reserva inválida.');
  if (!paymentsConfigured()) fail('Pagamento online ainda não configurado.',503);
  await reconcileInterruptedCheckouts();
  // Claim creation under the same lock as reservations: only one request can contact the provider.
  const payment = await locked(async tx => {
    const booking = await tx.booking.findUnique({ where: { id: bookingId } });
    if (!booking || booking.customerId !== user.id) fail('Reserva não encontrada.',404);
    if (booking.status !== 'Aguardando pagamento' || !booking.expiresAt || booking.expiresAt <= new Date()) fail('A reserva não está mais aguardando pagamento.',409);
    const amount = Math.round(Number(booking.deposit) * 100);
    if (amount < 100) fail('O sinal mínimo para pagamento online é R$ 1,00.');
    const existing = await tx.payment.findFirst({ where: { bookingId }, orderBy: { createdAt:'desc' } });
    if(existing?.checkoutUrl && existing.status==='Pendente')return existing;
    if(existing?.status==='Criando')fail('A cobrança ainda está sendo processada. Aguarde alguns instantes antes de tentar recuperar o link.',409);
    if(existing && ['Inconclusiva','Pendente'].includes(existing.status)&&!retry)fail('A cobrança teve resposta inconclusiva. Use Tentar abrir pagamento novamente para recuperar o mesmo pedido.',409);
    if(existing && ['Aprovado','Em análise'].includes(existing.status))fail('Essa cobrança já foi processada. Consulte a situação da reserva.',409);
    const record=existing||await tx.payment.create({data:{bookingId,amount,status:'Criando'}});
    const urls=paymentUrls();
    if(webhookEnabled()&&!urls.webhook)fail('Configure a URL pública do webhook.');
    const payload=record.checkoutRequest||{handle:process.env.INFINITEPAY_HANDLE,order_nsu:record.id,items:[{quantity:1,price:record.amount,description:'Sinal de 30% — Agendamento Bogéa Glam'}],redirect_url:urls.redirect,options:{single_payment:true,valid_until:booking.expiresAt.toISOString(),payment_methods_enabled:['credit_card','pix']},...(webhookEnabled()?{webhook:{url:urls.webhook,events:['paid','refunded','canceled']}}:{})};
    return tx.payment.update({where:{id:record.id},data:{status:'Criando',reason:null,createdAt:new Date(),checkoutRequest:payload}});
  });
  if (payment.checkoutUrl) return { url: payment.checkoutUrl };
  const payload=payment.checkoutRequest;
  try {
  const data = await provider('links',payload);
  const url = data.url || data.link;
  let parsed; try { parsed = new URL(url); } catch { providerFailure('O provedor não retornou um link válido. Solicite análise da cobrança.',true); }
  if (parsed.protocol !== 'https:' || !['infinitepay.io','infinitepay.com.br'].some(domain=>parsed.hostname===domain||parsed.hostname.endsWith(`.${domain}`))) providerFailure('Link de pagamento inválido. Solicite análise da cobrança.',true);
  await prisma.payment.updateMany({ where: { id: payment.id,status:'Criando' }, data: { checkoutUrl: url,status:'Pendente' } });
  return { url };
  } catch(error) {
    await prisma.payment.updateMany({where:{id:payment.id,status:'Criando'},data:{status:error.uncertain===false?'Falhou':'Inconclusiva',reason:error.uncertain===false?'Criação recusada pelo provedor.':'O provedor pode ter aceitado a solicitação. Conferir antes de repetir.'}});
    throw error;
  }
}
export async function verifyPayment(input, user = null) {
  const order = input.order_nsu, transaction = input.transaction_nsu, slug = input.slug || input.invoice_slug;
  if ([order,transaction,slug].some(v => typeof v !== 'string' || v.length < 1 || v.length > 200)) fail('Identificadores do pagamento inválidos.');
  const payment = await prisma.payment.findUnique({ where: { id: order }, include: { booking: true } });
  if (!payment || (user && !['ROOT','ADMIN'].includes(user.role) && payment.booking.customerId !== user.id)) fail('Cobrança não encontrada.',404);
  const checked = await provider('payment_check', { order_nsu: order, transaction_nsu: transaction, slug });
  if (checked.success !== true || checked.paid !== true) return { confirmed: false, status: 'Pagamento ainda não aprovado.' };
  const result=await locked(async tx => {
    const current = await tx.payment.findUnique({ where: { id: order }, include: { booking: true } });
    if (current.transactionId === transaction && current.status !== 'Pendente') return { confirmed: current.status === 'Aprovado', status: current.status, reason: current.reason,protocol:current.booking.protocol };
    const duplicate = await tx.payment.findUnique({ where: { transactionId: transaction } });
    if (duplicate) fail('Essa transação já foi utilizada.',409);
    const booking = current.booking;
    let reason = '';
    if (current.transactionId && current.transactionId !== transaction) fail('A cobrança já possui outra transação. Solicite análise ao salão.',409);
    if (checked.amount !== current.amount || !Number.isFinite(checked.paid_amount) || checked.paid_amount < current.amount) reason = 'Valor divergente.';
    else if (booking.status !== 'Aguardando pagamento' || !booking.expiresAt || booking.expiresAt <= new Date()) reason = 'Reserva vencida, cancelada ou alterada.';
    else {
      try {
        const ctx = await bookingContext(tx,dateString(booking.bookingDate),booking.professionalId,booking.serviceIds);
        const plan = availablePlan(ctx,dateString(booking.bookingDate),booking.startMinute,booking.id);
        if (!plan || plan.end !== booking.endMinute || plan.segments.length !== booking.segments.length || plan.segments.some((s,i) => s.start !== booking.segments[i].start || s.end !== booking.segments[i].end)) reason = 'Expediente ou disponibilidade alterados.';
      } catch { reason = 'Profissional ou serviços indisponíveis.'; }
    }
    await tx.payment.update({ where: { id: order }, data: { transactionId: transaction, status: reason ? 'Em análise' : 'Aprovado', reason: reason || null } });
    if (!reason) {
      const confirmed = await tx.booking.update({ where: { id: booking.id }, data: { status: 'Confirmado', paid: true, expiresAt: null } });
      await queueConfirmation(tx,confirmed);
    }
    return { confirmed: !reason, status: reason ? 'Em análise' : 'Confirmado', reason,protocol:reason?null:(await tx.booking.findUnique({where:{id:booking.id},select:{protocol:true}})).protocol };
  });
  if(result.confirmed)scheduleNotificationDispatch();
  return result;
}



