const category=s=>String(s?.category||'').trim().toUpperCase();
const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function canComplement(main,extra){
 if(!main||!extra||main.id===extra.id)return false;
 const base=category(main),kind=category(extra),name=normalize(extra.name);
 if(base==='MAQUIAGEM')return kind==='PENTEADO'||(kind==='ADICIONAIS'&&/babyliss|baby.?lis|grampo/.test(name));
 if(base==='ESCOVA')return kind==='ADICIONAIS'&&/babyliss|baby.?lis|grampo/.test(name);
 return false;
}

