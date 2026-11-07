import React,{useEffect,useState,useRef} from 'react';
import {CheckCircle2,Clock3,AlertCircle,LoaderCircle,ArrowRight,RefreshCw} from 'lucide-react';
import {send} from './api';
import Account from './account';
import Brand from './brand';
import {announcePaymentUpdate} from './reservation-payment';
export default function PaymentReturn(){
  const [state,setState]=useState('loading'),[message,setMessage]=useState('Estamos conferindo o pagamento do seu sinal.'),[needsLogin,setNeedsLogin]=useState(false);
  const [protocol,setProtocol]=useState('');
  const checking=useRef(false);
  const verify=async()=>{
    if(checking.current)return;checking.current=true;setState('loading');setNeedsLogin(false);
    try{const result=await send('/payments/check',Object.fromEntries(new URLSearchParams(window.location.search)));setProtocol(result.protocol||'');announcePaymentUpdate();setState(result.confirmed?'confirmed':'pending');setMessage(result.confirmed?'O sinal foi recebido e seu atendimento está confirmado.':`${result.status}${result.reason?` ${result.reason}`:''}`);}
    catch(error){setState('error');setMessage(error.message);setNeedsLogin(error.status===401);}
    finally{checking.current=false;}
  };
  useEffect(()=>{verify();},[]);
  const Icon=state==='confirmed'?CheckCircle2:state==='loading'?LoaderCircle:state==='pending'?Clock3:AlertCircle;
  return <div className="payment-return-page"><header><Brand subtitle="GLAM STUDIO"/></header><main className={`payment-return-card ${state}`} aria-busy={state==='loading'}><div className="payment-return-icon"><Icon size={38} strokeWidth={1.5}/></div><p className="eyebrow">{state==='confirmed'?'TUDO CERTO COM SEU SINAL':'SEU AGENDAMENTO'}</p><h1>{state==='confirmed'?'Seu momento está confirmado.':state==='loading'?'Conferindo seu pagamento…':state==='pending'?'Aguardando confirmação':'Não foi possível verificar'}</h1><p className="payment-return-message" role="status">{message}</p>{state==='confirmed'&&<div className="payment-return-note"><CheckCircle2 size={19}/><p>O sinal será abatido do valor total do serviço. O restante será pago no salão.<br/>Esperamos você para o seu momento de cuidado.</p></div>}{state==='confirmed'&&protocol&&<div className="confirmation-protocol"><span>Seu protocolo</span><strong>{protocol}</strong><a href="/consultar">Consultar situação do agendamento</a></div>}{needsLogin?<div className="payment-return-login"><p>Entre na conta usada na reserva para consultar seu pagamento.</p><Account onLogin={verify}/></div>:state!=='confirmed'&&<button type="button" className="payment-return-retry" disabled={state==='loading'} onClick={verify}><RefreshCw size={16}/>{state==='loading'?'Verificando…':'Verificar pagamento novamente'}</button>}<a className="payment-return-primary" href="/servicos">Voltar aos serviços <ArrowRight size={17}/></a><a className="payment-return-home" href="/">Conhecer o portfólio</a></main><p className="payment-return-signature">Vitória Bogéa · Um cuidado que começa antes do espelho.</p></div>;
}


