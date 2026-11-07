import { prisma } from './db.js';
import { salonHours, planAppointment, validDate, minutesToTime } from './scheduling.js';
export const fail = (message, status = 400) => { const error = new Error(message); error.status = status; throw error; };
export const asDate = value => { if (!validDate(value)) fail('Data inválida.'); return new Date(`${value}T00:00:00Z`); };
export const dateString = value => value.toISOString().slice(0,10);
export const cleanText = (value, max = 200) => typeof value === 'string' ? value.trim().slice(0,max) : '';
export const phone = value => String(value || '').replace(/\D/g, '');
export const money = value => Number(value);
export const activeWhere = now => ({ status: { notIn: ['Cancelado','Expirado','Não compareceu'] }, OR: [{ status: { not: 'Aguardando pagamento' } }, { expiresAt: { gt: now } }] });
export async function locked(work) {
  return prisma.$transaction(async tx => { await tx.$executeRaw`SELECT pg_advisory_xact_lock(5241, 1)`; return work(tx); }, { maxWait: 10000, timeout: 15000 });
}
export async function getSalon(db = prisma) {
  return await db.salon.findUnique({ where: { id: 1 } }) || { id: 1, name: 'Bogéa Glam', address: '', whatsapp: '', hours: salonHours, reminderHours: 24 };
}
export function validateHours(hours) {
  if (!hours || typeof hours !== 'object' || Object.keys(hours).length !== 7) fail('Informe os sete dias de funcionamento.');
  for (let day = 0; day < 7; day++) {
    const h = hours[day]; if (h === null) continue;
    if (!h || !Number.isInteger(h.open) || !Number.isInteger(h.close) || h.open < 0 || h.close > 1440 || h.open >= h.close) fail('Expediente inválido.');
    if (h.lunchStart != null || h.lunchEnd != null) {
      if (!Number.isInteger(h.lunchStart) || !Number.isInteger(h.lunchEnd) || h.lunchStart < h.open || h.lunchEnd > h.close || h.lunchStart >= h.lunchEnd) fail('O almoço precisa estar dentro do expediente.');
    }
  }
  return hours;
}
export async function bookingContext(db, date, professionalId, serviceIds, rangeEnd = null) {
  if (!Number.isInteger(professionalId) || !Array.isArray(serviceIds) || !serviceIds.length || serviceIds.length > 30 || serviceIds.some(id => !Number.isInteger(id) || id < 1) || new Set(serviceIds).size !== serviceIds.length) fail('Selecione serviços e profissional válidos.');
  const bookingDate = asDate(date);
  const lastDate = rangeEnd ? asDate(rangeEnd) : bookingDate;
  const [salon, professional, services, bookings, blocks] = await Promise.all([
    getSalon(db), db.professional.findUnique({ where: { id: professionalId } }), db.service.findMany({ where: { id: { in: serviceIds }, active: true } }),
    db.booking.findMany({ where: { bookingDate: { gte: bookingDate, lte: lastDate }, professionalId, ...activeWhere(new Date()) } }),
    db.block.findMany({ where: { date: { lte: lastDate }, endDate: { gte: bookingDate }, OR: [{ professionalId: null }, { professionalId }] } })
  ]);
  if (!professional?.active || services.length !== serviceIds.length || services.some(s => !Number.isInteger(s.duration) || s.duration < 15 || s.duration > 600) || (!professional.allServices && serviceIds.some(id => !professional.serviceIds.includes(id)))) fail('O profissional não realiza todos os serviços selecionados.');
  const duration = services.reduce((sum,s) => sum + s.duration,0);
  const totalCents = services.reduce((sum,s) => sum + Math.round(Number(s.price) * 100),0);
  return { salon, professional, services, bookings, blocks, duration, totalCents, bookingDate };
}
export function availablePlan(ctx, date, start, excludeId = null, now = new Date()) {
  const plan = planAppointment(date, start, ctx.duration, now, ctx.salon.hours, ctx.professional.hours);
  if (!plan || ctx.bookings.some(b => dateString(b.bookingDate) === date && b.id !== excludeId && start < b.endMinute && plan.end > b.startMinute) || ctx.blocks.some(b => dateString(b.date) <= date && dateString(b.endDate) >= date && start < b.end && plan.end > b.start)) return null;
  return plan;
}
export async function createBooking(body, user, manual = false) {
  const { date, professionalId, serviceIds, startMinute } = body;
  const clientName = cleanText(body.clientName,120), whatsapp = phone(body.whatsapp);
  if (clientName.length < 2 || !/^\d{10,13}$/.test(whatsapp)) fail('Informe nome e WhatsApp com DDD.');
  if (!manual && user.role === 'EMPLOYEE') fail('Funcionários não criam reservas.',403);
  return locked(async tx => {
    const ctx = await bookingContext(tx,date,professionalId,serviceIds);
    const plan = availablePlan(ctx,date,startMinute);
    if (!plan) fail('Este horário não está disponível. Atualize a consulta.',409);
    return tx.booking.create({ data: {
      clientName, whatsapp, customerId: manual ? null : user.id, professionalId, serviceIds,
      serviceNames: ctx.services.map(s => s.name), bookingDate: ctx.bookingDate,
      startMinute, endMinute: plan.end, segments: plan.segments, totalMinutes: ctx.duration,
      totalPrice: ctx.totalCents / 100, deposit: Math.round(ctx.totalCents * .3) / 100,
      status: manual ? 'Confirmado' : 'Aguardando pagamento', expiresAt: manual ? null : new Date(Date.now() + 600000),
      whatsappConsent: body.whatsappConsent === true, paid: manual && body.depositReceived === true
    } });
  });
}
export function presentBooking(b, employee = false) {
  const status = b.status === 'Aguardando pagamento' && (!b.expiresAt || b.expiresAt <= new Date()) ? 'Expirado' : b.status;
  const result = { id: b.id, protocol:b.protocol, client_name: b.clientName, whatsapp: b.whatsapp, booking_date: dateString(b.bookingDate), professional_id: b.professionalId, professional_name: b.professional?.name, services: b.serviceNames, start: minutesToTime(b.startMinute), end: minutesToTime(b.endMinute), start_minute: b.startMinute, end_minute: b.endMinute, segments: b.segments, status, expires_at: b.expiresAt, whatsapp_consent: b.whatsappConsent };
  return employee ? result : { ...result, total_price: Number(b.totalPrice), deposit: Number(b.deposit), paid: b.paid };
}

