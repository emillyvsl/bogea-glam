import {createHash} from 'node:crypto';
import {prisma} from './db.js';
import {verifyPayment,webhookEnabled} from './payments.js';
import {fail} from './salon.js';
export async function recordPaymentEvent(input,source='webhook'){
 const orderId=input.order_nsu,transactionId=input.transaction_nsu,slug=input.slug||input.invoice_slug;
 const event=String(input.event||input.type||'paid').toLowerCase();
 if(!['paid','settled','refunded','canceled','created','payment_failed'].includes(event)||typeof orderId!=='string'||!orderId||orderId.length>200)fail('Evento de pagamento inválido.');
 for(const value of [transactionId,slug])if(value!=null&&(typeof value!=='string'||!value||value.length>200))fail('Identificadores inválidos.');
 if(!await prisma.payment.findUnique({where:{id:orderId},select:{id:true}}))fail('Cobrança não encontrada.',404);
 const key=createHash('sha256').update(JSON.stringify([source,event,orderId,transactionId||'',slug||''])).digest('hex');
 return prisma.paymentEvent.upsert({where:{key},update:{},create:{key,orderId,transactionId,slug,event,status:['refunded','canceled','payment_failed'].includes(event)?'Revisão necessária':event==='created'?'Informativo':transactionId&&slug?'Pendente':'Identificadores ausentes',error:['refunded','canceled','payment_failed'].includes(event)?'Aviso sem assinatura. Conferir na conta InfinitePay; não houve alteração automática da reserva.':null}});
}
let running=false;
export async function reconcilePaymentEvents(){
 if(running)return {processed:0};running=true;let processed=0;
 try{const events=await prisma.paymentEvent.findMany({where:{status:{in:['Pendente','Verificando']},nextAttemptAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:10});
 for(const event of events){const claim=await prisma.paymentEvent.updateMany({where:{id:event.id,status:{in:['Pendente','Verificando']},nextAttemptAt:{lte:new Date()}},data:{status:'Verificando',attempts:{increment:1},nextAttemptAt:new Date(Date.now()+120000)}});if(!claim.count)continue;
 try{const result=await verifyPayment({order_nsu:event.orderId,transaction_nsu:event.transactionId,slug:event.slug});await prisma.paymentEvent.update({where:{id:event.id},data:{status:result.confirmed?'Verificado':result.status==='Em análise'?'Revisão necessária':event.attempts>=9?'Revisão necessária':'Pendente',error:result.confirmed?null:result.reason||result.status,nextAttemptAt:new Date(Date.now()+Math.min(60,2**Math.min(event.attempts,6))*60000)}});}catch(error){await prisma.paymentEvent.update({where:{id:event.id},data:{status:event.attempts>=9?'Revisão necessária':'Pendente',error:'Não foi possível verificar no provedor. Nova tentativa programada.',nextAttemptAt:new Date(Date.now()+Math.min(60,2**Math.min(event.attempts,6))*60000)}});}processed++;}
 }finally{running=false;}return {processed};
}
export function registerPaymentEvents(app,requireRoot){
 const receive=async(req,res)=>{if(!webhookEnabled())return res.sendStatus(404);await recordPaymentEvent(req.body);res.json({ok:true});setImmediate(()=>reconcilePaymentEvents().catch(()=>console.error('Falha na conciliação; eventos preservados no banco.')));};
 app.post('/api/webhooks/infinitepay',receive);app.post('/webhooks/infinitepay',receive);
 app.post('/api/admin/payments/reconcile',requireRoot,async(req,res)=>{if(req.body.order_nsu)await recordPaymentEvent(req.body,'root');res.json(await reconcilePaymentEvents());});
}
