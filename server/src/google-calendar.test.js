import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encryptToken,decryptToken,eventId,bookingEvent,safeGoogleError,queueGoogleCalendar} from './google-calendar.js';
import {consumeOAuthState} from './google-calendar-routes.js';

test('Google tokens use authenticated encryption, random nonces and strict key format',()=>{
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY='ab'.repeat(32);
  const a=encryptToken('private-refresh-token'),b=encryptToken('private-refresh-token');
  assert.notEqual(a,b);assert.ok(!a.includes('private-refresh-token'));assert.equal(decryptToken(a),'private-refresh-token');
  const parts=a.split('.');parts[2]=Buffer.alloc(16).toString('base64');assert.throws(()=>decryptToken(parts.join('.')));
  process.env.GOOGLE_TOKEN_ENCRYPTION_KEY='wrong';assert.throws(()=>encryptToken('token'));delete process.env.GOOGLE_TOKEN_ENCRYPTION_KEY;
});
test('Google events use Rio Branco time and optional invitations without exposing finance',()=>{
  const b={id:8,bookingDate:new Date('2026-11-10'),startMinute:480,endMinute:570,clientName:'Cliente',whatsapp:'68999999999',serviceNames:['Escova'],protocol:'BG-123',deposit:36};
  const event=bookingEvent(b);assert.equal(event.start.dateTime,'2026-11-10T08:00:00-05:00');assert.equal(event.end.dateTime,'2026-11-10T09:30:00-05:00');assert.deepEqual(event.attendees,[]);assert.ok(event.description.includes('BG-123'));assert.ok(!JSON.stringify(event).includes('deposit'));
  assert.deepEqual(bookingEvent({...b,clientEmail:'cliente@example.com'}).attendees,[{email:'cliente@example.com'}]);
});
test('Google IDs are stable, valid and unique per destination and generation',()=>{
  const c={id:'a',calendarId:'primary'};assert.match(eventId(8,c),/^[a-v0-9]{5,1024}$/);assert.equal(eventId(8,c),eventId(8,c));assert.notEqual(eventId(8,c),eventId(8,{...c,id:'b'}));assert.notEqual(eventId(8,c),eventId(8,c,1));
});
test('OAuth state consumption checks user, professional, session, expiry and one-time deletion',async()=>{
  let used=false;
  const db={googleCalendarOAuthState:{deleteMany:async({where})=>{assert.equal(where.userId,2);assert.equal(where.professionalId,3);assert.equal(where.sessionHash,'session');assert.ok(where.expiresAt.gt instanceof Date);if(used)return {count:0};used=true;return {count:1};}}};
  assert.equal(await consumeOAuthState(db,'invalid',2,3,'session'),false);
  assert.equal(await consumeOAuthState(db,'ab'.repeat(32),2,3,'session'),true);
  assert.equal(await consumeOAuthState(db,'ab'.repeat(32),2,3,'session'),false);
});
test('Disabled integration never queues or contacts Google; error messages do not expose secrets',async()=>{
  delete process.env.GOOGLE_CALENDAR_ENABLED;await queueGoogleCalendar({}, {id:8});
  assert.ok(!safeGoogleError({message:'SECRET',response:{data:{token:'SECRET'}}}).includes('SECRET'));
});
