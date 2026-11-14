import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GestaoPartida } from '../services/sharedMatches';
import { MATCH_METRICS, matchInsights } from '../utils/matchInsights';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { ResponsivePanel } from './ResponsivePanel';
import './MatchInsights.css';
import { MatchHighlights } from './MatchHighlights';

export function MatchInsights({ data, selectedPeriod, placement }: {
  data: GestaoPartida;
  selectedPeriod?: number | null;
  placement?: { analysis: HTMLElement; highlights: HTMLElement };
}) {
  const [localPeriod, setPeriod] = useState<number | null>(null);
  const period = selectedPeriod === undefined ? localPeriod : selectedPeriod;
  const [help, setHelp] = useState<HTMLButtonElement | null>(null);
  const teams = useMemo(() => matchInsights(data, period), [data, period]);
  const maxPeriod = Math.max(1, data.partida.periodo_atual || 1, ...data.eventos.map(event => event.periodo || 1));
  const live = data.partida.status === 'AO_VIVO';
  const highlights = <MatchHighlights data={data} period={period} />;
  const analysis = <section className={`match-insights${placement ? ' is-split' : ''}`} aria-labelledby="match-insights-title">
    <header className="match-insights-heading">
      <div><h2 id="match-insights-title">{period === null ? 'Raio-X da partida' : `Estatísticas do ${period}º tempo`}</h2><p>{period === null ? 'Partida inteira' : 'Somente os eventos deste tempo'} · {live ? 'destaques provisórios' : 'registros da súmula'}</p></div>
      <button type="button" className="match-insights-info" aria-label="Como são calculados os destaques e as estatísticas"
        aria-haspopup="dialog" aria-expanded={!!help} onClick={event => setHelp(help ? null : event.currentTarget)}><Icon name="info" size={20} /></button>
    </header>
    {selectedPeriod === undefined && <div className="match-insights-periods" role="group" aria-label="Filtrar estatísticas por tempo">
      {[null, ...Array.from({ length: maxPeriod }, (_, i) => i + 1)].map(value => <button type="button" key={value ?? 'all'} aria-pressed={period === value} onClick={() => setPeriod(value)}>{value === null ? 'Todos' : `${value}º tempo`}</button>)}
    </div>}
    <div className="match-insights-grid">
      <article className="match-insights-comparison" aria-label="Comparativo dos times">
        <div className="match-insights-team-names">{teams.map(team => <div key={team.id}><ClubBadge src={team.badge} name={team.name} size={28} /><strong title={team.name}>{team.name}</strong></div>)}</div>
        <dl>{MATCH_METRICS.filter(([key]) => !key.startsWith('CARTAO_')).map(([key, label]) => {
          const values = teams.map(team => team.totals[key]);
          const max = Math.max(1, ...values);
          return <div className="match-insights-metric" key={key}><dt>{label}</dt><dd>
            <strong>{values[0]}</strong><span className="match-insights-bars" aria-hidden="true"><span><i style={{ width: `${values[0] / max * 100}%` }} /></span><span><i style={{ width: `${values[1] / max * 100}%` }} /></span></span><strong>{values[1]}</strong>
          </dd></div>;
        })}</dl>
        <section className="match-insights-card-summary" aria-label="Cartões registrados">
          <dl>{MATCH_METRICS.filter(([key]) => key.startsWith('CARTAO_')).map(([key, label]) => <div key={key}>
            <dt><i className={`match-insights-card-icon ${key.toLowerCase()}`} aria-hidden="true" />{label}</dt>
            <dd><strong>{teams[0].totals[key]}</strong><span aria-hidden="true">–</span><strong>{teams[1].totals[key]}</strong></dd>
          </div>)}</dl>
        </section>
      </article>
      {!placement && highlights}
    </div>
    {help && <ResponsivePanel anchor={help} wide title="Como interpretar o Raio-X" onClose={() => setHelp(null)} className="match-insights-help">
      <p><strong>Participação em gols:</strong> gols + (assistências × 0,6). É um critério do Ludora para destacar contribuições registradas, sem dar nota ou definir o melhor jogador.</p>
      <p><strong>Defesas:</strong> maior quantidade registrada, analisada separadamente. Todos os empates são preservados. Gols contra entram no placar do adversário e não pontuam o autor.</p>
      <p>Usamos apenas eventos publicados e atletas da escalação publicada. Lances sem jogador não contam para os destaques. Zero significa nenhum registro; não mede habilidade, minutos em campo ou eficiência.</p>
      <p>Em “Todos”, gols seguem o placar da súmula, inclusive correções. Por tempo, mostram os eventos de gol registrados. O filtro é apenas para consulta; não altera a partida.</p>
      <p>{live ? 'Durante o jogo, os destaques são provisórios. Os lances aparecem depois dos cinco segundos de cancelamento e da confirmação do servidor.' : 'Correções posteriores da súmula atualizam esta análise.'}</p>
      <small>Fórmula própria, sem homologação de federação. Referência de ponderação: <a href="https://sportslabtools.com/en/futsal/stats/" target="_blank" rel="noreferrer">exemplo configurável do SportsLab</a>.</small>
    </ResponsivePanel>}
  </section>;
  // Keep one filter state for both columns, and the original reading order on mobile.
  return placement ? <>{createPortal(analysis, placement.analysis)}{createPortal(highlights, placement.highlights)}</> : analysis;
}
