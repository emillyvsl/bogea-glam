import {frontendOrigin} from './config.js';
import { randomBytes } from 'node:crypto';
import { prisma } from './db.js';
import { hashPassword, verifyPassword, tokenHash } from './password.js';

export function sessionCookieOptions(env=process.env){
  const sameSite=(env.COOKIE_SAME_SITE||'lax').trim().toLowerCase();
  if(!['lax','strict','none'].includes(sameSite))throw new Error('COOKIE_SAME_SITE deve ser lax, strict ou none.');
  return {httpOnly:true,secure:env.NODE_ENV==='production'||sameSite==='none',sameSite,path:'/api'};
}
const cookieName = 'bogea_session';

const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role, professionalId: user.professional?.id });
const readToken = (req,name=cookieName) => (req.headers.cookie || '').split(';').map(c => c.trim()).find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);

export const adminGuard = (database = prisma, roles = ['ROOT','ADMIN','MANAGER']) => async (req, res, next) => {
  try {
    const token = req.bookingAccess?(readToken(req,'bogea_guest_session')||readToken(req)):readToken(req);
    const session = token && await database.session.findUnique({ where: { tokenHash: tokenHash(token) }, include: { user: { include: { professional: true } } } });
    if (!session || session.expiresAt <= new Date() || !session.user.active) return res.status(401).json({ error: 'Entre com seu e-mail e senha.' });
    if (!roles.includes(session.user.role) || (session.user.role === 'EMPLOYEE' && !session.user.professional?.active)) return res.status(403).json({ error: 'Acesso não permitido.' });
    req.user = session.user; next();
  } catch (error) { next(error); }
};
export const isRoot=user=>['ROOT','ADMIN'].includes(user.role);
export const isManagement=user=>['ROOT','ADMIN','MANAGER'].includes(user.role);
export const requireRoot = adminGuard(prisma,['ROOT','ADMIN']);
export const requireAdmin = adminGuard();
export const requireUser = adminGuard(prisma, ['ROOT','ADMIN','MANAGER','EMPLOYEE','CLIENT']);
export const requireBookingUser=(req,res,next)=>{req.bookingAccess=true;return requireUser(req,res,next);};
export const requireStaff = adminGuard(prisma, ['ROOT','ADMIN','MANAGER','EMPLOYEE']);

