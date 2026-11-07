import {ensureProtocol} from './protocol.js';
import { prisma } from './db.js';
import { getSalon, dateString, phone } from './salon.js';
import { minutesToTime,localNow } from './scheduling.js';
import {metaConfigured,sendMetaTemplate,appointmentComponents} from './meta-whatsapp.js';
export const whatsappProvider=()=>process.env.WHATSAPP_PROVIDER==='meta'?'meta':'twilio';
export const notificationsConfigured = () => whatsappProvider()==='meta' ? metaConfigured()&&!!process.env.META_WHATSAPP_CONFIRMATION_TEMPLATE : process.env.TWILIO_ENABLED === 'true' && !!process.env.TWILIO_ACCOUNT_SID && !!process.env.TWILIO_AUTH_TOKEN && !!process.env.TWILIO_FROM && !!process.env.TWILIO_CONFIRMATION_SID && !!process.env.TWILIO_REMINDER_SID;
export async function queueConfirmation(db, booking, remindersOnly=false) {
  if(booking.status!=='Confirmado')return;
  booking.protocol=await ensureProtocol(db,booking);
  if (!notificationsConfigured() || !booking.whatsappConsent) return;
  const salon = await getSalon(db);
  const start = new Date(`${dateString(booking.bookingDate)}T${minutesToTime(booking.startMinute)}:00-05:00`);
  if (start <= new Date()) return;
  const body = `${salon.name}: atendimento de ${booking.clientName} confirmado para ${dateString(booking.bookingDate)} às ${minutesToTime(booking.startMinute)}. ${salon.address}`;
  const entries = remindersOnly?[]:[{ kind: 'confirmation-client', phone: phone(booking.whatsapp), scheduledAt: new Date() }];
  if (!remindersOnly&&salon.whatsapp) entries.push({ kind: 'confirmation-salon', phone: phone(salon.whatsapp), scheduledAt: new Date() });
  for(const hours of [24,2]){
    const scheduledAt=new Date(start.getTime()-hours*3600000);
    if(scheduledAt>new Date()&&(whatsappProvider()!=='meta'||process.env[`META_WHATSAPP_REMINDER_${hours}H_TEMPLATE`]))entries.push({kind:`reminder-${hours}h-client`,phone:phone(booking.whatsapp),scheduledAt});
  }  for (const entry of entries) await db.notification.upsert({ where: { bookingId_kind: { bookingId: booking.id, kind: entry.kind } }, update: {}, create: { bookingId: booking.id, body, ...entry } });
}
let dispatching=false;
export function scheduleNotificationDispatch(){
  if(dispatching||!notificationsConfigured())return;
  dispatching=true;
  setImmediate(async()=>{
    try{await processNotifications({includeReminders:process.env.REMINDERS_ENABLED==='true'});}
    catch{console.error('Não foi possível processar a fila de WhatsApp. Consulte o painel.');}
    finally{dispatching=false;}
  });
}
export async function processNotifications({includeReminders=true}={}) {
  if (!notificationsConfigured()) return { processed: 0, configured: false };
  if(includeReminders){const future=await prisma.booking.findMany({where:{status:'Confirmado',whatsappConsent:true,bookingDate:{gte:new Date(localNow().date+'T00:00:00Z')}},orderBy:{bookingDate:'asc'},take:500});for(const booking of future)await queueConfirmation(prisma,booking,true);}
  await prisma.notification.updateMany({ where: { status: 'Enviando', claimedAt: { lt: new Date(Date.now() - 60000) } }, data: { status: 'Inconclusiva', error: 'Envio interrompido; conferir no provedor antes de repetir.' } });
  let processed = 0;
  for (let index = 0; index < 3; index++) {
    const entry = await prisma.notification.findFirst({ where: { status: 'Na fila', scheduledAt: { lte: new Date() },...(includeReminders?{}:{kind:{notIn:['reminder-client','reminder-24h-client','reminder-2h-client']}}) }, orderBy: { scheduledAt: 'asc' }, include: { booking: {include:{professional:true}} } });
    if (!entry) break;
    const claimed = await prisma.notification.updateMany({ where: { id: entry.id, status: 'Na fila' }, data: { status: 'Enviando', claimedAt: new Date() } });
    if (!claimed.count) continue;
    if (entry.booking.status !== 'Confirmado' || !entry.booking.whatsappConsent) { await prisma.notification.update({ where: { id: entry.id }, data: { status: 'Cancelada' } }); continue; }
    const startAt=new Date(dateString(entry.booking.bookingDate)+'T'+minutesToTime(entry.booking.startMinute)+':00-05:00');
    if(startAt<=new Date()||(entry.kind==='reminder-24h-client'&&Date.now()>startAt.getTime()-2*3600000)){await prisma.notification.update({where:{id:entry.id},data:{status:'Cancelada',error:'Prazo do aviso encerrado.'}});continue;}
    try {
      if(whatsappProvider()==='meta'){
        const result=await sendMetaTemplate({to:entry.phone,name:entry.kind==='reminder-24h-client'?process.env.META_WHATSAPP_REMINDER_24H_TEMPLATE:entry.kind==='reminder-2h-client'?process.env.META_WHATSAPP_REMINDER_2H_TEMPLATE:entry.kind.startsWith('reminder')?process.env.META_WHATSAPP_REMINDER_TEMPLATE:process.env.META_WHATSAPP_CONFIRMATION_TEMPLATE,language:process.env.META_WHATSAPP_LANGUAGE||'pt_BR',components:appointmentComponents(entry.booking,entry.kind)});
        await prisma.notification.update({where:{id:entry.id},data:{status:result.status,sid:result.sid,error:null}});
        processed++;continue;
      }
      const to = entry.phone.startsWith('55') && entry.phone.length >= 12 ? entry.phone : `55${entry.phone}`;
      const contentSid = entry.kind.startsWith('reminder') ? process.env.TWILIO_REMINDER_SID : process.env.TWILIO_CONFIRMATION_SID;
      const payload = new URLSearchParams({ From: process.env.TWILIO_FROM, To: `whatsapp:+${to}`, ContentSid: contentSid, ContentVariables: JSON.stringify({ '1': entry.booking.clientName, '2': dateString(entry.booking.bookingDate), '3': minutesToTime(entry.booking.startMinute) }) });
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${process.env.TWILIO_ACCOUNT_SID}/Messages.json`, { method: 'POST', headers: { Authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload, signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      await prisma.notification.update({ where: { id: entry.id }, data: { status: response.ok && data.sid ? 'Aceita pelo Twilio' : response.status >= 500 ? 'Inconclusiva' : 'Falhou', sid: data.sid || null, error: response.ok ? null : 'Provedor não aceitou o envio. Confira as configurações e o número.' } });
    } catch(error) { await prisma.notification.update({ where: { id: entry.id }, data: { status: error.uncertain===false?'Falhou':'Inconclusiva', error: error.uncertain===false?error.message:'Resposta do provedor desconhecida. Não repetir automaticamente.' } }); }
    processed++;
  }
  return { processed, configured: true };
}




