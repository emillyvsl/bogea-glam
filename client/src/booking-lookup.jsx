import React,{useState} from 'react';
import {Search,ClipboardCheck} from 'lucide-react';
import {send} from './api';
export default function BookingLookup(){
 const [protocol,setProtocol]=useState(()=>new URLSearchParams(window.location.hash.slice(1)).get('protocolo')||''),[result,setResult]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 return <section className="booking-lookup" id="consultar" aria-labelledby="lookup-title"><div><p className="eyebrow">ACOMPANHE SEU MOMENTO</p><h2 id="lookup-title">Consultar agendamento</h2><p>Informe o protocolo da sua confirmação para consultar a situação do atendimento. Guarde esse código com você.</p></div><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');setResult(null);try{setResult(await send('/bookings/lookup',{protocol}));}catch(err){setError(err.message);}finally{setBusy(false);}}}><label>Protocolo<input required maxLength={40} autoComplete="off" spellCheck={false} value={protocol} onChange={e=>setProtocol(e.target.value)} placeholder="BG-…"/></label><button disabled={busy} type="submit"><Search size={17}/>{busy?'Consultando…':'Consultar'}</button></form>{error&&<p className="lookup-error" role="alert">{error}</p>}{result&&<div className="lookup-result" role="status"><ClipboardCheck size={24}/><div><strong>{result.status}</strong><p>{result.services.join(', ')}</p><p>{result.date.split('-').reverse().join('/')} · {result.start}–{result.end}</p><p>{result.professional}</p><small>Protocolo: {result.protocol}</small></div></div>}</section>;
}

