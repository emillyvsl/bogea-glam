import {randomUUID} from 'node:crypto';
import {prisma} from './db.js';
import {localNow} from './scheduling.js';
import {calendarClient,calendarBookingActive,bookingEvent,eventFingerprint,eventId,googleConfigured,safeGoogleError} from './google-calendar.js';

const absent=error=>[404,410].includes(Number(error.code||error.response?.status));
const requestOptions={timeout:20000,retry:false};
export async function processGoogleCalendar({db=prisma,eventsFor=calendarClient,force=false}={}){
  if(!force&&!googleConfigured())return;
  const now=new Date(),stale=new Date(now-120000);
  const salon=await db.salon.findUnique({where:{id:1}})||{};
  // Reconcile source changes too (including reassignment); PostgreSQL is authoritative.
  const sources=await db.booking.findMany({where:{OR:[{status:{in:['Confirmado','Em atendimento']},bookingDate:{gte:new Date(localNow(now).date+'T00:00:00Z')}},{googleSync:{isNot:null}}]},include:{professional:true,googleSync:true}});
  for(const b of sources){
    const connected=b.professionalId&&await db.googleCalendarConnection.findFirst({where:{professionalId:b.professionalId,status:'CONNECTED'}});
    if(!b.googleSync){if(connected&&calendarBookingActive(b))await db.googleCalendarSync.upsert({where:{bookingId:b.id},create:{bookingId:b.id},update:{}});continue;}
    const changed=calendarBookingActive(b)?connected&&(b.googleSync.connectionId!==connected.id||b.googleSync.fingerprint!==eventFingerprint(b,salon)):!!b.googleSync.googleEventId;
    if(changed&&['SYNCED','SKIPPED'].includes(b.googleSync.status))await db.googleCalendarSync.update({where:{id:b.googleSync.id},data:{status:'PENDING',revision:{increment:1},nextAttemptAt:now}});
  }
  const jobs=await db.googleCalendarSync.findMany({where:{nextAttemptAt:{lte:now},OR:[{status:'PENDING'},{status:'RETRY'},{status:'PROCESSING',claimedAt:{lt:stale}}]},take:25,orderBy:{nextAttemptAt:'asc'}});
  for(const job of jobs){
    const lease=randomUUID();
    const claim=await db.googleCalendarSync.updateMany({where:{id:job.id,revision:job.revision,status:job.status,OR:[{lease:null},{claimedAt:{lt:stale}}]},data:{lease,claimedAt:now,status:'PROCESSING'}});
    if(!claim.count)continue;
    const owned={id:job.id,lease};
    const finish=async data=>{
      const result=await db.googleCalendarSync.updateMany({where:{...owned,revision:job.revision},data:{...data,lease:null,claimedAt:null}});
      if(!result.count)await db.googleCalendarSync.updateMany({where:owned,data:{lease:null,claimedAt:null,status:'PENDING'}});
    };
    try{
      const booking=await db.booking.findUnique({where:{id:job.bookingId},include:{professional:true}});
      const destination=calendarBookingActive(booking)&&booking.professional?.active?await db.googleCalendarConnection.findFirst({where:{professionalId:booking.professionalId,status:'CONNECTED'}}):null;
      // Always delete from the original destination, even after a professional change.
      if(job.googleEventId&&(!destination||job.connectionId!==destination.id||job.calendarId!==destination.calendarId)){
        const previous=await db.googleCalendarConnection.findUnique({where:{id:job.connectionId}});
        if(!previous?.refreshTokenEncrypted||previous.status!=='CONNECTED'){
          await finish({status:'SKIPPED',lastError:'A agenda original foi desconectada. Reconecte a mesma conta para atualizar ou remover o evento.'});continue;
        }
        try{await eventsFor(previous).delete({calendarId:job.calendarId,eventId:job.googleEventId,sendUpdates:'all'},requestOptions);}catch(error){if(!absent(error))throw error;}
        // Save the deletion before creating elsewhere so crashes can resume safely.
        await db.googleCalendarSync.updateMany({where:owned,data:{googleEventId:null,connectionId:null,calendarId:null,fingerprint:null,generation:{increment:1}}});
        job.googleEventId=null;
        job.generation++;
      }
      if(!destination){await finish({status:'SKIPPED',lastError:calendarBookingActive(booking)?'Profissional sem Google Agenda conectado.':null});continue;}
      const id=eventId(booking.id,destination,job.generation),body=bookingEvent(booking,salon),fingerprint=eventFingerprint(booking,salon);
      body.extendedProperties.private.bogeaFingerprint=fingerprint;
      // Persist intent BEFORE insert: a cancellation/reassignment can recover a lost response.
      await db.googleCalendarSync.updateMany({where:owned,data:{connectionId:destination.id,calendarId:destination.calendarId,googleEventId:id}});
      const events=eventsFor(destination),params={calendarId:destination.calendarId,eventId:id};
      let existing;
      try{existing=(await events.get(params,requestOptions)).data;}catch(error){if(!absent(error))throw error;}
      if(existing){
        if(existing.extendedProperties?.private?.bogeaBooking!==String(booking.id))throw new Error('Event ownership mismatch');
        if(existing.extendedProperties?.private?.bogeaFingerprint!==fingerprint)await events.patch({...params,sendUpdates:'all',requestBody:body},requestOptions);
      }else{
        try{await events.insert({calendarId:destination.calendarId,sendUpdates:'all',requestBody:{...body,id}},requestOptions);}
        catch(error){if(Number(error.code||error.response?.status)!==409)throw error;
          const found=(await events.get(params,requestOptions)).data;
          if(found.extendedProperties?.private?.bogeaBooking!==String(booking.id))throw new Error('Event ownership mismatch');
          await events.patch({...params,sendUpdates:'all',requestBody:body},requestOptions);
        }
      }
      await finish({status:'SYNCED',fingerprint,syncedAt:new Date(),lastError:null,attempts:0});
    }catch(error){
      const attempts=job.attempts+1;
      await finish({status:'RETRY',attempts,lastError:safeGoogleError(error),nextAttemptAt:new Date(Date.now()+Math.min(3600000,30000*2**Math.min(attempts,7)))});
    }
  }
}
