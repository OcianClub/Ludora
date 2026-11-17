import { CollectionSearch } from './CollectionToolbar';
import { RadioIndicator } from './RadioIndicator';
import { Icon } from './Icon';
import type { Competicao } from '../services/api';
import './MatchOpponentPicker.css';

export function MatchCompetitionPicker({ items, value, search, onSearch, onSelect }: {
  items:Competicao[]; value:string; search:string; onSearch:(value:string)=>void; onSelect:(value:string)=>void;
}) {
  const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
  const visible=items.filter(item=>normalize(`${item.nome} ${item.ano}`).includes(normalize(search)));
  const friendly=!search.trim() || normalize('Amistoso Sem competição').includes(normalize(search));
  const choices=[...(friendly ? [{id:'amistoso',name:'Amistoso',detail:'Sem competição',icon:'ball' as const}] : []),...visible.map(item=>({id:String(item.id),name:item.nome,detail:`Temporada ${item.ano}`,icon:'trophy' as const}))];
  const selectedVisible=choices.some(item=>item.id===value);
  return <div className="match-opponent-picker match-competition-picker">
    <p className="match-opponent-context">Escolha uma competição ou jogue um amistoso.</p>
    <div className="match-opponent-search"><CollectionSearch label="Buscar competição ou ano" placeholder="Nome da competição ou ano" value={search} onChange={onSearch}/></div>
    <div className="match-opponent-list" role="radiogroup" aria-label="Competições disponíveis" onKeyDown={event=>{
      if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
      event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')],index=buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[event.key==='Home' ? 0 : event.key==='End' ? buttons.length-1 : (index+(event.key==='ArrowUp' ? -1 : 1)+buttons.length)%buttons.length]?.focus();
    }}>
      {choices.map((item,index)=><button key={item.id} type="button" className="match-opponent-option" role="radio" aria-label={`${item.name}${item.id==='amistoso' ? '' : ` · ${item.detail}`}`} aria-checked={value===item.id} tabIndex={selectedVisible ? value===item.id ? 0 : -1 : index===0 ? 0 : -1} onClick={()=>onSelect(item.id)}><span className="match-picker-symbol"><Icon name={item.icon} size={20}/></span><span className="match-picker-copy"><strong>{item.name}</strong><small>{item.detail}</small></span><RadioIndicator checked={value===item.id}/></button>)}
      {!choices.length && <div className="match-opponent-empty"><Icon name="search" size={24}/><p>Nenhuma competição encontrada.</p><button type="button" onClick={()=>onSearch('')}>Limpar busca</button></div>}
    </div>
  </div>;
}
