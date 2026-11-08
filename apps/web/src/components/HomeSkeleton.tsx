function Line({ short = false }: { short?: boolean }) {
  return <span className={`home-placeholder home-skeleton-line${short ? ' is-short' : ''}`} />;
}
function Heading() {
  return <div className="home-section-heading"><span className="home-placeholder home-skeleton-heading" /></div>;
}
function Team() {
  return <div className="home-skeleton-team"><span className="home-placeholder home-skeleton-crest" /><Line /></div>;
}
function Row() {
  return <div className="home-skeleton-row"><span className="home-placeholder home-skeleton-mark" /><div><Line /><Line short /></div></div>;
}

export function HomeSkeleton({ manager }: { manager: boolean }) {
  return <div className="home-skeleton" role="status" aria-label="Carregando visão geral" aria-busy="true">
    <div aria-hidden="true">
      <div className="home-controls home-skeleton-controls">
        <div className="home-skeleton-phases"><span className="home-placeholder" /><span className="home-placeholder" /></div>
        <div className="home-skeleton-subs">{[0, 1, 2, 3].map(n => <span key={n} className="home-placeholder" />)}</div>
      </div>
      <div className={`home-focus home-skeleton-grid${manager ? '' : ' home-focus-public'}`}>
        <section className="home-feature"><Heading /><div className="home-skeleton-card home-skeleton-match">
          <Line /><div className="home-skeleton-scoreboard"><Team /><span className="home-placeholder home-skeleton-score" /><Team /></div>
          <div className="home-skeleton-divider"><Line /><Line short /></div><span className="home-placeholder home-skeleton-button" />
        </div></section>
        <div className="home-side">
          {manager && <section className="home-pending"><Heading /><div className="home-skeleton-card home-skeleton-pending"><Row /><Row /><Row /><Line /></div></section>}
          <section className="home-upcoming"><Heading /><div className="home-skeleton-card"><Line short /><Row /></div></section>
          {!manager && <section className="home-highlights"><Heading /><div className="home-skeleton-card"><Row /><Row /></div></section>}
        </div>
      </div>
      <section className="home-history home-skeleton-history"><Heading /><div className="home-history-table-wrap">
        <div className="history-summary"><Line short /><div className="history-summary-results">{[0, 1, 2, 3, 4].map(n => <span className="history-summary-result" key={n}><span className="home-placeholder home-skeleton-circle" /></span>)}</div><div className="history-summary-totals"><Line /></div></div>
        <table className="home-history-table"><thead><tr>
          <th><Line short /></th><th className="history-competition"><Line /></th><th className="history-confrontation"><Line /></th><th className="history-result-cell"><Line short /></th>
        </tr></thead><tbody>{[0, 1, 2, 3, 4].map(n => <tr key={n}>
          <td><Line short /></td><td className="history-competition"><Line /></td><td className="history-confrontation"><div className="history-table-teams">
            <span><span className="home-placeholder home-skeleton-mark" /><Line /></span>
            <div className="history-table-score"><span className="home-placeholder home-skeleton-digit" /><i /><span className="home-placeholder home-skeleton-digit" /></div>
            <span><span className="home-placeholder home-skeleton-mark" /><Line /></span>
          </div></td>
          <td className="history-result-cell"><span className="home-placeholder home-skeleton-result" /></td>
        </tr>)}</tbody></table>
      </div></section>
    </div>
  </div>;
}
