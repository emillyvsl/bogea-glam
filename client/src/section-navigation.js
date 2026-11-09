const sections=new Set(['trabalhos','sobre','booking','maquiagem']);
const storageKey='bogea-section-navigation';
let cancelNavigation=()=>{};
function scrollToSection(id){
  cancelNavigation();
  let observer,timer;
  const scroll=()=>{
    const element=document.getElementById(id);if(!element)return false;
    observer?.disconnect();clearTimeout(timer);
    const started=performance.now();let correction;
    const align=()=>{clearTimeout(correction);correction=setTimeout(()=>{
      const margin=parseFloat(getComputedStyle(element).scrollMarginTop)||0;
      if(Math.abs(element.getBoundingClientRect().top-margin)>4)element.scrollIntoView({block:'start',behavior:'instant'});
    },Math.max(120,650-(performance.now()-started)));};
    const resize=new ResizeObserver(align);resize.observe(document.body);resize.observe(element);
    const stop=()=>{resize.disconnect();clearTimeout(correction);clearTimeout(timer);document.removeEventListener('load',align,true);for(const event of ['wheel','touchstart','pointerdown','keydown'])window.removeEventListener(event,stop);};
    cancelNavigation=stop;
    document.addEventListener('load',align,true);
    for(const event of ['wheel','touchstart','pointerdown','keydown'])window.addEventListener(event,stop,{passive:true});
    element.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    timer=setTimeout(stop,8000);return true;
  };
  if(scroll())return;
  observer=new MutationObserver(scroll);observer.observe(document.body,{childList:true,subtree:true});timer=setTimeout(()=>observer.disconnect(),15000);
  cancelNavigation=()=>{observer.disconnect();clearTimeout(timer);};
}
export function setupSectionNavigation(){
  const url=new URL(window.location.href);
  let pending;
  if(sections.has(url.hash.slice(1))){pending=url.hash.slice(1);url.hash='';window.history.replaceState(window.history.state,'',url);}
  try{const saved=JSON.parse(sessionStorage.getItem(storageKey)||'null');sessionStorage.removeItem(storageKey);if(!pending&&saved?.path===url.pathname+url.search&&sections.has(saved.section))pending=saved.section;}catch{}
  if(pending)scrollToSection(pending);
  document.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const anchor=event.target.closest?.('a[href]');if(!anchor||anchor.target==='_blank'||anchor.hasAttribute('download'))return;
    const destination=new URL(anchor.href,window.location.href),id=destination.hash.slice(1);
    if(destination.origin!==window.location.origin||!sections.has(id))return;
    const samePage=destination.pathname===window.location.pathname&&destination.search===window.location.search;
    destination.hash='';
    if(samePage){event.preventDefault();scrollToSection(id);return;}
    try{sessionStorage.setItem(storageKey,JSON.stringify({path:destination.pathname+destination.search,section:id}));event.preventDefault();window.location.assign(destination.href);}catch{}
  });
}
