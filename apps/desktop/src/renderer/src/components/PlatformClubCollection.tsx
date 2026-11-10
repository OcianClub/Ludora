import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ClubeResumo } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Icon } from '@web/components/Icon';
import { DesktopTable, DesktopSortButton } from './DesktopTable';
import './PlatformClubCollection.css';

export type PlatformClubSortKey = 'nome' | 'cidade' | 'membros' | 'jogadores' | 'partidas' | 'ativo';
export type PlatformClubSort = { key: PlatformClubSortKey; dir: 1 | -1 } | null;

const columns: readonly [PlatformClubSortKey, string][] = [
  ['nome', 'Clube'], ['cidade', 'Cidade'], ['membros', 'Membros'],
  ['jogadores', 'Jogadores'], ['partidas', 'Partidas'], ['ativo', 'Status'],
];
const metrics = [['membros', 'Membros'], ['jogadores', 'Jogadores'], ['partidas', 'Partidas']] as const;
const numero = (value: number) => value.toLocaleString('pt-BR');
const cidade = (clube: ClubeResumo) => [clube.cidade, clube.estado].filter(Boolean).join(' · ') || 'Não informada';

function ClubPlan({ plano }: { plano: string }) {
  return <span className="overview-plan">{plano}</span>;
}

function ClubStatus({ ativo }: { ativo: boolean }) {
  return <span className="overview-club-status" data-health={ativo ? 'good' : 'unknown'}>
    {ativo ? 'Ativo' : 'Indisponível'}
  </span>;
}

/** Composição compartilhada dos cards de resumo; não faz consultas nem grava dados. */
export function PlatformSummaryCard({ icon, title, subtitle, status, metrics, to, onClick, label, tooltip, className = '', returnTo }: {
  icon: ReactNode; title: ReactNode; subtitle: ReactNode; status: ReactNode;
  metrics: readonly { label: string; value: ReactNode }[];
  to?: string; onClick?: () => void; label?: string; tooltip?: string; className?: string;
  returnTo?: string;
}) {
  const content = <>
    {icon}
    <span className="ticket-card-copy">
      <strong>{title}</strong><small>{subtitle}</small>
    </span>
    <Icon name="chevronRight" size={16}/>
    <span className="platform-summary-status">{status}</span>
    <dl className="club-directory-meta" style={{ gridTemplateColumns: `repeat(${Math.max(1, metrics.length)}, minmax(0, 1fr))` }}>{metrics.map(({label, value}) => <div key={label}>
      <dt>{label}</dt><dd>{value}</dd>
    </div>)}</dl>
  </>;
  const props = { className: `club-directory-card platform-club-card platform-club-surface ${className}`, 'aria-label': label, title: tooltip };
  return to ? <Link {...props} to={to} state={returnTo ? { voltarClubes: returnTo } : undefined}>{content}</Link> : <button {...props} type="button" onClick={onClick}>{content}</button>;
}

export function PlatformClubCard({ clube, returnTo }: { clube: ClubeResumo; returnTo?: string }) {
  return <PlatformSummaryCard to={`/clubes/${clube.id}`} returnTo={returnTo}
    icon={<ClubBadge src={clube.escudo} name={clube.nome} size={40}/>}
    title={<><span title={clube.nome}>{clube.nome}</span><ClubPlan plano={clube.plano}/></>}
    subtitle={cidade(clube)} status={<ClubStatus ativo={clube.ativo}/>}
    metrics={metrics.map(([key,label])=>({label,value:numero(clube[key])}))}/>;
}

export function PlatformClubOption({ clube, name, checked, onSelect, disabled = false, detail }: {
  clube: Pick<ClubeResumo, 'id' | 'nome' | 'escudo' | 'cidade' | 'estado'>; name: string; checked: boolean; onSelect: () => void; disabled?: boolean; detail?: string;
}) {
  return <label className="platform-club-option platform-club-surface" data-disabled={disabled}>
    <ClubBadge src={clube.escudo} name={clube.nome} size={32}/>
    <span className="platform-club-option-copy"><strong title={clube.nome}>{clube.nome}</strong><small>{detail || [clube.cidade, clube.estado].filter(Boolean).join(' · ') || 'Não informada'}</small></span>
    <input type="radio" name={name} aria-label={clube.nome} checked={checked} onChange={onSelect} disabled={disabled}/>
  </label>;
}

export function PlatformClubCards({ clubes, returnTo }: { clubes: readonly ClubeResumo[]; returnTo?: string }) {
  return <div className="club-directory overview-club-cards">
    {clubes.map(clube => <PlatformClubCard key={clube.id} clube={clube} returnTo={returnTo}/>)}
  </div>;
}

export function PlatformClubTable({ clubes, ordem, onSort }: {
  clubes: readonly ClubeResumo[];
  ordem: PlatformClubSort;
  onSort: (key: PlatformClubSortKey) => void;
}) {
  return <DesktopTable label="Clubes na plataforma" className="overview-table-scroll" tableClassName="overview-club-table">
      <thead><tr>
        {columns.map(([key, label]) => <th key={key} scope="col"
          aria-sort={ordem?.key === key ? ordem.dir === 1 ? 'ascending' : 'descending' : 'none'}>
          <DesktopSortButton label={label} direction={ordem?.key === key ? ordem.dir === 1 ? 'asc' : 'desc' : undefined} onClick={() => onSort(key)}/>
        </th>)}
        <th scope="col"><span className="sr-only">Detalhes</span></th>
      </tr></thead>
      <tbody>{clubes.map(clube => <tr key={clube.id}>
        <td><Link className="overview-club-name" to={`/clubes/${clube.id}`}>
          <ClubBadge src={clube.escudo} name={clube.nome} size={32}/>
          <strong title={clube.nome}>{clube.nome}</strong><ClubPlan plano={clube.plano}/>
        </Link></td>
        <td>{cidade(clube)}</td>
        {metrics.map(([key]) => <td key={key}>{numero(clube[key])}</td>)}
        <td><ClubStatus ativo={clube.ativo}/></td>
        <td><Link className="overview-open-club" aria-label={`Gerenciar ${clube.nome}`} to={`/clubes/${clube.id}`}>
          <Icon name="chevronRight" size={16}/>
        </Link></td>
      </tr>)}</tbody>
  </DesktopTable>;
}
