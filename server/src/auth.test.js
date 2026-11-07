import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { registerAuth, adminGuard } from './auth.js';
import { hashPassword } from './password.js';

test('login HTTP, sessão, logout, expiração e acesso negado', async t => {
  const user = { id: 1, name: 'Admin', email: 'admin@example.com', passwordHash: await hashPassword('senha-de-teste-123'), role: 'ADMIN', active: true };
  const sessions = new Map();
  const database = {
    user: { findUnique: async ({ where }) => where.email === user.email ? user : null },
    session: {
      findUnique: async ({ where }) => sessions.get(where.tokenHash),
      create: async ({ data }) => { sessions.set(data.tokenHash, { ...data, user }); },
      deleteMany: async ({ where }) => { for (const [key, value] of sessions) if (where.tokenHash === key || (where.expiresAt && value.expiresAt < where.expiresAt.lt)) sessions.delete(key); }
    }
  };
  const app = express(); app.use(express.json());
  for (const method of ['get', 'post']) {
    const original = app[method].bind(app);
    app[method] = (path, ...handlers) => original(path, ...handlers.map(handler => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)));
  }
  registerAuth(app, database);
  app.get('/api/admin-only', adminGuard(database), (_req,res) => res.json({ok:true}));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${server.address().port}/api/auth`;
  const login = (password, origin) => fetch(`${base}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(origin ? { Origin: origin } : {}) }, body: JSON.stringify({ email: ' ADMIN@example.com ', password }) });
  assert.equal((await fetch(`${base}/me`)).status, 401);
  assert.equal((await login('errada')).status, 401);
  assert.equal((await login('senha-de-teste-123', 'https://outro.example')).status, 403);
  const response = await login('senha-de-teste-123');
  assert.equal(response.status, 200);
  assert.equal((await response.json()).user.passwordHash, undefined);
  const cookie = response.headers.get('set-cookie');
  assert.match(cookie, /HttpOnly/i); assert.match(cookie, /SameSite=Lax/i);
  const headers = { Cookie: cookie.split(';')[0] };
  assert.equal((await fetch(`${base}/me`, { headers })).status, 200);
  user.role = 'CLIENT';
  assert.equal((await fetch(`${base}/me`, { headers })).status, 200);
  assert.equal((await fetch(`${base.replace('/auth','')}/admin-only`, { headers })).status, 403);
  user.role = 'ADMIN';
  user.active = false;
  assert.equal((await fetch(`${base}/me`, { headers })).status, 401);
  user.active = true;
  const session = [...sessions.values()][0]; session.expiresAt = new Date(0);
  assert.equal((await fetch(`${base}/me`, { headers })).status, 401);
  session.expiresAt = new Date(Date.now() + 10000);
  assert.equal((await fetch(`${base}/logout`, { method: 'POST', headers })).status, 200);
  assert.equal((await fetch(`${base}/me`, { headers })).status, 401);
  for (let attempt = 0; attempt < 10; attempt++) assert.equal((await login('errada')).status, 401);
  assert.equal((await login('senha-de-teste-123')).status, 429);
});
