import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';
import {google} from 'googleapis';

export const googleEnabled=()=>process.env.GOOGLE_CALENDAR_ENABLED==='true';
function encryptionKey(){
  const value=process.env.GOOGLE_TOKEN_ENCRYPTION_KEY||'';
  if(!/^[a-f0-9]{64}$/i.test(value))throw new Error('Configure GOOGLE_TOKEN_ENCRYPTION_KEY com 64 caracteres hexadecimais (32 bytes).');
  return Buffer.from(value,'hex');
}
export function googleConfigured(){return googleEnabled()&&!!process.env.GOOGLE_CLIENT_ID&&!!process.env.GOOGLE_CLIENT_SECRET&&!!process.env.GOOGLE_REDIRECT_URI&&/^[a-f0-9]{64}$/i.test(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY||'');}
export function encryptToken(token){
  const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',encryptionKey(),iv);
  const content=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
  return ['v1',iv.toString('base64'),cipher.getAuthTag().toString('base64'),content.toString('base64')].join('.');
}
export function decryptToken(value){
  const [version,iv,tag,content]=String(value).split('.');
  if(version!=='v1'||!iv||!tag||!content)throw new Error('Token Google inválido. Reconecte a conta.');
  const decipher=createDecipheriv('aes-256-gcm',encryptionKey(),Buffer.from(iv,'base64'));
  decipher.setAuthTag(Buffer.from(tag,'base64'));
  return Buffer.concat([decipher.update(Buffer.from(content,'base64')),decipher.final()]).toString('utf8');
}
export const digest=value=>createHash('sha256').update(value).digest('hex');
export const eventId=(bookingId,connection,generation=0)=>digest(`bogea:${bookingId}:${connection.id}:${connection.calendarId}:${generation}`);
export function createOAuthClient(){return new google.auth.OAuth2({clientId:process.env.GOOGLE_CLIENT_ID,clientSecret:process.env.GOOGLE_CLIENT_SECRET,redirectUri:process.env.GOOGLE_REDIRECT_URI,transporterOptions:{timeout:20000}});}
export function authorizationUrl(state){return createOAuthClient().generateAuthUrl({access_type:'offline',prompt:'consent',scope:['https://www.googleapis.com/auth/calendar.events','openid','email'],state});}
export function calendarClient(connection){
  const auth=createOAuthClient();auth.setCredentials({refresh_token:decryptToken(connection.refreshTokenEncrypted)});
  return google.calendar({version:'v3',auth}).events;
}
export function bookingEvent(booking){
  const date=booking.bookingDate.toISOString().slice(0,10);
  const instant=minute=>`${date}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}:00-05:00`;
  return {summary:`Bogéa Glam — ${booking.serviceNames.join(', ')}`,
    description:`Cliente: ${booking.clientName}\nWhatsApp: ${booking.whatsapp}\nProtocolo: ${booking.protocol||`Reserva #${booking.id}`}\nProfissional: ${booking.professional?.name||''}`,
    start:{dateTime:instant(booking.startMinute),timeZone:'America/Rio_Branco'},end:{dateTime:instant(booking.endMinute),timeZone:'America/Rio_Branco'},
    attendees:booking.clientEmail?[{email:booking.clientEmail}]:[],guestsCanModify:false,guestsCanInviteOthers:false,visibility:'private',
    extendedProperties:{private:{bogeaBooking:String(booking.id)}}};
}
export const eventFingerprint=booking=>digest(JSON.stringify({professionalId:booking.professionalId,event:bookingEvent(booking)}));
export const calendarBookingActive=b=>['Confirmado','Em atendimento','Concluído'].includes(b.status);
// Persist only. No Google request is made inside a payment/booking transaction.
export async function queueGoogleCalendar(db,booking){
  if(!googleEnabled())return;
  await db.googleCalendarSync.upsert({where:{bookingId:booking.id},create:{bookingId:booking.id},update:{revision:{increment:1},status:'PENDING',nextAttemptAt:new Date(),attempts:0,lastError:null}});
}
export function safeGoogleError(error){
  const code=error.response?.data?.error==='invalid_grant'?'invalid_grant':error.code||error.response?.status;
  if(code==='invalid_grant'||code===401)return 'Autorização Google expirada ou revogada. Reconecte a conta.';
  if(code===403)return 'Google recusou o acesso. Confira a permissão da agenda e a API no Google Cloud.';
  return 'Não foi possível sincronizar com o Google. Uma nova tentativa será realizada.';
}
