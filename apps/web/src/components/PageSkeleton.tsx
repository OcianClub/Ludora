import { LoadingSkeleton } from './LoadingSkeleton';
import { HomeSkeleton } from './HomeSkeleton';
import type { LoadingPage } from '../utils/pageLoading';
import './PageSkeleton.css';
import '../pages/Dashboard.css';

const titles: Record<LoadingPage, string> = {
  home: 'Visão geral', players: 'Jogadores', player: 'Perfil do jogador', scout: 'Scout dos jogadores',
  teams: 'Times', schedule: 'Partidas', match: 'Detalhes da partida', requests: 'Solicitações',
  members: 'Pessoas e acessos', profile: 'Meu perfil', club: 'Configurações do clube', competition: 'Competições',
};

function Lines() { return <div className="loading-skeleton-copy"><span className="loading-skeleton-line"/><span className="loading-skeleton-line loading-skeleton-line--short"/></div>; }
export function ScoutSkeleton() {
  return <div className="scout-collection-loading" data-skeleton-page="scout" role="status" aria-label="Carregando elenco">
    <div className="page-skeleton-summary" aria-hidden="true">{[1,2,3].map(n => <Lines key={n}/>)}</div>
    <div className="page-skeleton-toolbar" aria-hidden="true"><span className="loading-skeleton-line"/></div>
    <LoadingSkeleton kind="table" label="Carregando atletas" count={6}/>
  </div>;
}
export function PageSkeleton({ page, contentOnly = false, manager = false }: { page: LoadingPage; contentOnly?: boolean; manager?: boolean }) {
  if (page === 'home') return <div className="dashboard" data-skeleton-page={page}>
    <div className="page-header"><div><h1 className="page-title">Visão geral</h1><span className="loading-skeleton-line loading-skeleton-line--short"/></div></div>
    <HomeSkeleton manager={manager}/></div>;
  if (page === 'scout' && contentOnly) return <ScoutSkeleton/>;
  const kind = page === 'match' ? 'match' : ['club','profile'].includes(page) ? 'form'
    : ['teams','schedule'].includes(page) ? 'cards' : page === 'requests' ? 'rows' : 'table';
  return <div className={`page-skeleton page-skeleton--${page}`} data-skeleton-page={page} aria-busy="true">
    {!contentOnly && <header className="page-skeleton-heading" aria-hidden="true"><h1 className="page-title">{titles[page]}</h1>
      <span className="loading-skeleton-line loading-skeleton-line--short"/>
    </header>}
    {!contentOnly && ['players','scout','teams','schedule'].includes(page) && <div className="page-skeleton-controls" aria-hidden="true">{[1,2,3,4].map(n => <span className="loading-skeleton-line" key={n}/>)}</div>}
    {page === 'scout' ? <ScoutSkeleton/> : page === 'player' ? <>
      <div className="page-skeleton-identity" aria-hidden="true"><span className="loading-skeleton-mark"/><Lines/></div>
      <div className="page-skeleton-summary" aria-hidden="true">{[1,2,3,4].map(n=><Lines key={n}/>)}</div>
      <LoadingSkeleton kind="table" count={3} label="Carregando perfil do jogador"/>
    </> : <LoadingSkeleton kind={kind} count={page === 'match' ? 3 : 4} label={`Carregando ${titles[page].toLowerCase()}`}/>}
  </div>;
}
