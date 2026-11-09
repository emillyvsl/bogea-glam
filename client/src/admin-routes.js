export const adminPaths={Agenda:'/admin',Histórico:'/admin/historico',Serviços:'/admin/servicos',Categorias:'/admin/categorias',Clientes:'/admin/clientes',Pagamentos:'/admin/pagamentos',WhatsApp:'/admin/whatsapp',Funcionamento:'/admin/configuracoes',Equipe:'/admin/equipe',Bloqueios:'/admin/bloqueios','Meu perfil':'/admin/perfil','Novo agendamento':'/admin/novo-agendamento'};
export const isAdminPath=path=>path==='/admin'||path.startsWith('/admin/');
export function adminTab(location=window.location){
  const query=new URLSearchParams(location.search);
  if(query.has('google'))return 'Meu perfil';
  const path=location.pathname.replace(/\/+$/,'');
  if(path==='/admin/agenda')return 'Agenda';
  return Object.keys(adminPaths).find(tab=>adminPaths[tab]===path)||'Agenda';
}
export function canonicalAdminUrl(location=window.location){
  const url=new URL(location.href);
  if(!isAdminPath(url.pathname)&&url.pathname!=='/equipe'&&!url.searchParams.has('painel'))return null;
  const legacy=url.searchParams.get('painel');
  const tab=url.searchParams.has('google')?'Meu perfil':Object.keys(adminPaths).find(name=>name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===legacy)||adminTab(url);
  url.pathname=adminPaths[tab];url.searchParams.delete('painel');
  return url;
}
