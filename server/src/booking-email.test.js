import {test} from 'node:test';
import assert from 'node:assert/strict';
import {confirmationEmail,sendResendEmail} from './booking-email.js';

test('Confirmation email escapes client data, formats dates and separates payment from confirmation',()=>{
  const b={id:1,clientName:'Maria <script>alert(1)</script>',clientEmail:'cliente@example.test',protocol:'BG-ABCDEF',serviceNames:['Escova','Corte'],bookingDate:new Date('2026-11-12'),startMinute:840,endMinute:1020,paid:true};
  const payload=confirmationEmail(b,{}, {name:'Vitória Bogéa'});
  assert.ok(payload.html.includes('&lt;script&gt;'));assert.ok(!payload.html.includes('<script>'));assert.ok(payload.html.includes('12 de novembro de 2026'));assert.ok(payload.html.includes('14:00 às 17:00'));assert.ok(payload.html.includes('Mensagem automática'));assert.ok(payload.html.includes('Por favor, não responda'));assert.ok(payload.html.includes('#protocolo=BG-ABCDEF'));assert.ok(payload.html.includes('Pagamento do sinal confirmado'));
  assert.ok(!confirmationEmail({...b,paid:false}).html.includes('Seu sinal foi recebido'));
  assert.deepEqual(payload.to,['cliente@example.test']);
});
test('Resend uses server credentials and stable idempotency headers; errors omit provider secrets',async()=>{
  const previous=process.env.RESEND_API_KEY;process.env.RESEND_API_KEY='test-only';
  try{
    const id=await sendResendEmail({subject:'Teste'},'booking/test',async(url,options)=>{assert.equal(url,'https://api.resend.com/emails');assert.equal(options.headers.Authorization,'Bearer test-only');assert.equal(options.headers['Idempotency-Key'],'booking/test');assert.ok(!options.body.includes('test-only'));return new Response(JSON.stringify({id:'email-test'}));});assert.equal(id,'email-test');
    await assert.rejects(()=>sendResendEmail({},'booking/test',async()=>new Response(JSON.stringify({message:'SECRET'}),{status:403})),error=>error.permanent&&!error.message.includes('SECRET'));
  }finally{if(previous===undefined)delete process.env.RESEND_API_KEY;else process.env.RESEND_API_KEY=previous;}
});
