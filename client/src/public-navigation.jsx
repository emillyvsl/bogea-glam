import React,{useEffect,useState} from 'react';
export default function PublicNavigation(){
  const services=window.location.pathname==='/servicos';
  const consulting=window.location.pathname==='/consultar';
  const [active,setActive]=useState(()=>consulting?'consultar':services?'agenda':window.location.hash==='#sobre'?'sobre':'portfolio');
  useEffect(()=>{
    if(services||consulting)return;
    const update=()=>setActive(window.location.hash==='#sobre'?'sobre':'portfolio');
    window.addEventListener('hashchange',update);
    const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting)setActive(entry.target.id==='sobre'?'sobre':'portfolio');}},{rootMargin:'-15% 0px -45% 0px',threshold:0});
    for(const id of ['trabalhos','sobre']){const section=document.getElementById(id);if(section)observer.observe(section);}
    return()=>{window.removeEventListener('hashchange',update);observer.disconnect();};
  },[services,consulting]);
  return <nav aria-label="Navegação principal">{[['portfolio','Portfólio','/#trabalhos'],['sobre','Sobre','/#sobre'],['agenda','Agendar','/servicos#booking'],['consultar','Consultar','/consultar']].map(([key,label,href])=><a key={key} href={href} className={active===key?'portfolio-active':''} aria-current={active===key?((key==='agenda'||key==='consultar')?'page':'location'):undefined} onClick={()=>{if(!services&&key!=='agenda')setActive(key);}}>{label}</a>)}</nav>;
}





