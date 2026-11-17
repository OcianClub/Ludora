import { useState } from 'react';
import type { Time } from '../services/api';
import { teamName } from '../utils/teamIdentity';
import { ClubBadge } from './Brand';
import { CollectionSearch, CollectionViewToggle } from './CollectionToolbar';
import { RadioIndicator } from './RadioIndicator';
import { Icon } from './Icon';
import './MatchOpponentPicker.css';

export function MatchOpponentPicker({ clubName, categoryName, teams, recentIds = [], selectedId, search, onSearch, onSelect }: {
  clubName: string; categoryName: string; teams: Time[]; selectedId?: number;
  recentIds?: number[];
  search: string; onSearch: (value: string) => void; onSelect: (id: number) => void;
}) {
  const [recentOnly, setRecentOnly] = useState(false);
  const options = recentOnly ? teams.filter(team => recentIds.includes(team.id)) : teams;
  const selectedVisible = options.some(team => team.id === selectedId);
  return <div className="match-opponent-picker">
    <div className="match-opponent-context"><span>Escolha quem enfrenta o</span><strong>{clubName} · {categoryName.toUpperCase()}</strong></div>
    <div className="match-opponent-search"><CollectionSearch label="Buscar adversário" placeholder="Nome do adversário" value={search} onChange={onSearch}/></div>
    {!!recentIds.length && <div className="match-opponent-shortcuts"><CollectionViewToggle label="Filtrar adversários" value={recentOnly ? 'recentes' : 'todos'} onChange={value=>setRecentOnly(value==='recentes')} options={[{value:'todos',label:'Todos',icon:'team'},{value:'recentes',label:'Recentes',icon:'clock'}]}/></div>}
    <div className="match-opponent-list" role="radiogroup" aria-label="Adversários disponíveis" onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')];
      const current = options.indexOf(document.activeElement as HTMLButtonElement);
      options[event.key === 'Home' ? 0 : event.key === 'End' ? options.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + options.length) % options.length]?.focus();
    }}>
      {[true, false].map(ludora => {
        const group = options.filter(team => !!team.clube_representado_id === ludora);
        return group.length ? <section key={String(ludora)} className="match-opponent-group" aria-label={ludora ? 'Ludora' : 'Outros times'}>
          <div className="match-opponent-group-heading"><h3>{ludora ? 'Ludora' : 'Outros times'}</h3><span>{group.length}</span></div>
          <p>{ludora ? 'O outro clube precisará aceitar o confronto.' : 'Confrontos criados diretamente.'}</p>
          {group.map(team => <button key={team.id} type="button" className="match-opponent-option" role="radio" aria-label={teamName(team.nome)} aria-checked={team.id === selectedId}
            tabIndex={selectedVisible ? team.id === selectedId ? 0 : -1 : options[0]?.id === team.id ? 0 : -1} onClick={() => onSelect(team.id)}>
            <ClubBadge src={team.escudo || team.clubeRepresentado?.escudo} name={team.nome} size={40} fallbackWhileLoading/>
            <strong>{teamName(team.nome)}</strong><RadioIndicator checked={team.id===selectedId}/>
          </button>)}
        </section> : null;
      })}
      {!options.length && <div className="match-opponent-empty"><Icon name="search" size={24}/><p>{search ? 'Nenhum adversário encontrado.' : recentOnly ? 'Nenhum adversário recente disponível.' : 'Nenhum adversário disponível nesta categoria.'}</p>{(search || recentOnly) && <button type="button" onClick={() => { onSearch(''); setRecentOnly(false); }}>Limpar busca</button>}</div>}
    </div>
  </div>;
}
