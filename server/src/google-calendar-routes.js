import {randomBytes} from 'node:crypto';
import {prisma} from './db.js';
import {requireStaff,requireAdmin} from './auth.js';
import {frontendOrigin} from './config.js';
import {localNow} from './scheduling.js';
import {googleEnabled,googleConfigured,createOAuthClient,authorizationUrl,digest,encryptToken,decryptToken,queueGoogleCalendar} from './google-calendar.js';

const sessionHash=req=>digest((req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('bogea_session='))?.slice(14)||'');
const ownProfessional=req=>req.user.professional?.active?req.user.professional.id:null;
export async function consumeOAuthState(db,state,userId,professionalId,session){
  if(typeof state!=='string'||!/^[a-f0-9]{64}$/.test(state))return false;
  const used=await db.googleCalendarOAuthState.deleteMany({where:{hash:digest(state),userId,professionalId,sessionHash:session,expiresAt:{gt:new Date()}}});
  return used.count===1;
}
const connectionSelect={id:true,professionalId:true,googleAccountEmail:true,status:true,connectedAt:true};
const syncSelect={bookingId:true,status:true,attempts:true,lastError:true,syncedAt:true};
export function registerGoogleCalendar(app){
  app.get('/api/google-calendar/status',requireStaff,async(req,res)=>{
    const professionalId=ownProfessional(req);
    const connection=professionalId?await prisma.googleCalendarConnection.findFirst({where:{professionalId,status:'CONNECTED'},select:connectionSelect}):null;
    const syncs=professionalId?await prisma.googleCalendarSync.findMany({where:{booking:{professionalId}},select:syncSelect,orderBy:{updatedAt:'desc'},take:30}):[];
    res.json({enabled:googleEnabled(),configured:googleConfigured(),professionalId,connection,syncs});
  });
  // POST avoids a third-party GET initiating an authorization flow.
  app.post('/api/google-calendar/connect',requireStaff,async(req,res)=>{
    if(!googleConfigured())return res.status(503).json({error:'A integração Google Agenda ainda não foi configurada no servidor.'});
    const professionalId=ownProfessional(req);if(!professionalId)return res.status(403).json({error:'Vincule este usuário a um profissional ativo na aba Equipe.'});
    const state=randomBytes(32).toString('hex');
    await prisma.googleCalendarOAuthState.deleteMany({where:{OR:[{expiresAt:{lt:new Date()}},{userId:req.user.id}]}});
    await prisma.googleCalendarOAuthState.create({data:{hash:digest(state),userId:req.user.id,professionalId,sessionHash:sessionHash(req),expiresAt:new Date(Date.now()+600000)}});
    res.json({url:authorizationUrl(state)});
  });
  app.get('/api/google-calendar/callback',requireStaff,async(req,res)=>{
    const professionalId=ownProfessional(req);
    if(!googleConfigured()||!professionalId||!await consumeOAuthState(prisma,req.query.state,req.user.id,professionalId,sessionHash(req)))return res.status(400).send('Autorização inválida ou expirada. Volte ao gerenciador e conecte novamente.');
    const back=new URL('/admin/perfil',frontendOrigin());back.searchParams.set('google','error');
    if(req.query.error||typeof req.query.code!=='string')return res.redirect(back.toString());
    try{
      const oauth=createOAuthClient();const {tokens}=await oauth.getToken({code:req.query.code});
      const identity=await oauth.verifyIdToken({idToken:tokens.id_token,audience:process.env.GOOGLE_CLIENT_ID});
      const profile=identity.getPayload();if(!profile?.email_verified||!tokens.refresh_token)throw new Error('Missing verified identity or refresh token');
      const encrypted=encryptToken(tokens.refresh_token);
      await prisma.$transaction(async tx=>{
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(5241, 2)`;
        const connected=await tx.googleCalendarConnection.findFirst({where:{professionalId,status:'CONNECTED'}});
        if(connected&&connected.googleAccountEmail!==profile.email)throw new Error('Disconnect the current account first');
        const previous=await tx.googleCalendarConnection.findFirst({where:{professionalId,googleAccountEmail:profile.email},orderBy:{connectedAt:'desc'}});
        if(previous)await tx.googleCalendarConnection.update({where:{id:previous.id},data:{status:'CONNECTED',refreshTokenEncrypted:encrypted}});
        else await tx.googleCalendarConnection.create({data:{professionalId,googleAccountEmail:profile.email,refreshTokenEncrypted:encrypted}});
        const bookings=await tx.booking.findMany({where:{professionalId,status:{in:['Confirmado','Em atendimento']},bookingDate:{gte:new Date(localNow().date+'T00:00:00Z')}}});
        for(const booking of bookings)await queueGoogleCalendar(tx,booking);
      });
      back.searchParams.set('google','connected');
    }catch{ /* Never log OAuth codes or provider responses containing tokens. */ }
    res.redirect(back.toString());
  });
  app.delete('/api/google-calendar/disconnect',requireStaff,async(req,res)=>{
    const professionalId=ownProfessional(req);if(!professionalId)return res.status(403).json({error:'Usuário sem profissional vinculado.'});
    const connection=await prisma.googleCalendarConnection.findFirst({where:{professionalId,status:'CONNECTED'}});
    if(connection){
      // Keep the destination identity for auditing, but erase the encrypted secret.
      await prisma.$transaction(async tx=>{
        await tx.googleCalendarConnection.update({where:{id:connection.id},data:{status:'DISCONNECTED',refreshTokenEncrypted:null}});
        await tx.googleCalendarOAuthState.deleteMany({where:{professionalId}});
      });
      try{await createOAuthClient().revokeToken(decryptToken(connection.refreshTokenEncrypted));}catch{ /* Locally disconnected even if revocation is unavailable. */ }
    }
    res.json({ok:true});
  });
  app.get('/api/admin/google-calendar',requireAdmin,async(_req,res)=>{
    const professionals=await prisma.professional.findMany({select:{id:true,name:true,googleConnections:{where:{status:'CONNECTED'},select:connectionSelect}}});
    const syncs=await prisma.googleCalendarSync.findMany({where:{status:{in:['RETRY','PENDING','PROCESSING']}},select:syncSelect,orderBy:{updatedAt:'desc'},take:100});
    res.json({professionals,syncs});
  });
  app.post('/api/admin/google-calendar/retry/:bookingId',requireAdmin,async(req,res)=>{
    if(!googleConfigured())return res.status(503).json({error:'Google Agenda desativado ou sem configuração.'});
    const id=Number(req.params.bookingId);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Reserva inválida.'});
    const booking=await prisma.booking.findUnique({where:{id}});if(!booking)return res.status(404).json({error:'Reserva não encontrada.'});
    await queueGoogleCalendar(prisma,booking);res.json({ok:true});
  });
}
