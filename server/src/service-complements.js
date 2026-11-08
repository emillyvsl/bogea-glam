const normalized=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function validateComplements(services,serviceIds){
 const main=services.find(s=>s.id===serviceIds[0]),base=main?.category.trim().toUpperCase();
 if(services.every(s=>s.category.trim().toUpperCase()==='ADICIONAIS'))throw new Error('Adicionais precisam acompanhar um serviço principal.');
 for(const extra of services.filter(s=>s.category.trim().toUpperCase()==='ADICIONAIS')){
  const name=normalized(extra.name),valid=base==='MAQUIAGEM'?/babyliss|baby.?lis|grampo/.test(name):base==='ESCOVA'?/babyliss|baby.?lis|grampo/.test(name):false;
  if(!valid)throw new Error('Este adicional não é compatível com o serviço principal.');
 }
}

