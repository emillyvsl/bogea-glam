import assert from 'node:assert/strict';
import {encryptToken,digest,queueGoogleCalendar} from '../src/google-calendar.js';
import {processGoogleCalendar} from '../src/google-calendar-worker.js';
import {consumeOAuthState} from '../src/google-calendar-routes.js';

export async function checkGoogleCalendar(db){
  const previous={enabled:process.env.GOOGLE_CALENDAR_ENABLED,key:process.env.GOOGLE_TOKEN_ENCRYPTION_KEY};
  process.env.GOOGLE_CALENDAR_ENABLED='true';process.env.GOOGLE_TOKEN_ENCRYPTION_KEY='ab'.repeat(32);
  const professionals=[];let booking;
  try{
    for(let i=0;i<2;i++)professionals.push(await db.professional.create({data:{name:`Google fixture ${i}`,email:`google-${i}@example.test`}}));
    const connections=[];
    for(const p of professionals)connections.push(await db.googleCalendarConnection.create({data:{professionalId:p.id,googleAccountEmail:p.email,refreshTokenEncrypted:encryptToken('fake-token')}}));
    booking=await db.booking.create({data:{clientName:'Cliente teste Google',whatsapp:'68999999999',professionalId:professionals[0].id,serviceIds:[],serviceNames:['Escova'],bookingDate:new Date('2031-11-11'),startMinute:480,endMinute:540,totalMinutes:60,totalPrice:120,deposit:36,status:'Confirmado',paid:true,protocol:'BG-ABCDEFABCDEFABCDEFABCDEF'}});
    const events=new Map(),calls=[],code=value=>Object.assign(new Error('Simulated provider failure'),{code:value});let loseResponse=true,failPatch=false,holdInsert=null;
    const eventsFor=connection=>({
      get:async({eventId})=>{const data=events.get(`${connection.id}/${eventId}`);if(!data)throw code(404);return {data};},
      insert:async params=>{calls.push(['insert',connection.id,params]);const key=`${connection.id}/${params.requestBody.id}`;if(events.has(key))throw code(409);events.set(key,params.requestBody);if(holdInsert)await holdInsert();if(loseResponse){loseResponse=false;throw code(503);}return {data:params.requestBody};},
      patch:async params=>{calls.push(['patch',connection.id,params]);if(failPatch)throw code(503);events.set(`${connection.id}/${params.eventId}`,{...params.requestBody,id:params.eventId});return {data:params.requestBody};},
      delete:async params=>{calls.push(['delete',connection.id,params]);if(!events.delete(`${connection.id}/${params.eventId}`))throw code(410);return {};}
    });
    const run=()=>processGoogleCalendar({db,eventsFor,force:true});
    const job=()=>db.googleCalendarSync.findUnique({where:{bookingId:booking.id}});
    const queue=()=>queueGoogleCalendar(db,booking);
    await queue();await queue();assert.equal(await db.googleCalendarSync.count({where:{bookingId:booking.id}}),1);
    await run();assert.equal((await job()).status,'RETRY');assert.equal(events.size,1);assert.equal((await db.booking.findUnique({where:{id:booking.id}})).paid,true);
    await queue();await Promise.all([run(),run()]);assert.equal((await job()).status,'SYNCED');assert.equal(events.size,1);assert.equal(calls.filter(c=>c[0]==='insert').length,1);
    assert.equal(calls.filter(c=>c[0]==='patch').length,0,'Resposta perdida não deve reenviar o convite se o evento já está correto.');
    assert.deepEqual(calls.find(c=>c[0]==='insert')[2].requestBody.attendees,[]);
    booking=await db.booking.update({where:{id:booking.id},data:{clientEmail:'cliente@example.test',startMinute:600,endMinute:660}});
    await queue();await run();assert.equal(events.size,1);assert.equal([...events.values()][0].start.dateTime,'2031-11-11T10:00:00-05:00');assert.equal([...events.values()][0].attendees[0].email,'cliente@example.test');assert.equal(calls.at(-1)[2].sendUpdates,'all');
    booking=await db.booking.update({where:{id:booking.id},data:{professionalId:professionals[1].id}});
    await queue();await run();assert.equal(events.size,1);assert.equal(calls.at(-2)[0],'delete');assert.equal(calls.at(-2)[1],connections[0].id);assert.equal(calls.at(-1)[1],connections[1].id);
    booking=await db.booking.update({where:{id:booking.id},data:{status:'Cancelado'}});await queue();await run();assert.equal(events.size,0);assert.equal((await job()).status,'SKIPPED');
    // A cancellation arriving while Google responds must survive the old worker result.
    booking=await db.booking.update({where:{id:booking.id},data:{status:'Confirmado',professionalId:professionals[0].id}});
    holdInsert=async()=>{holdInsert=null;booking=await db.booking.update({where:{id:booking.id},data:{status:'Cancelado'}});await queue();};
    await queue();await run();assert.equal((await job()).status,'PENDING');await run();assert.equal(events.size,0);
    booking=await db.booking.update({where:{id:booking.id},data:{status:'Confirmado',professionalId:professionals[0].id}});await queue();await run();assert.equal(events.size,1);assert.equal((await job()).status,'SYNCED');
    // Recover an abandoned lease; Google remains authoritative only for the mirror.
    await db.googleCalendarSync.update({where:{bookingId:booking.id},data:{status:'PROCESSING',lease:'abandoned',claimedAt:new Date(Date.now()-180000),nextAttemptAt:new Date(0)}});await run();assert.equal((await job()).status,'SYNCED');assert.equal(events.size,1);
    failPatch=true;booking=await db.booking.update({where:{id:booking.id},data:{endMinute:720}});await queue();await run();assert.equal((await job()).status,'RETRY');assert.equal((await db.booking.findUnique({where:{id:booking.id}})).status,'Confirmado');failPatch=false;
    // Revoked/disconnected destinations never receive another write.
    await db.googleCalendarConnection.update({where:{id:connections[0].id},data:{status:'DISCONNECTED',refreshTokenEncrypted:null}});const count=calls.length;await queue();await run();assert.equal(calls.length,count);assert.equal((await job()).status,'SKIPPED');
    // Real database state checks: wrong user/session, expiry and replay are rejected.
    const state='cd'.repeat(32);const stateData={hash:digest(state),userId:1,professionalId:professionals[0].id,sessionHash:'s',expiresAt:new Date(Date.now()+60000)};
    await db.googleCalendarOAuthState.create({data:stateData});
    assert.equal(await consumeOAuthState(db,state,2,professionals[0].id,'s'),false);assert.equal(await consumeOAuthState(db,state,1,professionals[1].id,'s'),false);assert.equal(await consumeOAuthState(db,state,1,professionals[0].id,'other'),false);
    assert.equal(await consumeOAuthState(db,state,1,professionals[0].id,'s'),true);assert.equal(await consumeOAuthState(db,state,1,professionals[0].id,'s'),false);
    await db.googleCalendarOAuthState.create({data:{...stateData,expiresAt:new Date(0)}});assert.equal(await consumeOAuthState(db,state,1,professionals[0].id,'s'),false);
    console.log('OK: Google simulado — resposta perdida, duplicidade, convites opcionais, atualização, troca de profissional, cancelamento, recuperação de lease, falha independente e estado OAuth.');
  }finally{
    if(booking)await db.booking.delete({where:{id:booking.id}});
    await db.googleCalendarOAuthState.deleteMany({where:{professionalId:{in:professionals.map(p=>p.id)}}});
    await db.googleCalendarConnection.deleteMany({where:{professionalId:{in:professionals.map(p=>p.id)}}});
    await db.professional.deleteMany({where:{id:{in:professionals.map(p=>p.id)}}});
    for(const [key,value] of [['GOOGLE_CALENDAR_ENABLED',previous.enabled],['GOOGLE_TOKEN_ENCRYPTION_KEY',previous.key]]){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  }
}
