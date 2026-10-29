import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchPartidas, deletarPartida, atualizarStatusPartida, fetchEventosPartida, registrarEvento, deletarEvento,
  fetchEscalacao, salvarEscalacao, fetchJogadoresPerfis, fetchTimes,
  Partida, Evento, EscalacaoItem, PerfilJogador, Time, BASE_URL, type Jogador, type ConflitoCamisa
} from '../services/api';
import { Btn, Modal, Input, Select, StatusBadge, Spinner, Card } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToMatch, type RealtimeState } from '../services/matchRealtime';
import './PartidaDetalhe.css';
import { ClubBadge } from '../components/Brand';
import { formatMatchDate } from '../components/MatchCard';
import { Icon } from '../components/Icon';
import { EVENT_TYPES, EventIcon } from '../components/EventIcon';
import { MatchEditor, ScoreEditor } from '../components/MatchEditors';
import { PositionIcon } from '../components/PositionIcon';
import { ConfirmDelete } from '../components/CollectionControls';
import { CollectionSearch } from '../components/CollectionToolbar';
import { MatchActionsMenu } from '../components/MatchActionsMenu';
import { PlayerShirtDialog } from '../components/PlayerShirtDialog';
import { validTimeInput } from '../utils/timeInput';

const STATUS_NEXT: Record<string, string> = { AGENDADA: 'PREPARADA', PREPARADA: 'AO_VIVO', AO_VIVO: 'FINALIZADA' };
const ETAPAS = [
  { titulo: 'Dados da partida', descricao: 'Confira o confronto, a data e o local antes de montar sua equipe.' },
  { titulo: 'Monte sua equipe', descricao: 'Escolha cinco titulares e convoque os reservas para a partida.' },
  { titulo: 'Tudo certo para jogar?', descricao: 'Revise os dados e a escalação. A partida começa somente quando você confirmar.' },
];

