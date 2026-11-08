const oldNames={
 'Escova curta':'Curta','Escova média':'Média','Escova longa':'Longa','Escova extra-longa / mega-hair':'Extra-longa, mega-hair',
 'Penteado sem escova':'Sem escova','Penteado com escova':'Com escova','Penteado para cacheadas sem finalização':'Cacheada sem finalização','Penteado para cacheadas com finalização':'Cacheada com finalização',
 'Maquiagem express':'Express','Maquiagem social':'Social','Penteado para noiva':'Penteado','Maquiagem para noiva':'Maquiagem',
 'Curso de automaquiagem':'Automaquiagem','Curso de maquiagem profissional':'Maquiagem Profissional','Curso de escova modelada':'Escova modelada'
};
const descriptions={
 'COR':'Serviço de coloração capilar. Escolha a técnica desejada para o seu cabelo.',
 'ALISAMENTO':'Selagem capilar conforme a região escolhida: raiz ou comprimento total.',
 'ESCOVA':'Escovação e finalização conforme o comprimento do cabelo indicado no serviço.',
 'PENTEADO':'Produção de penteado conforme a modalidade escolhida, com ou sem preparação dos fios.',
 'MAQUIAGEM':'Produção de maquiagem conforme a modalidade escolhida.',
 'NOIVA':'Produção de beleza para noiva conforme o serviço escolhido.',
 'SOBRANCELHAS':'Cuidado e valorização das sobrancelhas conforme a técnica selecionada.',
 'CURSOS':'Aula de formação na modalidade indicada. Este cadastro é de curso, não de atendimento de beleza.',
 'ADICIONAIS':'Complemento opcional de um serviço principal. Não pode ser agendado separadamente.'
};
// Valores em reais e durações em minutos. Nomes se repetem entre categorias.
export const salonCatalog=[
 ['COR','Morena iluminada',450,240],
 ['COR','Mechas loiras',500,360,'Valor de R$ 500,00 a R$ 600,00, conforme avaliação. O valor inicial é R$ 500,00.'],
 ['COR','Loiro com fundo de clareamento',750,480],
 ['COR','Coloração raiz',150,120],
 ['COR','Coloração total',350,180],
 ['COR','Gloss, tonalização',180,120],
 ['COR','Correção de cor',500,240],
 ['COR','Ruivo',400,180],
 ['ALISAMENTO','Selagem Raiz',200,120],
 ['ALISAMENTO','Selagem total',280,180],
 ['ESCOVA','Escova curta',60,60],
 ['ESCOVA','Escova média',70,60],
 ['ESCOVA','Escova longa',80,60],
 ['ESCOVA','Escova extra-longa / mega-hair',100,90],
 ['ADICIONAIS','Chapinha ou babyliss',40,30],
 ['ADICIONAIS','Prender o cabelo no grampo',10,15],
 ['PENTEADO','Penteado sem escova',170,45],
 ['PENTEADO','Penteado com escova',200,60],
 ['PENTEADO','Penteado para cacheadas sem finalização',170,60],
 ['PENTEADO','Penteado para cacheadas com finalização',230,90],
 ['MAQUIAGEM','Maquiagem express',170,40],
 ['MAQUIAGEM','Maquiagem social',200,60],
 ['NOIVA','Penteado para noiva',350,120],
 ['NOIVA','Maquiagem para noiva',350,120],
 ['SOBRANCELHAS','Design convencional',40,30],
 ['SOBRANCELHAS','Design com henna',55,50],
 ['SOBRANCELHAS','Brow lamination',180,90],
 ['CURSOS','Curso de automaquiagem',450,240],
 ['CURSOS','Curso de maquiagem profissional',1250,480],
 ['CURSOS','Curso de escova modelada',700,300]
].map(([category,name,price,duration,description=''])=>({category,name,price,duration,description:description||descriptions[category],active:true}));
export async function replaceSalonCatalog(tx){
 await tx.$executeRaw`SELECT pg_advisory_xact_lock(5241, 1)`;
 const now=new Date();
 // Changing a service while its payment is pending can invalidate confirmation.
 if(await tx.booking.count({where:{status:'Aguardando pagamento',expiresAt:{gt:now}}}))throw new Error('Há reservas aguardando pagamento. Aguarde o fim dos prazos antes de substituir o catálogo.');
 const existing=await tx.service.findMany({orderBy:{id:'asc'}}),ids=[];
 for(const name of new Set(salonCatalog.map(s=>s.category)))await tx.category.upsert({where:{name},update:{},create:{name}});
 for(const service of salonCatalog){
   let match=existing.find(s=>s.category===service.category&&s.name===service.name);
   if(!match&&oldNames[service.name])match=existing.find(s=>s.category===service.category&&s.name===oldNames[service.name]);
   // Keep the previous ID when an old uniquely named service moves category.
   if(!match&&salonCatalog.filter(s=>s.name===service.name).length===1){const candidates=existing.filter(s=>s.name===service.name);if(candidates.length===1)match=candidates[0];}
   const row=match?await tx.service.update({where:{id:match.id},data:service}):await tx.service.create({data:service});ids.push(row.id);
 }
 const old=existing.filter(s=>!ids.includes(s.id));let deleted=0,archived=0;
 for(const service of old){
   const linked=await tx.booking.count({where:{serviceIds:{has:service.id}}});
   if(linked){await tx.service.update({where:{id:service.id},data:{active:false}});archived++;}
   else{await tx.service.delete({where:{id:service.id}});deleted++;}
 }
 // Remove obsolete unreferenced IDs from explicit professional assignments.
 const allIds=(await tx.service.findMany({select:{id:true}})).map(s=>s.id);
 for(const p of await tx.professional.findMany({where:{allServices:false}})){const serviceIds=p.serviceIds.filter(id=>allIds.includes(id));if(serviceIds.length!==p.serviceIds.length)await tx.professional.update({where:{id:p.id},data:{serviceIds}});}
 return {active:ids.length,categories:new Set(salonCatalog.map(s=>s.category)).size,deleted,archived};
}


