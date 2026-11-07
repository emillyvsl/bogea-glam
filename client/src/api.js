const apiBase=(import.meta.env.VITE_API_URL||'').replace(/\/$/,'');
export const API=apiBase?(apiBase.endsWith('/api')?apiBase:apiBase+'/api'):'/api';
export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, { credentials: 'include', cache: 'no-store', ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    const unavailable=new Error('A conexão com o servidor foi interrompida. Aguarde alguns instantes e atualize a página.');
    unavailable.connectionLost=true;
    throw unavailable;
  }
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!data || typeof data !== 'object') {
    const error = new Error(response.status >= 500
      ? 'O servidor está indisponível. Confira se o backend e o PostgreSQL estão rodando e tente novamente.'
      : 'O servidor retornou uma resposta inválida. Atualize a página e tente novamente.');
    error.status = response.status;
    error.connectionLost=response.status>=500;
    throw error;
  }
  if (!response.ok) { const error = new Error(data.error || 'Não foi possível concluir.'); error.status = response.status; throw error; }
  return data;
}
export const send = (path, body, method = 'POST') => api(path,{ method, body: JSON.stringify(body) });
export const money = value => new Intl.NumberFormat('pt-BR',{ style:'currency',currency:'BRL' }).format(value);
export const time = value => `${String(Math.floor(value/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`;
export const minute = value => { const [h,m] = value.split(':').map(Number); return h*60+m; };
export const today = () => new Intl.DateTimeFormat('en-CA',{ timeZone:'America/Rio_Branco',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
export const dateLabel = value => new Intl.DateTimeFormat('pt-BR',{ weekday:'long',day:'numeric',month:'long' }).format(new Date(`${value}T12:00:00Z`));