function formatPreparationDate(value: string) {
  const date = new Date(`${value.slice(0, 10)}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? 'Data a definir' : date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).replace(/ de /g, ' ').replace(/\./g, '').toUpperCase();
}

const STATUS_BTN: Record<string, string> = { AGENDADA: 'Iniciar preparação', PREPARADA: 'Iniciar partida', AO_VIVO: 'Finalizar partida' };

export default function PartidaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { podeGerenciar: gestorDoClube, token, clube } = useAuth();

  const [partida, setPartida] = useState<Partida | null>(null);
  const podeGerenciar = gestorDoClube && !partida?.somente_leitura;
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [escalacao, setEscalacao] = useState<EscalacaoItem[]>([]);
  const [jogadores, setJogadores] = useState<Pick<PerfilJogador, 'id' | 'nome' | 'numCamisa' | 'posicao'>[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [syncError, setSyncError] = useState('');
  const [realtimeState, setRealtimeState] = useState<RealtimeState>('connecting');
  const [aba, setAba] = useState<'resumo' | 'eventos' | 'escalacao'>('resumo');
  const [editor, setEditor] = useState<'match' | 'score' | null>(null);
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);
  const [lineupDirty, setLineupDirty] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [shirtPlayer, setShirtPlayer] = useState<Pick<Jogador, 'id' | 'nome' | 'numCamisa'> | null>(null);
  const [buscaJogador, setBuscaJogador] = useState('');
  const stageHeading = useRef<HTMLHeadingElement>(null);
  const [deletingEvent, setDeletingEvent] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const refreshVersion = useRef(0);
  const drag = useRef<{ id: number; pointerId: number; x: number; y: number; moved: boolean } | null>(null);
  const skipSwapClick = useRef(false);
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<number | null>(null);
  const [swapSource, setSwapSource] = useState<number | null>(null);

  useEffect(() => {
    stageHeading.current?.focus({ preventScroll: true });
  }, [etapa]);

  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState({ tipo: 'GOL', periodo: '1', minuto: '', jogador_id: '' });
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [eventError, setEventError] = useState('');

  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    const matchId = Number(id);
    setLoading(true);
    setLoadError('');
    setSyncError('');
    setRealtimeState('connecting');
    setEtapa(0);
    setShirtPlayer(null);
    setLineupDirty(false);
    setSwapSource(null);

    async function refreshMatch() {
      const version = ++refreshVersion.current;
      try {
        const [matches, events] = await Promise.all([
          fetchPartidas(), fetchEventosPartida(matchId),
        ]);
        if (!active || version !== refreshVersion.current) return;
        setPartida(matches.find(match => match.id === matchId) || null);
        setEventos(events);
        setSyncError('');
        // Não substitui a escalação que o usuário pode estar editando.
      } catch {
        if (active && version === refreshVersion.current) {
          setSyncError('Não foi possível atualizar os dados. Recarregue a página para tentar novamente.');
        }
      }
    }

    async function loadMatch() {
      try {
        const [matches, events, lineup] = await Promise.all([
          fetchPartidas(), fetchEventosPartida(matchId), fetchEscalacao(matchId),
        ]);
        if (!active) return;
        const match = matches.find(item => item.id === matchId);
        setPartida(match || null);
        setEventos(events);
        setEscalacao(lineup);
        if (!match) return;

        const [players, teams] = await Promise.all([
          match.somente_leitura
            ? Promise.resolve(lineup.filter(item=>item.jogador).map(item=>({id:item.jogador_id,nome:item.jogador!.nome,posicao:item.jogador!.posicao,numCamisa:item.numCamisa})))
            : fetchJogadoresPerfis(match.categoria_id), fetchTimes(),
        ]);
        if (!active) return;
        setJogadores(players);
        setTimes(teams);

        if (token && clube) {
          unsubscribe = subscribeToMatch({
            baseUrl: BASE_URL,
            token,
            clubId: match.clube_origem_id || clube.id,
            matchId,
            onScore: score => {
              setPartida(previous => previous ? {
                ...previous,
                gols_mandante: score.gols_mandante,
                gols_visitante: score.gols_visitante,
              } : previous);
              // Invalida consultas anteriores ao novo placar recebido.
              void refreshMatch();
            },
            onRefresh: () => { void refreshMatch(); },
            onStateChange: setRealtimeState,
          });
        }
      } catch {
        if (active) setLoadError('Não foi possível carregar a partida. Recarregue a página para tentar novamente.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMatch();
    return () => {
      active = false;
      unsubscribe();
    };
  }, [id, token, clube?.id]);

  async function mudarStatus() {
    if (!partida || savingStatus || !podeGerenciar) return;
    const next = STATUS_NEXT[partida.status];
    if (!next) return;
    if (next === 'AO_VIVO' && (lineupDirty || escalacao.filter(item => item.titular).length !== 5)) { setActionError('Defina e salve exatamente cinco titulares antes de iniciar.'); return; }
    if (next === 'FINALIZADA' && !confirm('Finalizar esta partida? Confira o placar e os eventos antes de confirmar.')) return;
    setSavingStatus(true); setActionError(''); setNotice('');
    try {
      await atualizarStatusPartida(partida.id, next, partida.status);
      refreshVersion.current++;
      setPartida(p => p ? { ...p, status: next } : p);
      if (next === 'AO_VIVO') setAba('resumo');
      setNotice('Situação da partida atualizada.');
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Não foi possível atualizar a partida.'); }
    finally { setSavingStatus(false); }
  }

  async function adicionarEvento(e: React.FormEvent) {
    e.preventDefault();
    if (salvandoEvento || !podeGerenciar) return;
    setSalvandoEvento(true); setEventError('');
    try {
      const savedEvent = await registrarEvento(Number(id), {
        tipo: formEvento.tipo, periodo: Number(formEvento.periodo),
        minuto: formEvento.minuto ? Number(formEvento.minuto) : undefined,
        jogador_id: formEvento.jogador_id ? Number(formEvento.jogador_id) : undefined,
      });
      refreshVersion.current++;
      setEventos(previous => previous.some(event => event.id === savedEvent.id) ? previous : [...previous, savedEvent]);
      setModalEvento(false);
      setNotice('Evento registrado. O placar é ajustado separadamente em Editar placar.');
    } catch (err: any) { setEventError(err.message); }
    finally { setSalvandoEvento(false); }
  }

  async function removerEvento(eventoId: number) {
    if (deletingEvent || !podeGerenciar) return;
    if (!confirm('Remover evento?')) return;
    setDeletingEvent(eventoId); setActionError('');
    try {
      await deletarEvento(eventoId);
      refreshVersion.current++;
      setEventos(prev => prev.filter(e => e.id !== eventoId));
      setNotice('Evento removido. Essa ação não altera o placar.');
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Não foi possível remover o evento.'); }
    finally { setDeletingEvent(null); }
  }

  async function salvarEscalacaoAtual() {
    if (savingLineup || !podeGerenciar) return false;
    if (escalacao.some(item => !Number.isInteger(item.numCamisa) || item.numCamisa < 1)) { setActionError('Defina o número da camisa de todos os convocados antes de salvar.'); return false; }
    setSavingLineup(true); setActionError(''); setNotice('');
    try {
      await salvarEscalacao(Number(id), escalacao.map(e => ({ jogador_id: e.jogador_id, numCamisa: e.numCamisa, titular: e.titular })));
      setLineupDirty(false);
      setNotice('Escalação salva.');
      return true;
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Não foi possível salvar a escalação.'); return false; }
    finally { setSavingLineup(false); }
  }

  function toggleJogador(jogadorId: number) {
    const jogador = jogadores.find(item => item.id === jogadorId);
    if (!podeGerenciar || savingLineup || savingStatus) return;
    if (!escalacao.some(item => item.jogador_id === jogadorId) && (!jogador?.numCamisa || jogador.numCamisa < 1)) {
      setActionError('Defina o número da camisa do jogador antes de convocá-lo.');
      return;
    }
    setActionError('');
    setLineupDirty(true);
    setEscalacao(previous => {
      const exists = previous.some(item => item.jogador_id === jogadorId);
      const remaining = exists ? previous.filter(item => item.jogador_id !== jogadorId) : [...previous, {
        jogador_id: jogadorId, numCamisa: jogador!.numCamisa!, titular: false,
      }];
      return remaining.map((item, index) => ({ ...item, titular: index < 5 }));
    });
  }

  if (loading) return <Spinner />;
  if (loadError) return <div role="alert" style={{ padding: 40 }}>{loadError}</div>;
  if (!partida) return <div style={{ color: 'var(--texto-sec)', padding: 40 }}>Partida não encontrada</div>;

  const mandante = partida.mandante || times.find(t => t.id === partida.mandante_id);
  const visitante = partida.visitante || times.find(t => t.id === partida.visitante_id);
  const jogOpts = jogadores.map(j => ({ value: j.id, label: `${j.nome} (#${j.numCamisa || '?'})` }));
  const escalacaoIds = new Set(escalacao.map(e => e.jogador_id));
  const canRecord = podeGerenciar && ['AO_VIVO', 'FINALIZADA'].includes(partida.status);
  const partidaEmAndamento = ['AO_VIVO', 'FINALIZADA'].includes(partida.status);
  const preparando = podeGerenciar && ['AGENDADA', 'PREPARADA'].includes(partida.status);
  const abaVisivel = partidaEmAndamento ? aba : 'escalacao';
  const disponiveis = jogadores.filter(j => !escalacaoIds.has(j.id));
  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const jogadoresEncontrados = disponiveis.filter(j => normalizar(`${j.nome} ${j.posicao} ${j.numCamisa ?? ''}`).includes(normalizar(buscaJogador.trim())));
  const titulares = escalacao.filter(item => item.titular);
  const reservas = escalacao.filter(item => !item.titular);

  const busy = savingStatus || savingLineup;
  const escalaValida = titulares.length === 5 && escalacao.every(item => Number.isInteger(item.numCamisa) && item.numCamisa >= 1 && item.numCamisa <= 99);
  const dadosValidos = Boolean(partida.data && partida.horario && validTimeInput(partida.horario));

  async function irParaEtapa(proxima: number) {
    if (!preparando || busy) return;
    setActionError('');
    if (proxima > 0 && !dadosValidos) {
      setActionError('Informe uma data e um horário válidos em Editar partida antes de continuar.');
      return;
    }
    if (proxima === 2) {
      if (!escalaValida) { setActionError('Escolha exatamente cinco titulares e informe a camisa de todos os convocados para revisar.'); return; }
      if (lineupDirty && !await salvarEscalacaoAtual()) return;
    }
    setSwapSource(null);
    setEtapa(proxima);
  }

  async function confirmarPreparacao() {
    if (busy || !preparando) return;
    setActionError('');
    if (!dadosValidos || !escalaValida || lineupDirty) {
      setActionError('Revise os dados e salve uma escalação com cinco titulares antes de confirmar.');
      return;
    }
    setSavingStatus(true);
    try {
      const updated = await atualizarStatusPartida(partida!.id, 'PREPARADA', partida!.status);
      refreshVersion.current++;
      setPartida(previous => previous ? { ...previous, ...updated, status: 'PREPARADA' } : previous);
      setNotice('Preparação confirmada. Você já pode iniciar a partida.');
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível confirmar a preparação. Tente novamente.');
    } finally { setSavingStatus(false); }
  }

  function trocarConvocados(origem: number, destino: number) {
    if (!podeGerenciar || savingLineup || savingStatus || origem === destino) return;
    const primeiro = escalacao.find(item => item.jogador_id === origem);
    const segundo = escalacao.find(item => item.jogador_id === destino);
    if (!primeiro || !segundo) return;
    setEscalacao(previous => previous.map(item => item.jogador_id === origem
      ? { ...segundo, titular: primeiro.titular }
      : item.jogador_id === destino ? { ...primeiro, titular: segundo.titular } : item));
    setLineupDirty(true);
    setSwapSource(null);
    setNotice('Jogadores trocados. Salve a escalação para confirmar.');
  }

  function terminarArraste(event: React.PointerEvent<HTMLButtonElement>, cancelar = false) {
    const current = drag.current;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (current?.moved) {
      skipSwapClick.current = true;
      if (!cancelar && dropTarget != null) trocarConvocados(current.id, dropTarget);
    }
    setDraggedId(null);
    setDropTarget(null);
  }

  function renderConvocados(items: EscalacaoItem[], inicio: number) {
    return items.map((item, index) => {
      const jogador = jogadores.find(j => j.id === item.jogador_id) || item.jogador;
      const nome = jogador?.nome || 'Jogador';
      return <div className={`lineup-row${draggedId === item.jogador_id ? ' is-dragging' : ''}${dropTarget === item.jogador_id || swapSource === item.jogador_id ? ' is-swap-target' : ''}`} key={item.jogador_id} data-lineup-id={item.jogador_id}>
        <span className="lineup-order" aria-label={`Posição ${inicio + index + 1} na escalação`}>{inicio + index + 1}</span>
        {podeGerenciar ? <button type="button" className="lineup-shirt lineup-shirt-edit" disabled={busy}
          aria-label={`Editar camisa de ${nome}`} onClick={() => setShirtPlayer({ id: item.jogador_id, nome, numCamisa: item.numCamisa || undefined })}>
          {item.numCamisa > 0 ? String(item.numCamisa).padStart(2, '0') : <Icon name="shirt" size={22}/>}
        </button> : <span className="lineup-shirt">{item.numCamisa > 0 ? String(item.numCamisa).padStart(2, '0') : '—'}</span>}
        <div className="lineup-player"><strong>{nome}</strong>{jogador?.posicao && <span className="lineup-position"><PositionIcon position={jogador.posicao} />{jogador.posicao}</span>}</div>
        {item.titular && <span className="lineup-starter-tag">Titular</span>}
        {podeGerenciar && <>
          <button type="button" className="lineup-swap" aria-label={`${swapSource != null && swapSource !== item.jogador_id ? 'Trocar com' : 'Trocar'} ${nome}`} aria-pressed={swapSource === item.jogador_id} disabled={savingLineup || savingStatus}
            title="Arraste sobre outro convocado ou selecione dois jogadores para trocar"
            onPointerDown={event => {
              if (event.button !== 0) return;
              skipSwapClick.current = false;
              drag.current = { id: item.jogador_id, pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              const current = drag.current;
              if (!current || current.pointerId !== event.pointerId) return;
              if (!current.moved && Math.hypot(event.clientX - current.x, event.clientY - current.y) < 8) return;
              current.moved = true;
              setDraggedId(current.id);
              const row = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-lineup-id]');
              const target = row ? Number(row.getAttribute('data-lineup-id')) : null;
              setDropTarget(target !== current.id ? target : null);
            }}
            onPointerUp={event => terminarArraste(event)}
            onPointerCancel={event => terminarArraste(event, true)}
            onLostPointerCapture={() => { drag.current = null; setDraggedId(null); setDropTarget(null); }}
            onClick={event => {
              if (skipSwapClick.current) { skipSwapClick.current = false; if (event.detail > 0) return; }
              if (swapSource == null) setSwapSource(item.jogador_id);
              else if (swapSource === item.jogador_id) setSwapSource(null);
              else trocarConvocados(swapSource, item.jogador_id);
            }}><Icon name="switchClub" size={17} /></button>
          <button type="button" className="lineup-remove" aria-label={`Remover ${nome} da escalação`} disabled={savingLineup || savingStatus} onClick={() => { setSwapSource(null); toggleJogador(item.jogador_id); }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </>}
      </div>;
    });
  }

  function openEvent(type: string) {
    setFormEvento(f => ({ ...f, tipo: type, jogador_id: '', minuto: '' }));
    setEventError(''); setModalEvento(true);
  }

  function onShirtSaved(updated: Jogador, swapped?: ConflitoCamisa) {
    const numberFor = (playerId: number, current: number | undefined) => playerId === updated.id
      ? updated.numCamisa
      : playerId === swapped?.jogador_id ? swapped.camisa_anterior ?? undefined : current;
    setJogadores(previous => previous.map(player => ({ ...player, numCamisa: numberFor(player.id, player.numCamisa) })));
    const next = escalacao.map(item => ({ ...item, numCamisa: numberFor(item.jogador_id, item.numCamisa) ?? 0 }));
    if (next.some((item, index) => item.numCamisa !== escalacao[index].numCamisa)) {
      setEscalacao(next);
      setLineupDirty(true);
    }
    setShirtPlayer(null);
    setActionError(next.some(item => !item.numCamisa) ? 'Um convocado ficou sem camisa após a troca. Defina o número dele antes de continuar.' : '');
    setNotice('Número da camisa atualizado.');
  }

  function onEdited(updated: Partida) {
    refreshVersion.current++;
    setPartida(previous => previous ? { ...previous, ...updated } : updated);
    if (editor === 'match' && preparando) setEtapa(0);
    setNotice('Alterações salvas.');
  }

  const eventButtons = <section className="event-actions-panel">
    <h2 className="section-title">Registrar evento</h2>
    <div className="event-action-grid">{EVENT_TYPES.map(type => <button key={type.value} className="event-action" disabled={!canRecord || type.unavailable} onClick={() => openEvent(type.value)} title={type.unavailable ? 'Cartão azul indisponível nesta versão' : type.label}>
      <span className="event-icon-box"><EventIcon type={type.value} /></span><span>{type.label}</span>{type.unavailable && <small>Indisponível</small>}
    </button>)}</div>
    <p className="editor-description">{!podeGerenciar ? 'Seu vínculo permite acompanhar a partida. A edição é reservada à gestão do clube.' : !canRecord ? 'Inicie a partida para registrar os acontecimentos do jogo.' : 'Escolha um evento para informar jogador, período e minuto. O placar é ajustado separadamente.'}</p>
  </section>;

  return (
    <div className="partida-detalhe">
      <header className="match-detail-header">
        <button type="button" className="match-detail-close" aria-label="Voltar para partidas" onClick={() => navigate('/partidas')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        <h1>{partidaEmAndamento ? 'Detalhes da partida' : 'Preparação da partida'}</h1>
        {podeGerenciar && <MatchActionsMenu disabled={busy || salvandoEvento || deletingEvent !== null || deleteBusy}
          onEdit={() => setEditor('match')}
          onDelete={() => { setDeleteError(''); setConfirmDelete(true); }}/>}
      </header>
      {!preparando && actionError && <p className="notice-error" role="alert">{actionError}</p>}
      {!preparando && notice && <p className="match-notice" role="status">{notice}</p>}
      {partida.somente_leitura && <p className="collection-notice">Histórico compartilhado: esta partida é administrada pelo clube que a registrou. Aqui você pode acompanhar o placar, a escalação publicada e os eventos.</p>}

      {partidaEmAndamento && <p role="status" className="realtime-status">
        {realtimeState === 'connected'
          ? 'Conectado às atualizações de placar e novos eventos.'
          : realtimeState === 'connecting'
            ? 'Conectando às atualizações ao vivo…'
            : 'Atualizações ao vivo indisponíveis. Recarregue a página para consultar os dados atuais.'}
      </p>}
      {syncError && <p role="alert" className="realtime-status text-vermelho">{syncError}</p>}

      {preparando && <>
        <nav className="preparation-steps" aria-label="Etapas da preparação">
          <ol>{ETAPAS.map((item, index) => <li key={item.titulo}>
            <button type="button" aria-current={etapa === index ? 'step' : undefined} disabled={busy} onClick={() => void irParaEtapa(index)}>
              <span className={`preparation-step-number${index < etapa ? ' is-complete' : ''}`}>{index < etapa ? <Icon name="checkAll" size={16}/> : index + 1}</span>
              <span>{['Dados', 'Escalação', 'Revisão'][index]}</span>
            </button>
          </li>)}</ol>
          <div className="preparation-progress" aria-hidden="true"><span style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }}/></div>
        </nav>
        <div className="preparation-heading"><small>Etapa {etapa + 1} de 3</small><h2 ref={stageHeading} tabIndex={-1}>{ETAPAS[etapa].titulo}</h2><p>{ETAPAS[etapa].descricao}</p></div>
      </>}
      {(!preparando || etapa !== 1) && <>
      {preparando ? <section className="match-detail-card preparation-match-card" aria-label="Informações da partida">
        <div className="preparation-match-header">
          <span className="preparation-match-date"><Icon name="calendar" size={16}/>{formatPreparationDate(partida.data)}{partida.categoria?.nome ? ` · ${partida.categoria.nome.toUpperCase()}` : ''}</span>
          <StatusBadge status={partida.status}/>
        </div>
        <div className="preparation-match-teams">
          <div className="preparation-match-team"><ClubBadge src={mandante?.escudo} name={mandante?.nome || 'Mandante'} size={64}/><strong>{mandante?.nome || 'Mandante'}</strong><span>Mandante</span></div>
          <div className="preparation-match-center"><strong>VS</strong><span>{partida.horario || 'Horário a definir'}</span></div>
          <div className="preparation-match-team"><ClubBadge src={visitante?.escudo} name={visitante?.nome || 'Visitante'} size={64}/><strong>{visitante?.nome || 'Visitante'}</strong><span>Visitante</span></div>
        </div>
        <div className="preparation-match-location"><Icon name="location" size={18}/><span>{partida.local || 'Local a definir'}</span></div>
      </section> : <section className={`match-detail-card${partida.status === 'AO_VIVO' ? ' is-live' : ''}${preparando && etapa === 2 ? ' is-review' : ''}`} aria-label="Informações da partida">
        <div className="match-detail-date"><Icon name="calendar" size={16}/><span>{formatMatchDate(partida.data)}{partida.categoria?.nome ? ` · ${partida.categoria.nome.toUpperCase()}` : ''}</span></div>
        <div className="match-detail-confrontation">
          <div className="placar-time"><ClubBadge src={mandante?.escudo} name={mandante?.nome || 'Mandante'} size={64}/><span className="placar-time-nome">{mandante?.nome || 'Mandante'}</span></div>
          <div className="placar-centro">
            <div className="placar-gols" aria-label={partidaEmAndamento ? `${partida.gols_mandante} a ${partida.gols_visitante}` : 'Contra'}>{partidaEmAndamento ? <><span>{partida.gols_mandante}</span><span className="placar-x">·</span><span>{partida.gols_visitante}</span></> : <span className="placar-x">VS</span>}</div>
            <StatusBadge status={partida.status}/>
          </div>
          <div className="placar-time"><ClubBadge src={visitante?.escudo} name={visitante?.nome || 'Visitante'} size={64}/><span className="placar-time-nome">{visitante?.nome || 'Visitante'}</span></div>
        </div>
        <dl className="match-detail-facts">
          <div><Icon name="location" size={22}/><dt>Local</dt><dd>{partida.local || 'Local a definir'}</dd></div>
          <div><Icon name="clock" size={22}/><dt>Horário</dt><dd>{partida.horario || 'A definir'}</dd></div>
          <div><Icon name={partida.emCasa ? 'home' : 'bus'} size={22}/><dt>Mando</dt><dd>{partida.emCasa ? 'Casa' : 'Fora'}</dd></div>
        </dl>
        {podeGerenciar && partidaEmAndamento && <div className="match-detail-score-edit"><Btn variant="ghost" size="sm" onClick={() => setEditor('score')}><Icon name="edit" size={14}/>Editar placar</Btn></div>}
      </section>}
      {preparando && etapa === 2 && <section className="preparation-review" aria-label="Escalação para revisão">
        <div className="preparation-review-heading"><div><h3>Equipe convocada</h3><p>{titulares.length} titulares · {reservas.length} reservas</p></div><Btn variant="ghost" size="sm" onClick={() => void irParaEtapa(1)}><Icon name="edit" size={15}/>Alterar</Btn></div>
        <div className="preparation-review-lists">{[{ titulo: 'Titulares', items: titulares }, { titulo: 'Reservas', items: reservas }].map(group => <section key={group.titulo}>
          <h4>{group.titulo}<span>{group.items.length}</span></h4>
          <ul>{group.items.map(item => {
            const jogador = jogadores.find(j => j.id === item.jogador_id) || item.jogador;
            return <li key={item.jogador_id}>
              <span className="review-player-shirt">{String(item.numCamisa).padStart(2, '0')}</span>
              <div><strong>{jogador?.nome || 'Jogador'}</strong>{jogador?.posicao && <span className="lineup-position"><PositionIcon position={jogador.posicao}/>{jogador.posicao}</span>}</div>
            </li>;
          })}</ul>
          {!group.items.length && <p className="lineup-empty">Nenhum reserva convocado.</p>}
        </section>)}</div>
        <p className="editor-description">Ao iniciar, a preparação será encerrada e os controles ao vivo ficarão disponíveis.</p>
      </section>}
      </>}

      {/* Controles de status */}
      {podeGerenciar && partidaEmAndamento && STATUS_NEXT[partida.status] && (
        <div className="partida-acoes">
          <Btn onClick={mudarStatus} disabled={savingStatus}>{savingStatus ? 'Salvando...' : STATUS_BTN[partida.status]}</Btn>
        </div>
      )}

      {/* Abas */}
      {!preparando && partidaEmAndamento && <div className="partida-abas">
        {(partidaEmAndamento ? (['resumo', 'eventos', 'escalacao'] as const) : (['escalacao'] as const)).map(a => (
          <button key={a} className={`aba${abaVisivel === a ? ' aba-ativa' : ''}`} onClick={() => setAba(a)}>
            {a === 'resumo' ? 'Resumo' : a === 'eventos' ? `Eventos (${eventos.length})` : `Escalação (${escalacao.length})`}
          </button>
        ))}
      </div>}

      {abaVisivel === 'resumo' && (
        <div className="aba-content">
          {eventButtons}
          <div className="resumo-stats">
            {[['Gols casa', partida.gols_mandante], ['Gols fora', partida.gols_visitante], ['Eventos', eventos.length], ['Convocados', escalacao.length]].map(([l, v]) => (
              <Card key={String(l)} className="resumo-stat-card">
                <p className="stat-label">{l}</p>
                <p className="stat-value text-primaria">{v}</p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {abaVisivel === 'eventos' && (
        <div className="aba-content">
          {eventButtons}
          <h2 className="section-title">Acontecimentos da partida</h2>
          {eventos.length === 0
            ? <p className="text-sec">Nenhum evento registrado</p>
            : (
              <div className="eventos-list">
                {eventos.map(ev => {
                  const jog = jogadores.find(j => j.id === ev.jogador_id);
                  const tipo = EVENT_TYPES.find(t => t.value === ev.tipo);
                  return (
                    <div key={ev.id} className="evento-item">
                      <span className="event-icon-box"><EventIcon type={ev.tipo} /></span>
                      <span className="evento-description"><strong>{tipo?.label || ev.tipo}</strong><small>{ev.jogador?.nome || jog?.nome || 'Sem jogador vinculado'}</small></span>
                      <span className="evento-meta">{ev.periodo}º período{ev.minuto != null ? ` · ${ev.minuto}'` : ''}</span>
                      {podeGerenciar && <button className="btn-remover-ev" aria-label={`Remover ${tipo?.label || ev.tipo} de ${jog?.nome || 'jogador não informado'}`} disabled={deletingEvent !== null} onClick={() => removerEvento(ev.id)}><Icon name="trash" size={17} /></button>}
                    </div>
                  );
                })}
              </div>
            )
          }
        </div>
      )}

      {abaVisivel === 'escalacao' && (!preparando || etapa === 1) && (
        <div className="aba-content">
          <div className="lineup-groups">
            {podeGerenciar && <p className="lineup-swap-help" role="status"><Icon name="info" size={18}/><span>{swapSource == null ? 'Use o botão de troca para arrastar um jogador sobre outro ou selecione os dois botões para trocar.' : 'Selecione o botão de troca do outro jogador. Para cancelar, selecione novamente o primeiro.'}</span></p>}
            <div className="lineup-columns"><section>
              <h2>Titulares · {titulares.length}/5</h2>
              {titulares.length ? renderConvocados(titulares, 0) : <p className="lineup-empty">Selecione jogadores para preencher as cinco vagas.</p>}
            </section>
            <section>
              <h2>Reservas · {reservas.length}</h2>
              {reservas.length ? renderConvocados(reservas, titulares.length) : <p className="lineup-empty">Nenhum reserva convocado.</p>}
            </section>
            </div>
            {podeGerenciar && <details className="lineup-available">
              <summary><span>Adicionar jogadores <small>{disponiveis.length}</small></span><Icon name="chevronRight" size={18} /></summary>
              <div className="lineup-available-content">
                <CollectionSearch label="Buscar jogador disponível" placeholder="Buscar nome, camisa ou posição" value={buscaJogador} onChange={setBuscaJogador}/>
                <p className="editor-description">Os primeiros cinco convocados são titulares. Os demais entram como reservas.</p>
                <div className="escalacao-grid">
                  {jogadoresEncontrados.map(j => (
                    <article key={j.id} className="available-player">
                      <button type="button" className="lineup-shirt available-shirt" disabled={busy}
                        aria-label={`${j.numCamisa ? 'Editar' : 'Definir'} camisa de ${j.nome}`} onClick={() => setShirtPlayer(j)}>
                        {j.numCamisa ? String(j.numCamisa).padStart(2, '0') : <Icon name="shirt" size={22}/>}
                      </button>
                      <button type="button" className="available-player-add" disabled={busy} aria-label={`Convocar ${j.nome}`}
                        onClick={() => j.numCamisa ? toggleJogador(j.id) : setShirtPlayer(j)}>
                        <span className="available-player-info"><strong>{j.nome}</strong><span className="lineup-position"><PositionIcon position={j.posicao}/>{j.posicao}</span>{!j.numCamisa && <small>Definir camisa para convocar</small>}</span>
                        <Icon name="plus" size={18}/>
                      </button>
                    </article>
                  ))}
                  {!jogadoresEncontrados.length && <p className="lineup-empty">{disponiveis.length ? 'Nenhum jogador encontrado para essa busca.' : 'Todos os jogadores já foram convocados.'}</p>}
                </div>
              </div>
            </details>}
          </div>
          {podeGerenciar && !preparando && <div className="lineup-actions">
            <Btn onClick={salvarEscalacaoAtual} disabled={savingLineup || savingStatus}>{savingLineup ? 'Salvando...' : 'Salvar escalação'}</Btn>
            {partida.status === 'PREPARADA' && !lineupDirty && titulares.length === 5 && <Btn variant="ghost" onClick={mudarStatus} disabled={savingStatus || savingLineup}>{savingStatus ? 'Salvando...' : STATUS_BTN[partida.status]}</Btn>}
          </div>}
        </div>
      )}

      {preparando && <div className="preparation-footer">
        {actionError && <p role="alert" className="notice-error">{actionError}</p>}
        <div className="preparation-footer-content">
          <div className="preparation-save-state" role="status">{lineupDirty ? 'Alterações não salvas' : etapa === 2 && partida.status === 'PREPARADA' ? 'Preparação confirmada' : etapa === 0 ? 'Confira os dados para continuar' : 'Escalação salva'}<small>{etapa === 1 ? `${titulares.length}/5 titulares · ${reservas.length} reservas` : etapa === 2 ? 'A partida só começa com sua confirmação.' : 'Você pode voltar às etapas anteriores.'}</small></div>
          <div className="preparation-footer-buttons">
            {etapa > 0 && <Btn variant="ghost" disabled={busy} onClick={() => void irParaEtapa(etapa - 1)}><Icon name="chevronLeft" size={16}/>Voltar</Btn>}
            {etapa === 1 && <Btn variant="ghost" disabled={busy} onClick={() => void salvarEscalacaoAtual()}>{savingLineup ? 'Salvando…' : 'Salvar escalação'}</Btn>}
            {etapa < 2 ? <Btn disabled={busy} onClick={() => void irParaEtapa(etapa + 1)}>{savingLineup ? 'Salvando…' : etapa === 0 ? 'Montar escalação' : 'Revisar partida'}<Icon name="chevronRight" size={16}/></Btn>
              : partida.status === 'AGENDADA' ? <Btn disabled={busy} onClick={() => void confirmarPreparacao()}>{savingStatus ? 'Confirmando…' : 'Confirmar preparação'}<Icon name="checkAll" size={17}/></Btn>
              : <Btn disabled={busy} onClick={() => void mudarStatus()}>{savingStatus ? 'Iniciando…' : 'Iniciar partida'}<Icon name="chevronRight" size={17}/></Btn>}
          </div>
        </div>
      </div>}

      <ConfirmDelete name={confirmDelete ? `${mandante?.nome || partida.mandante?.nome || 'Mandante'} × ${visitante?.nome || partida.visitante?.nome || 'Visitante'}` : null}
        busy={deleteBusy} error={deleteError} onClose={() => setConfirmDelete(false)} onConfirm={async () => {
          if (deleteBusy || !podeGerenciar) return;
          setDeleteBusy(true);
          setDeleteError('');
          try {
            await deletarPartida(partida.id);
            navigate('/partidas', { replace: true });
          } catch (error) {
            setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir a partida. Tente novamente.');
          } finally {
            setDeleteBusy(false);
          }
        }} />

      {shirtPlayer && <PlayerShirtDialog player={shirtPlayer} category={partida.categoria?.nome}
        onClose={() => setShirtPlayer(null)} onSaved={onShirtSaved}/>}
      {/* Modal de evento */}
      {editor === 'match' && <MatchEditor partida={partida} times={times} onClose={() => setEditor(null)} onSaved={onEdited} />}
      {editor === 'score' && <ScoreEditor partida={partida} onClose={() => setEditor(null)} onSaved={onEdited} />}
      <Modal open={modalEvento} onClose={() => { if (!salvandoEvento) setModalEvento(false); }} title="Registrar evento">
        <form onSubmit={adicionarEvento} className="form-grid">
          <div className="selected-event full"><span className="event-icon-box"><EventIcon type={formEvento.tipo} /></span><strong>{EVENT_TYPES.find(type => type.value === formEvento.tipo)?.label}</strong></div>
          <Select label="Período" options={Array.from({ length: 10 }, (_, i) => ({ value: String(i + 1), label: `${i + 1}º Período` }))} value={formEvento.periodo} onChange={e => setFormEvento(f => ({ ...f, periodo: e.target.value }))} required disabled={salvandoEvento} />
          <Input label="Minuto" type="number" min="0" max="200" value={formEvento.minuto} onChange={e => setFormEvento(f => ({ ...f, minuto: e.target.value }))} placeholder="Opcional" disabled={salvandoEvento} />
          <Select label="Jogador" emptyLabel="Sem jogador vinculado" options={jogOpts} value={formEvento.jogador_id} onChange={e => setFormEvento(f => ({ ...f, jogador_id: e.target.value }))} className="full" disabled={salvandoEvento} />
          {eventError && <p className="notice-error full" role="alert">{eventError}</p>}
          {formEvento.tipo === 'GOL' && <p className="editor-description full">Este registro identifica o gol nas estatísticas. Atualize também o resultado em Editar placar.</p>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1/-1' }}>
            <Btn variant="ghost" type="button" disabled={salvandoEvento} onClick={() => setModalEvento(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvandoEvento}>{salvandoEvento ? 'Registrando...' : 'Registrar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
