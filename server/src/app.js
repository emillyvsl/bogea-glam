import {registerGoogleCalendar} from './google-calendar-routes.js';
import {queueGoogleCalendar} from './google-calendar.js';
import {registerPaymentEvents} from './payment-events.js';
import {frontendOrigin} from './config.js';
import express from 'express';
import cors from 'cors';
import { prisma } from './db.js';
import { registerAuth, requireAdmin, requireRoot, requireBookingUser, isRoot, isManagement, requireUser, requireStaff } from './auth.js';
import { hashPassword } from './password.js';
import { validDate, minutesToTime } from './scheduling.js';
import { getSalon, validateHours, locked, fail, asDate, cleanText, phone, bookingContext, availablePlan, createBooking, presentBooking, dateString } from './salon.js';
import { checkout, verifyPayment, paymentsConfigured,webhookEnabled,reconcileInterruptedCheckouts } from './payments.js';
import { queueConfirmation, processNotifications, notificationsConfigured,whatsappProvider,scheduleNotificationDispatch } from './notifications.js';
import {metaConfigured,sendMetaTemplate,metaTestMessage} from './meta-whatsapp.js';
import {confirmationPreview} from './confirmation-template.js';
import { registerUploads } from './uploads.js';

export const app = express();
app.use(cors({ origin: frontendOrigin(), credentials: true }));
app.use(express.json({ limit: '48kb' }));
app.use('/api', (_req,res,next) => { res.set('Cache-Control','no-store'); next(); });
for (const method of ['get','post','patch','put','delete']) {
  const register = app[method].bind(app);
  app[method] = (path,...handlers) => register(path,...handlers.map(handler => handler.constructor.name === 'AsyncFunction' ? (req,res,next) => Promise.resolve(handler(req,res,next)).catch(next) : handler));
}
registerAuth(app);
registerGoogleCalendar(app);
registerUploads(app);
app.get('/api/health', async (_req,res) => { await prisma.$queryRaw`SELECT 1`; res.json({ ok: true }); });
const protocolAttempts=new Map();
app.post('/api/bookings/lookup',async(req,res)=>{
  const now=Date.now(),key=req.ip,attempt=protocolAttempts.get(key);
  if(attempt&&attempt.until>now&&attempt.count>=15)return res.status(429).json({error:'Muitas consultas. Aguarde um minuto e tente novamente.'});
  if(!attempt||attempt.until<=now)protocolAttempts.set(key,{count:1,until:now+60000});else attempt.count++;
  if(protocolAttempts.size>1000)for(const [ip,item] of protocolAttempts)if(item.until<=now)protocolAttempts.delete(ip);
  const protocol=String(req.body.protocol||'').trim().toUpperCase();
  const short=/^BG-\d{4,12}$/.test(protocol);
  if(!short&&!/^BG-[A-F0-9]{24}$/.test(protocol))return res.status(404).json({error:'Protocolo não encontrado. Confira o código recebido.'});
  const b=await prisma.booking.findUnique({where:{protocol},include:{professional:{select:{name:true}}}});
  if(!b)return res.status(404).json({error:'Protocolo não encontrado. Confira o código recebido.'});
  res.json({protocol:b.protocol,status:b.status,date:dateString(b.bookingDate),start:minutesToTime(b.startMinute),end:minutesToTime(b.endMinute),services:b.serviceNames,professional:b.professional?.name||'Profissional do salão'});
});
app.get('/api/catalog', async (_req,res) => {
  const [salon,services,professionals] = await Promise.all([getSalon(),prisma.service.findMany({ where: { active: true }, orderBy: { id: 'asc' } }),prisma.professional.findMany({ where: { active: true }, select: { id: true, name: true, serviceIds: true, allServices: true } })]);
  res.json({ salon: { ...salon, timezone: 'America/Rio_Branco', depositPercent: 30 }, services: services.map(s => ({ ...s, price: Number(s.price) })), professionals });
});
app.get('/api/availability', async (req,res) => {
  const { date,professionalId,serviceIds } = req.query;
  if (!validDate(date) || !/^\d+$/.test(professionalId || '') || typeof serviceIds !== 'string' || !/^\d+(,\d+)*$/.test(serviceIds)) fail('Informe data, profissional e serviços.');
  const ctx = await bookingContext(prisma,date,Number(professionalId),serviceIds.split(',').map(Number));
  const slots = [];
  for (let start = 0; start < 1440; start += 60) {
    const plan = availablePlan(ctx,date,start);
    if (plan) slots.push({ ...plan,label: minutesToTime(start),endLabel: minutesToTime(plan.end),crossesLunch: plan.segments.length > 1 });
  }
  res.json({ date,slots,totalMinutes: ctx.duration,closed: !ctx.salon.hours[new Date(`${date}T12:00:00Z`).getUTCDay()] });
});
app.get('/api/availability/dates', async(req,res)=>{
  const {month,professionalId,serviceIds}=req.query;
  if(typeof month!=='string'||!/^\d{4}-\d{2}$/.test(month)||!validDate(`${month}-01`)||!/^\d+$/.test(professionalId||'')||typeof serviceIds!=='string'||!/^\d+(,\d+)*$/.test(serviceIds))fail('Informe mês, profissional e serviços válidos.');
  const first=asDate(`${month}-01`),last=new Date(first);
  last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  const ctx=await bookingContext(prisma,dateString(first),Number(professionalId),serviceIds.split(',').map(Number),dateString(last));
  const days=[],now=new Date();
  for(let day=1;day<=last.getUTCDate();day++){
    const date=`${month}-${String(day).padStart(2,'0')}`;
    let available=false;
    for(let start=0;start<1440;start+=60)if(availablePlan(ctx,date,start,null,now)){available=true;break;}
    days.push({date,available});
  }
  res.json({month,days});
});
app.post('/api/bookings', requireBookingUser, async (req,res) => {
  const b = await createBooking(req.body,req.user);
  res.status(201).json({ bookingId: b.id, expiresAt: b.expiresAt, status: b.status, totalPrice: Number(b.totalPrice), deposit: Number(b.deposit) });
});
app.post('/api/bookings/manual', requireAdmin, async (req,res) => {
  const b = await createBooking({...req.body,depositReceived:isRoot(req.user)&&req.body.depositReceived===true},req.user,true);
  await queueConfirmation(prisma,b);
  scheduleNotificationDispatch();
  res.status(201).json({ bookingId: b.id });
});
app.get('/api/bookings', requireUser, async (req,res) => {
  const where = isManagement(req.user) ? {} : req.user.role === 'EMPLOYEE' ? { professionalId: req.user.professional.id } : { customerId: req.user.id };
  const bookings = await prisma.booking.findMany({ where, include: { professional: true }, orderBy: [{ bookingDate: 'asc' },{ startMinute: 'asc' }] });
  res.json(bookings.map(b => presentBooking(b,!isRoot(req.user))));
});
async function reservationSnapshot(id,user) {
  await reconcileInterruptedCheckouts();
  const b=await prisma.booking.findUnique({where:{id},include:{professional:true,payments:{orderBy:{createdAt:'desc'},take:1}}});
  if(!b||(b.customerId!==user.id&&!isManagement(user)))fail('Reserva não encontrada.',404);
  const payment=b.payments[0];
  return {booking:presentBooking(b),payment:payment?{status:payment.status,reason:payment.reason,checkoutUrl:payment.checkoutUrl}:null,serverNow:new Date().toISOString()};
}
app.get('/api/bookings/pending',requireBookingUser,async(req,res)=>{
  const latest=await prisma.booking.findFirst({where:{customerId:req.user.id,status:'Aguardando pagamento',expiresAt:{gt:new Date()}},orderBy:{createdAt:'desc'}});
  res.json(latest?await reservationSnapshot(latest.id,req.user):{booking:null});
});
app.get('/api/bookings/:id',requireBookingUser,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)fail('Reserva inválida.');
  res.json(await reservationSnapshot(id,req.user));
});
app.post('/api/bookings/:id/cancel',requireBookingUser,async(req,res)=>{
 const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)fail('Reserva inválida.');
 await locked(async tx=>{
   const booking=await tx.booking.findUnique({where:{id}});
   if(!booking||booking.customerId!==req.user.id)fail('Reserva não encontrada.',404);
   if(booking.status==='Cancelado')return;
   if(booking.status!=='Aguardando pagamento'||booking.paid)fail('Esta reserva já não pode ser cancelada nesta tela. Entre em contato com o salão.',409);
   if(await tx.payment.count({where:{bookingId:id,status:{in:['Aprovado','Em análise']}}}))fail('Há um pagamento registrado. Entre em contato com o salão.',409);
   await tx.booking.update({where:{id},data:{status:'Cancelado',expiresAt:null}});
   await tx.notification.updateMany({where:{bookingId:id,status:'Na fila'},data:{status:'Cancelada'}});
 });res.json({ok:true,status:'Cancelado'});
});
app.patch('/api/bookings/:id/status', requireStaff, async (req,res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) fail('Atendimento inválido.');
  const employee = req.user.role === 'EMPLOYEE';
  const updated = await locked(async tx => {
    const b = await tx.booking.findUnique({ where: { id } });
    if (!b || (employee && b.professionalId !== req.user.professional.id)) fail('Atendimento não encontrado.',404);
    const transitions = employee ? { Confirmado: ['Em atendimento','Não compareceu'], 'Em atendimento': ['Concluído'] } : { 'Aguardando pagamento': ['Confirmado','Cancelado'], Confirmado: ['Em atendimento','Não compareceu','Cancelado'], 'Em atendimento': ['Concluído','Cancelado'] };
    if (!transitions[b.status]?.includes(req.body.status)) fail('Alteração de status não permitida.',409);
    if (b.status === 'Aguardando pagamento' && req.body.status === 'Confirmado') {
      if (!b.expiresAt || b.expiresAt <= new Date()) fail('A reserva expirou.',409);
      const ctx = await bookingContext(tx,dateString(b.bookingDate),b.professionalId,b.serviceIds);
      const plan = availablePlan(ctx,dateString(b.bookingDate),b.startMinute,b.id);
      if (!plan || plan.end !== b.endMinute) fail('A disponibilidade mudou. Não foi possível confirmar.',409);
    }
    const result = await tx.booking.update({ where: { id }, data: { status: req.body.status, paid: b.paid || (isRoot(req.user) && req.body.depositReceived === true), ...(req.body.status === 'Confirmado' ? { expiresAt: null } : {}) } });
    if (result.status === 'Confirmado') await queueConfirmation(tx,result);
    await queueGoogleCalendar(tx,result);
    if (result.status === 'Cancelado') await tx.notification.updateMany({ where: { bookingId: id, status: 'Na fila' }, data: { status: 'Cancelada' } });
    return result;
  });
  res.json({ ok: true, status: updated.status });
  if(updated.status==='Confirmado')scheduleNotificationDispatch();
});
app.patch('/api/bookings/:id/deposit',requireRoot,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)fail('Atendimento inválido.');
  await locked(async tx=>{
    const booking=await tx.booking.findUnique({where:{id}});
    if(!booking)fail('Atendimento não encontrado.',404);
    if(booking.status!=='Confirmado')fail('Registre o sinal de um atendimento confirmado.',409);
    const updated=await tx.booking.update({where:{id},data:{paid:true}});
    await queueConfirmation(tx,updated);
  });
  res.json({ok:true});scheduleNotificationDispatch();
});
app.get('/api/admin/workspace', requireAdmin, async (req,res) => {
  const [salon,services,professionals,blocks,payments,notifications,categories] = await Promise.all([getSalon(),prisma.service.findMany({ orderBy: { id: 'asc' } }),prisma.professional.findMany({ orderBy: { id: 'asc' },include:{user:{select:{role:true}}} }),prisma.block.findMany({ orderBy: { date: 'asc' } }),prisma.payment.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),prisma.notification.findMany({ orderBy: { id: 'desc' }, take: 200 }),prisma.category.findMany({orderBy:{name:'asc'}})]);
  res.json({ paymentEvents:isRoot(req.user)?await prisma.paymentEvent.findMany({orderBy:{createdAt:'desc'},take:100}):[],salon,services,professionals,blocks,payments:isRoot(req.user)?payments:[],notifications:isRoot(req.user)?notifications:[],categories,confirmationDraft:isRoot(req.user)?confirmationPreview():null,integrations: { payments: paymentsConfigured(), whatsapp: notificationsConfigured(), whatsappProvider:whatsappProvider(),whatsappDemo:whatsappProvider()==='meta'&&process.env.META_WHATSAPP_CONFIRMATION_TEMPLATE==='jaspers_market_order_confirmation_v1',metaConfigured:metaConfigured(),webhook: webhookEnabled(), reminders: process.env.REMINDERS_ENABLED === 'true' } });
});
app.put('/api/admin/salon', requireAdmin, async (req,res) => {
  const { hours, reminderHours } = req.body; validateHours(hours);
  if (![2,24,48].includes(reminderHours)) fail('Antecedência de lembrete inválida.');
  const data = { name: cleanText(req.body.name,120), address: cleanText(req.body.address,300), whatsapp: phone(req.body.whatsapp), hours, reminderHours };
  if (!data.name || (data.whatsapp && !/^\d{10,13}$/.test(data.whatsapp))) fail('Informe nome e WhatsApp válidos.');
  res.json(await locked(tx => tx.salon.upsert({ where: { id: 1 }, update: data, create: { id: 1,...data } })));
});
app.post('/api/admin/categories',requireAdmin,async(req,res)=>{
  const name=cleanText(req.body.name,80),id=req.body.id;
  if(!name||(id!=null&&(!Number.isInteger(id)||id<1)))fail('Informe uma categoria válida.');
  res.json(await locked(async tx=>{
    const duplicate=await tx.category.findFirst({where:{name:{equals:name,mode:'insensitive'},...(id?{id:{not:id}}:{})}});
    if(duplicate)fail('Já existe uma categoria com esse nome.');
    return id?tx.category.update({where:{id},data:{name}}):tx.category.create({data:{name}});
  }));
});
app.delete('/api/admin/categories/:id',requireAdmin,async(req,res)=>{
  const id=Number(req.params.id);if(!Number.isInteger(id)||id<1)fail('Categoria inválida.');
  await locked(async tx=>{const category=await tx.category.findUnique({where:{id}});if(!category)fail('Categoria não encontrada.',404);if(await tx.service.count({where:{category:category.name}}))fail('Esta categoria está vinculada a serviços. Altere os serviços antes de excluir.');await tx.category.delete({where:{id}});});
  res.json({ok:true});
});
app.post('/api/admin/services', requireAdmin, async (req,res) => {
  const { duration,price } = req.body;
  const data = { name: cleanText(req.body.name,120), category: cleanText(req.body.category,80), description: cleanText(req.body.description,1500), image: cleanText(req.body.image,1000), duration, price, active: req.body.active === true };
  if (!data.name || !Number.isInteger(duration) || duration < 15 || duration > 600 || !Number.isFinite(price) || price < 0 || price > 99999999 || (data.image && !/^https:\/\//.test(data.image) && !/^\/images\/[\w/-]+\.(jpg|jpeg|png|webp)$/i.test(data.image) && !/^\/api\/images\/[\da-f-]+\.(jpg|png|webp)$/.test(data.image))) fail('Confira nome, duração (15–600 min), preço e imagem.');
  const id = req.body.id;
  if (id != null && (!Number.isInteger(id) || id < 1)) fail('Serviço inválido.');
  res.json(await locked(async tx => {if(!await tx.category.findUnique({where:{name:data.category}}))fail('Selecione uma categoria cadastrada.');return id ? tx.service.update({ where: { id }, data }) : tx.service.create({ data });}));
});
app.patch('/api/admin/services/:id/active', requireAdmin, async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1||typeof req.body.active!=='boolean')fail('Serviço inválido.');
  res.json(await locked(tx=>tx.service.update({where:{id},data:{active:req.body.active}})));
});
app.patch('/api/admin/professionals/:id/active', requireAdmin, async(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isInteger(id)||id<1||typeof req.body.active!=='boolean')fail('Profissional inválido.');
  res.json(await locked(async tx=>{
    const previous=await tx.professional.findUnique({where:{id},include:{user:{select:{role:true}}}});
    if(previous?.user?.role==='ROOT'&&!isRoot(req.user))fail('Somente root pode gerenciar contas root.',403);
    if(previous?.userId===req.user.id&&req.body.active===false)fail('Você não pode desativar a própria conta.');
    const professional=await tx.professional.update({where:{id},data:{active:req.body.active}});
    if(professional.userId){
      await tx.user.update({where:{id:professional.userId},data:{active:req.body.active}});
      if(!req.body.active)await tx.session.deleteMany({where:{userId:professional.userId}});
    }
    return professional;
  }));
});
app.post('/api/admin/professionals', requireAdmin, async (req,res) => {
  const { id,hours,serviceIds,allServices,password } = req.body;
  const email = cleanText(req.body.email,254).toLowerCase(), name = cleanText(req.body.name,120);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !Array.isArray(serviceIds) || serviceIds.some(id => !Number.isInteger(id) || id < 1) || (id != null && (!Number.isInteger(id) || id < 1))) fail('Confira os dados do profissional.');
  if (hours != null) validateHours(hours);
  if (password && (typeof password !== 'string' || password.length < 12 || password.length > 256)) fail('A senha deve ter entre 12 e 256 caracteres.');
  const passwordHash = password ? await hashPassword(password) : null;
  const result = await locked(async tx => {
    const previous = id ? await tx.professional.findUnique({ where: { id },include:{user:{select:{role:true}}} }) : null;
    const role=req.body.role||previous?.user?.role||'EMPLOYEE';
    if(!['ROOT','MANAGER','EMPLOYEE'].includes(role))fail('Perfil inválido.');
    if(!isRoot(req.user)&&(role==='ROOT'||previous?.user?.role==='ROOT'))fail('Somente root pode gerenciar contas root.',403);
    if(previous?.userId===req.user.id&&(role!==req.user.role||req.body.active!==true))fail('Não altere seu próprio perfil nem desative sua conta.');
    if (id && !previous) fail('Profissional não encontrado.',404);
    if (!previous?.userId && !passwordHash) fail('Informe a senha inicial de acesso.');
    if (await tx.service.count({ where: { id: { in: serviceIds } } }) !== new Set(serviceIds).size) fail('Serviço inválido.');
    const existing = await tx.user.findUnique({ where: { email } });
    if (existing && existing.id !== previous?.userId) fail('Este e-mail já está vinculado a outra conta.',409);
    const userData = { email,name,role,active: req.body.active === true,...(passwordHash ? { passwordHash } : {}) };
    const user = previous?.userId ? await tx.user.update({ where: { id: previous.userId }, data: userData }) : await tx.user.create({ data: { ...userData, passwordHash } });
    if (passwordHash || req.body.active !== true || previous?.user?.role!==role) await tx.session.deleteMany({ where: { userId: user.id } });
    const data = { name,email,active: req.body.active === true,hours: hours === null ? undefined : hours,serviceIds,allServices: allServices === true,userId: user.id };
    if (hours === null && previous) await tx.$executeRaw`UPDATE professionals SET hours = NULL WHERE id = ${id}`;
    return id ? tx.professional.update({ where: { id }, data }) : tx.professional.create({ data });
  }); res.json(result);
});
app.post('/api/admin/blocks', requireAdmin, async (req,res) => {
  const { date,start,end,professionalId } = req.body;
  const startDate=asDate(date),endDate=asDate(req.body.endDate || date);
  if(endDate < startDate)fail('A data final do bloqueio deve ser igual ou posterior à data inicial.');
  const reason = cleanText(req.body.reason,200);
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1440 || start >= end || !reason || (professionalId != null && !Number.isInteger(professionalId))) fail('Confira os dados do bloqueio.');
  res.status(201).json(await locked(async tx => {
    if (professionalId && !await tx.professional.findUnique({ where: { id: professionalId } })) fail('Profissional inválido.');
    const data={date:startDate,endDate,start,end,professionalId:professionalId||null,reason};
    if(req.body.id!=null){if(!Number.isInteger(req.body.id)||req.body.id<1)fail('Bloqueio inválido.');return tx.block.update({where:{id:req.body.id},data});}
    return tx.block.create({ data });
  }));
});
app.delete('/api/admin/blocks/:id', requireAdmin, async (req,res) => {
  const id = Number(req.params.id); if (!Number.isInteger(id)) fail('Bloqueio inválido.');
  await locked(tx => tx.block.delete({ where: { id } })); res.json({ ok: true });
});
app.get('/api/payments/config', (_req,res) => res.json({ configured: paymentsConfigured() }));
app.post('/api/payments/checkout', requireBookingUser, async (req,res) => res.json(await checkout(req.body.bookingId,req.user,req.body.retry===true)));
app.post('/api/payments/check', requireBookingUser, async (req,res) => res.json(await verifyPayment(req.body,req.user)));
registerPaymentEvents(app,requireRoot);
app.post('/api/admin/notifications/run', requireRoot, async (_req,res) => res.json(await processNotifications()));
app.post('/api/admin/notifications/test',requireRoot,async(req,res)=>{
  const result=await sendMetaTemplate(metaTestMessage(req.body.phone));
  res.json({ok:true,status:result.status,message:'A Meta aceitou a solicitação. Isso ainda não comprova entrega no WhatsApp.'});
});
app.use((error,_req,res,_next) => {
  const status = error.status || (error.code === 'P2002' ? 409 : error.code === 'P2025' ? 404 : error.type === 'entity.parse.failed' ? 400 : 500);
  if (status === 500) console.error(error.message);
  res.status(status).json({ error: status === 413 ? 'A imagem excede o limite de 5 MB.' : status === 500 ? 'Não foi possível concluir a operação.' : error.code === 'P2002' ? 'Registro já cadastrado.' : error.code === 'P2025' ? 'Registro não encontrado.' : error.message });
});









