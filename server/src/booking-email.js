import {randomUUID} from 'node:crypto';
import {prisma} from './db.js';
import {frontendOrigin} from './config.js';

export const emailConfigured=()=>process.env.EMAIL_ENABLED==='true'&&!!process.env.RESEND_API_KEY&&!!process.env.EMAIL_FROM;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function confirmationEmail(booking,salon={},professional={}){
  const origin=frontendOrigin(),lookup=new URL('/consultar',origin);lookup.hash=new URLSearchParams({protocolo:booking.protocol}).toString();
  const date=new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(booking.bookingDate);
  const time=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
  const rows=[['Serviço',booking.serviceNames.join(' + ')],['Profissional',professional.name||'Profissional do salão'],['Data',date],['Horário',`${time(booking.startMinute)} às ${time(booking.endMinute)} · Rio Branco`],['Protocolo',booking.protocol]];
  if(salon.address)rows.push(['Local',salon.address]);
  const payment=booking.paid?'Pagamento do sinal confirmado':'Atendimento confirmado pelo salão';
  const paymentText=booking.paid?'Seu sinal foi recebido e será descontado do valor total do atendimento.':'A confirmação do atendimento não significa quitação. Consulte o salão sobre os valores pendentes.';
  const automatic='Este e-mail foi enviado automaticamente pelo sistema de agendamentos do Bogéa Glam. Por favor, não responda a esta mensagem.';
  const support='Em caso de dúvidas, cancelamentos ou reagendamentos, entre em contato com nossa equipe pelo WhatsApp ou consulte seu agendamento em nosso site.';
  const logo=new URL('/images/Logo%20dourado%20Bog%C3%A9a%20Glam%20transparente.png',origin).href;
  const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f3efe7;color:#3c3028;font-family:Arial,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#fff;border-radius:14px;overflow:hidden"><tr><td align="center" style="background:#171611;padding:24px"><img src="${escape(logo)}" width="150" alt="Bogéa Glam — Studio de Beleza" style="display:block;width:150px;max-width:100%;height:auto"></td></tr><tr><td style="padding:30px 24px"><p style="text-align:center;font-size:10px;letter-spacing:2px;color:#9b763e">SEU MOMENTO DE CUIDADO ESTÁ RESERVADO</p><h1 style="text-align:center;font:400 28px Georgia,serif">Seu agendamento está confirmado!</h1><p style="font-size:14px;line-height:1.8">Olá, ${escape(booking.clientName)}! Seu momento de beleza já tem data marcada. Estamos felizes em receber você no Bogéa Glam.</p><div style="border-top:1px solid #e5d9c8;margin:24px 0"></div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f8f5ef;border-radius:10px"><tr><td colspan="2" style="padding:18px 14px 8px;color:#997342;font-size:11px">DETALHES DO AGENDAMENTO</td></tr>${rows.map(([label,value])=>`<tr><td style="padding:12px 14px;font-size:13px;vertical-align:top;color:#77685a">${escape(label)}</td><td align="right" style="padding:12px 14px;font-size:13px;overflow-wrap:anywhere"><strong>${escape(value)}</strong></td></tr>`).join('')}</table><div style="margin:16px 0;padding:18px 14px;background:#f8f5ef;border-radius:10px"><strong style="font-size:14px">${payment}</strong><p style="font-size:12px;line-height:1.7;margin-bottom:0">${paymentText}</p></div><table role="presentation" width="100%"><tr><td align="center" bgcolor="#805f46" style="border-radius:8px"><a href="${escape(lookup.href)}" style="display:block;padding:17px;color:#fff;text-decoration:none;font-size:15px;font-weight:bold">Consultar meu agendamento</a></td></tr></table><p style="text-align:center;font-size:12px;line-height:1.7">Caso precise cancelar ou reagendar, consulte as <a href="${escape(origin+'/termos-de-uso')}" style="color:#805f46">condições disponíveis no site</a>.</p><div style="border-top:1px solid #e5d9c8;margin-top:24px;padding-top:20px"><strong style="font:600 11px Arial,sans-serif;color:#877b6e">Mensagem automática</strong><p style="font-size:11px;line-height:1.6;color:#877b6e">${automatic}</p><p style="font-size:11px;line-height:1.6;color:#877b6e">${support}</p><p style="font-size:12px"><a href="https://wa.me/5568999124302" style="color:#805f46">WhatsApp (68) 99912-4302</a> · <a href="${escape(lookup.href)}" style="color:#805f46">Consultar agendamento</a></p><p style="text-align:center;font:400 17px Georgia,serif">Bogéa Glam · Um cuidado que começa antes do espelho.</p></div></td></tr><tr><td align="center" style="background:#171611;padding:24px;color:#c6a469;font-size:12px;line-height:1.9"><strong>BOGÉA GLAM</strong><br>${escape(salon.address||'Rio Branco · Acre')}<br><a href="${escape(origin)}" style="color:#eee7dc">${escape(new URL(origin).hostname)}</a><br>© ${new Date().getFullYear()} Bogéa Glam</td></tr></table></td></tr></table></body></html>`;
  return {from:process.env.EMAIL_FROM,to:[booking.clientEmail],subject:'Seu agendamento no Bogéa Glam está confirmado!',html,text:[`Olá, ${booking.clientName}! Seu agendamento no Bogéa Glam está confirmado.`,...rows.map(([label,value])=>`${label}: ${value}`),payment,paymentText,`Consultar meu agendamento: ${lookup.href}`,'Mensagem automática',automatic,support,'WhatsApp: https://wa.me/5568999124302','Bogéa Glam · Um cuidado que começa antes do espelho.'].join('\n\n')};
}
export async function queueBookingEmail(db,booking){
  if(!emailConfigured()||!booking.clientEmail||!booking.protocol)return;
  const [salon,professional]=await Promise.all([db.salon.findUnique({where:{id:1}}),booking.professionalId?db.professional.findUnique({where:{id:booking.professionalId}}):null]);
  await db.bookingEmail.upsert({where:{bookingId:booking.id},create:{bookingId:booking.id,payload:confirmationEmail(booking,salon||{},professional||{})},update:{}});
}
export async function sendResendEmail(payload,key,fetcher=fetch){
  const response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
  let data;try{data=await response.json();}catch{throw new Error('Resposta inconclusiva do provedor de e-mail.');}
  if(!response.ok)throw Object.assign(new Error('O provedor recusou o envio. Confira domínio, remetente e credenciais no Resend.'),{permanent:response.status>=400&&response.status<500&&![408,409,429].includes(response.status)});
  if(!data.id)throw new Error('Resposta inconclusiva do provedor de e-mail.');return data.id;
}
export async function processBookingEmails({db=prisma,sendEmail=sendResendEmail}={}){
  if(!emailConfigured())return;
  const now=new Date(),stale=new Date(now-120000);
  const jobs=await db.bookingEmail.findMany({where:{nextAttemptAt:{lte:now},OR:[{status:{in:['PENDING','RETRY']}},{status:'PROCESSING',claimedAt:{lt:stale}}]},take:20,orderBy:{nextAttemptAt:'asc'}});
  for(const job of jobs){
    const lease=randomUUID();const claim=await db.bookingEmail.updateMany({where:{id:job.id,status:job.status,OR:[{lease:null},{claimedAt:{lt:stale}}]},data:{lease,claimedAt:now,status:'PROCESSING',firstAttemptAt:job.firstAttemptAt||now}});if(!claim.count)continue;
    const finish=data=>db.bookingEmail.updateMany({where:{id:job.id,lease},data:{...data,lease:null,claimedAt:null}});
    try{
      const b=await db.booking.findUnique({where:{id:job.bookingId}});
      if(!b||!['Confirmado','Em atendimento','Concluído'].includes(b.status)){await finish({status:'CANCELLED'});continue;}
      // Resend retains idempotency keys for 24h. Never retry ambiguous sends beyond that window.
      if(job.firstAttemptAt&&now-job.firstAttemptAt>23*3600000){await finish({status:'REVIEW',lastError:'Prazo seguro de reenvio encerrado. Confira o envio no painel Resend.'});continue;}
      const providerId=await sendEmail(job.payload,`bogea-confirmation/${job.id}`);
      await finish({status:'SENT',providerId,sentAt:new Date(),lastError:null});
    }catch(error){const attempts=job.attempts+1;await finish({status:error.permanent||attempts>=10?'REVIEW':'RETRY',attempts,lastError:'Falha ao enviar e-mail. Confira remetente, domínio e registros no Resend.',nextAttemptAt:new Date(Date.now()+Math.min(3600000,60000*2**attempts))});}
  }
}
let running=false;
export function scheduleBookingEmails(){if(running||!emailConfigured())return;running=true;setImmediate(async()=>{try{await processBookingEmails();}catch{console.error('Falha na fila de e-mails. Nova tentativa programada.');}finally{running=false;}});}
