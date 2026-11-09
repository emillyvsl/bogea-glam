const sections=new Set(['trabalhos','sobre','booking','maquiagem']);
const storageKey='bogea-section-navigation';
function scrollToSection(id){
  let observer,timer;
  const scroll=()=>{const element=document.getElementById(id);if(!element)return false;element.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});observer?.disconnect();clearTimeout(timer);return true;};
  if(scroll())return;
  observer=new MutationObserver(scroll);observer.observe(document.body,{childList:true,subtree:true});timer=setTimeout(()=>observer.disconnect(),15000);
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
