import React,{useState} from 'react';
import {send} from './api';
import {showError,showSuccess} from './alerts';
export default function WhatsAppPanel({workspace,save}){
  const [phone,setPhone]=useState(''),[busy,setBusy]=useState(false),[result,setResult]=useState('');
  const meta=workspace.integrations.whatsappProvider==='meta';
  const test=async event=>{
    event.preventDefault();setBusy(true);setResult('');
    try{const data=await send('/admin/notifications/test',{phone});setResult(data.message);showSuccess('Solicitação aceita pela Meta.');}
    catch(error){setResult(error.message);showError(error.message);}
    finally{setBusy(false);}
  };
  return <section className="editor"><h2>Confirmações e lembretes</h2>{workspace.confirmationDraft&&<section className="final-whatsapp-preview"><h3>Modelo para o cliente final</h3><p>Exemplo em português. O modelo <strong>{workspace.confirmationDraft.name}</strong> precisa ser cadastrado e aprovado na Meta antes de ser ativado para envio.</p><pre>{workspace.confirmationDraft.text}</pre><small>Os dados serão preenchidos com o atendimento e os valores reais.</small></section>}{workspace.integrations.whatsappDemo&&<p className="manual-whatsapp-demo">Modo de teste: as confirmações usam o modelo de demonstração em inglês da Meta.</p>}<p>Integração selecionada: <strong>{meta?'WhatsApp da Meta':'Twilio'}</strong>. Confirmações automáticas: {workspace.integrations.whatsapp?'configuradas':'aguardando credenciais e modelo de confirmação'}. Executor periódico: {workspace.integrations.reminders?'ativado enquanto o servidor estiver rodando':'desativado'}.</p>{meta&&<form className="whatsapp-test-form" onSubmit={test}><h3>Enviar mensagem de teste</h3><p>O número precisa estar autorizado no painel da Meta ao usar um remetente de teste. A aceitação pela API não comprova entrega ou leitura.</p><label>WhatsApp de destino<input type="tel" required value={phone} onChange={e=>setPhone(e.target.value)} placeholder="DDD + número ou DDI + DDD + número"/></label><button className="gold-button" disabled={busy}>{busy?'Enviando…':'Enviar teste pela Meta'}</button>{result&&<p role="status">{result}</p>}</form>}<p>Links manuais abrem uma conversa; você ainda precisa enviar a mensagem.</p><button className="outline-button" onClick={()=>save('/admin/notifications/run',{})}>Processar fila agora</button>{workspace.notifications.map(n=><article className="appointment" key={n.id}><span>#{n.bookingId} · {n.kind} · {n.status}<small>{new Date(n.scheduledAt).toLocaleString('pt-BR',{timeZone:'America/Rio_Branco'})}</small></span><span>{n.error||n.sid}</span></article>)}</section>;
}
