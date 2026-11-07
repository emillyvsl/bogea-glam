export const metaConfigured=()=>process.env.META_WHATSAPP_ENABLED==='true'&&!!process.env.META_WHATSAPP_TOKEN&&/^\d+$/.test(process.env.META_WHATSAPP_PHONE_NUMBER_ID||'')&&/^v\d+\.\d+$/.test(process.env.META_WHATSAPP_API_VERSION||'v25.0');
export function internationalPhone(value){
  const digits=String(value||'').replace(/\D/g,'');
  const to=digits.length===10||digits.length===11?`55${digits}`:digits;
  if(!/^[1-9]\d{10,14}$/.test(to)){const error=new Error('Informe o telefone com DDD ou DDI e DDD.');error.status=400;throw error;}
  return to;
}
function metaError(data,status){
  const code=data?.error?.code;
  const messages={190:'O token da Meta está expirado ou inválido. Gere outro e atualize META_WHATSAPP_TOKEN no servidor.',131030:'O destinatário não está autorizado no número de teste da Meta. Adicione e confirme o número no painel da Meta.',132001:'O modelo ou idioma não está disponível nessa conta da Meta.',132000:'Os parâmetros enviados não correspondem ao modelo da Meta.'};
  const safe=String(data?.error?.message||'A Meta não aceitou o envio.').replaceAll(process.env.META_WHATSAPP_TOKEN||'__missing_token__','[oculto]').slice(0,300);
  const error=new Error(`${messages[code]||safe}${code?` (Meta ${code})`:''}`);
  error.status=502;error.uncertain=status>=500;error.providerCode=code;return error;
}
export async function sendMetaTemplate({to,name,language='pt_BR',components},fetcher=fetch){
  if(!metaConfigured()){const error=new Error('Configure e ative o WhatsApp da Meta no servidor.');error.status=503;throw error;}
  if(!/^[a-z0-9_]+$/.test(name||'')||!/^\w+$/.test(language)){const error=new Error('Modelo ou idioma inválido.');error.status=400;throw error;}
  const payload={messaging_product:'whatsapp',to:internationalPhone(to),type:'template',template:{name,language:{code:language},...(components?.length?{components}:{})}};
  let response,data;
  try{
    response=await fetcher(`https://graph.facebook.com/${process.env.META_WHATSAPP_API_VERSION||'v25.0'}/${process.env.META_WHATSAPP_PHONE_NUMBER_ID}/messages`,{method:'POST',headers:{Authorization:`Bearer ${process.env.META_WHATSAPP_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
    data=await response.json();
  }catch{const error=new Error('Resposta da Meta desconhecida. Confira no provedor antes de repetir o envio.');error.status=502;error.uncertain=true;throw error;}
  if(!response.ok||data.error)throw metaError(data,response.status);
  const sid=data.messages?.[0]?.id;
  if(!sid){const error=new Error('A Meta não retornou o identificador da mensagem. Confira antes de repetir.');error.status=502;error.uncertain=true;throw error;}
  return {sid,status:'Aceita pela Meta'};
}
export function metaTestMessage(to){
  const name=process.env.META_WHATSAPP_TEST_TEMPLATE||'hello_world';
  const language=process.env.META_WHATSAPP_TEST_LANGUAGE||'en_US';
  const components=name==='jaspers_market_order_confirmation_v1'?[{type:'body',parameters:[
    {type:'text',text:'Teste Bogéa Glam'},
    {type:'text',text:'TESTE-SEM-PEDIDO'},
    {type:'text',text:new Intl.DateTimeFormat('pt-BR',{timeZone:'America/Rio_Branco'}).format(new Date())}
  ]}]:undefined;
  return {to,name,language,components};
}
export function appointmentComponents(booking,kind){
  const fields=(kind==='reminder-24h-client'?(process.env.META_WHATSAPP_REMINDER_24H_FIELDS||'clientName,time'):kind==='reminder-2h-client'?(process.env.META_WHATSAPP_REMINDER_2H_FIELDS||'clientName,time'):kind.startsWith('reminder')?process.env.META_WHATSAPP_REMINDER_FIELDS:process.env.META_WHATSAPP_CONFIRMATION_FIELDS)??'clientName,date,time';
  if(!fields.trim())return [];
  const date=booking.bookingDate.toISOString().slice(0,10).split('-').reverse().join('/');
  const time=`${String(Math.floor(booking.startMinute/60)).padStart(2,'0')}:${String(booking.startMinute%60).padStart(2,'0')}`;
  const end=Number.isInteger(booking.endMinute)?`${String(Math.floor(booking.endMinute/60)).padStart(2,'0')}:${String(booking.endMinute%60).padStart(2,'0')}`:time;
  const currency=value=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value);
  const deposit=Number(booking.deposit||0),total=Number(booking.totalPrice||0);
  const values={protocol:booking.protocol||'Sem protocolo',consultUrl:(process.env.APP_ORIGIN||'http://localhost:5173').replace(/\/$/,'')+'/consultar',clientName:booking.clientName,date,time,bookingReference:`Agendamento Bogéa Glam #${booking.id} — ${booking.paid?'sinal recebido':'sinal não registrado'}`,appointmentDateTime:`${date} às ${time}`,services:booking.serviceNames?.join(', ')||'Serviço agendado',professionalName:booking.professional?.name||'Profissional do salão',timeRange:`${time} às ${end}`,depositStatus:booking.paid?`${currency(deposit)} recebido`:`${currency(deposit)} não registrado`,remaining:currency(total-(booking.paid?deposit:0))};
  return [{type:'body',parameters:fields.split(',').map(field=>{if(!(field.trim() in values))throw new Error('Confira os campos do modelo de agendamento da Meta.');return {type:'text',text:values[field.trim()]};})}];
}



