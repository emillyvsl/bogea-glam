import { strict as assert } from 'node:assert';
import { readFile,unlink } from 'node:fs/promises';
import path from 'node:path';
export async function checkWorkflow(env) {
  const { app } = await import('../src/app.js');
  const { prisma } = await import('../src/db.js');
  const server = app.listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  const base=`http://127.0.0.1:${server.address().port}/api`;
  const realFetch=globalThis.fetch;
  const metaKeys=['WHATSAPP_PROVIDER','META_WHATSAPP_ENABLED','META_WHATSAPP_TOKEN','META_WHATSAPP_PHONE_NUMBER_ID','META_WHATSAPP_CONFIRMATION_TEMPLATE','META_WHATSAPP_REMINDER_TEMPLATE','META_WHATSAPP_LANGUAGE'];
  const oldMeta=Object.fromEntries(metaKeys.map(key=>[key,process.env[key]]));
  const metaTemplates=[];
  const uploadedFiles=[];
  let paidAmount=3600;
  let linkMode='ok',linkCalls=0,lastLinkPayload=null;
  process.env.INFINITEPAY_HANDLE='test'; process.env.INFINITEPAY_API_KEY='test-only';
  globalThis.fetch=async(url,options)=>{
    if(String(url).startsWith('https://graph.facebook.com/')){
      metaTemplates.push(JSON.parse(options.body).template.name);
      return new Response(JSON.stringify({messages:[{id:`wamid.test-${metaTemplates.length}`}]}));
    }
    if(String(url)==='https://api.checkout.infinitepay.io/links'){
      linkCalls++;lastLinkPayload=JSON.parse(options.body);
      await new Promise(resolve=>setTimeout(resolve,40));
      if(linkMode==='timeout')throw new Error('Resposta desconhecida simulada');
      return new Response(JSON.stringify({url:'https://buy.infinitepay.io/test'}));
    }
    if(String(url)==='https://api.checkout.infinitepay.io/payment_check')return new Response(JSON.stringify({success:true,paid:true,amount:paidAmount,paid_amount:paidAmount+10}));
    return realFetch(url,options);
  };
  const request=async(path,body,cookie,method=body?'POST':'GET')=>{
    const response=await fetch(`${base}${path}`,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    const admin=await request('/auth/login',{email:env.ADMIN_EMAIL,password:env.ADMIN_PASSWORD});assert.equal(admin.status,200);
    let ws=(await request('/admin/workspace',null,admin.cookie)).data;
    const professional=ws.professionals[0], service=ws.services.find(s=>s.name==='Escova');
    const team=await request('/admin/professionals',{...professional,password:'staff-test-password',hours:null,serviceIds:[service.id],allServices:false},admin.cookie);assert.equal(team.status,200,JSON.stringify(team.data));
    const guest=await request('/auth/guest',{name:'Visitante completo',whatsapp:'(68) 99999-9999'});assert.equal(guest.status,200);assert.equal(guest.data.user.role,'CLIENT');
    assert.equal((await request('/auth/booking-session',null,guest.cookie)).status,200);
    assert.equal((await request('/admin/workspace',null,guest.cookie)).status,401);
    assert.equal((await request('/auth/guest',{name:'A',whatsapp:'123'})).status,400);
    const staff=await request('/auth/login',{email:professional.email,password:'staff-test-password'});assert.equal(staff.status,200);
    const roleProfessional=await request('/admin/professionals',{name:'Gestor teste',email:'gestor-role@example.test',password:'manager-test-password',active:true,allServices:true,serviceIds:[],hours:null,role:'MANAGER'},admin.cookie);assert.equal(roleProfessional.status,200);
    const managerLogin=await request('/auth/login',{email:'gestor-role@example.test',password:'manager-test-password'});assert.equal(managerLogin.data.user.role,'MANAGER');
    assert.equal((await request('/admin/professionals',{name:'Escalada',email:'blocked-root@example.test',password:'manager-test-password',active:true,allServices:true,serviceIds:[],hours:null,role:'ROOT'},managerLogin.cookie)).status,403);
    assert.equal((await request('/admin/professionals',{...roleProfessional.data,role:'EMPLOYEE'},admin.cookie)).status,200);
    assert.equal((await request('/admin/workspace',null,managerLogin.cookie)).status,401);
    assert.equal((await request('/admin/workspace',null,staff.cookie)).status,403);
    const picture=await readFile('../client/public/images/escova.jpg');
    const upload=async(bytes,cookie,type='image/jpeg')=>fetch(`${base}/admin/images`,{method:'POST',headers:{'Content-Type':type,...(cookie?{Cookie:cookie}:{})},body:bytes});
    assert.equal((await upload(picture)).status,401);
    assert.equal((await upload(picture,staff.cookie)).status,403);
    assert.equal((await upload(Buffer.from('<svg>não é PNG</svg>'),admin.cookie,'image/png')).status,400);
    assert.equal((await upload(Buffer.alloc(6*1024*1024),admin.cookie)).status,413);
    const imageResponse=await upload(picture,admin.cookie);assert.equal(imageResponse.status,201);
    const image=(await imageResponse.json()).url;uploadedFiles.push(image.split('/').at(-1));
    const publicImage=await fetch(`${base.replace(/\/api$/,'')}${image}`);
    assert.equal(publicImage.status,200);assert.equal(publicImage.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await publicImage.arrayBuffer()),picture);
    const category=await request('/admin/categories',{name:'Categoria de teste'},admin.cookie);assert.equal(category.status,200);
    assert.equal((await request('/admin/categories',{name:'categoria de teste'},admin.cookie)).status,400);
    assert.equal((await request('/admin/categories',{name:'Sem acesso'},staff.cookie)).status,403);
    assert.equal((await request('/admin/services',{...service,category:'Não cadastrada',price:Number(service.price)},admin.cookie)).status,400);
    assert.equal((await request('/admin/services',{...service,category:category.data.name,price:Number(service.price)},admin.cookie)).status,200);
    assert.equal((await request(`/admin/categories/${category.data.id}`,{},admin.cookie,'DELETE')).status,400);
    assert.equal((await request('/admin/categories',{id:category.data.id,name:'Categoria renomeada'},admin.cookie)).status,200);
    assert.equal((await prisma.service.findUnique({where:{id:service.id}})).category,'Categoria renomeada');
    assert.equal((await request('/admin/services',{...service,price:Number(service.price)},admin.cookie)).status,200);
    assert.equal((await request(`/admin/categories/${category.data.id}`,{},admin.cookie,'DELETE')).status,200);
    const imageSaved=await request('/admin/services',{...service,price:Number(service.price),image},admin.cookie);assert.equal(imageSaved.status,200);assert.equal(imageSaved.data.image,image);
    assert.equal((await request(`/admin/services/${service.id}/active`,{active:false},admin.cookie,'PATCH')).status,200);
    assert.equal((await request('/catalog')).data.services.some(s=>s.id===service.id),false);
    assert.equal((await request(`/admin/services/${service.id}/active`,{active:true},admin.cookie,'PATCH')).status,200);
    const register=await request('/auth/register',{name:'Cliente Teste',email:'customer@example.com',password:'customer-test-password'});assert.equal(register.status,201);
    const customer=await request('/auth/login',{email:'customer@example.com',password:'customer-test-password'});assert.equal(customer.status,200);
    let next=new Date(Date.now()+14*86400000);while(next.getUTCDay()!==2)next=new Date(next.getTime()+86400000);const date=next.toISOString().slice(0,10);
    const body={clientEmail:'customer@example.test',termsAccepted:true,termsVersion:'2026-11-08',clientName:'Cliente Teste',whatsapp:'68999999999',professionalId:professional.id,serviceIds:[service.id],date,startMinute:540,whatsappConsent:false};
    assert.equal((await request('/bookings',body)).status,401);
    assert.equal((await request('/bookings',body,staff.cookie)).status,403);
    assert.equal((await request('/bookings',{...body,termsAccepted:false},customer.cookie)).status,400);
    assert.equal((await request('/bookings',{...body,termsVersion:'old'},customer.cookie)).status,400);
    assert.equal((await request('/bookings',{...body,clientEmail:''},customer.cookie)).status,400);
    assert.equal((await request('/bookings',{...body,clientEmail:'invalid'},customer.cookie)).status,400);
    const attempts=await Promise.all([request('/bookings',body,customer.cookie),request('/bookings',body,customer.cookie)]);
    assert.deepEqual(attempts.map(a=>a.status).sort(),[201,409]);
    const id=attempts.find(a=>a.status===201).data.bookingId;
    const acceptedTerms=await prisma.booking.findUnique({where:{id}});assert.equal(acceptedTerms.termsVersion,'2026-11-08');assert.ok(acceptedTerms.termsAcceptedAt instanceof Date);
    const blockedLunch=await request(`/availability?date=${date}&professionalId=${professional.id}&serviceIds=${service.id}`);
    assert.equal(blockedLunch.data.slots.some(s=>s.start===720),false);
    assert.equal(blockedLunch.data.slots.some(s=>s.start===540),false);
    let staffBookings=await request('/bookings',null,staff.cookie);
    assert.equal(staffBookings.data.length,1);assert.equal(staffBookings.data[0].deposit,undefined);assert.equal(staffBookings.data[0].total_price,undefined);
    assert.equal((await request('/bookings/manual',{...body,startMinute:600},customer.cookie)).status,403);
    const manual=await request('/bookings/manual',{...body,clientEmail:'',startMinute:600,depositReceived:true},admin.cookie);assert.equal(manual.status,201);
    const withProtocol=await prisma.booking.findUnique({where:{id:manual.data.bookingId}});
    assert.match(withProtocol.protocol,/^BG-\d{4,12}$/);
    const lookup=await request('/bookings/lookup',{protocol:withProtocol.protocol});assert.equal(lookup.status,200);assert.equal(lookup.data.status,'Confirmado');assert.equal(lookup.data.whatsapp,undefined);assert.equal(lookup.data.clientName,undefined);assert.equal(lookup.data.totalPrice,undefined);
    assert.equal((await request('/bookings/lookup',{protocol:'BG-INVALID'})).status,404);
    const own=await request('/bookings',null,customer.cookie);assert.equal(own.data.length,1);
    const forbiddenService=ws.services.find(s=>s.id!==service.id);
    assert.equal((await request('/bookings',{...body,startMinute:780,serviceIds:[forbiddenService.id]},customer.cookie)).status,400);
    const block=await request('/admin/blocks',{date,start:780,end:840,professionalId:null,reason:'Feriado parcial'},admin.cookie);assert.equal(block.status,201);
    assert.equal((await request('/admin/blocks',{...block.data,date,endDate:date,reason:'Bloqueio editado'},admin.cookie)).status,201);
    assert.equal((await request('/bookings',{...body,startMinute:780},customer.cookie)).status,409);
    const checkoutAttempts=await Promise.all([request('/payments/checkout',{bookingId:id},customer.cookie),request('/payments/checkout',{bookingId:id},customer.cookie)]);
    assert.deepEqual(checkoutAttempts.map(r=>r.status).sort(),[200,409]);assert.equal(linkCalls,1);
    assert.equal((await request('/payments/checkout',{bookingId:id},customer.cookie)).status,200);assert.equal(linkCalls,1);
    assert.equal(lastLinkPayload.items[0].price,3600);assert.equal(lastLinkPayload.options.single_payment,true);
    assert.equal(lastLinkPayload.webhook_url,undefined);
    const snapshot=await request(`/bookings/${id}`,null,customer.cookie);assert.equal(snapshot.status,200);assert.equal(snapshot.data.booking.status,'Aguardando pagamento');
    assert.equal(snapshot.data.booking.expires_at,lastLinkPayload.options.valid_until);assert.ok(snapshot.data.serverNow);
    assert.equal((await request(`/bookings/${id}`,null,staff.cookie)).status,404);
    assert.equal((await request('/bookings/pending',null,customer.cookie)).data.booking.id,id);
    const payment=await prisma.payment.findFirst({where:{bookingId:id}});
    const verification={order_nsu:payment.id,transaction_nsu:'transaction-test-1',slug:'test-slug'};
    const {recordPaymentEvent,reconcilePaymentEvents}=await import('../src/payment-events.js');
    const e1=await recordPaymentEvent(verification),e2=await recordPaymentEvent(verification);assert.equal(e1.id,e2.id);
    await reconcilePaymentEvents();assert.equal((await prisma.booking.findUnique({where:{id}})).status,'Confirmado');
    assert.equal((await prisma.paymentEvent.findUnique({where:{id:e1.id}})).status,'Verificado');
    const refundEvent=await recordPaymentEvent({...verification,event:'refunded'});assert.equal(refundEvent.status,'Revisão necessária');assert.equal((await prisma.booking.findUnique({where:{id}})).status,'Confirmado');
    const confirmed=await request('/payments/check',verification,customer.cookie);assert.equal(confirmed.data.confirmed,true,JSON.stringify(confirmed.data));
    assert.equal((await request('/payments/check',verification,customer.cookie)).data.confirmed,true);
    const saved=await prisma.booking.findUnique({where:{id}});assert.equal(saved.paid,true);assert.equal(saved.expiresAt,null);assert.equal(saved.status,'Confirmado');
    assert.equal((await request(`/bookings/${id}/status`,{status:'Cancelado'},staff.cookie,'PATCH')).status,409);
    assert.equal((await request(`/bookings/${id}/status`,{status:'Em atendimento'},staff.cookie,'PATCH')).status,200);
    assert.equal((await request(`/bookings/${id}/status`,{status:'Concluído'},staff.cookie,'PATCH')).status,200);
    const late=await request('/bookings',{...body,startMinute:840},customer.cookie);assert.equal(late.status,201);
    assert.equal((await request('/payments/checkout',{bookingId:late.data.bookingId},customer.cookie)).status,200);
    const latePayment=await prisma.payment.findFirst({where:{bookingId:late.data.bookingId}});
    await prisma.booking.update({where:{id:late.data.bookingId},data:{expiresAt:new Date(0)}});
    const lateCheck=await request('/payments/check',{...verification,order_nsu:latePayment.id,transaction_nsu:'transaction-late'},customer.cookie);
    assert.equal(lateCheck.data.status,'Em análise');assert.equal(lateCheck.data.confirmed,false);
    const other=await request('/bookings',{...body,startMinute:900,professionalId:ws.professionals[1].id},customer.cookie);assert.equal(other.status,201);
    assert.equal((await request('/payments/checkout',{bookingId:other.data.bookingId},admin.cookie)).status,404);
    assert.equal((await request('/payments/checkout',{bookingId:other.data.bookingId},customer.cookie)).status,200);
    const mismatchPayment=await prisma.payment.findFirst({where:{bookingId:other.data.bookingId}});
    paidAmount=999;
    const mismatch=await request('/payments/check',{...verification,order_nsu:mismatchPayment.id,transaction_nsu:'wrong-amount'},customer.cookie);
    assert.equal(mismatch.data.confirmed,false);assert.match(mismatch.data.reason,/Valor/);
    paidAmount=3600;
    const replacement=await request('/bookings',{...body,startMinute:840},customer.cookie);assert.equal(replacement.status,201);
    await request('/payments/checkout',{bookingId:replacement.data.bookingId},customer.cookie);
    const replacedPayment=await prisma.payment.findFirst({where:{bookingId:replacement.data.bookingId}});
    assert.equal((await request('/payments/check',{...verification,order_nsu:replacedPayment.id},customer.cookie)).status,409);
    assert.equal((await prisma.booking.findUnique({where:{id:replacement.data.bookingId}})).status,'Aguardando pagamento');
    const staffOwn=await request('/bookings',null,staff.cookie);assert.equal(staffOwn.data.some(b=>b.professional_id===ws.professionals[1].id),false);
    const invalidHours={...ws.salon.hours,2:{open:1080,close:480,lunchStart:null,lunchEnd:null}};
    assert.equal((await request('/admin/salon',{...ws.salon,hours:invalidHours},admin.cookie,'PUT')).status,400);
    const shiftDate=days=>new Date(new Date(`${date}T12:00:00Z`).getTime()+days*86400000).toISOString().slice(0,10);
    const rangeStart=shiftDate(7),rangeEnd=shiftDate(9);
    const range=await request('/admin/blocks',{date:rangeStart,endDate:rangeEnd,start:0,end:1440,professionalId:professional.id,reason:'Férias'},admin.cookie);
    assert.equal(range.status,201);assert.equal(range.data.endDate.slice(0,10),rangeEnd);
    const month=rangeStart.slice(0,7);
    const calendar=await request(`/availability/dates?month=${month}&professionalId=${professional.id}&serviceIds=${service.id}`);
    assert.equal(calendar.status,200);
    for(const entry of calendar.data.days){
      assert.deepEqual(Object.keys(entry).sort(),['available','date']);
      const daily=await request(`/availability?date=${entry.date}&professionalId=${professional.id}&serviceIds=${service.id}`);
      assert.equal(entry.available,daily.data.slots.length>0,`Calendário deve refletir a agenda de ${entry.date}`);
    }
    assert.equal(calendar.data.days.find(d=>d.date===rangeStart).available,false);
    assert.equal((await request(`/availability/dates?month=2026-13&professionalId=${professional.id}&serviceIds=${service.id}`)).status,400);
    for(const delta of [7,8,9]){
      const result=await request(`/availability?date=${shiftDate(delta)}&professionalId=${professional.id}&serviceIds=${service.id}`);
      assert.equal(result.data.slots.length,0,'O período inclui a data inicial, os dias internos e a data final');
      assert.equal((await request('/bookings',{...body,date:shiftDate(delta)},customer.cookie)).status,409);
    }
    for(const delta of [4,10])assert.ok((await request(`/availability?date=${shiftDate(delta)}&professionalId=${professional.id}&serviceIds=${service.id}`)).data.slots.length>0);
    assert.ok((await request(`/availability?date=${rangeStart}&professionalId=${ws.professionals[1].id}&serviceIds=${service.id}`)).data.slots.length>0);
    assert.equal((await request('/admin/blocks',{date:rangeEnd,endDate:rangeStart,start:0,end:1440,reason:'Inválido'},admin.cookie)).status,400);
    assert.equal((await request('/admin/blocks',{date:rangeStart,endDate:'2026-02-30',start:0,end:1440,reason:'Inválido'},admin.cookie)).status,400);
    const editedRange=await request('/admin/blocks',{id:range.data.id,date:rangeStart,endDate:rangeEnd,start:600,end:660,professionalId:null,reason:'Reunião diária'},admin.cookie);assert.equal(editedRange.status,201);
    for(const delta of [7,8,9]){
      for(const pro of ws.professionals){
        const available=(await request(`/availability?date=${shiftDate(delta)}&professionalId=${pro.id}&serviceIds=${service.id}`)).data.slots;
        assert.equal(available.some(s=>s.start===600),false);
        assert.ok(available.some(s=>s.start===540),'Horários fora do intervalo diário continuam livres');
      }
    }
    assert.equal((await request(`/admin/blocks/${range.data.id}`,null,admin.cookie,'DELETE')).status,200);
    assert.ok((await request(`/availability?date=${rangeStart}&professionalId=${professional.id}&serviceIds=${service.id}`)).data.slots.some(s=>s.start===600));
    const uncertainBody={...body,date:shiftDate(21)};
    const uncertain=await request('/bookings',uncertainBody,customer.cookie);assert.equal(uncertain.status,201);
    linkMode='timeout';const callsBefore=linkCalls;
    assert.equal((await request('/payments/checkout',{bookingId:uncertain.data.bookingId},customer.cookie)).status,502);
    assert.equal((await prisma.payment.findFirst({where:{bookingId:uncertain.data.bookingId}})).status,'Inconclusiva');
    await prisma.payment.updateMany({where:{bookingId:uncertain.data.bookingId},data:{status:'Criando',createdAt:new Date(Date.now()-90000)}});
    const interrupted=await request(`/bookings/${uncertain.data.bookingId}`,null,customer.cookie);
    assert.equal(interrupted.data.payment.status,'Inconclusiva','Tentativa interrompida não pode permanecer criando indefinidamente');
    assert.equal((await request('/payments/checkout',{bookingId:uncertain.data.bookingId},customer.cookie)).status,409);
    assert.equal(linkCalls,callsBefore+1,'Não repetir criação inconclusiva no provedor');
    const originalRequest=structuredClone(lastLinkPayload);
    linkMode='ok';
    Object.assign(process.env,{WHATSAPP_PROVIDER:'meta',META_WHATSAPP_ENABLED:'true',META_WHATSAPP_TOKEN:'test-only',META_WHATSAPP_PHONE_NUMBER_ID:'12345',META_WHATSAPP_CONFIRMATION_TEMPLATE:'appointment_confirmed',META_WHATSAPP_REMINDER_TEMPLATE:'appointment_reminder',META_WHATSAPP_REMINDER_24H_TEMPLATE:'appointment_reminder_24',META_WHATSAPP_REMINDER_2H_TEMPLATE:'appointment_reminder_2',META_WHATSAPP_LANGUAGE:'pt_BR'});
    const notified=await request('/bookings/manual',{...body,date:shiftDate(28),whatsappConsent:true,depositReceived:true},admin.cookie);assert.equal(notified.status,201);
    const queued=await prisma.notification.findMany({where:{bookingId:notified.data.bookingId}});
    assert.ok(queued.some(n=>n.kind==='confirmation-client'));assert.ok(queued.some(n=>n.kind==='reminder-24h-client'));assert.ok(queued.some(n=>n.kind==='reminder-2h-client'));
    for(let attempt=0;attempt<40;attempt++){
      const confirmation=await prisma.notification.findFirst({where:{bookingId:notified.data.bookingId,kind:'confirmation-client'}});
      if(confirmation?.status==='Aceita pela Meta')break;
      await new Promise(resolve=>setTimeout(resolve,25));
    }
    assert.ok(metaTemplates.includes('appointment_confirmed'));
    assert.equal((await prisma.notification.findFirst({where:{bookingId:notified.data.bookingId,kind:'confirmation-client'}})).status,'Aceita pela Meta');
    assert.equal((await prisma.booking.findUnique({where:{id:notified.data.bookingId}})).paid,true);
    const sentCount=metaTemplates.length;
    assert.equal((await request(`/bookings/${notified.data.bookingId}/deposit`,{},staff.cookie,'PATCH')).status,403);
    assert.equal((await request(`/bookings/${notified.data.bookingId}/deposit`,{},admin.cookie,'PATCH')).status,200);
    await new Promise(resolve=>setTimeout(resolve,80));assert.equal(metaTemplates.length,sentCount,'Registrar o sinal não duplica confirmação já enviada');
    const noConsent=await request('/bookings/manual',{...body,date:shiftDate(35),whatsappConsent:false,depositReceived:false},admin.cookie);assert.equal(noConsent.status,201);
    assert.equal((await request(`/bookings/${noConsent.data.bookingId}/deposit`,{},admin.cookie,'PATCH')).status,200);
    assert.equal((await prisma.booking.findUnique({where:{id:noConsent.data.bookingId}})).paid,true);
    assert.equal(await prisma.notification.count({where:{bookingId:noConsent.data.bookingId}}),0,'Sem consentimento não há mensagem automática');
    assert.equal((await request('/admin/notifications/test',{phone:'68999999999'},staff.cookie)).status,403);
    const metaTest=await request('/admin/notifications/test',{phone:'68999999999'},admin.cookie);assert.equal(metaTest.status,200);assert.match(metaTest.data.message,/não comprova entrega/);
    const recovery=await Promise.all([request('/payments/checkout',{bookingId:uncertain.data.bookingId,retry:true},customer.cookie),request('/payments/checkout',{bookingId:uncertain.data.bookingId,retry:true},customer.cookie)]);
    assert.deepEqual(recovery.map(r=>r.status).sort(),[200,409]);
    assert.deepEqual(lastLinkPayload,originalRequest,'Recuperar exatamente o mesmo pedido, valor, opções e vencimento');
    assert.equal(await prisma.payment.count({where:{bookingId:uncertain.data.bookingId}}),1);
    assert.equal((await prisma.booking.findUnique({where:{id:uncertain.data.bookingId}})).expiresAt.toISOString(),originalRequest.options.valid_until);
    const callsAfterRecovery=linkCalls;
    assert.equal((await request('/payments/checkout',{bookingId:uncertain.data.bookingId,retry:true},customer.cookie)).status,200);
    assert.equal(linkCalls,callsAfterRecovery,'Reabrir link existente não chama o provedor');
    assert.equal((await request('/bookings',uncertainBody,customer.cookie)).status,409);
    await prisma.booking.update({where:{id:uncertain.data.bookingId},data:{expiresAt:new Date(0)}});
    assert.equal((await request(`/bookings/${uncertain.data.bookingId}`,null,customer.cookie)).data.booking.status,'Expirado');
    assert.equal((await request('/payments/checkout',{bookingId:uncertain.data.bookingId,retry:true},customer.cookie)).status,409);
    assert.equal(linkCalls,callsAfterRecovery,'Não recuperar cobrança depois de expirar');
    assert.equal((await request('/bookings',uncertainBody,customer.cookie)).status,201,'A reserva expirada precisa liberar o horário');
    linkMode='ok';
    const cancelSlots=await request(`/availability?date=${date}&professionalId=${professional.id}&serviceIds=${service.id}`);
    if(cancelSlots.data.slots.length){
      const startMinute=cancelSlots.data.slots[0].start;
      const cancelReservation=await request('/bookings',{...body,startMinute},customer.cookie);assert.equal(cancelReservation.status,201);
      const cancelId=cancelReservation.data.bookingId;
      assert.equal((await request(`/bookings/${cancelId}/cancel`,{},admin.cookie)).status,404);
      assert.equal((await request(`/bookings/${cancelId}/cancel`,{},customer.cookie)).status,200);
      assert.equal((await request(`/bookings/${cancelId}/cancel`,{},customer.cookie)).status,200);
      assert.equal((await prisma.booking.findUnique({where:{id:cancelId}})).status,'Cancelado');
      assert.equal((await request('/payments/checkout',{bookingId:cancelId},customer.cookie)).status,409);
      assert.ok((await request(`/availability?date=${date}&professionalId=${professional.id}&serviceIds=${service.id}`)).data.slots.some(s=>s.start===startMinute));
    }
    const profileData={name:'Profissional atualizada',email:professional.email};
    assert.equal((await request('/auth/profile',profileData,customer.cookie,'PATCH')).status,403);
    assert.equal((await request('/auth/profile',{...profileData,email:'updated@example.test',currentPassword:'wrong'},staff.cookie,'PATCH')).status,400);
    const profileResult=await request('/auth/profile',{...profileData,role:'ROOT'},staff.cookie,'PATCH');assert.equal(profileResult.status,200);assert.equal(profileResult.data.user.role,'EMPLOYEE');
    assert.equal((await prisma.professional.findUnique({where:{id:professional.id}})).name,profileData.name);
    const secondSession=await request('/auth/login',{email:professional.email,password:'staff-test-password'});
    const newCredentials={...profileData,email:'updated@example.test',currentPassword:'staff-test-password',newPassword:'updated-password-test'};
    assert.equal((await request('/auth/profile',newCredentials,staff.cookie,'PATCH')).status,200);
    assert.equal((await request('/auth/me',null,secondSession.cookie)).status,401);
    assert.equal((await request('/auth/me',null,staff.cookie)).status,200);
    assert.equal((await request('/auth/login',{email:newCredentials.email,password:newCredentials.newPassword})).status,200);
    assert.equal((await prisma.professional.findUnique({where:{id:professional.id}})).email,newCredentials.email);
    assert.equal((await request(`/admin/professionals/${professional.id}/active`,{active:false},admin.cookie,'PATCH')).status,200);
    assert.equal((await request('/bookings',null,staff.cookie)).status,401);
    console.log('OK: login de cliente/equipe, isolamento, consentimento opcional, conflitos simultâneos, bloqueios, agendamento manual e validação de pagamentos (provedor simulado).');
  } finally {
    globalThis.fetch=realFetch;delete process.env.INFINITEPAY_HANDLE;delete process.env.INFINITEPAY_API_KEY;
    for(const key of metaKeys)if(oldMeta[key]===undefined)delete process.env[key];else process.env[key]=oldMeta[key];
    server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await prisma.$disconnect();
    const {imageDirectory}=await import('../src/uploads.js');
    for(const filename of uploadedFiles)await unlink(path.join(imageDirectory,filename));
  }
}






