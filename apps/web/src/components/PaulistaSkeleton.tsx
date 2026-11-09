import './PaulistaSkeleton.css';

const labels: Record<string, string> = { visao: 'resumo', jogos: 'jogos', classificacao: 'classificação', chaveamento: 'chaveamento', avisos: 'avisos' };
const Line = ({ short = false }: { short?: boolean }) => <span className={`paulista-skeleton-line${short ? ' is-short' : ''}`}/>;
const Team = () => <div className="paulista-skeleton-team"><span className="paulista-skeleton-badge"/><Line/></div>;
function Game() {
  return <div className="paulista-skeleton-card"><Line short/><div className="paulista-skeleton-contest"><Team/><span className="paulista-skeleton-score"/><Team/></div><Line/><Line short/></div>;
}
export function PaulistaSkeleton({ tab }: { tab: string }) {
  return <div className={`paulista-skeleton is-${tab}`} role="status" aria-label={`Carregando ${labels[tab] || 'dados'} do campeonato`}>
    <div aria-hidden="true">
      <div className="paulista-skeleton-tabs">{[0, 1, 2, 3].map(i => <Line key={i}/>)}</div>
      {tab === 'jogos' ? <>
        <div className="paulista-skeleton-search"><Line/><span className="paulista-skeleton-badge"/></div>
        <div className="paulista-skeleton-games">{[0, 1, 2].map(i => <Game key={i}/>)}</div>
      </> : tab === 'classificacao' ? <>
        <div className="paulista-skeleton-card paulista-skeleton-ranking"><Team/><span className="paulista-skeleton-score"/></div>
        <div className="paulista-skeleton-table">{[0, 1, 2, 3, 4, 5, 6].map(i => <div key={i}><Line short/><Team/><Line short/><Line short/></div>)}</div>
      </> : tab === 'chaveamento' ? <>
        <div className="paulista-skeleton-search"><Line short/></div>
        <div className="paulista-skeleton-map">{[4, 2, 1].map((count, i) => <div key={i}><Line short/>{Array.from({ length: count }, (_, j) => <Game key={j}/>)}</div>)}</div>
        <div className="paulista-skeleton-rounds">{[0, 1, 2].map(i => <Game key={i}/>)}</div>
      </> : tab === 'avisos' ? <div className="paulista-skeleton-card"><Line/><Line/><Line short/></div> : <>
        <div className="paulista-skeleton-card paulista-skeleton-hero"><div><Team/><Line/><Line short/></div><span className="paulista-skeleton-score"/></div>
        <div className="paulista-skeleton-metrics">{[0, 1, 2, 3].map(i => <div key={i}><Line short/><span className="paulista-skeleton-score"/></div>)}</div>
        <div className="paulista-skeleton-columns"><div className="paulista-skeleton-card"><Line short/><Team/><Line/><Team/><Line/></div><div className="paulista-skeleton-card"><Line short/><Team/><Team/><Team/></div></div>
      </>}
    </div>
  </div>;
}
