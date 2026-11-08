import React,{useEffect,useState} from 'react';
import {CalendarDays,Link,Unplug,RefreshCw} from 'lucide-react';
import {api,send} from './api';
import {showError,confirmAction} from './alerts';

const labels={SYNCED:'Sincronizado',PENDING:'Na fila',PROCESSING:'Sincronizando',RETRY:'Nova tentativa programada',SKIPPED:'Sem sincronização'};
export default function GoogleCalendarSettings({user}){
  const [data,setData]=useState(null),[overview,setOverview]=useState(null),[busy,setBusy]=useState(false);
  const management=['ROOT','ADMIN','MANAGER'].includes(user.role);
  const oauthResult=new URLSearchParams(window.location.search).get('google');
  async function load(){setData(await api('/google-calendar/status'));if(management)setOverview(await api('/admin/google-calendar'));}
  useEffect(()=>{load().catch(e=>showError(e.message));const timer=setInterval(()=>load().catch(()=>{}),30000);return()=>clearInterval(timer);},[]);
  async function action(work){setBusy(true);try{await work();await load();}catch(e){showError(e.message);}finally{setBusy(false);}}
  if(!data)return <section className="editor">Carregando Google Agenda…</section>;
  return <section className="editor google-settings"><div className="google-settings-heading"><CalendarDays size={30}/><div><h2>Google Agenda</h2><p>Seus atendimentos confirmados na sua agenda Google.</p></div></div>
    {oauthResult==='connected'&&<p role="status">Google Agenda conectado. Os próximos atendimentos confirmados serão sincronizados.</p>}
    {oauthResult==='error'&&<p className="notice" role="alert">Não foi possível conectar. Autorize o acesso à agenda e tente novamente com a mesma conta já vinculada, se houver.</p>}
    {!data.enabled||!data.configured?<p className="notice">A integração aguarda configuração e ativação no servidor.</p>:null}
    {!data.professionalId?<p>Este usuário ainda não está vinculado a um profissional. Faça o vínculo na aba Equipe para conectar uma agenda.</p>:<>
      <div className="google-connection"><strong>{data.connection?.googleAccountEmail||'Nenhuma conta conectada'}</strong><span>{data.connection?'Conectada':'Desconectada'}</span></div>
      <p>Agendamentos confirmados serão enviados automaticamente. Clientes que informarem e-mail receberão um convite.</p>
      <div className="google-actions"><button className="primary-button" disabled={busy||!data.configured} onClick={()=>action(async()=>{const result=await send('/google-calendar/connect',{});window.location.assign(result.url);})}><Link size={17}/>{data.connection?'Reconectar Google Agenda':'Conectar Google Agenda'}</button>
      {data.connection&&<button className="outline-button" disabled={busy} onClick={()=>action(async()=>{if(await confirmAction('Desconectar Google Agenda?','Novos atendimentos deixarão de ser enviados. Eventos já enviados permanecem no Google e precisam ser removidos por você.','Desconectar'))await send('/google-calendar/disconnect',{},'DELETE');})}><Unplug size={17}/>Desconectar</button>}</div>
      {!!data.syncs.length&&<div className="google-sync-list"><h3>Sincronizações recentes</h3>{data.syncs.map(s=><article key={s.bookingId}><strong>Reserva #{s.bookingId}</strong><span>{labels[s.status]||s.status}</span>{s.lastError&&<p>{s.lastError}</p>}</article>)}</div>}
    </>}
    {management&&overview&&<div className="google-sync-list"><h3>Agendas da equipe</h3>{overview.professionals.map(p=><article key={p.id}><strong>{p.name}</strong><span>{p.googleConnections[0]?.googleAccountEmail||'Desconectada'}</span></article>)}{!!overview.syncs.length&&<h3>Sincronizações pendentes</h3>}{overview.syncs.map(s=><article key={s.bookingId}><strong>Reserva #{s.bookingId}</strong><span>{labels[s.status]||s.status}</span>{s.lastError&&<p>{s.lastError}</p>}<button className="outline-button" disabled={busy||!data.configured} onClick={()=>action(()=>send(`/admin/google-calendar/retry/${s.bookingId}`,{}))}><RefreshCw size={15}/>Tentar novamente</button></article>)}</div>}
  </section>;
}
