import {canComplement} from './service-complements';
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
  const [showAddons,setShowAddons]=useState(false);

  // Categorias derivadas dos serviços reais
  const categories = useMemo(() => {
    const set = new Set(services.filter(s=>!isAddon(s)).map(s => s.category).filter(Boolean));
    return ['all', ...set];
  }, [services]);

  const filtered = useMemo(() => {
    const q = normalize(query.trim());
    return services.filter(s => {
      if(isAddon(s))return false;
      const matchQuery = !q || normalize(s.name+' '+s.category).includes(q);
      const matchCat = category === 'all' || s.category === category;
      return matchQuery && matchCat;
    });
  }, [services, query, category]);

  // Totais
  const chosen = services.filter(s => selected.includes(s.id));
  const mainService=services.find(s=>s.id===selected[0]);
  const addons=services.filter(s=>canComplement(mainService,s));
  const total = chosen.reduce((sum, s) => sum + Number(s.price), 0);
  const totalMinutes = chosen.reduce((sum, s) => sum + (Number(s.duration) || 0), 0);
  const deposit = Math.round(total * 0.3 * 100) / 100;

  if(showAddons&&mainService)return <section className="service-list-step addons-step"><button type="button" className="back-button" onClick={()=>setShowAddons(false)}>← Voltar aos serviços</button><header className="service-list-head"><h1>{String(mainService.category).toUpperCase()==='ESCOVA'?'Quer finalizar sua escova?':'Quer adicionar penteado, babyliss ou prender no grampo?'}</h1><p className="service-list-sub">Serviço escolhido: <strong>{mainService.name}</strong>. Os adicionais são opcionais.</p></header><section className="service-addons"><h3>Complementos opcionais</h3>{addons.map(addon=>{const checked=selected.includes(addon.id),compatible=professionals.some(p=>p.active!==false&&(p.allServices||chosen.filter(s=>s.id!==addon.id).every(s=>p.serviceIds?.includes(s.id))&&p.serviceIds?.includes(addon.id)));return <label key={addon.id}><input type="checkbox" checked={checked} disabled={!compatible&&!checked} onChange={()=>onToggle(addon.id,true)}/><span><strong>{isAddon(addon)&&/babyliss|baby.?lis/i.test(addon.name)?'Finalização com babyliss':addon.name}</strong><small>{formatMinutes(addon.duration)} · {money(Number(addon.price))}{!compatible?' · Sem profissional compatível':''}</small></span></label>;})}</section><div className="addons-total"><strong>Total {money(total)}</strong><span>Sinal de 30%: {money(deposit)} · Duração: {formatMinutes(totalMinutes)}</span></div><button type="button" className="gold-button" disabled={!professionals.some(p=>p.active!==false&&(p.allServices||chosen.every(s=>p.serviceIds?.includes(s.id))))} onClick={onContinue}>{chosen.length>1?'Continuar com os complementos':'Continuar sem adicionais'} →</button></section>;
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
                <div className="service-card-body">
                  <div className="service-card-title"><h3>{s.name}</h3>{isSelected&&<Check size={18} aria-label="Serviço selecionado"/>}</div>
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
              1 serviço{chosen.length>1? +  adicional(is):''}
            </strong>
            <span>
              Total {money(total)} · Sinal {money(deposit)} · ~{formatMinutes(totalMinutes)}
            </span>
          </div>
          <button type="button" className="gold-button" disabled={!professionals.some(p=>p.active!==false&&(p.allServices||chosen.every(s=>p.serviceIds?.includes(s.id))))} onClick={()=>addons.length?setShowAddons(true):onContinue()}>
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







const isAddon=service=>String(service.category||'').trim().toUpperCase()==='ADICIONAIS';





