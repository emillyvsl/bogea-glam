import React from 'react';
import { ArrowLeft,Plus,Search } from 'lucide-react';
export function ListHeader({title,count,onNew,newLabel,search,onSearch}) {
  return <div className="crud-list-header"><div className="crud-record-count"><strong>{count}</strong> registro(s)</div><button className="gold-button" onClick={onNew}><Plus size={17}/>{newLabel}</button><label className="crud-search"><Search size={17}/><input aria-label={`Buscar ${title.toLowerCase()}`} value={search} onChange={e=>onSearch(e.target.value)} placeholder="Buscar por nome…"/></label></div>;
}
export function EditorHeader({title,onBack,disabled=false}) {
  return <header className="crud-editor-header"><button className="outline-button" type="button" disabled={disabled} onClick={onBack}><ArrowLeft size={16}/>Voltar à lista</button><h2>{title}</h2><p>Revise os dados e salve suas alterações.</p></header>;
}
export function StatusBadge({active}){return <span className={`crud-status ${active?'active':'inactive'}`}>{active?'Ativo':'Inativo'}</span>;}
