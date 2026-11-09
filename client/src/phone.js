export function formatWhatsApp(value){
  let digits=String(value||'').replace(/\D/g,'');
  if(digits.startsWith('55')&&digits.length>11)digits=digits.slice(2);
  digits=digits.slice(0,11);
  if(!digits)return '';
  if(digits.length<=2)return `(${digits}`;
  const number=digits.slice(2),split=number.length>8?5:4;
  return `(${digits.slice(0,2)}) ${number.slice(0,split)}${number.length>split?'-'+number.slice(split):''}`;
}
