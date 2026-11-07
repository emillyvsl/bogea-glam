import BookingLookup from './booking-lookup';
import PaymentReturn from './payment-return';
import PublicNavigation from './public-navigation';
import PortfolioWorks from './portfolio-works';
import SiteFooter from './site-footer';
import AboutVitoria from './about-vitoria';
import React,{ useEffect,useState,useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { Sparkles,Scissors,Check,Clock3,MapPin } from 'lucide-react';
import { api,send,money,today,dateLabel } from './api';
import Account from './account';
import Admin from './admin';
import Brand from './brand';
import {showError} from './alerts';
import CatalogServices from './catalog-services';
import BookingSchedule from './booking-schedule';
import ReservationPayment,{openCheckoutTab,launchCheckout,reservationKey,announcePaymentUpdate} from './reservation-payment';
import './styles.css';
import './design.css';

function App() {
  const [catalog,setCatalog]=useState(null),[error,setError]=useState(''),[step,setStep]=useState(1),[serviceIds,setServiceIds]=useState([]),[professionalId,setProfessionalId]=useState(''),[date,setDate]=useState(''),[scheduleStage,setScheduleStage]=useState('professional'),[slots,setSlots]=useState([]),[slot,setSlot]=useState(null),[busy,setBusy]=useState(false),[refresh,setRefresh]=useState(0),[user,setUser]=useState(null),[client,setClient]=useState({name:'',whatsapp:'',consent:false}),[booking,setBooking]=useState(null),[paymentConfigured,setPaymentConfigured]=useState(false),[checkoutUrl,setCheckoutUrl]=useState('');
  const reserving=useRef(false);
  useEffect(()=>{
    api('/catalog').then(data=>{setCatalog(data);if(window.location.pathname==='/servicos'&&window.location.hash==='#booking')requestAnimationFrame(()=>requestAnimationFrame(()=>document.getElementById('booking')?.scrollIntoView({block:'start'})));}).catch(e=>setError(e.message));
    api('/auth/me').then(async d=>{
      setUser(d.user);
      if(window.location.pathname==='/pagamento-concluido'||window.location.pathname==='/equipe'||new URLSearchParams(window.location.search).has('painel'))return;
      let saved=null;try{const id=Number(localStorage.getItem(reservationKey(d.user.id)));if(Number.isInteger(id)&&id>0)saved=await api(`/bookings/${id}`);}catch{}
      if(!saved?.booking||['Confirmado','Cancelado','Concluído','Em atendimento'].includes(saved.booking.status))saved=await api('/bookings/pending');
      if(saved.booking){setBooking({bookingId:saved.booking.id});setStep(4);}
    }).catch(()=>{});
    api('/payments/config').then(d=>setPaymentConfigured(d.configured)).catch(()=>{});
  },[]);
  useEffect(()=>{
    const focus=()=>{
      setRefresh(v=>v+1);
      api('/payments/config').then(data=>setPaymentConfigured(data.configured)).catch(()=>{});
    };
    window.addEventListener('focus',focus);
    return()=>window.removeEventListener('focus',focus);
  },[]);
  useEffect(()=>{
    setSlot(null);setSlots([]);
    if(step===4||!professionalId||!serviceIds.length||!date||scheduleStage!=='datetime'){setBusy(false);return;}
    const controller=new AbortController();setBusy(true);setError('');
    api(`/availability?date=${date}&professionalId=${professionalId}&serviceIds=${serviceIds.join(',')}`,{signal:controller.signal}).then(d=>setSlots(d.slots)).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[date,professionalId,serviceIds,refresh,scheduleStage,step===4]);
  useEffect(()=>{if(error)showError(error);},[error]);
  useEffect(()=>{if(step>1)document.getElementById('booking')?.scrollIntoView({behavior:'smooth',block:'start'});},[step]);
  if(new URLSearchParams(window.location.search).has('painel')||window.location.pathname==='/equipe')return <Admin/>;
  if(window.location.pathname==='/pagamento-concluido')return <PaymentReturn/>;
  if(window.location.pathname==='/consultar')return <div className="app-shell catalog-shell lookup-page"><header className="topbar portfolio-topbar"><Brand subtitle="GLAM STUDIO"/><PublicNavigation/></header><main><BookingLookup/></main><SiteFooter/></div>;
  if(!catalog)return <main className="loading-screen">{error||'Preparando seu momento…'}{error&&<button onClick={()=>window.location.reload()}>Tentar novamente</button>}</main>;
  const selected=catalog.services.filter(s=>serviceIds.includes(s.id));
  const total=selected.reduce((sum,s)=>sum+Number(s.price),0),deposit=Math.round(total*100*.3)/100;
  const eligible=catalog.professionals.filter(p=>p.allServices||serviceIds.every(id=>p.serviceIds.includes(id)));
  const reserve=async e=>{
    e.preventDefault();if(reserving.current||!slot||!user)return;reserving.current=true;setError('');setBusy(true);
    const tab=paymentConfigured?openCheckoutTab():null;
    try{
      const result=await send('/bookings',{clientName:client.name,whatsapp:client.whatsapp,whatsappConsent:client.consent,date,startMinute:slot.start,professionalId:Number(professionalId),serviceIds});
      setBooking(result);setCheckoutUrl('');setStep(4);try{localStorage.setItem(reservationKey(user.id),String(result.bookingId));}catch{}
      if(paymentConfigured){try{setCheckoutUrl(await launchCheckout(result.bookingId,tab));}catch(e){setError(e.connectionLost?'Sua reserva foi criada, mas a resposta do pagamento foi interrompida. Atualize a situação abaixo antes de tentar novamente.':e.message);}}
    }catch(e){
      if(tab&&!tab.closed)tab.close();
      if(e.connectionLost){
        let pending=null;try{pending=await api('/bookings/pending');}catch{}
        if(pending?.booking){setBooking({bookingId:pending.booking.id});setStep(4);try{localStorage.setItem(reservationKey(user.id),String(pending.booking.id));}catch{}setError('Sua reserva foi localizada. Confira o contador e a situação do pagamento abaixo.');}
        else setError('A conexão foi interrompida antes de recebermos a resposta da reserva. Atualize a página para verificar se ela foi criada antes de tentar outra.');
      }else{setError(e.message);if(e.status===409){setStep(2);setRefresh(v=>v+1);}if(e.status===401)setUser(null);}
    }
    finally{reserving.current=false;setBusy(false);}
  };
  if(window.location.pathname!=='/servicos'&&step===1){
  return <div className="app-shell catalog-shell"><header className="topbar portfolio-topbar"><Brand subtitle="GLAM STUDIO"/><PublicNavigation/></header><main><section className="hero portfolio-hero"><div className="hero-copy"><p className="eyebrow">CABELOS · MAQUIAGEM · IDENTIDADE</p><h1>Sua beleza.<br/>Sua essência.<br/><em>Meu cuidado.</em></h1><p className="hero-text">Um olhar atento aos seus traços, à sua história e ao que faz você ser única.</p><div className="hero-actions"><a className="gold-button hero-cta" href="/servicos">Agendar serviços</a></div><div className="hero-signature"><strong>Vitória Bogéa</strong><span>Cabeleireira &amp; maquiadora</span><small>Acre · Brasil</small></div></div><div className="hero-visual"><div className="portfolio-portrait"><img className="studio-portrait" src="/images/IMG_3876.JPG.jpeg" alt="Vitória Bogéa, cabeleireira e maquiadora"/><div className="portrait-caption"><span>BELEZA COM<br/>PERSONALIDADE</span><em>by Vitória Bogéa</em></div></div></div><a className="hero-discover" href="/servicos"><span>DESCUBRA SEU PRÓXIMO MOMENTO</span><span aria-hidden="true">↓</span></a></section><PortfolioWorks/><AboutVitoria/></main><SiteFooter/></div>;
  }
  return <div className="app-shell catalog-shell services-shell"><header className="topbar portfolio-topbar"><Brand subtitle="GLAM STUDIO"/><PublicNavigation/></header><main><section className="hero portfolio-hero"><div className="hero-copy"><p className="eyebrow">CABELOS · MAQUIAGEM · IDENTIDADE</p><h1>Sua beleza.<br/>Sua essência.<br/><em>Meu cuidado.</em></h1><p className="hero-text">Um olhar atento aos seus traços, à sua história e ao que faz você ser única.</p><div className="hero-actions"><a className="gold-button hero-cta" href="#booking">Agendar serviços</a></div><div className="hero-signature"><strong>Vitória Bogéa</strong><span>Cabeleireira &amp; maquiadora</span><small>Acre · Brasil</small></div></div><div className="hero-visual"><div className="portfolio-portrait"><img className="studio-portrait" src="/images/IMG_3876.JPG.jpeg" alt="Vitória Bogéa, cabeleireira e maquiadora"/><div className="portrait-caption"><span>BELEZA COM<br/>PERSONALIDADE</span><em>by Vitória Bogéa</em></div></div></div><a className="hero-discover" href="#booking"><span>DESCUBRA SEU PRÓXIMO MOMENTO</span><span aria-hidden="true">↓</span></a></section><section className="booking-area" id="booking">{(step>1||serviceIds.length>0)&&<nav className="steps" aria-label="Etapas do agendamento">{['Serviços','Profissional e horário','Seus dados','Reserva'].map((label,index)=><button type="button" className={step===index+1?'step active':'step'} key={label} aria-current={step===index+1?'step':undefined} disabled={busy||index+1>=step||!!booking?.bookingId} onClick={()=>{setError('');setStep(index+1);document.getElementById('booking')?.scrollIntoView({behavior:'smooth',block:'start'});}}><span>{index+1}</span>{label}</button>)}</nav>}{error&&<p className="notice" role="alert">{error}</p>}
  {step===1&&<CatalogServices services={catalog.services} professionals={catalog.professionals} selected={serviceIds} onToggle={id=>setServiceIds(ids=>ids.includes(id)?[]:[id])} onContinue={()=>{if(!serviceIds.length||!eligible.length)return;setProfessionalId('');setDate('');setScheduleStage('professional');setSlot(null);setError('');setStep(2);}}/>}
  {step===2&&<BookingSchedule stage={scheduleStage} setStage={setScheduleStage} professionals={eligible} professionalId={professionalId} setProfessionalId={setProfessionalId} date={date} setDate={setDate} slots={slots} slot={slot} setSlot={setSlot} busy={busy} onRefresh={()=>setRefresh(v=>v+1)} onBack={()=>setStep(1)} onContinue={()=>setStep(3)} services={selected} total={total} deposit={deposit}/>}
  {step===3&&<section className="details-panel"><button className="back-button" onClick={()=>setStep(2)}>← Voltar aos horários</button>{!user?<><p>Entre ou crie uma conta para vincular a reserva a você.</p><Account allowRegister onLogin={who=>setUser(who)}/></>:user.role==='EMPLOYEE'?<p>O perfil de funcionário acessa a própria agenda. Use uma conta de cliente para reservar.</p>:<form onSubmit={reserve}><h2>Seus dados</h2><p>{dateLabel(date)} · {slot?.label}–{slot?.endLabel} · {catalog.professionals.find(p=>String(p.id)===professionalId)?.name}</p><p>{selected.map(s=>s.name).join(', ')} · Sinal {money(deposit)} · Restante {money(total-deposit)}</p><label>Nome<input required autoComplete="off" placeholder="Nome de quem será atendido" minLength={2} maxLength={120} value={client.name} onChange={e=>setClient({...client,name:e.target.value})}/></label><label>WhatsApp com DDD<input type="tel" required value={client.whatsapp} onChange={e=>setClient({...client,whatsapp:e.target.value})}/></label><label className="check-label"><input type="checkbox" checked={client.consent} onChange={e=>setClient({...client,consent:e.target.checked})}/>Quero receber confirmação e lembretes pelo WhatsApp (opcional).</label><p>Ao confirmar, o horário ficará bloqueado por 10 minutos. O checkout abre em outra aba e o contador permanece nesta página.</p><button className="primary-button" disabled={busy||!slot}>{busy?'Preparando reserva…':paymentConfigured?'Reservar e pagar sinal':'Reservar horário'}</button></form>}</section>}
  {step===4&&booking&&<ReservationPayment bookingId={booking.bookingId} userId={user?.id} paymentConfigured={paymentConfigured} checkoutUrl={checkoutUrl} onNew={()=>{try{localStorage.removeItem(reservationKey(user?.id));}catch{}setBooking(null);setCheckoutUrl('');setDate('');setSlot(null);setProfessionalId('');setScheduleStage('professional');setError('');setStep(1);}}/>}
  </section></main><SiteFooter/></div>;
}
createRoot(document.getElementById('root')).render(<App/>);




















