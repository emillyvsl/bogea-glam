import React,{useState,useEffect} from 'react';
import {X} from 'lucide-react';
const time=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const weekday=d=>new Date(`${d}T12:00:00Z`).getUTCDay();
export default function AgendaTimeline({dates,selectedDate,onDateChange,bookings,workspace,professional,renderBooking}){
  const [selected,setSelected]=useState(null),[compact,setCompact]=useState(()=>window.matchMedia('(max-width: 1000px)').matches),[weekDay,setWeekDay]=useState('');
  useEffect(()=>{const media=window.matchMedia('(max-width: 1000px)');const update=()=>setCompact(media.matches);media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
  const shownDay=dates.includes(selectedDate)?selectedDate:dates.includes(weekDay)?weekDay:dates[0];
  const shownDates=compact&&dates.length>1?[shownDay]:dates;
  useEffect(()=>{if(!selected)return;const close=e=>{if(e.key==='Escape')setSelected(null);};document.addEventListener('keydown',close);return()=>document.removeEventListener('keydown',close);},[selected]);
  const people=(workspace?.professionals||[]).filter(p=>(!professional||String(p.id)===professional)&&(p.active||bookings.some(b=>b.professional_id===p.id&&dates.includes(b.booking_date))));
  if(!people.length){for(const b of bookings)if((!professional||String(b.professional_id)===professional)&&!people.some(p=>p.id===b.professional_id))people.push({id:b.professional_id,name:b.professional_name||'Profissional'});}
  const columns=shownDates.flatMap(date=>(people.length?people:[{id:null,name:'Agenda'}]).map(person=>({date,person,hours:workspace?.salon?.hours?.[weekday(date)]})));
  const relevant=bookings.filter(b=>shownDates.includes(b.booking_date));
  const ranges=columns.filter(c=>c.hours).map(c=>c.hours);
  const start=Math.floor(Math.min(...ranges.map(h=>h.open),...relevant.map(b=>b.start_minute),ranges.length||relevant.length?1440:480)/30)*30;
  const end=Math.ceil(Math.max(...ranges.map(h=>h.close),...relevant.map(b=>b.end_minute),ranges.length||relevant.length?0:1080)/30)*30;
  const height=(end-start)*1.5,ticks=Array.from({length:(end-start)/30+1},(_,i)=>start+i*30);
  const position=(from,to)=>({top:(Math.max(from,start)-start)*1.5,height:Math.max(0,(Math.min(to,end)-Math.max(from,start))*1.5)});
  const current=selected&&bookings.find(b=>b.id===selected);
  return <><p className="timeline-note">Horários de início e fim · Fuso de Rio Branco · Clique no atendimento para ver detalhes e ações.</p>{compact&&dates.length>1&&<div className="timeline-week-days" role="group" aria-label="Dia da semana">{dates.map(d=><button type="button" key={d} aria-pressed={d===shownDay} onClick={()=>{setWeekDay(d);onDateChange?.(d);}}><span>{new Intl.DateTimeFormat('pt-BR',{weekday:'short',timeZone:'UTC'}).format(new Date(`${d}T12:00:00Z`))}</span><strong>{d.slice(8)}/{d.slice(5,7)}</strong></button>)}</div>}<div className="timeline-scroll"><div className="agenda-timeline" style={{gridTemplateColumns:`${compact?48:64}px repeat(${columns.length},minmax(0,1fr))`}}>
    <div className="timeline-corner">Horário</div>{columns.map(c=><header className="timeline-column-title" key={`${c.date}-${c.person.id}`}><strong>{c.person.name}</strong><span>{new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',month:'2-digit',timeZone:'UTC'}).format(new Date(`${c.date}T12:00:00Z`))}</span><small>{c.hours?`${time(c.hours.open)}–${time(c.hours.close)}`:'Salão fechado'}</small></header>)}
    <div className="timeline-axis" style={{height}}>{ticks.map(t=><span key={t} style={{top:(t-start)*1.5}}>{time(t)}</span>)}</div>
    {columns.map(c=>{const own=c.person.hours?c.person.hours[weekday(c.date)]:c.hours;const items=relevant.filter(b=>b.booking_date===c.date&&b.professional_id===c.person.id&&!['Cancelado','Expirado','Não compareceu'].includes(b.status));return <div key={`${c.date}-${c.person.id}-body`} className="timeline-column" style={{height}}>
      {ticks.map(t=><div key={t} className="timeline-rule" style={{top:(t-start)*1.5}}/>)}
      {!c.hours||!own?<div className="timeline-unavailable" style={{top:0,height}}>Fechado</div>:<>{[[start,Math.max(c.hours.open,own.open),'Fechado'],[Math.min(c.hours.close,own.close),end,'Fechado'],...[c.hours,own===c.hours?null:own].filter(h=>h?.lunchStart!=null).map(h=>[h.lunchStart,h.lunchEnd,'Intervalo'])].filter(([a,b])=>b>a&&b>start&&a<end).map(([a,b,label],i)=><div key={i} className="timeline-unavailable" style={position(a,b)}>{label}</div>)}</>}
      {(workspace?.blocks||[]).filter(b=>c.date>=b.date.slice(0,10)&&c.date<=(b.endDate||b.date).slice(0,10)&&(!b.professionalId||b.professionalId===c.person.id)).map(b=><div key={b.id} className="timeline-block" style={position(b.start,b.end)}>Bloqueio: {b.reason||'Indisponível'}</div>)}
      {items.map(b=><button type="button" key={b.id} className={`timeline-booking ${b.status==='Aguardando pagamento'?'pending':b.status==='Concluído'?'completed':''}`} style={position(b.start_minute,b.end_minute)} onClick={()=>setSelected(b.id)} aria-label={`${b.client_name}, ${b.services.join(', ')}, ${b.start} às ${b.end}`}><strong>{b.start}–{b.end}</strong><b>{b.client_name}</b><span>{b.services.join(', ')}</span><small>{b.status}</small></button>)}
    </div>;})}
  </div></div>{current&&<div className="timeline-dialog-backdrop" onClick={()=>setSelected(null)}><section role="dialog" aria-modal="true" aria-label="Detalhes do atendimento" className="timeline-dialog" onClick={e=>e.stopPropagation()}><button autoFocus type="button" className="icon-button timeline-dialog-close" aria-label="Fechar detalhes" onClick={()=>setSelected(null)}><X size={22}/></button>{renderBooking(current)}</section></div>}</>;
}



