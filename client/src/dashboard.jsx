import AgendaTimeline from './agenda-timeline';
import React,{ useState,useEffect } from 'react';
import { History,Tags,Flower2,CalendarDays,Scissors,Users,Wallet,MessageCircle,Settings,UserRound,ChevronLeft,ChevronRight,ChevronDown,ExternalLink,Plus,Bell,Menu,X,LogOut,Clock3,CheckCircle2,LockKeyhole,RefreshCw,ArrowUpRight } from 'lucide-react';
import Brand from './brand';
import { today,money,dateLabel } from './api';

const toDate=value=>new Date(`${value}T12:00:00Z`);
const iso=value=>value.toISOString().slice(0,10);
const shift=(value,days)=>{const d=toDate(value);d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const monthLabel=value=>new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'}).format(toDate(value));
const displayDate=value=>new Intl.DateTimeFormat('pt-BR',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(toDate(value));
const weekdays=['S','T','Q','Q','S','S','D'];
const icons={'Meu perfil':UserRound,Agenda:CalendarDays,Histórico:History,Serviços:Scissors,Categorias:Tags,Clientes:Users,Pagamentos:Wallet,WhatsApp:MessageCircle,Funcionamento:Settings,Equipe:UserRound,Bloqueios:LockKeyhole};

export function DashboardShell({user,tab,setTab,workspace,bookings,onLogout,children}) {
  const [menu,setMenu]=useState(false),[alerts,setAlerts]=useState(false);
  const admin=['ROOT','ADMIN','MANAGER'].includes(user.role);
  const root=['ROOT','ADMIN'].includes(user.role);
  const tabs=admin?['Agenda','Histórico','Serviços','Categorias','Clientes',...(root?['Pagamentos','WhatsApp']:[]),'Funcionamento','Equipe','Bloqueios','Meu perfil']:['Agenda','Meu perfil'];
  const pending=bookings.filter(b=>b.status==='Aguardando pagamento').length;
  const nextConfirmed=bookings.filter(b=>b.booking_date>=today()&&b.status==='Confirmado').sort((a,b)=>a.booking_date.localeCompare(b.booking_date)||a.start_minute-b.start_minute);
  const name=workspace?.salon.name||'Bogéa Glam';
  const navigate=next=>{setTab(next);setMenu(false);};
  return <div className="manager-shell">{menu&&<button className="sidebar-scrim" aria-label="Fechar menu" onClick={()=>setMenu(false)}/>}
    <aside className={`manager-sidebar ${menu?'is-open':''}`}><div className="sidebar-brand"><Brand/><button className="icon-button mobile-close" onClick={()=>setMenu(false)} aria-label="Fechar menu"><X size={20}/></button></div><div className="salon-switch"><span className="salon-letter">B</span><div><strong>{name}</strong><small>Painel de gestão</small></div><ChevronDown size={15}/></div><p className="nav-caption">GERENCIAMENTO</p><nav aria-label="Menu principal">{tabs.map(t=>{const Icon=icons[t];return <button key={t} className={`sidebar-link ${tab===t?'is-active':''}`} aria-current={tab===t?'page':undefined} onClick={()=>navigate(t)}><Icon size={21}/><span>{t==='Funcionamento'?'Configurações':t==='Bloqueios'?'Bloqueios de agenda':t}</span>{t==='Agenda'&&<b>{bookings.filter(b=>b.booking_date===today()&&!['Cancelado','Expirado'].includes(b.status)).length}</b>}{t==='WhatsApp'&&<i className="gold-dot"/>}</button>;})}<a className="sidebar-link" href="/"><ExternalLink size={21}/><span>Ver catálogo</span></a></nav><button className="sidebar-logout" onClick={onLogout}><LogOut size={17}/>Sair da conta</button></aside>
    <div className="manager-main"><header className="manager-topbar"><div className="breadcrumbs"><button className="icon-button mobile-menu" onClick={()=>setMenu(true)} aria-label="Abrir menu"><Menu size={22}/></button><span>Gerenciador</span><ChevronRight size={16}/><strong>{tab==='Funcionamento'?'Configurações':tab==='Bloqueios'?'Bloqueios de agenda':tab}</strong></div><div className="topbar-account"><span className="manager-role-badge">{root?'Root':admin?'Manager':'Funcionário'}</span><div className="notification-anchor"><button className="icon-button notification-bell" aria-label="Ver resumo de reservas" aria-expanded={alerts} onClick={()=>setAlerts(!alerts)}><Bell size={22}/>{(pending>0||nextConfirmed.length>0)&&<i className="gold-dot"/>}</button>{alerts&&<div className="notification-popover"><strong>Seus agendamentos</strong><p>{nextConfirmed.length} confirmado(s) a partir de hoje.</p><p>{pending} reserva(s) aguardando sinal.</p>{nextConfirmed.slice(0,3).map(b=><a className="notification-booking-link" key={b.id} href={`/?painel=agenda&data=${b.booking_date}&profissional=${b.professional_id}`}><strong>Reserva #{b.id} · {b.professional_name}</strong><span>{b.booking_date.split('-').reverse().join('/')} · {b.start}–{b.end}</span></a>)}<small>Clique no atendimento para abrir a data e o profissional corretos.</small></div>}</div><div className="manager-account-info"><strong>{user.name}</strong><small>{user.email}</small></div><span className="account-avatar" title={`${user.name} · ${user.email}`}>{user.name.split(' ').map(n=>n[0]).slice(0,2).join('')}</span></div></header><main className="manager-content">{children}</main></div>
  </div>;
}

export function MiniCalendar({value,onChange}) {
  const [month,setMonth]=useState(value.slice(0,7));
  useEffect(()=>setMonth(value.slice(0,7)),[value]);
  const first=toDate(`${month}-01`),offset=(first.getUTCDay()+6)%7;
  const start=shift(`${month}-01`,-offset);
  const changeMonth=amount=>{const d=toDate(`${month}-01`);d.setUTCMonth(d.getUTCMonth()+amount);setMonth(iso(d).slice(0,7));};
  return <section className="mini-calendar" aria-label="Calendário"><header><strong>{monthLabel(`${month}-01`)}</strong><div><button className="icon-button" onClick={()=>changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={16}/></button><button className="icon-button" onClick={()=>changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={16}/></button></div></header><div className="mini-calendar-grid">{weekdays.map((day,i)=><span key={i} className="weekday">{day}</span>)}{Array.from({length:42},(_,i)=>{const day=shift(start,i);return <button key={day} className={`${day.slice(0,7)!==month?'outside':''} ${day===value?'selected':''} ${day===today()?'is-today':''}`} aria-label={displayDate(day)} aria-pressed={day===value} onClick={()=>onChange(day)}>{toDate(day).getUTCDate()}</button>;})}</div></section>;
}

export function AgendaView({bookings,workspace,user,onNew,onTeam,renderBooking,onRefresh}) {
  const [date,setDate]=useState(()=>{const value=new URLSearchParams(window.location.search).get('data');return /^\d{4}-\d{2}-\d{2}$/.test(value||'')?value:today();}),[professional,setProfessional]=useState(()=>new URLSearchParams(window.location.search).get('profissional')||''),[status,setStatus]=useState(''),[view,setView]=useState('Dia');
  const admin=['ROOT','ADMIN','MANAGER'].includes(user.role);
  const root=['ROOT','ADMIN'].includes(user.role);
  const availableProfessionals=(workspace?.professionals||[]).filter(p=>p.active||bookings.some(b=>b.professional_id===p.id));
  const selectedProfessional=admin?(availableProfessionals.some(p=>String(p.id)===professional)?professional:String(availableProfessionals[0]?.id||'')):String(user.professionalId||'');
  const base=bookings.filter(b=>String(b.professional_id)===selectedProfessional);
  const dayBookings=base.filter(b=>b.booking_date===date);
  const confirmed=dayBookings.filter(b=>b.status==='Confirmado').length;
  const waiting=dayBookings.filter(b=>b.status==='Aguardando pagamento').length;
  const completed=dayBookings.filter(b=>b.status==='Concluído').length;
  const visible=base.filter(b=>!status||b.status===status);
  const count=dayBookings.filter(b=>!['Cancelado','Expirado','Não compareceu'].includes(b.status)).length;
  const monthlyBookings=(admin?bookings:base).filter(b=>b.booking_date.slice(0,7)===date.slice(0,7));
  const monthScope=`${monthLabel(date)} · ${admin?'Todas as agendas':'Sua agenda'}`;
  const monthlyConfirmed=monthlyBookings.filter(b=>['Confirmado','Em atendimento','Concluído'].includes(b.status));
  const upcomingApproved=monthlyBookings.filter(b=>['Confirmado','Em atendimento'].includes(b.status)&&b.booking_date>=today());
  const monthlyWaiting=monthlyBookings.filter(b=>b.status==='Aguardando pagamento');
  const monthlyPaid=monthlyBookings.filter(b=>b.paid&&['Confirmado','Em atendimento','Concluído'].includes(b.status));
  const stats=[
    {label:'Agendamentos a realizar',value:String(upcomingApproved.length).padStart(2,'0'),detail:'Somente confirmados ou em atendimento, de hoje em diante',caption:monthScope,Icon:CalendarDays},
    {label:'Confirmadas no mês',value:String(monthlyConfirmed.length).padStart(2,'0'),detail:`${monthlyBookings.filter(b=>b.status==='Concluído').length} concluídas`,caption:monthScope,Icon:CheckCircle2,tone:'sage'},
    {label:'Aguardando sinal',value:String(monthlyWaiting.length).padStart(2,'0'),detail:'Reservas do mês ainda no prazo',caption:monthScope,Icon:Clock3},
    ...(root?[{label:'Sinais · atendimentos válidos',value:money(monthlyPaid.reduce((sum,b)=>sum+Number(b.deposit||0),0)),detail:`${monthlyPaid.length} atendimento(s) confirmado(s), em atendimento ou concluído(s)`,caption:`Atendimentos de ${monthLabel(date)} · Todas as agendas`,Icon:Wallet}]:[])
  ];
  const move=direction=>{if(view==='Mês'){const d=toDate(date);d.setUTCDate(1);d.setUTCMonth(d.getUTCMonth()+direction);setDate(iso(d));}else setDate(shift(date,direction*(view==='Semana'?7:1)));};
  const weekStart=shift(date,-((toDate(date).getUTCDay()+6)%7));
  const dates=view==='Semana'?Array.from({length:7},(_,i)=>shift(weekStart,i)):[date];
  const monthFirst=`${date.slice(0,7)}-01`,monthStart=shift(monthFirst,-((toDate(monthFirst).getUTCDay()+6)%7));
  return <div className="agenda-screen"><section className="dashboard-intro"><div><p className="eyebrow">GESTÃO DE ATENDIMENTOS</p><h1>Agenda de atendimentos</h1><p>Acompanhe reservas, horários e a operação do salão.</p></div><div className="intro-actions">{admin&&<button className="gold-button" onClick={onNew}><Plus size={20}/>Novo agendamento</button>}</div></section>
    <div className="dashboard-stats" style={{'--stat-count':stats.length}}>{stats.map(s=><article className={`stat-card ${s.tone||''}`} key={s.label}><div className="stat-card-top"><span>{s.label}</span><i><s.Icon size={21}/></i></div><div className={`stat-value ${s.Icon===Wallet?'currency':''}`}><strong>{s.value}</strong>{s.detail&&<small>{s.detail}</small>}</div><p>{s.caption}</p></article>)}</div>
    {admin&&<section className="agenda-selector"><Users size={22}/><label>Agenda<select aria-label="Selecionar profissional da agenda" value={selectedProfessional} onChange={e=>setProfessional(e.target.value)}>{!availableProfessionals.length&&<option value="">Nenhum profissional cadastrado</option>}{availableProfessionals.map(p=><option key={p.id} value={p.id}>{p.name}{!p.active?' (inativo)':''}</option>)}</select></label><button className="outline-button" onClick={onTeam}>Gerenciar equipe</button></section>}
    <div className="mobile-agenda-summary">{count} atendimento(s) · {confirmed} confirmado(s) · {waiting} aguardando sinal</div><div className="agenda-layout agenda-full-width"><section className="calendar-board"><header className="calendar-toolbar"><div className="date-navigation"><button className="icon-button" onClick={()=>move(-1)} aria-label="Período anterior"><ChevronLeft size={20}/></button><button className="icon-button" onClick={()=>move(1)} aria-label="Próximo período"><ChevronRight size={20}/></button><input className="agenda-date-picker" type="date" aria-label="Escolher data da agenda" value={date} onChange={e=>{if(e.target.value)setDate(e.target.value);}}/><strong>{view==='Mês'?monthLabel(date):displayDate(date)}</strong><button className="today-button" onClick={()=>setDate(today())}>Hoje</button></div><div className="view-switch">{['Dia','Semana','Mês'].map(v=><button key={v} className={view===v?'active':''} aria-pressed={view===v} onClick={()=>setView(v)}>{v}</button>)}</div></header><div className="calendar-filterbar"><span><i className="gold-dot"/>{view==='Dia'?new Intl.DateTimeFormat('pt-BR',{weekday:'long',timeZone:'UTC'}).format(toDate(date)):view==='Semana'?'Sua semana':'Seu mês'} <small>{dayBookings.length} agendamentos no dia</small></span><div><select aria-label="Filtrar por status" value={status} onChange={e=>setStatus(e.target.value)}><option value="">Todos os status</option>{['Confirmado','Aguardando pagamento','Em atendimento','Concluído','Cancelado','Expirado','Não compareceu'].map(s=><option key={s}>{s}</option>)}</select><button className="icon-button" title="Atualizar agenda" aria-label="Atualizar agenda" onClick={onRefresh}><RefreshCw size={16}/></button></div></div>
    {view!=='Mês'&&<div className="mobile-agenda-week" role="group" aria-label="Escolher dia da semana">{Array.from({length:7},(_,i)=>shift(weekStart,i)).map(d=><button type="button" key={d} aria-pressed={d===date} className={d===today()?'is-today':''} onClick={()=>setDate(d)}><span>{new Intl.DateTimeFormat('pt-BR',{weekday:'narrow',timeZone:'UTC'}).format(toDate(d))}</span><strong>{toDate(d).getUTCDate()}</strong><i className={base.some(b=>b.booking_date===d&&!['Cancelado','Expirado'].includes(b.status))?'has-bookings':''}/></button>)}</div>}{view==='Mês'?<div className="month-board">{weekdays.map((w,i)=><span className="weekday" key={i}>{w}</span>)}{Array.from({length:42},(_,i)=>{const d=shift(monthStart,i),items=visible.filter(b=>b.booking_date===d&&['Confirmado','Em atendimento','Concluído','Aguardando pagamento'].includes(b.status)&&(b.status!=='Aguardando pagamento'||(b.expires_at&&new Date(b.expires_at)>new Date())));return <button className={`${d.slice(0,7)!==date.slice(0,7)?'outside':''} ${d===today()?'is-today':''}`} key={d} onClick={()=>{setDate(d);setView('Dia');}}><strong>{toDate(d).getUTCDate()}</strong>{items.slice(0,2).map(b=><small key={b.id} className={b.status==='Aguardando pagamento'?'month-booking-pending':'month-booking-confirmed'}>{b.start} · {b.client_name}{b.status==='Aguardando pagamento'?' · Aguardando sinal':' '}</small>)}{items.length>2&&<small>+{items.length-2} atendimentos</small>}</button>;})}</div>:<AgendaTimeline dates={dates} selectedDate={date} onDateChange={setDate} bookings={visible} workspace={workspace} professional={selectedProfessional} renderBooking={renderBooking}/>}
    <footer className="calendar-legend"><span><i/>Confirmado</span><span><i/>Aguardando sinal</span><span><i/>Concluído</span><span><i/>Indisponível</span></footer></section></div>{admin&&<button type="button" className="mobile-agenda-create" aria-label="Novo agendamento" onClick={onNew}><Plus size={28}/></button>}
  </div>;
}

export function ClientsView({bookings}) {
  const [search,setSearch]=useState(''),[selected,setSelected]=useState(null);
  const grouped=new Map();
  for(const b of bookings){const key=b.whatsapp.replace(/\D/g,'');if(!grouped.has(key))grouped.set(key,{name:b.client_name,phone:b.whatsapp,bookings:[]});grouped.get(key).bookings.push(b);}
  const clients=[...grouped.values()].filter(c=>`${c.name} ${c.phone}`.toLowerCase().includes(search.toLowerCase()));
  return <section className="editor clients-panel"><div><p className="eyebrow">RELAÇÕES QUE FLORESCEM</p><h2>Seus clientes</h2></div><label>Buscar por nome ou WhatsApp<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Encontre um cliente…"/></label>{clients.length?<div className="client-grid">{clients.map(c=><button key={c.phone} className={`client-card ${selected===c.phone?'selected':''}`} onClick={()=>setSelected(selected===c.phone?null:c.phone)}><span className="client-initial">{c.name[0]}</span><strong>{c.name}</strong><small>{c.phone} · {c.bookings.length} atendimento(s)</small>{selected===c.phone&&<div className="client-history">{c.bookings.map(b=><p key={b.id}>{b.booking_date.split('-').reverse().join('/')} · {b.start}<br/>{b.services.join(', ')}<br/><span>{b.status}</span></p>)}</div>}</button>)}</div>:<p className="calendar-empty">Nenhum cliente encontrado.</p>}</section>;
}

















