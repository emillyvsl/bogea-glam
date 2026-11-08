import assert from 'node:assert/strict';
import {queueBookingEmail,processBookingEmails} from '../src/booking-email.js';
export async function checkBookingEmail(db){
  const keys=['EMAIL_ENABLED','RESEND_API_KEY','EMAIL_FROM'],old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
  process.env.EMAIL_ENABLED='true';process.env.RESEND_API_KEY='test-only';process.env.EMAIL_FROM='Bogéa Glam <agenda@example.test>';
  let booking;
  try{
    booking=await db.booking.create({data:{clientName:'Cliente de teste',clientEmail:'cliente@example.test',whatsapp:'68999999999',serviceIds:[],serviceNames:['Escova'],bookingDate:new Date('2031-11-11'),startMinute:480,endMinute:540,totalMinutes:60,totalPrice:120,deposit:36,status:'Confirmado',paid:true,protocol:'BG-123456123456123456123456'}});
    await queueBookingEmail(db,{...booking,clientEmail:null});assert.equal(await db.bookingEmail.count({where:{bookingId:booking.id}}),0);
    await queueBookingEmail(db,booking);await queueBookingEmail(db,booking);assert.equal(await db.bookingEmail.count({where:{bookingId:booking.id}}),1);
    let calls=0;const seen=new Set(),keysUsed=[];
    const sender=async(payload,key)=>{calls++;keysUsed.push(key);assert.deepEqual(payload.to,['cliente@example.test']);seen.add(key);if(calls===1)throw new Error('Lost response');return 'email-mocked';};
    await processBookingEmails({db,sendEmail:sender});assert.equal((await db.bookingEmail.findUnique({where:{bookingId:booking.id}})).status,'RETRY');assert.equal((await db.booking.findUnique({where:{id:booking.id}})).paid,true);
    await db.bookingEmail.update({where:{bookingId:booking.id},data:{nextAttemptAt:new Date(0)}});
    await Promise.all([processBookingEmails({db,sendEmail:sender}),processBookingEmails({db,sendEmail:sender})]);
    const saved=await db.bookingEmail.findUnique({where:{bookingId:booking.id}});assert.equal(saved.status,'SENT');assert.equal(saved.providerId,'email-mocked');assert.equal(seen.size,1);assert.equal(keysUsed[0],keysUsed[1]);
    await queueBookingEmail(db,booking);await processBookingEmails({db,sendEmail:sender});assert.equal(calls,2);
    await db.bookingEmail.update({where:{bookingId:booking.id},data:{status:'RETRY',firstAttemptAt:new Date(Date.now()-24*3600000),nextAttemptAt:new Date(0)}});await processBookingEmails({db,sendEmail:sender});assert.equal((await db.bookingEmail.findUnique({where:{bookingId:booking.id}})).status,'REVIEW');assert.equal(calls,2);
    await db.bookingEmail.update({where:{bookingId:booking.id},data:{status:'PENDING',nextAttemptAt:new Date(0)}});await db.booking.update({where:{id:booking.id},data:{status:'Cancelado'}});await processBookingEmails({db,sendEmail:sender});assert.equal((await db.bookingEmail.findUnique({where:{bookingId:booking.id}})).status,'CANCELLED');assert.equal(calls,2);
    console.log('OK: Resend simulado — fila única, destinatário opcional, falha independente, concorrência, idempotência, prazo de recuperação e cancelamento.');
  }finally{if(booking)await db.booking.delete({where:{id:booking.id}});for(const k of keys){if(old[k]===undefined)delete process.env[k];else process.env[k]=old[k];}}
}
