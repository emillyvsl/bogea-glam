import React,{useEffect,useState} from 'react';
import {Clock3,CheckCircle2,ExternalLink,ShieldCheck,TriangleAlert} from 'lucide-react';
import {api,send,money,dateLabel} from './api';
import {showError} from './alerts';
export const reservationKey=userId=>`bogea-reservation:${userId}`;
export function openCheckoutTab(){
  const tab=window.open('about:blank','_blank');
  if(tab){tab.opener=null;tab.document.title='Abrindo pagamento';tab.document.body.textContent='Preparando o pagamento do sinal. Aguarde…';}
  return tab;
}
export async function launchCheckout(bookingId,tab,retry=false){
  try{const result=await send('/payments/checkout',{bookingId,retry});if(tab&&!tab.closed)tab.location.replace(result.url);return result.url;}
  catch(error){if(tab&&!tab.closed)tab.close();throw error;}
}
export function announcePaymentUpdate(){try{localStorage.setItem('bogea-payment-update',String(Date.now()));}catch{} }
export default function ReservationPayment({bookingId,userId,paymentConfigured,checkoutUrl,onNew}) {
  const [snapshot,setSnapshot]=useState(null),[error,setError]=useState(''),[tick,setTick]=useState(Date.now()),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[offset,setOffset]=useState(0),[recoveredUrl,setRecoveredUrl]=useState('');
  useEffect(()=>{
    let disposed=false,inFlight=false;const controller=new AbortController();
    const update=async()=>{if(inFlight)return;inFlight=true;try{const data=await api(`/bookings/${bookingId}`,{signal:controller.signal});if(!disposed){setSnapshot(data);setOffset(Date.now()-new Date(data.serverNow).getTime());setError('');if(['Confirmado','Concluído','Cancelado'].includes(data.booking.status)){try{localStorage.removeItem(reservationKey(userId));}catch{}}}}catch(e){if(!disposed&&e.name!=='AbortError')setError(e.message);}finally{inFlight=false;}};
    update();const poll=setInterval(update,5000);window.addEventListener('focus',update);window.addEventListener('storage',update);
    return()=>{disposed=true;controller.abort();clearInterval(poll);window.removeEventListener('focus',update);window.removeEventListener('storage',update);};
  },[bookingId,userId,refresh]);
  useEffect(()=>{const timer=setInterval(()=>setTick(Date.now()),1000);return()=>clearInterval(timer);},[]);
  if(!snapshot)return <section className="success-panel"><h2>Sua reserva</h2><p role="status">{error||'Carregando o prazo da reserva…'}</p><button className="outline-button" onClick={()=>setRefresh(v=>v+1)}>Atualizar</button></section>;
  const {booking:b,payment}=snapshot;
  const left=b.expires_at?Math.max(0,Math.ceil((new Date(b.expires_at).getTime()-(tick-offset))/1000)):0;
  const active=b.status==='Aguardando pagamento'&&left>0;
  const confirmed=['Confirmado','Em atendimento','Concluído'].includes(b.status);
  const review=payment?.status==='Em análise';
  const uncertain=['Criando','Inconclusiva'].includes(payment?.status);
  const url=payment?.checkoutUrl||recoveredUrl||checkoutUrl;
  const open=async()=>{const tab=openCheckoutTab();setBusy(true);try{setRecoveredUrl(await launchCheckout(bookingId,tab,true));setRefresh(v=>v+1);}catch(e){showError(e.message);setRefresh(v=>v+1);}finally{setBusy(false);}};
  return <section className="success-panel reservation-payment"><div className={`payment-state-icon ${confirmed?'confirmed':''}`}>{confirmed?<CheckCircle2 size={30}/>:review||uncertain?<TriangleAlert size={30}/>:<Clock3 size={30}/>}</div><p className="eyebrow">{review?'PAGAMENTO EM ANÁLISE':confirmed?'ATENDIMENTO CONFIRMADO':active?'AGUARDANDO PAGAMENTO':'RESERVA ENCERRADA'}</p><h2>{review?'O salão precisa conferir o pagamento.':confirmed?'Seu horário está confirmado.':active?'Pague o sinal para confirmar seu horário.':b.status==='Cancelado'?'Sua reserva foi cancelada.':'O prazo para pagamento terminou.'}</h2>
  {active&&!review&&<><div className="reservation-countdown" role="timer" aria-label="Tempo restante para pagar"><span>{String(Math.floor(left/60)).padStart(2,'0')}:{String(left%60).padStart(2,'0')}</span><small>para pagar o sinal</small></div><p>Enquanto esse prazo estiver válido, ninguém pode reservar o mesmo horário com esse profissional. Sem confirmação em 10 minutos, o período volta a ficar disponível.</p></>}
  {!active&&!confirmed&&!review&&<p>Este horário não está mais bloqueado por esta reserva. Se você já pagou, volte pela InfinitePay para verificar o pagamento; pagamentos tardios ficam para análise do salão.</p>}
  {review&&<p>{payment.reason} A reserva não será confirmada automaticamente. Entre em contato com o salão para análise.</p>}
  {confirmed&&<p>{b.paid?'O sinal foi registrado e o atendimento está garantido.':'A reserva foi confirmada pelo salão.'}</p>}
  {confirmed&&b.protocol&&<div className="confirmation-protocol"><span>Seu protocolo</span><strong>{b.protocol}</strong><a href="/consultar">Consultar agendamento</a></div>}<div className="success-card"><span>Reserva #{b.id} · {dateLabel(b.booking_date)}</span><strong>{b.start}–{b.end} · {b.professional_name}</strong><small>{b.services.join(', ')}</small><div className="success-price"><span>Sinal de 30%</span><strong>{money(b.deposit)}</strong></div><small>Total {money(b.total_price)} · Restante após o sinal {money(b.total_price-b.deposit)}</small></div>
  {active&&!review&&(paymentConfigured?<div className="checkout-retry-area"><p>{uncertain?'O link ainda não foi recebido. Você pode tentar recuperar a mesma cobrança, sem reiniciar o prazo da reserva.':'Se a aba da InfinitePay não abriu, use o botão abaixo. O contador continuará nesta página.'}</p>{url?<a className="gold-button" href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={17}/>Tentar abrir pagamento novamente</a>:<button className="gold-button" disabled={busy||payment?.status==='Criando'} onClick={open}><ExternalLink size={17}/>{busy?'Recuperando link…':payment?.status==='Criando'?'Preparando link de pagamento…':'Tentar abrir pagamento novamente'}</button>}<small>Disponível somente até o fim do contador de 10 minutos.</small></div>:<p className="notice">Pagamento online ainda não configurado pelo salão.</p>)}
  {error&&<p className="notice" role="alert">{error}</p>}<p className="payment-verification-note"><ShieldCheck size={16}/>A confirmação só aparece após a verificação do pagamento pelo servidor. Ao terminar, use o retorno ao site na InfinitePay.</p>{!active&&<button className="outline-button" onClick={onNew}>Voltar ao catálogo</button>}</section>;
}



