import ManagerLogin from './manager-login';
import BookingHistory from './booking-history';
import Categories from './categories';
import React,{ useEffect,useState } from 'react';
import Account from './account';
import WhatsAppPanel from './whatsapp-panel';
import {showError,showSuccess,confirmAction} from './alerts';
import Brand from './brand';
import Services from './services';
import Blocks from './blocks';
import { ListHeader,EditorHeader,StatusBadge } from './crud';
import { Pencil,Power } from 'lucide-react';
import { DashboardShell, AgendaView, ClientsView } from './dashboard';
import { api,send,money,time,minute,today,dateLabel } from './api';

const defaults = Object.fromEntries([0,1,2,3,4,5,6].map(d=>[d,d<2?null:{open:480,close:d===5?1140:d===6?960:1080,lunchStart:720,lunchEnd:780}]));
function Hours({ value,onChange }) {
  const days=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
  return <div className="hours-editor">{days.map((day,i)=><div className="hours-row" key={day}><label className="check-label"><input type="checkbox" checked={!!value[i]} onChange={e=>onChange({...value,[i]:e.target.checked?{open:480,close:1080,lunchStart:720,lunchEnd:780}:null})}/>{day}</label>{value[i]?<><label>Abertura<input type="time" required value={time(value[i].open)} onChange={e=>onChange({...value,[i]:{...value[i],open:minute(e.target.value)}})}/></label><label>Fechamento<input type="time" required value={time(value[i].close)} onChange={e=>onChange({...value,[i]:{...value[i],close:minute(e.target.value)}})}/></label><label className="check-label"><input type="checkbox" checked={value[i].lunchStart!=null} onChange={e=>onChange({...value,[i]:{...value[i],lunchStart:e.target.checked?720:null,lunchEnd:e.target.checked?780:null}})}/>Almoço</label>{value[i].lunchStart!=null&&<><label>Início<input type="time" required value={time(value[i].lunchStart)} onChange={e=>onChange({...value,[i]:{...value[i],lunchStart:minute(e.target.value)}})}/></label><label>Fim<input type="time" required value={time(value[i].lunchEnd)} onChange={e=>onChange({...value,[i]:{...value[i],lunchEnd:minute(e.target.value)}})}/></label></>}</>:<span>Fechado</span>}</div>)}</div>;
}
function Settings({ salon,save }) {
  const [form,setForm]=useState(salon);
  return <form className="editor" onSubmit={e=>{e.preventDefault();save('/admin/salon',form,'PUT');}}><h2>Funcionamento do salão</h2><div className="form-grid">{[['name','Nome'],['address','Endereço'],['whatsapp','WhatsApp']].map(([key,label])=><label key={key}>{label}<input value={form[key]} required={key==='name'} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label>Lembrete antes do atendimento<select value={form.reminderHours} onChange={e=>setForm({...form,reminderHours:Number(e.target.value)})}>{[2,24,48].map(h=><option key={h} value={h}>{h} horas</option>)}</select></label></div><Hours value={form.hours} onChange={hours=>setForm({...form,hours})}/><p>Alterações preservam os agendamentos existentes. Confira possíveis conflitos na agenda.</p><button className="primary-button">Salvar configuração</button></form>;
}
function Team({ professionals,services,save,user }) {
  const blank={name:'',email:'',password:'',role:'EMPLOYEE',active:true,allServices:true,serviceIds:[],hours:null};
  const [form,setForm]=useState(null),[search,setSearch]=useState('');
  const rows=professionals.filter(p=>`${p.name} ${p.email}`.toLowerCase().includes(search.toLowerCase()));
  if(!form)return <section className="crud-list"><ListHeader title="Profissionais" count={professionals.length} onNew={()=>setForm({...blank})} newLabel="Novo profissional" search={search} onSearch={setSearch}/><div className="crud-table-scroll"><table className="crud-table"><thead><tr><th>Profissional</th><th>Serviços</th><th>Expediente</th><th>Situação</th><th>Ações</th></tr></thead><tbody>{rows.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small>{p.email}</small><small>Perfil: {p.user?.role==='ROOT'?'Root':p.user?.role==='MANAGER'?'Manager':'Funcionário'}</small></td><td>{p.allServices?'Todos os serviços':`${p.serviceIds.length} serviço(s)`}</td><td>{p.hours?'Personalizado':'Horário do salão'}</td><td><StatusBadge active={p.active}/></td><td><div className="crud-row-actions"><button aria-label={`Editar ${p.name}`} onClick={()=>setForm({...p,password:'',role:p.user?.role||'EMPLOYEE'})}><Pencil size={15}/>Editar</button><button onClick={()=>save(`/admin/professionals/${p.id}/active`,{active:!p.active},'PATCH')}><Power size={15}/>{p.active?'Desativar':'Ativar'}</button></div></td></tr>)}</tbody></table></div>{!rows.length&&<p className="crud-empty">Nenhum profissional encontrado.</p>}</section>;
  return <section className="crud-editor"><EditorHeader title={form.id?'Editar profissional':'Novo profissional'} onBack={()=>setForm(null)}/><form className="editor" onSubmit={async e=>{e.preventDefault();if(await save('/admin/professionals',form))setForm(null);}}><h2>{form.id?'Editar profissional':'Novo profissional'}</h2>{[['name','Nome','text'],['email','E-mail de acesso','email'],['password',form.userId?'Nova senha (opcional)':'Senha inicial (12 caracteres ou mais)','password']].map(([key,label,type])=><label key={key}>{label}<input type={type} autoComplete={key==='password'?'new-password':'off'} required={key!=='password'||!form.userId} minLength={key==='password'?12:undefined} value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}<label>Perfil de acesso<select required value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="EMPLOYEE">Funcionário — somente a própria agenda</option><option value="MANAGER">Manager — gestão sem Pagamentos e WhatsApp</option>{['ROOT','ADMIN'].includes(user.role)&&<option value="ROOT">Root — acesso completo</option>}</select></label><label className="check-label"><input type="checkbox" checked={form.active} onChange={e=>setForm({...form,active:e.target.checked})}/>Ativo</label><label className="check-label"><input type="checkbox" checked={form.allServices} onChange={e=>setForm({...form,allServices:e.target.checked})}/>Realiza todos os serviços atuais e futuros</label>{!form.allServices&&services.map(s=><label className="check-label" key={s.id}><input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={e=>setForm({...form,serviceIds:e.target.checked?[...form.serviceIds,s.id]:form.serviceIds.filter(id=>id!==s.id)})}/>{s.name}</label>)}<label className="check-label"><input type="checkbox" checked={form.hours===null} onChange={e=>setForm({...form,hours:e.target.checked?null:structuredClone(defaults)})}/>Seguir expediente do salão</label>{form.hours&&<Hours value={form.hours} onChange={hours=>setForm({...form,hours})}/>}<div className="crud-form-actions"><button type="button" className="outline-button" onClick={()=>setForm(null)}>Cancelar</button><button className="gold-button">Salvar profissional</button></div></form></section>;
}
function Manual({ workspace,save }) {
  const [form,setForm]=useState({clientName:'',whatsapp:'',serviceIds:[],professionalId:'',date:today(),startMinute:null,whatsappConsent:false,depositReceived:false});
  const [slots,setSlots]=useState([]),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const eligible=workspace.professionals.filter(p=>p.active&&(p.allServices||form.serviceIds.every(id=>p.serviceIds.includes(id))));
  useEffect(()=>{
    setSlots([]);setForm(f=>({...f,startMinute:null}));
    if(!form.serviceIds.length||!form.professionalId)return;
    const controller=new AbortController();setBusy(true);setError('');
    api(`/availability?date=${form.date}&professionalId=${form.professionalId}&serviceIds=${form.serviceIds.join(',')}`,{signal:controller.signal}).then(d=>setSlots(d.slots)).catch(e=>{if(e.name!=='AbortError')setError(e.message);}).finally(()=>{if(!controller.signal.aborted)setBusy(false);});
    return()=>controller.abort();
  },[form.date,form.professionalId,form.serviceIds]);
  return <form className="editor" onSubmit={async e=>{e.preventDefault();if(await save('/bookings/manual',{...form,professionalId:Number(form.professionalId)}))setForm({...form,clientName:'',whatsapp:'',startMinute:null});}}><h2>Agendamento manual</h2><p>O atendimento será confirmado diretamente, por decisão administrativa.</p>{workspace.integrations.whatsappDemo&&<p className="manual-whatsapp-demo">WhatsApp em modo de teste: a confirmação usará o modelo de demonstração em inglês da Meta.</p>}<div className="form-grid">{[['clientName','Cliente'],['whatsapp','WhatsApp com DDD']].map(([key,label])=><label key={key}>{label}<input required value={form[key]} onChange={e=>setForm({...form,[key]:e.target.value})}/></label>)}</div><fieldset><legend>Serviços</legend>{workspace.services.filter(s=>s.active).map(s=><label className="check-label" key={s.id}><input type="checkbox" checked={form.serviceIds.includes(s.id)} onChange={e=>setForm({...form,professionalId:'',serviceIds:e.target.checked?[...form.serviceIds,s.id]:form.serviceIds.filter(id=>id!==s.id)})}/>{s.name} · {money(s.price)}</label>)}</fieldset><div className="form-grid"><label>Profissional<select required value={form.professionalId} onChange={e=>setForm({...form,professionalId:e.target.value})}><option value="">Selecione</option>{eligible.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><label>Data<input type="date" required min={today()} value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label></div>{busy?<p>Buscando horários…</p>:<div className="slots">{slots.map(s=><button type="button" className={form.startMinute===s.start?'slot selected':'slot'} key={s.start} onClick={()=>setForm({...form,startMinute:s.start})}>{s.label}<small>até {s.endLabel}</small></button>)}</div>}{!busy&&!slots.length&&<p>Selecione serviços, profissional e uma data com horários disponíveis.</p>}{error&&<p role="alert">{error}</p>}<label className="check-label"><input type="checkbox" checked={form.whatsappConsent} onChange={e=>setForm({...form,whatsappConsent:e.target.checked})}/>Cliente autorizou mensagens no WhatsApp</label><label className="check-label"><input type="checkbox" checked={form.depositReceived} onChange={e=>setForm({...form,depositReceived:e.target.checked})}/>Sinal recebido por outro meio</label><button className="primary-button" disabled={form.startMinute===null||busy}>Confirmar atendimento</button></form>;
}

function BookingCard({ b,user,save,setNotice }) {
  const admin=['ROOT','ADMIN','MANAGER'].includes(user.role);
  const root=['ROOT','ADMIN'].includes(user.role);
  const actions=(user.role==='EMPLOYEE'?{Confirmado:['Em atendimento','Não compareceu'],'Em atendimento':['Concluído']}:admin?{'Aguardando pagamento':['Confirmado','Cancelado'],Confirmado:['Em atendimento','Não compareceu','Cancelado'],'Em atendimento':['Concluído','Cancelado']}:{} )[b.status]||[];
  const text=`Olá, ${b.client_name}! Seu atendimento no Bogéa Glam está ${b.status.toLowerCase()} para ${b.booking_date} às ${b.start}.`;
  const raw=b.whatsapp.replace(/\D/g,'');const destination=raw.length>=12&&raw.startsWith('55')?raw:`55${raw}`;
  return <article className={`appointment booking-${b.status==='Confirmado'?'confirmed':b.status==='Aguardando pagamento'?'pending':'other'}`}><div className="booking-time"><strong>{b.start}</strong><small>{b.end}</small></div><div className="booking-info"><span className="booking-status">{b.status}</span><h3>{b.client_name}</h3><p>{b.services.join(', ')}</p>{b.protocol&&<small>Protocolo: {b.protocol}</small>}<small>{b.professional_name}</small>{b.total_price!=null&&<p className="booking-money">Total {money(b.total_price)} · Sinal {money(b.deposit)} {b.paid?'recebido':'não registrado'}</p>}{b.segments.length>1&&<small>Trechos: {b.segments.map(s=>`${time(s.start)}–${time(s.end)}`).join(' / ')}</small>}</div><div className="booking-actions">{user.role==='CLIENT'&&b.status==='Aguardando pagamento'&&<button onClick={async()=>{try{const result=await send('/payments/checkout',{bookingId:b.id});window.location.assign(result.url);}catch(e){setNotice(e.message);showError(e.message);}}}>Pagar sinal</button>}{root&&b.status==='Confirmado'&&!b.paid&&<button onClick={()=>save(`/bookings/${b.id}/deposit`,{},'PATCH')}>Registrar sinal recebido</button>}{root&&b.status==='Aguardando pagamento'&&<button onClick={()=>save(`/bookings/${b.id}/status`,{status:'Confirmado',depositReceived:true},'PATCH')}>Confirmar sinal recebido</button>}{actions.map(status=><button key={status} onClick={()=>save(`/bookings/${b.id}/status`,{status},'PATCH')}>{status==='Confirmado'?'Confirmar manualmente':status}</button>)}{(admin||user.role==='EMPLOYEE')&&<a href={`https://wa.me/${destination}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer">WhatsApp ↗</a>}</div></article>;
}

export default function Admin() {
  const [user,setUser]=useState(null),[loading,setLoading]=useState(true),[bookings,setBookings]=useState([]),[workspace,setWorkspace]=useState(null),[tab,setTab]=useState('Agenda'),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const load=async who=>{setBookings(await api('/bookings'));if(['ROOT','ADMIN','MANAGER'].includes(who.role))setWorkspace(await api('/admin/workspace'));else if(who.role==='EMPLOYEE'){const catalog=await api('/catalog');setWorkspace({salon:catalog.salon,professionals:catalog.professionals.filter(p=>p.id===who.professionalId),blocks:[]});}};
  useEffect(()=>{api('/auth/me').then(async d=>{await load(d.user);setUser(d.user);}).catch(e=>{if(e.status!==401){setNotice(e.message);showError(e.message);}}).finally(()=>setLoading(false));},[]);
  const save=async(path,body,method='POST')=>{if((path.endsWith('/active')&&body.active===false)||body.status==='Cancelado'){if(!await confirmAction('Confirmar alteração?',body.status==='Cancelado'?'O atendimento será cancelado e o horário ficará livre para novas reservas.':'O registro será desativado para novos agendamentos.','Sim, confirmar'))return false;}setBusy(true);setNotice('');try{await send(path,body,method);await load(user);showSuccess(method==='DELETE'?'Removido com sucesso.':'Salvo com sucesso.');return true;}catch(e){setNotice(e.message);showError(e.message);if(e.status===401)setUser(null);return false;}finally{setBusy(false);}};
  useEffect(()=>{
    if(!user)return;
    let running=false,disposed=false;
    const refresh=async()=>{if(running||disposed||document.visibilityState==='hidden')return;running=true;try{await load(user);}catch(error){if(error.status===401&&!disposed)setUser(null);}finally{running=false;}};
    const timer=setInterval(refresh,15000);window.addEventListener('focus',refresh);window.addEventListener('storage',refresh);
    return()=>{disposed=true;clearInterval(timer);window.removeEventListener('focus',refresh);window.removeEventListener('storage',refresh);};
  },[user]);
  if(loading)return <div className="loading-screen">Carregando seu salão…</div>;
  if(!user)return <ManagerLogin notice={notice} onLogin={async who=>{setUser(who);setTab('Agenda');try{await load(who);}catch(e){setNotice(e.message);showError(e.message);}}}/>;
  const onLogout=async()=>{try{await send('/auth/logout',{});setUser(null);setWorkspace(null);setBookings([]);setTab('Agenda');}catch(e){setNotice(e.message);showError(e.message);}};
  const agenda=tab==='Agenda';
  return <DashboardShell user={user} tab={tab} setTab={t=>{setTab(t);setNotice('');}} workspace={workspace} bookings={bookings} onLogout={onLogout}>
    {!agenda&&<section className="dashboard-intro"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>{tab==='Funcionamento'?'Configurações':tab==='Bloqueios'?'Bloqueios de agenda':tab}</h1><p>Consulte registros e gerencie as informações do salão.</p></div></section>}
    <fieldset className="workspace-body" disabled={busy}>
    {agenda&&<AgendaView bookings={bookings} workspace={workspace} user={user} onNew={()=>setTab('Novo agendamento')} onTeam={()=>setTab('Equipe')} onRefresh={()=>load(user).catch(e=>{setNotice(e.message);showError(e.message);})} renderBooking={b=><BookingCard key={b.id} b={b} user={user} save={save} setNotice={setNotice}/>}/>}
    {['ROOT','ADMIN','MANAGER'].includes(user.role)&&tab==='Histórico'&&<BookingHistory bookings={bookings}/>} 
    {workspace&&tab==='Categorias'&&<Categories categories={workspace.categories||[]} services={workspace.services} save={save}/>} 
    {workspace&&tab==='Clientes'&&<ClientsView bookings={bookings}/>}
    {workspace&&tab==='Novo agendamento'&&<Manual workspace={workspace} save={save}/>}
    {workspace&&tab==='Serviços'&&<Services services={workspace.services} categories={workspace.categories||[]} save={save}/>}
    {workspace&&tab==='Equipe'&&<Team user={user} professionals={workspace.professionals} services={workspace.services} categories={workspace.categories||[]} save={save}/>}
    {workspace&&tab==='Funcionamento'&&<Settings salon={workspace.salon} save={save}/>}
    {workspace&&tab==='Bloqueios'&&<Blocks blocks={workspace.blocks} professionals={workspace.professionals} save={save}/>}
    {workspace&&['ROOT','ADMIN'].includes(user.role)&&tab==='Pagamentos'&&<section className="editor"><h2>Sinais e pagamentos</h2><button className="outline-button" onClick={()=>save('/admin/payments/reconcile',{})}>Conciliar pagamentos</button>{(workspace.paymentEvents||[]).filter(e=>e.status!=='Verificado'&&e.status!=='Informativo').map(e=><p key={e.id} className="notice">Notificação {e.event}: {e.status} · {e.error||'Verificação programada'}</p>)}<p>InfinitePay: {workspace.integrations.payments?'configurada':'aguardando credenciais no servidor'}. Webhook: {workspace.integrations.webhook?'habilitado':'desativado'}.</p>{workspace.payments.length?workspace.payments.map(p=><article className="appointment" key={p.id}><span>Reserva #{p.bookingId} · {money(p.amount/100)} · {p.status}</span><span>{p.reason}</span>{bookings.find(b=>b.id===p.bookingId)&&<a className="outline-button" href={`/?painel=agenda&data=${bookings.find(b=>b.id===p.bookingId).booking_date}&profissional=${bookings.find(b=>b.id===p.bookingId).professional_id}`}>Ver na agenda</a>}</article>):<p>Nenhuma cobrança criada.</p>}</section>}
    {workspace&&['ROOT','ADMIN'].includes(user.role)&&tab==='WhatsApp'&&<WhatsAppPanel workspace={workspace} save={save}/>}
  </fieldset></DashboardShell>;
}