export function registerAuth(app, database = prisma) {
  const requireUser = adminGuard(database, ['ROOT','ADMIN','MANAGER','EMPLOYEE','CLIENT']);
  // Browser writes must come from the configured frontend (also prevents login CSRF).
  app.use('/api', (req, res, next) => {
    if (['POST','PATCH','DELETE','PUT'].includes(req.method) && req.get('Origin') && req.get('Origin') !== frontendOrigin()) return res.status(403).json({ error: 'Origem não permitida.' });
    next();
  });
  const attempts = new Map();
  const cleanup = setInterval(() => { for (const [ip, attempt] of attempts) if (attempt.until < Date.now()) attempts.delete(ip); }, 60000);
  cleanup.unref();
  const dummyHash = hashPassword(randomBytes(32).toString('hex'));
  app.post('/api/auth/guest',async(req,res)=>{
    const name=String(req.body.name||'').trim(),phone=String(req.body.whatsapp||'').replace(/\D/g,'');
    if(name.length<2||name.length>120||!/^\d{10,13}$/.test(phone))return res.status(400).json({error:'Informe nome completo e WhatsApp com DDD.'});
    const key=`guest:${req.ip}`,now=Date.now(),attempt=attempts.get(key);
    if(attempt&&attempt.until>now&&attempt.count>=15)return res.status(429).json({error:'Muitas tentativas. Aguarde alguns minutos.'});
    if(!attempt||attempt.until<=now)attempts.set(key,{count:1,until:now+15*60000});else attempt.count++;
    const existingToken=readToken(req,'bogea_guest_session');
    const existing=existingToken&&await database.session.findUnique({where:{tokenHash:tokenHash(existingToken)},include:{user:true}});
    if(existing&&existing.expiresAt>new Date()&&existing.user.role==='CLIENT'&&existing.user.active)return res.json({user:publicUser(existing.user)});
    const user=await database.user.create({data:{name,email:`guest-${randomBytes(18).toString('hex')}@guest.invalid`,passwordHash:await hashPassword(randomBytes(32).toString('hex')),role:'CLIENT'}});
    const token=randomBytes(32).toString('hex'),maxAge=7*24*60*60*1000;
    await database.session.create({data:{tokenHash:tokenHash(token),userId:user.id,expiresAt:new Date(Date.now()+maxAge)}});
    res.cookie('bogea_guest_session',token,{...sessionCookieOptions(),maxAge}).json({user:publicUser(user)});
  });
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 256) return res.status(400).json({ error: 'Informe e-mail e senha válidos.' });
    const ip = req.ip;
    const current = attempts.get(ip);
    const attempt = current && current.until > Date.now() ? current : { count: 0, until: Date.now() + 15 * 60000 };
    if (attempt.count >= 10) return res.status(429).json({ error: 'Muitas tentativas. Tente novamente em 15 minutos.' });
    attempt.count++; attempts.set(ip, attempt);
    const user = await database.user.findUnique({ where: { email: email.trim().toLowerCase() }, include: { professional: true } });
    const valid = await verifyPassword(password, user?.passwordHash || await dummyHash);
    if (!valid || !user?.active || !['ROOT','ADMIN','MANAGER','EMPLOYEE','CLIENT'].includes(user.role) || (user.role === 'EMPLOYEE' && !user.professional?.active)) return res.status(401).json({ error: 'E-mail ou senha inválidos.' });
    attempts.delete(ip);
    const previous = readToken(req);
    if (previous) await database.session.deleteMany({ where: { tokenHash: tokenHash(previous) } });
    await database.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    const token = randomBytes(32).toString('hex');
    const maxAge = 8 * 60 * 60 * 1000;
    await database.session.create({ data: { tokenHash: tokenHash(token), userId: user.id, expiresAt: new Date(Date.now() + maxAge) } });
    res.cookie(cookieName, token, { ...sessionCookieOptions(), maxAge }).json({ user: publicUser(user) });
  });
  app.get('/api/auth/booking-session',requireBookingUser,(req,res)=>res.json({user:publicUser(req.user)}));
  app.get('/api/auth/me', requireUser, (req, res) => res.json({ user: publicUser(req.user) }));
  app.post('/api/auth/logout', async (req, res) => {
    const token = req.bookingAccess?(readToken(req,'bogea_guest_session')||readToken(req)):readToken(req);
    if (token) await database.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
    res.clearCookie(cookieName, sessionCookieOptions()).json({ ok: true });
  });
  app.post('/api/auth/register', async (req, res) => {
    const key = `register:${req.ip}`;
    const current = attempts.get(key);
    const attempt = current && current.until > Date.now() ? current : { count: 0, until: Date.now() + 15 * 60000 };
    if (attempt.count >= 10) return res.status(429).json({ error: 'Muitas tentativas de cadastro. Tente novamente em 15 minutos.' });
    attempt.count++; attempts.set(key,attempt);
    const { name, email, password } = req.body;
    if (typeof name !== 'string' || name.trim().length < 2 || name.length > 120 || typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== 'string' || password.length < 12 || password.length > 256) return res.status(400).json({ error: 'Informe nome, e-mail e senha com 12 a 256 caracteres.' });
    try {
      await database.user.create({ data: { name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await hashPassword(password), role: 'CLIENT' } });
      res.status(201).json({ ok: true });
    } catch (error) { if (error.code === 'P2002') return res.status(409).json({ error: 'Não foi possível cadastrar esse e-mail. Tente entrar na sua conta.' }); throw error; }
  });
}





