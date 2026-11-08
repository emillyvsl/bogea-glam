export const frontendOrigin=()=>new URL(process.env.FRONTEND_URL||process.env.APP_ORIGIN||'http://localhost:5173').origin;
export const apiOrigin=()=>process.env.APP_URL||process.env.PUBLIC_API_URL||'';
export function paymentUrls(){
 const redirect=process.env.INFINITEPAY_REDIRECT_URL||frontendOrigin().replace(/\/$/,'')+'/pagamento-concluido';
 const webhook=process.env.INFINITEPAY_WEBHOOK_URL||(apiOrigin()?apiOrigin().replace(/\/$/,'')+'/api/webhooks/infinitepay':'');
 for(const value of [redirect,webhook].filter(Boolean)){const url=new URL(value);if(!['http:','https:'].includes(url.protocol)||(process.env.NODE_ENV==='production'&&url.protocol!=='https:'))throw new Error('URLs de pagamento devem usar HTTPS em produção.');}
 return {redirect,webhook};
}

