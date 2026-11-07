import { Toast } from './Toast';
import { createPortal } from 'react-dom';
import { EVENT_REVIEW_MS, useDelayedMatchEvents } from '../hooks/useDelayedMatchEvents';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { comandoPartida, type GestaoPartida } from '../services/sharedMatches';
import {
  canIdentifyGoal,
  eventAuthorTeam,
  pendingGoal,
  eventScores,
  type MatchEvent,
} from '../utils/matchEvents';
import { Btn, Input, Modal, StatusBadge } from './UI';
import { Icon } from './Icon';
import { ClubBadge } from './Brand';
import { formatMatchDate } from './MatchCard';
import { EventIcon, EVENT_TYPES } from './EventIcon';
import { PositionIcon } from './PositionIcon';
import { PublishedLineups } from './PublishedLineups';
import { MatchResultSummary } from './MatchResultSummary';
import { FilterSelect } from './FilterSelect';
import { CollectionSearch } from './CollectionToolbar';
import './MatchLiveBoard.css';

type Props = {
  data: GestaoPartida;
  refresh: () => Promise<void>;
  players?: { id: number; nome: string; numCamisa?: number; posicao?: string }[];
  onEdit?: () => void;
  onResponsibility?: () => void;
};
type EventForm = {
  type: string;
  teamId: number;
  playerId: string;
  ownGoal: boolean;
  minute: string;
  reason: string;
  assistId: string;
  existing?: MatchEvent;
};

function EventReviewProgress({ due }: { due: number }) {
  const [elapsed] = useState(() => Math.min(EVENT_REVIEW_MS, Math.max(0, Date.now() - (due - EVENT_REVIEW_MS))));

  return (
    <span className="live-review-progress" aria-hidden="true">
      <i style={{ '--event-review-duration': `${EVENT_REVIEW_MS}ms`, animationDelay: `-${elapsed}ms` } as CSSProperties} />
    </span>
  );
}

export function MatchLiveBoard(props: Props) {
  const { clube, usuario } = useAuth();
  return <MatchLiveSession key={`${props.data.partida.id}:${clube?.id}:${usuario?.id}`} {...props} />;
}

