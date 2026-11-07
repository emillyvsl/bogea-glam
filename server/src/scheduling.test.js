import test from 'node:test';
import assert from 'node:assert/strict';
import { planAppointment, validDate, localNow } from './scheduling.js';
import { salonHours } from './scheduling.js';
const now = new Date('2026-11-02T15:00:00Z');
test('mechas às 9h terminam às 15h com almoço', () => {
  assert.deepEqual(planAppointment('2026-11-03', 540, 300, now), { start: 540, end: 900, segments: [{ start: 540, end: 720 }, { start: 780, end: 900 }] });
});
test('rejeita almoço, antes da abertura, início fracionado e fechamento', () => {
  for (const start of [420,720,750,1080,NaN]) assert.equal(planAppointment('2026-11-03',start,60,now),null);
});
test('preserva durações sem arredondar', () => assert.equal(planAppointment('2026-11-03', 480, 45, now).end,525));
test('não transfere trabalho para outro dia', () => assert.equal(planAppointment('2026-11-07',900,120,now),null));
test('domingo e segunda ficam fechados', () => {
  for (const date of ['2026-11-08','2026-11-09']) assert.equal(planAppointment(date,480,60,now),null);
});
test('rejeita data inválida e horários passados em Rio Branco', () => {
  assert.equal(validDate('2026-02-30'), false);
  assert.equal(planAppointment('2026-11-03',480,60,new Date('2026-11-03T14:00:00Z')),null);
  assert.equal(localNow(new Date('2026-11-04T02:00:00Z')).date,'2026-11-03');
});
test('interseção do expediente e união dos almoços do salão/profissional', () => {
  const own = { ...salonHours, 2: { open:540,close:1020,lunchStart:660,lunchEnd:750 } };
  assert.equal(planAppointment('2026-11-03',480,60,now,salonHours,own),null);
  assert.equal(planAppointment('2026-11-03',660,60,now,salonHours,own),null);
  const plan = planAppointment('2026-11-03',540,240,now,salonHours,own);
  assert.deepEqual(plan.segments,[{start:540,end:660},{start:780,end:900}]);
  assert.equal(planAppointment('2026-11-03',960,120,now,salonHours,own),null);
});
test('pausas separadas e dia fechado do profissional', () => {
  const own = { ...salonHours,2:{open:480,close:1080,lunchStart:600,lunchEnd:660},3:null };
  assert.deepEqual(planAppointment('2026-11-03',540,240,now,salonHours,own).segments,[{start:540,end:600},{start:660,end:720},{start:780,end:900}]);
  assert.equal(planAppointment('2026-11-04',480,60,now,salonHours,own),null);
});
