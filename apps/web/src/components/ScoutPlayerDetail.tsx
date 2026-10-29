import { useEffect, useState } from 'react';
import { Btn, Modal, Spinner } from './UI';
import { fetchContextoScout, type PerfilJogador } from '../services/api';
import { formatMatchDate } from './MatchCard';
import { hasAssessment, profileClass, profileDescription } from '../utils/scoutPlayers';
import { resumirContextoScout, formatarMediaScout, type ContextoScout } from '../../../mobile/src/utils/contextoScout';
import { PositionIcon } from './PositionIcon';
import { Icon, type IconName } from './Icon';
import { ScoutIndexHelp } from './ScoutIndexHelp';

const AXES = [
  ['finalizacao', 'Finalização'], ['tecnica', 'Técnica'], ['intensidade', 'Intensidade'],
  ['disciplina', 'Disciplina'], ['defesa', 'Defesa'], ['visao_de_jogo', 'Visão de jogo'],
] as const;

export function ScoutPlayerDetail({ player, category, onClose }: { player: PerfilJogador; category: string; onClose: () => void }) {
  const [context, setContext] = useState<ContextoScout | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [radarOpen, setRadarOpen] = useState(() => !window.matchMedia('(max-width: 600px)').matches);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setContext(null);
    fetchContextoScout(player.id, controller.signal).then(data => {
      if (!controller.signal.aborted) setContext(data);
    }).catch(() => {
      if (!controller.signal.aborted) setError('Não foi possível carregar o histórico. Os totais do atleta continuam disponíveis abaixo.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [player.id, attempt]);
  const summary = context ? resumirContextoScout(context) : null;
  const axes = AXES.map(([key, label]) => ({ key, label, value: player.scores_ml?.[key] }));
  const hasAxes = axes.every(axis => typeof axis.value === 'number' && Number.isFinite(axis.value));
  const point = (index: number, value: number) => {
    const angle = (index * 60 - 90) * Math.PI / 180;
    return `${160 + Math.cos(angle) * value},${130 + Math.sin(angle) * value}`;
  };
  return <Modal open title="Ficha do atleta" className="scout-detail-dialog" onClose={onClose}>
    <header className={`scout-detail-identity scout-tone-${profileClass(player)}`}>
      <span className="scout-shirt">{player.numCamisa != null ? `#${player.numCamisa}` : '—'}</span>
      <div className="scout-detail-person"><h2>{player.nome}</h2><p className="position-inline"><PositionIcon position={player.posicao}/>{player.posicao || 'Posição não informada'} · {category}{player.idade != null ? ` · ${player.idade} anos` : ''}</p>
        <span className="scout-profile-label">{hasAssessment(player) ? player.perfil_ml : 'Ainda não avaliado'}</span>
      </div>
      <div className="scout-rating"><span>Índice</span><strong>{hasAssessment(player) ? player.nota_geral!.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</strong></div>
      <p className="scout-profile-description">{hasAssessment(player) ? profileDescription[player.perfil_ml!] || 'Avaliação disponível para os registros atuais.' : 'A ausência de avaliação não significa nota zero.'}</p>
    </header>

    <div className={`scout-detail-content scout-tone-${profileClass(player)}`}>
    <ScoutIndexHelp />
    <section className="scout-detail-section" aria-labelledby="scout-recent-title">
      <h3 id="scout-recent-title">Momento do atleta</h3>
      <p className="scout-help">Eventos registrados em partidas finalizadas.</p>
      {loading ? <Spinner /> : error ? <div role="alert" className="scout-inline-error"><p>{error}</p><Btn variant="ghost" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Btn></div> : context && summary && <>
        <p className={`scout-sample${summary.poucosRegistros ? ' is-small-sample' : ''}`}><Icon name="info" size={19}/><span><strong>{context.total_partidas} {context.total_partidas === 1 ? 'partida finalizada' : 'partidas finalizadas'} com registro.</strong>{summary.poucosRegistros && <small>Amostra inicial: menos de 5 partidas. Evite conclusões a partir de poucos registros.</small>}</span></p>
        {!!summary.tamanhoRecente && <>
          <h4>Médias nos últimos {summary.tamanhoRecente} registros</h4>
          <dl className="scout-detail-totals">{summary.metricas.map(metric => <div key={metric.campo}><dt>{metric.titulo}/jogo</dt><dd>{formatarMediaScout(metric.recente)}</dd>{summary.podeComparar && <small>5 anteriores: {formatarMediaScout(metric.anterior)}</small>}</div>)}</dl>
          <div className="scout-history-scroll"><table className="scout-history-table"><caption>Mais recentes primeiro · G: gols · A: assistências · D: defesas</caption>
            <thead><tr><th scope="col">Partida</th><th scope="col">G</th><th scope="col">A</th><th scope="col">D</th></tr></thead>
            <tbody>{context.partidas.map(match => <tr key={match.id}><th scope="row">{match.adversario}<small>{formatMatchDate(match.data)}</small></th><td>{match.gols}</td><td>{match.assistencias}</td><td>{match.defesas}</td></tr>)}</tbody>
          </table></div>
        </>}
        {!context.total_partidas && <p className="scout-help">O histórico aparece quando houver escalações ou eventos registrados em partidas finalizadas.</p>}
        <p className="scout-help">Zero significa nenhum evento registrado, não necessariamente ausência de ações em campo.</p>
      </>}
    </section>

    {hasAxes && <section className="scout-detail-section" aria-labelledby="scout-axes-title">
      <h3 id="scout-axes-title">Índices comparativos</h3>
      <div className="scout-comparison">
        <details className="scout-radar-disclosure" open={radarOpen} onToggle={event => setRadarOpen(event.currentTarget.open)}><summary>Gráfico de radar</summary><svg viewBox="0 0 320 270" aria-hidden="true" className="scout-radar">
          {[25, 50, 75, 100].map(radius => <polygon key={radius} points={AXES.map((_, index) => point(index, radius)).join(' ')} className="scout-radar-grid" />)}
          {AXES.map((_, index) => <line key={index} x1="160" y1="130" x2={point(index, 100).split(',')[0]} y2={point(index, 100).split(',')[1]} className="scout-radar-grid" />)}
          <polygon points={axes.map((axis, index) => point(index, Math.max(0, Math.min(100, axis.value!)))).join(' ')} className="scout-radar-data" />
          {axes.map((axis, index) => { const [x, y] = point(index, 122).split(','); return <text key={axis.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis.label}</text>; })}
        </svg></details>
        <dl className="scout-axis-values">{axes.map(axis => <div key={axis.key}><dt>{axis.label}</dt><dd><span className="scout-axis-track" role="meter" aria-label={axis.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.max(0, Math.min(100, axis.value!))}><span style={{ width: `${Math.max(0, Math.min(100, axis.value!))}%` }}/></span><span>{Math.round(axis.value!)}</span></dd></div>)}</dl>
      </div>
      <p className="scout-help">Indicadores em escala relativa ao grupo analisado; valores devem ser interpretados considerando os registros disponíveis.</p>
    </section>}
    <section className="scout-detail-section"><h3>Totais registrados</h3><p className="scout-help">Acumulados do cadastro atual, incluindo partidas em andamento. Não correspondem apenas ao recorte recente.</p>
      <dl className="scout-detail-totals scout-recorded-totals">{([
        ['Escalações', player.totalPartidas, 'team'], ['Gols', player.totalGols, 'ball'], ['Assistências', player.totalAssistencias, 'handshake'],
        ['Defesas', player.totalDefesas, 'defense'], ['Cartões', player.totalCartoes, 'alert'], ['Faltas', player.totalFaltas, 'whistle'],
      ] as [string, number, IconName][]).map(([label, value, icon]) => <div key={label}><Icon name={icon} size={18}/><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
    </div>
  </Modal>;
}
