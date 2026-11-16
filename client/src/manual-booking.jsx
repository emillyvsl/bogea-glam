import {formatWhatsApp} from './phone';
import BookingCalendar from './booking-calendar';
import React,{useEffect,useState} from 'react';
import {Search,X} from 'lucide-react';
import {api,money,dateLabel} from './api';

const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export default function ManualBooking({workspace,save,onCancel}){
  const [form,setForm]=useState({clientName:'',whatsapp:'',clientEmail:'',serviceIds:[],professionalId:'',date:'',startMinute:null,whatsappConsent:false,depositReceived:false});
  const [slots,setSlots]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[refresh,setRefresh]=useState(0);
  const services=workspace.services.filter(s=>s.active),selected=services.filter(s=>form.serviceIds.includes(s.id));
  const eligible=workspace.professionals.filter(p=>p.active&&(p.allServices||form.serviceIds.every(id=>p.serviceIds.includes(id))));
  const serviceKey=form.serviceIds.join(',');
  const filtered=services.filter(s=>normalized(`${s.name} ${s.category}`).includes(normalized(query)));
  function toggleService(id){
    setForm(current=>{
      const serviceIds=current.serviceIds.includes(id)?current.serviceIds.filter(value=>value!==id):[...current.serviceIds,id];
      const professional=workspace.professionals.find(p=>String(p.id)===current.professionalId);
      const compatible=professional?.active&&(professional.allServices||serviceIds.every(value=>professional.serviceIds.includes(value)));
      return {...current,serviceIds,professionalId:compatible?current.professionalId:'',date:'',startMinute:null};
    });
  }
  useEffect(()=>{
    setSlots([]);setError('');setBusy(false);setForm(current=>({...current,startMinute:null}));
    if(!serviceKey||!form.professionalId||!/^\d{4}-\d{2}-\d{2}$/.test(form.date))return;
    const controller=new AbortController();setBusy(true);
    api(`/availability?${new URLSearchParams({date:form.date,professionalId:form.professionalId,serviceIds:serviceKey})}`,{signal:controller.signal})
      .then(data=>{if(!controller.signal.aborted)setSlots(data.slots);})
      .catch(err=>{if(!controller.signal.aborted)setError(err.message);})
      .finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[form.date,form.professionalId,serviceKey,refresh]);
  async function submit(event){
    event.preventDefault();
    if(!slots.some(s=>s.start===form.startMinute)){setError('Escolha um horário disponível antes de confirmar.');return;}
    if(await save('/bookings/manual',{...form,professionalId:Number(form.professionalId)})){
      setForm(current=>({...current,clientName:'',whatsapp:'',clientEmail:'',startMinute:null,whatsappConsent:false,depositReceived:false}));setRefresh(value=>value+1);
    }
  }
  return <form className="editor manual-booking" onSubmit={submit}><h3 className="manual-section-title">Dados da cliente</h3>

    <div className="form-grid"><label>Cliente<input placeholder="Nome completo" autoComplete="name" required value={form.clientName} onChange={e=>setForm({...form,clientName:e.target.value})}/></label><label>WhatsApp com DDD<input placeholder="(68) 99999-9999" autoComplete="tel" type="tel" inputMode="numeric" pattern="\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}" title="Informe o DDD e o número do WhatsApp" required value={form.whatsapp} onChange={e=>setForm({...form,whatsapp:formatWhatsApp(e.target.value)})}/></label></div>
    <label>E-mail da cliente (opcional)<input placeholder="cliente@email.com" autoComplete="email" type="email" maxLength={254} value={form.clientEmail} onChange={e=>setForm({...form,clientEmail:e.target.value})}/></label>
    <fieldset className="manual-service-picker"><legend className="manual-section-title">Serviços do atendimento</legend>
      <div className="manual-service-field">
        <div className="manual-service-input"><Search size={18} aria-hidden="true"/><input type="search" aria-label="Buscar serviço ou categoria" value={query} placeholder="Buscar serviço ou categoria" onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/></div>
        <label className="manual-service-select">Adicionar serviço<select aria-label="Adicionar serviço" value="" onChange={e=>{const id=Number(e.target.value);if(!id)return;toggleService(id);setQuery('');}}>
          <option value="">Selecione um serviço</option>
          {filtered.filter(service=>!form.serviceIds.includes(service.id)).map(service=><option key={service.id} value={service.id}>{service.name} · {service.category} · {money(service.price)}</option>)}
        </select></label>
        {!filtered.length&&<p role="status">Nenhum serviço encontrado.</p>}
      </div>
      {!!selected.length&&<div className="manual-service-tags" aria-label="Serviços selecionados">{form.serviceIds.map(id=>services.find(service=>service.id===id)).filter(Boolean).map(service=><button type="button" key={service.id} onClick={()=>toggleService(service.id)} aria-label={`Remover ${service.name}`}><span>{service.name}</span><X size={14}/></button>)}</div>}
      {!!selected.length&&<small>{selected.length} serviço(s) · Total {money(selected.reduce((sum,service)=>sum+Number(service.price),0))}</small>}
    </fieldset>
    <h3 className="manual-section-title">Profissional e data</h3><div className="form-grid"><label>Profissional<select required disabled={!form.serviceIds.length} value={form.professionalId} onChange={e=>setForm({...form,professionalId:e.target.value,date:'',startMinute:null})}><option value="">Selecione</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div>
    {!!serviceKey&&!!form.professionalId&&<div className="manual-calendar"><BookingCalendar key={form.professionalId+':'+serviceKey+':'+refresh} professionalId={form.professionalId} serviceId={serviceKey} selected={form.date} onChoose={date=>setForm(current=>({...current,date,startMinute:null}))} onMonthChange={()=>setForm(current=>({...current,date:'',startMinute:null}))}/></div>}
    {!!form.date&&<p className="manual-selected-date">Data selecionada: <strong>{dateLabel(form.date)}</strong></p>}
    {!!form.serviceIds.length&&!eligible.length&&<p role="status">Nenhuma profissional ativa realiza todos os serviços selecionados. Revise a seleção ou o cadastro da equipe.</p>}
    <fieldset className="manual-time-picker"><legend>Horários disponíveis</legend>{busy?<p role="status">Buscando horários…</p>:error?<p role="alert">{error}</p>:!form.serviceIds.length||!form.professionalId?<p>Selecione os serviços e a profissional para consultar os horários.</p>:!form.date?<p>Escolha a data do atendimento.</p>:slots.length?<div className="slots">{slots.map(s=><button type="button" aria-pressed={form.startMinute===s.start} className={form.startMinute===s.start?'slot selected':'slot'} key={s.start} onClick={()=>setForm({...form,startMinute:s.start})}>{s.label}<small>até {s.endLabel}</small></button>)}</div>:<p role="status">Não há horários disponíveis nesta data para os serviços selecionados. Escolha outra data.</p>}{!!serviceKey&&!!form.professionalId&&!!form.date&&!busy&&<button type="button" className="outline-button" onClick={()=>setRefresh(value=>value+1)}>Atualizar horários</button>}</fieldset>
    <div className="manual-options"><label className="check-label"><input type="checkbox" checked={form.whatsappConsent} onChange={e=>setForm({...form,whatsappConsent:e.target.checked})}/>Cliente autorizou mensagens no WhatsApp</label>
    <label className="check-label"><input type="checkbox" checked={form.depositReceived} onChange={e=>setForm({...form,depositReceived:e.target.checked})}/>Sinal recebido por outro meio</label>
    </div><div className="manual-submit"><small>O atendimento será confirmado diretamente na agenda.</small><button className="primary-button" disabled={form.startMinute===null||busy||!!error||!form.serviceIds.length||!form.professionalId}>Confirmar atendimento</button><button type="button" className="outline-button" onClick={onCancel}>Cancelar</button></div>
  </form>;
}
