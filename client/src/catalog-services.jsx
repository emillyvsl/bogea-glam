import React, { useMemo, useState } from 'react';
import { Search, Check, Plus, Clock3, X } from 'lucide-react';
import { money } from './api';

const CATEGORY_LABEL = {
  cabelo: 'Cabelo',
  maquiagem: 'Maquiagem',
  sobrancelha: 'Sobrancelha',
  tratamento: 'Tratamento',
};

export default function CatalogServices({ services, professionals=[], selected, onToggle, onContinue }) {
  const [query, setQuery] = useState(()=>new URLSearchParams(window.location.search).get('busca')||'');
  const [category, setCategory] = useState('all');

  // Categorias derivadas dos serviços reais
  const categories = useMemo(() => {
    const set = new Set(services.map(s => s.category).filter(Boolean));
    return ['all', ...set];
  }, [services]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return services.filter(s => {
      const matchQuery = !q || normalize(s.name).includes(q);
      const matchCat = category === 'all' || s.category === category;
      return matchQuery && matchCat;
    });
  }, [services, query, category]);

  // Totais
  const chosen = services.filter(s => selected.includes(s.id));
  const total = chosen.reduce((sum, s) => sum + Number(s.price), 0);
  const totalMinutes = chosen.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const deposit = Math.round(total * 0.3 * 100) / 100;

  return (
    <section className="service-list-step" aria-labelledby="svc-title">
      <header className="service-list-head">
        
        <h1 id="svc-title">O que vamos fazer hoje?</h1>
        <p className="service-list-sub">
          Selecione um serviço por vez. O total e o sinal aparecem antes de confirmar.
        </p>
      </header>

      {/* Busca + categorias */}
      <div className="catalog-tools">
        <label className="catalog-search">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            placeholder="Buscar por nome do serviço…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label="Buscar serviço"
          />
        </label>

        <label className="catalog-category-select">
          <span>Categoria</span>
          <select aria-label="Filtrar por categoria" value={category} onChange={e=>setCategory(e.target.value)}>
            {categories.map(cat=><option key={cat} value={cat}>{cat==='all'?'Todas as categorias':CATEGORY_LABEL[cat]||cat}</option>)}
          </select>
        </label>
      </div>

      <p className="catalog-result-count" aria-live="polite">
        {filtered.length} {filtered.length === 1 ? 'serviço' : 'serviços'}
        {category !== 'all' && ` em ${CATEGORY_LABEL[category] || category}`}
      </p>

      {/* Grade de cards */}
      {filtered.length === 0 ? (
        <div className="catalog-empty">
          Nenhum serviço encontrado. Tente outro nome ou categoria.
          <button className="outline-button" type="button" onClick={()=>{setQuery('');setCategory('all');}}>Limpar busca e filtros</button>
        </div>
      ) : (
        <div className="service-grid">
          {filtered.map(s => {
            const isSelected = selected.includes(s.id);
            const staff=professionals.filter(p=>p.active!==false&&(p.allServices||p.serviceIds?.includes(s.id)));
            return (
              <article
                key={s.id}
                className={`service-card ${isSelected ? 'is-selected' : ''}`}
              >
                <div className="service-card-media">
                  {s.image
                    ? <img src={s.image} alt="" loading="lazy" />
                    : <div className="service-card-placeholder" aria-hidden="true" />}
                  {isSelected && (
                    <span className="service-card-check" aria-hidden="true">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  )}
                </div>

                <div className="service-card-body">
                  <h3>{s.name}</h3>
                  {s.description && (
                    <p className="service-card-desc">{s.description}</p>
                  )}
                  <p className="service-card-professionals"><strong>Profissionais:</strong> {staff.length?staff.map(p=>p.name).join(', '):'Nenhum profissional disponível'}</p>
                  <div className="service-card-meta">
                    {s.duration ? (
                      <span>
                        <Clock3 size={13} aria-hidden="true" />
                        {formatMinutes(Number(s.duration))}
                      </span>
                    ) : null}
                    <strong>{money(Number(s.price))}</strong>
                  </div>
                </div>

                <button
                  type="button"
                  className={`service-card-action ${isSelected ? 'remove' : ''}`}
                  onClick={() => onToggle(s.id)}
                  disabled={!staff.length&&!isSelected}
                  aria-pressed={isSelected}
                  aria-label={isSelected ? `Remover ${s.name}` : `Agendar ${s.name}`}
                >
                  {isSelected
                    ? <><X size={15}/> Remover</>
                    : <><Plus size={15}/> Agendar</>}
                </button>
              </article>
            );
          })}
        </div>
      )}

      {chosen.length>0&&!professionals.some(p=>p.active!==false&&(p.allServices||chosen.every(s=>p.serviceIds?.includes(s.id))))&&<p className="notice" role="alert">Nenhum profissional está disponível para este serviço. Escolha outro para continuar.</p>}
      {/* Barra fixa de resumo + continuar */}
      {chosen.length > 0 && (
        <div className="service-summary-bar" role="region" aria-label="Resumo do pedido">
          <div className="service-summary-info">
            <strong>
              {chosen.length} {chosen.length === 1 ? 'serviço' : 'serviços'}
            </strong>
            <span>
              Total {money(total)} · Sinal {money(deposit)} · ~{formatMinutes(totalMinutes)}
            </span>
          </div>
          <button type="button" className="gold-button" disabled={!professionals.some(p=>p.active!==false&&(p.allServices||chosen.every(s=>p.serviceIds?.includes(s.id))))} onClick={onContinue}>
            Continuar →
          </button>
        </div>
      )}
    </section>
  );
}

function formatMinutes(min) {
  if (!min) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h${m ? ` ${m}min` : ''}` : `${m}min`;
}

const normalize=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();