function MatchLiveSession({ data, refresh, onEdit, onResponsibility, players = [] }: Props) {
  const { clube, usuario } = useAuth();
  const p = data.partida;
  const live = p.status === 'AO_VIVO';
  const mine = data.equipes.find((team) => team.id === data.minhaEquipeId);
  const operator =
    data.equipes.find((team) => team.clube_id === p.sumula_clube_id)?.clube.nome ||
    data.organizador.nome;
  const teams = [
    { ...p.mandante, id: p.mandante_id },
    { ...p.visitante, id: p.visitante_id },
  ];
  const [form, setForm] = useState<EventForm | null>(null);
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const board = useRef<HTMLDivElement>(null);
  const intent = useRef<{ signature: string; key: string } | null>(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [remove, setRemove] = useState<MatchEvent | null>(null);
  const [reason, setReason] = useState('');
  const [finish, setFinish] = useState(false);
  const [substitution, setSubstitution] = useState(false);
  const [out, setOut] = useState('');
  const [into, setInto] = useState('');
  const [scoreCorrection, setScoreCorrection] = useState(false);
  const [previousPeriod, setPreviousPeriod] = useState<number | null>(null);
  const [homeScore, setHomeScore] = useState('');
  const [awayScore, setAwayScore] = useState('');
  const [undoEvent, setUndoEvent] = useState<MatchEvent | null>(null);
  useEffect(() => {
    if (!live) board.current?.querySelector<HTMLElement>('#match-result-title')?.focus();
  }, [live]);
  const latest = useRef(data);
  latest.current = data;
  const delayed = useDelayedMatchEvents(p.id, `${usuario?.id}:${clube?.id}`, async (event) => {
    setUndoEvent(event);
    setFeedback(event ? `${EVENT_TYPES.find(type => type.value === event.tipo)?.label || 'Evento'} registrado na súmula.` : 'Evento revertido e súmula atualizada.');
    await updateView();
  }, data.podeSumula);
  const changing = busy || delayed.queue.length > 0;
  const scores = eventScores(data);
  const lastEvent = [...data.eventos].sort((a, b) => b.id - a.id)[0];
  const inHome = mine ? mine.time_id === p.mandante_id : p.emCasa;
  const totalTimes = /(?:16|18)/.test(p.categoria?.nome || '') ? 2 : 4;
  const auditEntries = [...data.auditoria].sort((a, b) =>
    new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime() || b.id - a.id,
  );
  function auditTitle(entry: GestaoPartida['auditoria'][number]) {
    const changes = entry.dados as { sai?: number; entra?: number } | null;
    const playerName = (id?: number) => data.equipes.flatMap(team => team.escalacao)
      .find(player => player.jogador_id === id)?.jogador?.nome || `Jogador #${id}`;
    return entry.acao === 'SUBSTITUICAO' && changes
      ? `${playerName(changes.sai)} → ${playerName(changes.entra)}`
      : entry.acao.toLowerCase().replace(/_/g, ' ');
  }
  function changePeriod(period: number) {
    void act(
      () => comandoPartida(p.id, 'periodo', { periodo: period, versao: latest.current.partida.versao }, 'PATCH'),
      () => setPreviousPeriod(null),
      'Tempo atualizado. Os eventos anteriores foram mantidos.',
    );
  }
  function goBackPeriod() {
    setError('');
    const target = p.periodo_atual - 1;
    if (data.eventos.some(event => event.periodo >= target)) setPreviousPeriod(target);
    else changePeriod(target);
  }
  function requestRemoval(event: MatchEvent) {
    setRemove(event);
    setReason('Registro equivocado durante a operação da súmula');
    setError('');
  }
  function subtractGoal(teamId: number) {
    const queued = [...delayed.queue].reverse().find(item => !item.attempted && item.status === 'waiting' && item.payload.tipo === 'GOL' && item.payload.time_id === teamId);
    if (queued) { delayed.cancel(queued.id); return; }
    const goal = [...data.eventos].sort((a, b) => b.id - a.id).find(event => event.tipo === 'GOL' && event.time_id === teamId);
    if (goal) requestRemoval(goal);
    else { setHomeScore(String(p.gols_mandante)); setAwayScore(String(p.gols_visitante)); setReason(''); setScoreCorrection(true); }
  }
  function teamDiscipline(teamId: number) {
    const events = data.eventos.filter(event => event.time_id === teamId && event.periodo === p.periodo_atual);
    const fouls = events.filter(event => event.tipo === 'FALTA').length;
    return <div className="live-discipline">
      <span className="live-foul-dots" aria-label={`${fouls} faltas cometidas no ${p.periodo_atual}º tempo`} data-tooltip="Faltas cometidas neste tempo">
        {Array.from({ length: 5 }, (_, index) => <i key={index} className={index < fouls ? 'is-filled' : ''} />)}
        {fouls > 5 && <small>+{fouls - 5}</small>}
      </span>
      <span className="live-card-totals" aria-label="Cartões recebidos na partida">
        {['AMARELO', 'VERMELHO', 'AZUL'].map(color => <span key={color} data-tooltip={`Cartões ${color.toLowerCase()}s`}><EventIcon type={`CARTAO_${color}`} />{data.eventos.filter(event => event.time_id === teamId && event.tipo === `CARTAO_${color}`).length}</span>)}
      </span>
    </div>;
  }
  const pending = data.eventos.filter((event) => pendingGoal(data, event));
  const actorId = form
    ? form.ownGoal
      ? form.teamId === p.mandante_id
        ? p.visitante_id
        : p.mandante_id
      : form.teamId
    : null;
  const actor = data.equipes.find((team) => team.time_id === actorId);
  const actorName = teams.find((team) => team.id === actorId)?.nome || 'Equipe';
  const teamName = teams.find((team) => team.id === form?.teamId)?.nome || '';
  const roster = [...(actor?.escalacao || []), ...(data.podeAnotarOficial && actor?.id === mine?.id ? players.filter(p => p.numCamisa && !actor?.escalacao.some(e => e.jogador_id === p.id)).map(p => ({ jogador_id: p.id, numCamisa: p.numCamisa!, titular: false, jogador: { nome: p.nome, posicao: p.posicao || '' } })) : [])].sort(
    (a, b) => Number(b.titular) - Number(a.titular) || a.numCamisa - b.numCamisa,
  );
  const visiblePlayers = roster.filter((player) =>
    `${player.numCamisa} ${player.jogador?.nome || ''}`
      .toLocaleLowerCase('pt-BR')
      .includes(search.trim().toLocaleLowerCase('pt-BR')),
  );
  const modalOpen = !!form || !!remove || finish || substitution || scoreCorrection || previousPeriod !== null;

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      board.current
        ?.querySelectorAll<HTMLDetailsElement>('.live-settings[open], .live-event-menu[open]')
        .forEach((menu) => {
          if (!menu.contains(event.target as Node)) menu.open = false;
        });
    };
    const dismissMenus = () => {
      board.current
        ?.querySelectorAll<HTMLDetailsElement>('.live-settings[open], .live-event-menu[open]')
        .forEach((menu) => {
          menu.open = false;
        });
    };
    document.addEventListener('pointerdown', closeMenus);
    window.addEventListener('resize', dismissMenus);
    return () => {
      document.removeEventListener('pointerdown', closeMenus);
      window.removeEventListener('resize', dismissMenus);
    };
  }, []);

  function placeEventMenu(details: HTMLDetailsElement) {
    if (!details.open) return;
    const trigger = details.querySelector('summary')!;
    const menu = details.querySelector<HTMLDivElement>(':scope > div')!;
    const anchor = trigger.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.right = 'auto';
    const bounds = menu.getBoundingClientRect();
    menu.style.left = `${Math.max(12, Math.min(innerWidth - bounds.width - 12, anchor.right - bounds.width))}px`;
    menu.style.top = `${anchor.bottom + bounds.height + 6 <= innerHeight ? anchor.bottom + 6 : Math.max(12, anchor.top - bounds.height - 6)}px`;
  }

  async function updateView() {
    try {
      await refresh();
    } catch {
      setFeedback('Alteração salva. Não conseguimos atualizar a tela; confira sua conexão.');
    }
  }
  async function act(operation: () => Promise<unknown>, done: () => void, message: string) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setFeedback('');
    setUndoEvent(null);
    try {
      await operation();
      done();
      setFeedback(message);
      await updateView();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Não foi possível confirmar a operação. Tente novamente.',
      );
      await updateView();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }
  function sendEvent(payload: Record<string, unknown>) {
    if (live) {
      const team = teams.find(team => team.id === payload.time_id);
      delayed.enqueue(payload, `${EVENT_TYPES.find(type => type.value === payload.tipo)?.label || 'Evento'} · ${team?.nome || 'Equipe'}`);
      setForm(null);
      return;
    }
    const signature = JSON.stringify(payload);
    if (intent.current?.signature !== signature)
      intent.current = { signature, key: crypto.randomUUID() };
    const requestId = intent.current.key;
    return act(
      () =>
        comandoPartida(p.id, 'eventos', { ...payload, request_id: requestId, versao: latest.current.partida.versao }),
      () => {
        intent.current = null;
        setForm(null);
      },
      data.podeAnotarOficial ? 'Evento do clube registrado. Resultado oficial e placar anotado foram preservados.' : 'Evento confirmado na súmula.',
    );
  }
  function openEvent(type: string, teamId = mine?.time_id || p.mandante_id) {
    if (busyRef.current) return;
    setError('');
    setSearch('');
    if (type === 'GOL' && live && !data.equipes.some((team) => team.time_id === teamId)) {
      void sendEvent({ tipo: type, time_id: teamId, periodo: p.periodo_atual });
      return;
    }
    setForm({ type, teamId, playerId: '', ownGoal: false, minute: '', reason: '', assistId: '' });
  }
  function identify(event: MatchEvent) {
    setError('');
    setSearch('');
    setForm({
      type: event.tipo,
      teamId: event.time_id || p.mandante_id,
      playerId: String(event.jogador_id || ''),
      ownGoal: Boolean(event.gol_contra),
      minute: String(event.minuto ?? ''),
      reason: '',
      assistId: '',
      existing: event,
    });
  }
  function patch(values: Partial<EventForm>) {
    setForm((current) => (current ? { ...current, ...values } : null));
    setError('');
  }
  function saveEvent(later = false) {
    if (!form) return;
    if (form.existing) {
      void act(
        () =>
          comandoPartida(
            p.id,
            `eventos/${form.existing!.id}`,
            { jogador_id: Number(form.playerId), motivo: form.reason, versao: p.versao },
            'PATCH',
          ),
        () => setForm(null),
        'Autoria atualizada. O placar foi mantido.',
      );
      return;
    }
    void sendEvent({
      tipo: form.type,
      time_id: form.teamId,
      jogador_id: later ? undefined : form.playerId ? Number(form.playerId) : undefined,
      gol_contra: form.ownGoal,
      autor_pendente: later,
      periodo: p.periodo_atual,
      minuto: form.minute ? Number(form.minute) : undefined,
      assistencia_jogador_id: !later && form.assistId ? Number(form.assistId) : undefined,
      motivo: form.reason,
    });
  }
  const canSubmit =
    !!form &&
    EVENT_TYPES.some((type) => type.value === form.type && !type.unavailable) &&
    (!actor || !!form.playerId || (form.type === 'GOL' && form.ownGoal && !form.existing)) &&
    (form.existing
      ? !form.existing.jogador_id ||
        form.playerId === String(form.existing.jogador_id) ||
        !!form.reason.trim()
      : live || !!form.reason.trim());
  const canLeavePending =
    !data.podeAnotarOficial && !!form && !form.existing && form.type === 'GOL' && !!actor && (live || !!form.reason.trim());

  return (
    <div className="match-live-board" ref={board}>
      <div className="live-ownership">
        <span>
          <Icon name="handshake" size={17} />
          <span>
            Súmula: <strong>{operator}</strong>
            <small>{live ? data.podeSumula ? 'Seu clube está operando' : 'Você está acompanhando' : 'Registros da partida encerrada'}</small>
          </span>
        </span>
        {data.podeSumula && (
          <details
            className="live-settings"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget))
                event.currentTarget.open = false;
            }}
            onKeyDown={(event) => {
              if (event.key === 'Escape') event.currentTarget.open = false;
            }}
          >
            <summary aria-label="Opções da súmula" data-tooltip="Opções da súmula">···</summary>
            <div
              onClick={(event) => {
                if ((event.target as Element).closest('button'))
                  event.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              {onEdit && (
                <button type="button" onClick={() => setFeedback('A partida já começou. Data, horário e participantes estão bloqueados. Use os controles da súmula para corrigir os lances.')}>
                  <Icon name="edit" size={16} />
                  Editar partida
                </button>
              )}
              {onResponsibility && (
                <button type="button" onClick={onResponsibility}>
                  <Icon name="team" size={16} />
                  Responsável pela súmula
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setError('');
                  setReason('');
                  setHomeScore(String(p.gols_mandante));
                  setAwayScore(String(p.gols_visitante));
                  setScoreCorrection(true);
                }}
              >
                <Icon name="edit" size={16} />
                {data.paulista ? 'Corrigir placar anotado pelo clube' : 'Corrigir placar com justificativa'}
              </button>
            </div>
          </details>
        )}
      </div>
      <Toast message={delayed.queue.length ? '' : feedback} onClose={() => { setFeedback(''); setUndoEvent(null); }} action={undoEvent && data.podeSumula ? { label: 'Reverter', onClick: () => { requestRemoval(undoEvent); setFeedback(''); setUndoEvent(null); } } : undefined}/>
      {!!delayed.queue.length && createPortal(<div className="live-review-queue" role="status" aria-label="Eventos aguardando publicação">
        {delayed.queue.map(item => {
          const type = item.operation === 'remove'
            ? data.eventos.find(event => event.id === item.payload.evento_id)?.tipo
            : item.payload.tipo;
          const secondsRemaining = Math.min(EVENT_REVIEW_MS / 1000, Math.max(0, Math.ceil((item.due - delayed.now) / 1000)));

          return (
            <div key={item.id}>
              <span className="live-review-symbol" aria-hidden="true">
                {typeof type === 'string' ? <EventIcon type={type} /> : <Icon name="undo" size={20} />}
              </span>
              <span className="live-review-copy">
                <strong>{item.label}</strong>
                <small aria-live="off">{item.status === 'waiting' ? `Aguardando publicação · ${secondsRemaining}s` : item.status === 'sending' ? 'Confirmando no servidor…' : item.error}</small>
                {item.status === 'waiting' && !item.attempted && <EventReviewProgress key={item.due} due={item.due} />}
              </span>
              {item.status === 'waiting' && !item.attempted && <button type="button" onClick={() => delayed.cancel(item.id)}>Cancelar</button>}
              {item.status === 'failed' && <button type="button" onClick={() => delayed.retry(item.id)}>Conferir envio</button>}
            </div>
          );
        })}
      </div>, document.body)}
      {error && !modalOpen && (
        <p className="notice-error" role="alert">
          {error}
        </p>
      )}
      <div className="live-workspace">
        <div className="live-main">
          {live ? <section
            className={`live-score-card${live ? ' is-live' : ''}`}
            aria-label="Placar da partida"
          >
            <div className="live-score-heading">
              <span>
                <Icon name="calendar" size={16} />
                {formatMatchDate(p.data)}
                <i>·</i>
                {p.categoria?.nome?.toUpperCase()}
              </span>
              {live ? <span className="live-status-text"><i />AO VIVO</span> : <StatusBadge status={p.status} />}
            </div>
            <div className="live-score-confrontation">
              <div className="live-team">
                <ClubBadge src={p.mandante?.escudo} name={p.mandante?.nome} size={68} />
                <strong>{p.mandante?.nome}</strong>
                <small>Mandante</small>
                {teamDiscipline(p.mandante_id)}
              </div>
              <div className="live-score-center">
                <div className="live-score-numbers">
                  <div>
                    {live && data.podeSumula && (
                      <button
                        type="button"
                        className="live-goal-add"
                        disabled={busy}
                        aria-label={`Registrar gol do ${p.mandante?.nome}`} data-tooltip="Registrar gol"
                        onClick={() => openEvent('GOL', p.mandante_id)}
                      >
                        <Icon name="plus" size={23} />
                      </button>
                    )}
                    <strong>{p.gols_mandante}</strong>
                    {live && data.podeSumula && <button type="button" className="live-goal-add live-goal-subtract" aria-label={`Subtrair gol do ${p.mandante?.nome}`} data-tooltip="Subtrair um gol" disabled={busy || (!p.gols_mandante && !delayed.queue.some(item => item.payload.tipo === 'GOL' && item.payload.time_id === p.mandante_id))} onClick={() => subtractGoal(p.mandante_id)}><Icon name="minus" size={20} /></button>}
                  </div>
                  <span aria-hidden="true">·</span>
                  <div>
                    {live && data.podeSumula && (
                      <button
                        type="button"
                        className="live-goal-add"
                        disabled={busy}
                        aria-label={`Registrar gol do ${p.visitante?.nome}`} data-tooltip="Registrar gol"
                        onClick={() => openEvent('GOL', p.visitante_id)}
                      >
                        <Icon name="plus" size={23} />
                      </button>
                    )}
                    <strong>{p.gols_visitante}</strong>
                    {live && data.podeSumula && <button type="button" className="live-goal-add live-goal-subtract" aria-label={`Subtrair gol do ${p.visitante?.nome}`} data-tooltip="Subtrair um gol" disabled={busy || (!p.gols_visitante && !delayed.queue.some(item => item.payload.tipo === 'GOL' && item.payload.time_id === p.visitante_id))} onClick={() => subtractGoal(p.visitante_id)}><Icon name="minus" size={20} /></button>}
                  </div>
                </div>
              </div>
              <div className="live-team">
                <ClubBadge src={p.visitante?.escudo} name={p.visitante?.nome} size={68} />
                <strong>{p.visitante?.nome}</strong>
                <small>Visitante</small>
                {teamDiscipline(p.visitante_id)}
              </div>
            </div>
            <div className={`live-score-facts${p.local ? '' : ' without-location'}`}>
              {p.local && <span><Icon name="location" size={17} /><span data-tooltip={p.local} data-tooltip-overflow>{p.local}</span></span>}
              <span><Icon name="clock" size={17} />{p.horario || 'Horário não definido'}</span>
              <span><Icon name={inHome ? 'home' : 'bus'} size={16} />{inHome ? 'Casa' : 'Fora'}</span>
            </div>
          </section> : <MatchResultSummary data={data} onFeedback={setFeedback} onCorrectEvent={data.podeSumula || data.podeAnotarOficial ? () => openEvent('GOL') : undefined} />}
          {live && <div className="live-time-stepper" role="group" aria-label="Tempo da partida">
            <button type="button" aria-label="Voltar tempo" disabled={!live || !data.podeSumula || changing || p.periodo_atual <= 1} onClick={goBackPeriod}><Icon name="chevronLeft" size={20} /></button>
            <span><strong>{p.periodo_atual}º tempo{!live && ' · Encerrada'}</strong><small>{p.periodo_atual}/{Math.max(totalTimes, p.periodo_atual)}</small></span>
            <button type="button" aria-label="Avançar tempo" disabled={!live || !data.podeSumula || changing || p.periodo_atual >= totalTimes} onClick={() => changePeriod(p.periodo_atual + 1)}><Icon name="chevronRight" size={20} /></button>
          </div>}
          {(live && data.podeSumula || !live && data.podeAnotarOficial) && (
            <section className="live-controls" aria-labelledby="live-actions-title">
              <div className="live-controls-heading">
                <h2 id="live-actions-title">Registrar evento</h2>
              </div>
              <div className="live-event-actions">
                {EVENT_TYPES.filter((type) => (!live || type.value !== 'GOL') && !type.unavailable).map(
                  (type) => (
                    <button
                      type="button"
                      key={type.value}
                      disabled={busy}
                      onClick={() => openEvent(type.value)}
                    >
                      <EventIcon type={type.value} />
                      <span>{type.label}</span>
                    </button>
                  ),
                )}
              </div>
              <div className="live-controls-footer">
                <span>
                  {busy ? 'Confirmando alteração…' : data.podeAnotarOficial ? 'Os acontecimentos históricos identificam atletas do seu clube; não somam gols ao resultado oficial nem ao placar anotado.' : 'Use + para marcar gol. Novos lances têm 5 segundos para cancelar antes da publicação.'}
                </span>
              </div>
            </section>
          )}
          {!!pending.length && (data.podePreparar || data.podeSumula) && (
            <section className="live-pending" aria-label="Autoria pendente">
              <Icon name="alert" size={21} />
              <div>
                <strong>
                  {pending.length}{' '}
                  {pending.length === 1
                    ? 'gol sem jogador identificado'
                    : 'gols sem jogador identificado'}
                </strong>
                <p>O placar está registrado. Complete a autoria nos acontecimentos abaixo.</p>
                {pending
                  .filter((event) => canIdentifyGoal(data, event, clube?.id))
                  .map((event) => (
                    <button
                      type="button"
                      disabled={busy}
                      key={event.id}
                      onClick={() => identify(event)}
                    >
                      Identificar gol do {teams.find((team) => team.id === event.time_id)?.nome}
                      <Icon name="chevronRight" size={15} />
                    </button>
                  ))}
              </div>
            </section>
          )}
        </div>
        <div className="live-side-panel"><section className="live-timeline" aria-labelledby="live-timeline-title">
          <header>
            <h2 id="live-timeline-title" tabIndex={-1}>Acontecimentos</h2>
            {data.podeSumula ? <button className="live-undo-last" type="button" disabled={changing || !lastEvent} onClick={() => requestRemoval(lastEvent)}><Icon name="undo" size={16} />Desfazer último</button> : <span>{data.eventos.length}</span>}
          </header>
          <div className="live-timeline-items">
            {!data.eventos.length && (
              <div className="live-timeline-empty">
                <Icon name="ball" size={27} />
                <p>Nenhum evento registrado</p>
                <small>Gols, cartões e outros acontecimentos aparecerão aqui.</small>
              </div>
            )}
            {[...data.eventos]
              .sort((a, b) => b.id - a.id)
              .map((event) => {
                const team = teams.find((team) => team.id === event.time_id);
                const player = data.equipes
                  .find((team) => team.time_id === eventAuthorTeam(data, event))
                  ?.escalacao.find((player) => player.jogador_id === event.jogador_id);
                const pending = pendingGoal(data, event);
                return (
                  <article
                    className={`live-timeline-event${pending ? ' has-pending' : ''}`}
                    key={event.id}
                  >
                    <span className="live-event-symbol">
                      <EventIcon type={event.tipo} />
                    </span>
                    <div className="live-event-copy">
                      <div>
                        <strong>
                          {event.tipo.startsWith('CARTAO_') ? `Cartão ${event.tipo.slice(7).toLowerCase()}` : EVENT_TYPES.find((type) => type.value === event.tipo)?.label || event.tipo}
                          {event.gol_contra && ' contra'}
                          {team && <span className="live-event-team"> · {team.nome}</span>}
                        </strong>
                        <time>
                          {event.periodo}º tempo{event.minuto != null ? ` · ${event.minuto}′` : ''}
                        </time>
                      </div>
                      <p>
                        {event.jogador?.nome
                          ? `${player ? `#${player.numCamisa} · ` : ''}${event.jogador.nome}`
                          : pending
                            ? 'Jogador não identificado'
                            : 'Evento da equipe'}
                      </p>
                      {event.tipo === 'GOL' && scores.has(event.id) && <span className="live-event-score" aria-label={`Placar após o gol: ${scores.get(event.id)}`}>{scores.get(event.id)}</span>}
                      {pending && canIdentifyGoal(data, event, clube?.id) && (
                        <button type="button" disabled={busy} onClick={() => identify(event)}>
                          Identificar jogador
                        </button>
                      )}
                    </div>
                    {(data.podeSumula || canIdentifyGoal(data, event, clube?.id)) && (
                      <details
                        className="live-event-menu"
                        onToggle={(event) => placeEventMenu(event.currentTarget)}
                        onKeyDown={(event) => {
                          if (event.key === 'Escape') event.currentTarget.open = false;
                        }}
                        onBlur={(e) => {
                          if (!e.currentTarget.contains(e.relatedTarget))
                            e.currentTarget.open = false;
                        }}
                      >
                        <summary aria-label={`Opções do evento ${event.id}`} data-tooltip="Opções do acontecimento">···</summary>
                        <div>
                          {canIdentifyGoal(data, event, clube?.id) &&
                            data.equipes.some(
                              (team) => team.time_id === eventAuthorTeam(data, event),
                            ) && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={(e) => {
                                  e.currentTarget.closest('details')?.removeAttribute('open');
                                  identify(event);
                                }}
                              >
                                <Icon name="edit" size={15} />
                                {pending ? 'Identificar jogador' : 'Corrigir jogador'}
                              </button>
                            )}
                          {data.podeSumula && (
                            <button
                              type="button"
                              className="live-delete-event"
                              disabled={busy}
                              onClick={(e) => {
                                e.currentTarget.closest('details')?.removeAttribute('open');
                                setRemove(event);
                                setReason('');
                                setError('');
                              }}
                            >
                              <Icon name="trash" size={15} />
                              {event.tipo === 'GOL' ? 'Anular gol' : 'Remover evento'}
                            </button>
                          )}
                        </div>
                      </details>
                    )}
                  </article>
                );
              })}
          </div>
        </section>
        {(data.podePreparar || data.podeSumula) && <details className="live-audit" aria-label="Histórico de alterações">
          <summary>
            <Icon name="archive" size={17} />
            <span>
              <strong>Histórico de alterações</strong>
              <small data-tooltip={auditEntries[0] ? auditTitle(auditEntries[0]) : undefined} data-tooltip-overflow>
                {auditEntries[0] ? `Última: ${auditTitle(auditEntries[0])}` : 'Nenhuma alteração registrada'}
              </small>
            </span>
            <Icon name="chevronRight" size={17} />
          </summary>
          {!data.auditoria.length && <p>{data.podePreparar ? 'Nenhuma alteração registrada.' : 'Histórico disponível aos gestores da partida.'}</p>}
          <ol>
            {auditEntries.map(entry => {
              const changes = entry.dados as { motivo?: string } | null;
              return (
                <li key={entry.id}>
                  <strong>{auditTitle(entry)}</strong>
                  {changes?.motivo && <p>{changes.motivo}</p>}
                  <time>{new Date(entry.criado_em).toLocaleString('pt-BR')}</time>
                </li>
              );
            })}
          </ol>
        </details>}</div>
      </div>
      <section className="live-lineups">
        <div className="live-section-heading">
          <h2>Escalação</h2>
          {live && data.podePreparar && mine && (
            <Btn
              variant="ghost"
              size="sm"
              disabled={changing}
              onClick={() => {
                setSubstitution(true);
                setOut('');
                setInto('');
                setError('');
              }}
            >
              <Icon name="switchClub" size={17} />
              Fazer substituição
            </Btn>
          )}
        </div>
        <PublishedLineups data={data} statistics />
      </section>

      {live && data.podeSumula && <div className="live-finish-actions">
        <Btn variant="ghost" disabled={changing} onClick={() => { setError(''); setFinish(true); }}><Icon name="checkAll" size={17} />Finalizar partida</Btn>
      </div>}
      <Modal
        open={previousPeriod !== null}
        className="live-small-dialog"
        title={`Voltar para o ${previousPeriod}º tempo?`}
        onClose={() => { if (!busy) setPreviousPeriod(null); }}
        footer={
          <div className="live-modal-buttons">
            <Btn variant="ghost" disabled={busy} onClick={() => setPreviousPeriod(null)}>
              Cancelar
            </Btn>
            <Btn
              disabled={changing || !live || !data.podeSumula}
              onClick={() => { if (previousPeriod !== null) changePeriod(previousPeriod); }}
            >
              {busy ? 'Atualizando…' : 'Confirmar retorno'}
            </Btn>
          </div>
        }
      >
        <p>Já existem eventos registrados neste trecho da partida. Eles continuarão no tempo em que foram registrados.</p>
        <p className="live-period-explanation">As bolinhas passarão a mostrar as faltas cometidas no {previousPeriod}º tempo. O placar e os cartões da partida serão mantidos.</p>
        {error && <p className="notice-error" role="alert">{error}</p>}
      </Modal>
      <Modal
        open={!!form}
        className="live-event-dialog"
        title={
          form?.existing
            ? form.existing.jogador_id
              ? 'Corrigir jogador'
              : 'Identificar jogador'
            : form?.type === 'GOL'
              ? `Quem marcou pelo ${teamName}?`
              : `Registrar ${EVENT_TYPES.find((type) => type.value === form?.type)?.label.toLowerCase() || 'evento'}`
        }
        onClose={() => {
          if (!busy) setForm(null);
        }}
        footer={
          <div className="live-event-footer">
            <div className="live-modal-buttons">
              <Btn variant="ghost" disabled={busy} onClick={() => setForm(null)}>
                Voltar
              </Btn>
              <Btn disabled={busy || !canSubmit} onClick={() => saveEvent()}>
                {busy
                  ? 'Confirmando…'
                  : form?.existing
                    ? 'Salvar autoria'
                    : form?.type === 'GOL'
                      ? 'Registrar gol'
                      : 'Registrar evento'}
              </Btn>
            </div>
            {canLeavePending && (
              <button
                type="button"
                className="live-identify-later"
                disabled={busy}
                onClick={() => saveEvent(true)}
              >
                Registrar sem identificar agora
              </button>
            )}
          </div>
        }
      >
        {form && (
          <>
            {!form.existing && !live && (
              <FilterSelect
                inlineOptions
                label="Tipo de evento"
                emptyLabel="Selecionar evento"
                value={form.type}
                options={EVENT_TYPES.filter((type) => !type.unavailable).map((type) => ({
                  value: type.value,
                  label: type.label,
                }))}
                onChange={(type) => patch({ type, playerId: '', assistId: '', ownGoal: false })}
              />
            )}
            {!form.existing && (form.type !== 'GOL' || !live) && (
              <div className="live-team-choice" role="group" aria-label="Equipe do evento">
                {teams.filter(team => !data.podeAnotarOficial || team.id === mine?.time_id).map((team) => (
                  <button
                    type="button"
                    key={team.id}
                    aria-pressed={form.teamId === team.id}
                    onClick={() =>
                      patch({ teamId: team.id, playerId: '', assistId: '', ownGoal: false })
                    }
                  >
                    {team.nome}
                  </button>
                ))}
              </div>
            )}

            {actor ? (
              <>
                <p className="live-player-instruction">
                  {form.ownGoal
                    ? `Se souber, selecione o jogador do ${actorName} que fez o gol contra. Você também pode confirmar sem identificar agora.`
                    : form.existing
                      ? 'Escolha um convocado da partida. Identificar o autor não altera o placar.'
                      : 'Selecione o jogador. Os atletas em campo aparecem primeiro.'}
                </p>
                <CollectionSearch
                  label="Buscar jogador na escalação"
                  placeholder="Nome ou camisa"
                  value={search}
                  onChange={setSearch}
                />
                <div className="live-player-options" role="group" aria-label="Jogadores convocados">
                  {visiblePlayers.map((player) => (
                    <button
                      type="button"
                      key={player.jogador_id}
                      disabled={busy || (live && !form.existing && !player.titular)}
                      aria-pressed={form.playerId === String(player.jogador_id)}
                      onClick={() =>
                        patch({
                          playerId: String(player.jogador_id),
                          assistId:
                            form.assistId === String(player.jogador_id) ? '' : form.assistId,
                        })
                      }
                    >
                      <span className="lineup-shirt">
                        {String(player.numCamisa).padStart(2, '0')}
                      </span>
                      <span>
                        <strong data-tooltip={player.jogador?.nome} data-tooltip-overflow>{player.jogador?.nome || 'Jogador'}</strong>
                        <small>
                          <PositionIcon decorative tooltip={false} position={player.jogador?.posicao || ''} />
                          {player.jogador?.posicao}
                          {player.titular ? ' · Em campo' : ' · Reserva'}
                        </small>
                      </span>
                      <Icon
                        name={form.playerId === String(player.jogador_id) ? 'checkAll' : 'user'}
                        size={17}
                      />
                    </button>
                  ))}
                </div>
                {!visiblePlayers.length && (
                  <p className="lineup-empty">
                    {roster.length
                      ? 'Nenhum jogador encontrado.'
                      : 'A equipe ainda não publicou jogadores. Você pode identificar o gol depois.'}
                  </p>
                )}
                {!data.podeAnotarOficial && !form.existing && form.type === 'GOL' && !form.ownGoal && form.playerId && (
                  <details className="live-event-extra">
                    <summary>Adicionar assistência e minuto</summary>
                    <FilterSelect
                      inlineOptions
                      label="Assistência (opcional)"
                      value={form.assistId}
                      emptyLabel="Sem assistência"
                      onChange={(assistId) => patch({ assistId })}
                      options={roster
                        .filter(
                          (player) =>
                            player.jogador_id !== Number(form.playerId) &&
                            (!live || player.titular),
                        )
                        .map((player) => ({
                          value: String(player.jogador_id),
                          label: `#${player.numCamisa} · ${player.jogador?.nome}`,
                        }))}
                    />
                    <Input
                      label="Minuto (opcional)"
                      type="number"
                      min="0"
                      max="200"
                      value={form.minute}
                      onChange={(e) => patch({ minute: e.target.value })}
                    />
                  </details>
                )}
              </>
            ) : (
              <p className="live-player-instruction">
                {form.ownGoal
                  ? 'O autor é de um adversário externo ao Ludora.'
                  : 'Esta equipe é externa ao Ludora.'}{' '}
                O evento será registrado sem atleta vinculado.
              </p>
            )}
            {!data.podeAnotarOficial && !form.existing && form.type === 'GOL' && (
              <button
                type="button"
                className="live-own-goal"
                aria-pressed={form.ownGoal}
                onClick={() => {
                  patch({ ownGoal: !form.ownGoal, playerId: '', assistId: '' });
                  setSearch('');
                }}
              >
                <Icon name={form.ownGoal ? 'checkAll' : 'switchClub'} size={18} />
                Gol contra do adversário
              </button>
            )}
            {((!live && !form.existing) ||
              (form.existing?.jogador_id &&
                form.playerId !== String(form.existing.jogador_id))) && (
              <Input
                label="Motivo da correção"
                placeholder="Descreva o que precisa ser corrigido"
                value={form.reason}
                onChange={(e) => patch({ reason: e.target.value })}
                maxLength={500}
              />
            )}
            {error && (
              <p role="alert" className="notice-error">
                {error}
              </p>
            )}
          </>
        )}
      </Modal>
      <Modal
        open={!!remove}
        className="live-small-dialog"
        title={remove?.tipo === 'GOL' ? 'Anular este gol?' : 'Remover evento?'}
        onClose={() => {
          if (!busy) setRemove(null);
        }}
        footer={
          <div className="live-modal-buttons">
            <Btn variant="ghost" disabled={busy} onClick={() => setRemove(null)}>
              Voltar
            </Btn>
            <Btn
              variant="danger"
              disabled={busy || !reason.trim()}
              onClick={() => {
                if (remove) {
                  delayed.remove(remove.id, reason, `Reverter ${EVENT_TYPES.find(type => type.value === remove.tipo)?.label.toLowerCase() || 'evento'}`);
                  setRemove(null);
                }
              }}
            >
              {busy ? 'Confirmando…' : remove?.tipo === 'GOL' ? 'Anular gol' : 'Remover evento'}
            </Btn>
          </div>
        }
      >
        <p className="editor-description">
          {remove?.tipo === 'GOL'
            ? 'O gol será descontado do placar e a assistência vinculada também será removida.'
            : 'O registro será removido das estatísticas.'}{' '}
          A correção ficará no histórico.
        </p>
        <Input
          label="Motivo"
          placeholder="Ex.: gol anulado pela arbitragem"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
      </Modal>
      <Modal
        open={finish}
        className="live-small-dialog"
        title="Encerrar a partida?"
        onClose={() => {
          if (!busy) setFinish(false);
        }}
        footer={
          <div className="live-modal-buttons">
            <Btn variant="ghost" disabled={busy} onClick={() => setFinish(false)}>
              Continuar partida
            </Btn>
            <Btn
              disabled={changing}
              onClick={() =>
                void act(
                  () =>
                    comandoPartida(
                      p.id,
                      'status',
                      { status: 'FINALIZADA', versao: p.versao },
                      'PATCH',
                    ),
                  () => setFinish(false),
                  'Partida encerrada. O resultado está disponível para compartilhar.',
                )
              }
            >
              {busy
                ? 'Encerrando…'
                : pending.length
                  ? 'Encerrar com pendência'
                  : 'Confirmar encerramento'}
            </Btn>
          </div>
        }
      >
        <div className="live-final-score">
          <span><ClubBadge src={p.mandante?.escudo} name={p.mandante?.nome} size={44} /><strong>{p.mandante?.nome}</strong></span>
          <b>
            {p.gols_mandante} · {p.gols_visitante}
          </b>
          <span><ClubBadge src={p.visitante?.escudo} name={p.visitante?.nome} size={44} /><strong>{p.visitante?.nome}</strong></span>
        </div>
        <p className="editor-description">
          Confira o placar e os acontecimentos antes de encerrar. Os registros da partida serão incorporados ao scout imediatamente; a avaliação por IA será recalculada em seguida.
        </p>
        {!!pending.length && (
          <div className="live-pending">
            <Icon name="alert" size={20} />
            <div>
              <strong>
                {pending.length}{' '}
                {pending.length === 1
                  ? 'gol sem jogador identificado'
                  : 'gols sem jogador identificado'}
              </strong>
              <p>A pendência continuará nos detalhes após o encerramento.</p>
              {pending
                .filter((event) => canIdentifyGoal(data, event, clube?.id))
                .map((event) => (
                  <button
                    type="button"
                    key={event.id}
                    onClick={() => {
                      setFinish(false);
                      identify(event);
                    }}
                  >
                    Identificar gol do {teams.find((team) => team.id === event.time_id)?.nome}
                  </button>
                ))}
            </div>
          </div>
        )}
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
      </Modal>
      <Modal
        open={substitution}
        className="live-event-dialog live-substitution-dialog"
        title="Fazer substituição"
        onClose={() => {
          if (!busy) setSubstitution(false);
        }}
        footer={
          <div className="live-modal-buttons">
            <Btn variant="ghost" disabled={busy} onClick={() => setSubstitution(false)}>
              Voltar
            </Btn>
            <Btn
              disabled={busy || !out || !into}
              onClick={() =>
                void act(
                  () =>
                    comandoPartida(p.id, 'substituicoes', {
                      sai: Number(out),
                      entra: Number(into),
                      versao: p.versao,
                    }),
                  () => setSubstitution(false),
                  'Substituição confirmada.',
                )
              }
            >
              Confirmar troca
            </Btn>
          </div>
        }
      >
        <p className="live-player-instruction">Escolha quem sai e quem entra, ou arraste um reserva sobre o titular para preparar a troca.</p>
        <div className="live-substitution-columns">
          {[true, false].map(starter => <section key={String(starter)}>
            <h3>{starter ? 'Sai de campo' : 'Entra em campo'}</h3>
            <div className="live-player-options" role="group" aria-label={starter ? 'Titulares para sair' : 'Reservas para entrar'}>
              {(mine?.escalacao || []).filter(player => player.titular === starter).map(player => <button
                type="button" key={player.jogador_id} disabled={busy}
                aria-pressed={String(player.jogador_id) === (starter ? out : into)}
                draggable={!starter}
                onDragStart={event => event.dataTransfer.setData('application/ludora-substitute', String(player.jogador_id))}
                onDragOver={event => { if (starter && event.dataTransfer.types.includes('application/ludora-substitute')) event.preventDefault(); }}
                onDrop={event => {
                  event.preventDefault();
                  const id = event.dataTransfer.getData('application/ludora-substitute');
                  if (starter && mine?.escalacao.some(item => !item.titular && String(item.jogador_id) === id)) { setOut(String(player.jogador_id)); setInto(id); }
                }}
                onClick={() => starter ? setOut(String(player.jogador_id)) : setInto(String(player.jogador_id))}>
                <span className="lineup-shirt">{String(player.numCamisa).padStart(2, '0')}</span>
                <span><strong data-tooltip={player.jogador?.nome} data-tooltip-overflow>{player.jogador?.nome}</strong><small><PositionIcon decorative tooltip={false} position={player.jogador?.posicao || ''} />{player.jogador?.posicao}</small></span>
                <Icon name={String(player.jogador_id) === (starter ? out : into) ? 'checkAll' : 'switchClub'} size={17} />
              </button>)}
            </div>
            {!starter && !mine?.escalacao.some(player => !player.titular) && <p className="lineup-empty">Nenhum reserva disponível para entrar.</p>}
          </section>)}
        </div>
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
      </Modal>
      <Modal
        open={scoreCorrection}
        className="live-small-dialog"
        title={data.paulista ? 'Corrigir anotação de placar do clube' : 'Corrigir placar'}
        onClose={() => {
          if (!busy) setScoreCorrection(false);
        }}
        footer={
          <div className="live-modal-buttons">
            <Btn variant="ghost" disabled={busy} onClick={() => setScoreCorrection(false)}>
              Voltar
            </Btn>
            <Btn
              disabled={
                busy ||
                !reason.trim() ||
                !/^\d{1,2}$/.test(homeScore) ||
                !/^\d{1,2}$/.test(awayScore)
              }
              onClick={() =>
                void act(
                  () =>
                    comandoPartida(
                      p.id,
                      'placar',
                      {
                        gols_mandante: Number(homeScore),
                        gols_visitante: Number(awayScore),
                        motivo: reason,
                        versao: p.versao,
                      },
                      'PATCH',
                    ),
                  () => setScoreCorrection(false),
                  'Placar corrigido. Confira também os eventos para manter as estatísticas consistentes.',
                )
              }
            >
              Confirmar correção
            </Btn>
          </div>
        }
      >
        <p className="editor-description">
          {data.paulista ? 'Esta correção altera somente a anotação do clube. O resultado publicado pela federação e sua classificação permanecem separados.' : 'Use esta opção apenas para corrigir divergências. Para anular um gol, use o próprio evento.'}
        </p>
        <Input
          label={p.mandante?.nome}
          type="number"
          min="0"
          max="99"
          value={homeScore}
          onChange={(e) => setHomeScore(e.target.value)}
        />
        <Input
          label={p.visitante?.nome}
          type="number"
          min="0"
          max="99"
          value={awayScore}
          onChange={(e) => setAwayScore(e.target.value)}
        />
        <Input
          label="Motivo da correção"
          maxLength={500}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        {error && (
          <p role="alert" className="notice-error">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}
