import { useEffect, useState } from 'react';
import { Btn, Modal, Spinner } from './UI';
import { fetchContextoScout, type PerfilJogador } from '../services/api';
import { formatMatchDate } from './MatchCard';
import { hasAssessment, profileClass, profileDescription } from '../utils/scoutPlayers';
import { resumirContextoScout, formatarMediaScout, type ContextoScout } from '../../../mobile/src/utils/contextoScout';
import { PositionIcon } from './PositionIcon';

const AXES = [
  ['finalizacao', 'Finalização'], ['tecnica', 'Técnica'], ['intensidade', 'Intensidade'],
  ['disciplina', 'Disciplina'], ['defesa', 'Defesa'], ['visao_de_jogo', 'Visão de jogo'],
] as const;

export function ScoutPlayerDetail({ player, category, onClose }: { player: PerfilJogador; category: string; onClose: () => void }) {
  const [context, setContext] = useState<ContextoScout | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
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
      <div><h2>{player.nome}</h2><p className="position-inline"><PositionIcon position={player.posicao}/>{player.posicao || 'Posição não informada'} · {category}{player.idade != null ? ` · ${player.idade} anos` : ''}</p>
        <span className="scout-profile-label">{hasAssessment(player) ? player.perfil_ml : 'Ainda não avaliado'}</span>
      </div>
      <div className="scout-rating"><span>Índice</span><strong>{hasAssessment(player) ? player.nota_geral!.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) : '—'}</strong></div>
      <p className="scout-profile-description">{hasAssessment(player) ? profileDescription[player.perfil_ml!] || 'Avaliação disponível para os registros atuais.' : 'A ausência de avaliação não significa nota zero.'}</p>
    </header>

    <section className="scout-detail-section" aria-labelledby="scout-recent-title">
      <h3 id="scout-recent-title">Momento do atleta</h3>
      <p className="scout-help">Eventos registrados em partidas finalizadas.</p>
      {loading ? <Spinner /> : error ? <div role="alert" className="scout-inline-error"><p>{error}</p><Btn variant="ghost" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</Btn></div> : context && summary && <>
        <p className="scout-sample">{context.total_partidas} partidas finalizadas com registro.{summary.poucosRegistros && ' Amostra inicial: menos de 5 partidas. Evite conclusões a partir de poucos registros.'}</p>
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
        <svg viewBox="0 0 320 270" aria-hidden="true" className="scout-radar">
          {[25, 50, 75, 100].map(radius => <polygon key={radius} points={AXES.map((_, index) => point(index, radius)).join(' ')} className="scout-radar-grid" />)}
          {AXES.map((_, index) => <line key={index} x1="160" y1="130" x2={point(index, 100).split(',')[0]} y2={point(index, 100).split(',')[1]} className="scout-radar-grid" />)}
          <polygon points={axes.map((axis, index) => point(index, Math.max(0, Math.min(100, axis.value!)))).join(' ')} className="scout-radar-data" />
          {axes.map((axis, index) => { const [x, y] = point(index, 122).split(','); return <text key={axis.key} x={x} y={y} textAnchor="middle" dominantBaseline="middle">{axis.label}</text>; })}
        </svg>
        <dl className="scout-axis-values">{axes.map(axis => <div key={axis.key}><dt>{axis.label}</dt><dd><meter min="0" max="100" value={axis.value} aria-label={axis.label} /><span>{Math.round(axis.value!)}</span></dd></div>)}</dl>
      </div>
      <p className="scout-help">Escala relativa aos atletas analisados. 100 representa o maior valor observado no conjunto atual.</p>
    </section>}
    <section className="scout-detail-section"><h3>Totais registrados</h3><p className="scout-help">Acumulados do cadastro atual, incluindo partidas em andamento. Não correspondem apenas ao recorte recente.</p>
      <dl className="scout-detail-totals">{[
        ['Escalações', player.totalPartidas], ['Gols', player.totalGols], ['Assistências', player.totalAssistencias],
        ['Defesas', player.totalDefesas], ['Cartões', player.totalCartoes], ['Faltas', player.totalFaltas],
      ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    </section>
  </Modal>;
}
