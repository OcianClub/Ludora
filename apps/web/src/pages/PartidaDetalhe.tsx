import { Toast } from '../components/Toast';
import { PaulistaMatchNotice } from '../components/PaulistaMatchNotice';
import { nomeOficial } from '../utils/paulistaView';
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import {
  fetchPartidas, deletarPartida, atualizarStatusPartida, fetchEventosPartida, registrarEvento, deletarEvento,
  fetchEscalacao, salvarEscalacao, requestJson, fetchTimes,
  Partida, Evento, EscalacaoItem, PerfilJogador, Time, BASE_URL, invalidateApiReads, type Jogador, type ConflitoCamisa
} from '../services/api';
import { Btn, Modal, Input, Select, StatusBadge, LoadingSkeleton, Card } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { subscribeToMatch, type RealtimeState } from '../services/matchRealtime';
import { MATCH_POLL_CHANGED, MATCH_POLL_REFRESH } from '../services/matchPoll';
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
import { carregarGestao, comandoPartida, type GestaoPartida } from '../services/sharedMatches';
import { MatchOperations, PublishedLineups, MatchPreparationStatus } from '../components/MatchOperations';
import './SharedMatches.css';
import { MatchPreparationHeader, MatchLineupReview, LineupSwapHelp } from '../components/MatchPreparation';
import { validTimeInput } from '../utils/timeInput';
import { preparationStorageKey, readPreparationStep, rememberPreparationStep } from '../utils/matchPreparation';
import { validShirtNumber, reconcileLineupShirts } from '../utils/lineupShirts';
import type { RosterChange } from '../services/rosterRealtime';

const STATUS_NEXT: Record<string, string> = { AGENDADA: 'PREPARADA', PREPARADA: 'AO_VIVO', AO_VIVO: 'FINALIZADA' };
const ETAPAS = [
  { titulo: 'Dados da partida', descricao: 'Confira o confronto, a data e o local antes de montar sua equipe.' },
  { titulo: 'Monte sua equipe', descricao: 'Defina os titulares e convoque os reservas da sua equipe.' },
  { titulo: 'Revise sua equipe', descricao: 'Confira os convocados antes de publicar a escalação.' },
];

const STATUS_BTN: Record<string, string> = { AGENDADA: 'Iniciar preparação', PREPARADA: 'Iniciar partida', AO_VIVO: 'Finalizar partida' };

export default function PartidaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const detailLocation = useLocation();
  const { podeGerenciar: gestorDoClube, token, clube, usuario } = useAuth();
  const preparationKey = preparationStorageKey(usuario?.id, clube?.id, id);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [gestao, setGestao] = useState<GestaoPartida | null>(null);
  const podeGerenciar = gestao ? gestao.podePreparar : gestorDoClube && !partida?.somente_leitura;
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [escalacao, setEscalacao] = useState<EscalacaoItem[]>([]);
  const lineupRef = useRef(escalacao);
  lineupRef.current = escalacao;
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
  const [opponentOpen, setOpponentOpen] = useState(false);
  const [responsibilityOpen, setResponsibilityOpen] = useState(false);
  const [transferBusy, setTransferBusy] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingLineup, setSavingLineup] = useState(false);
  const [syncingShirt, setSyncingShirt] = useState(false);
  const [lineupDirty, setLineupDirty] = useState(false);
  const dirtyRef = useRef(false);
  dirtyRef.current = lineupDirty;
  const rosterChanged = useRef<(change: RosterChange) => void>(() => {});
  rosterChanged.current = change => {
    if (!partida || !['AGENDADA', 'PREPARADA'].includes(partida.status) || !gestao?.podePreparar) return;
    const changes = new Map(change.jogadores.map(j => [j.id, j.numCamisa]));
    setJogadores(current => current.map(j => changes.has(j.id) ? { ...j, numCamisa: changes.get(j.id) ?? undefined } : j));
    const result = reconcileLineupShirts(escalacao, changes);
    if (result.changed) setEscalacao(result.lineup);
    if (result.removed.length) setNotice('Jogador removido da escalação porque ficou sem camisa após uma alteração no elenco. Defina outro número para convocá-lo novamente.');
    setSwapSource(null);
  };
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
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

  function aplicarGestao(data: GestaoPartida, manterRascunho = false, players?: typeof jogadores) {
    if (data.paulista) data = { ...data, partida: { ...data.partida,
      mandante: data.partida.mandante && { ...data.partida.mandante, nome: nomeOficial(data.partida.mandante.nome) },
      visitante: data.partida.visitante && { ...data.partida.visitante, nome: nomeOficial(data.partida.visitante.nome) },
    } };
    const mine = data.equipes.find(e => e.id === data.minhaEquipeId);
    setGestao(data);
    setPartida({ ...data.partida, categoria_id: mine?.categoria_id || data.partida.categoria_id, categoria: mine?.categoria || data.partida.categoria,
      somente_leitura: !data.podePreparar, emCasa: mine ? mine.time_id === data.partida.mandante_id : data.partida.emCasa });
    setEventos(data.eventos);
    if (!manterRascunho) setEscalacao(mine?.escalacao || []);
    if (players) {
      setJogadores(players);
      const result = reconcileLineupShirts(lineupRef.current, new Map(players.map(j => [j.id, j.numCamisa])));
      if (manterRascunho) setEscalacao(result.lineup);
      if (result.removed.length) setNotice('Jogador removido da escalação por ficar sem camisa. Defina outro número para convocá-lo novamente.');
    }
  }
  async function carregarElenco(data: GestaoPartida) {
    const mine = data.equipes.find(e => e.id === data.minhaEquipeId);
    return data.podePreparar && mine && (data.podeAnotarOficial || ['AGENDADA', 'PREPARADA'].includes(data.partida.status))
      ? requestJson<typeof jogadores>(`/jogadores?categoria_id=${mine.categoria_id}&convocacao=true`) : undefined;
  }
  async function atualizarDados(manterRascunho = false) {
    const data = await carregarGestao(Number(id));
    aplicarGestao(data, manterRascunho, await carregarElenco(data));
  }
  useEffect(() => {
    function beforeUnload(event: BeforeUnloadEvent) {
      if (dirtyRef.current) { event.preventDefault(); event.returnValue = ''; }
    }
    function leaveLink(event: MouseEvent) {
      const link = (event.target as HTMLElement)?.closest<HTMLAnchorElement>('a[href]');
      if (dirtyRef.current && link && link.origin === location.origin && link.pathname !== location.pathname && !event.ctrlKey && !event.metaKey && !confirm('Há alterações não salvas na escalação. Sair sem salvar?')) event.preventDefault();
    }
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', leaveLink, true);
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', leaveLink, true); };
  }, []);
  useEffect(() => {
    let active = true;
    let unsubscribe = () => {};
    setLoading(true); setLoadError(''); setGestao(null); setEtapa(0); setLineupDirty(false); setSwapSource(null);
    let refreshing = false;
    let refreshQueued = false;
    let refreshTimer: number | null = null;
    async function refresh() {
      if (refreshing) { refreshQueued = true; return; }
      refreshing = true;
      const version = ++refreshVersion.current;
      try {
        const data = await carregarGestao(Number(id));
        const players = await carregarElenco(data);
        if (active && version === refreshVersion.current) { aplicarGestao(data, dirtyRef.current, players); setSyncError(''); }
      } catch { if (active) setSyncError('Não foi possível sincronizar. Confira sua conexão e tente recarregar.'); }
      finally {
        refreshing = false;
        if (active && refreshQueued) { refreshQueued = false; void refresh(); }
      }
    }
    const scheduleRefresh = () => {
      if (refreshTimer !== null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => { refreshTimer = null; void refresh(); }, 60);
    };
    const poll = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const resume = () => { if (!document.hidden) { invalidateApiReads('/jogadores'); void refresh(); } };
    document.addEventListener('visibilitychange', resume);
    void (async () => {
      try {
        const [data, teams] = await Promise.all([carregarGestao(Number(id)), fetchTimes()]);
        const players = await carregarElenco(data);
        if (!active) return;
        aplicarGestao(data, false, players); setTimes(teams);
        setEtapa(readPreparationStep(data, preparationKey));
        if (!['AGENDADA', 'PREPARADA'].includes(data.partida.status)) rememberPreparationStep(preparationKey, null);
        if (clube) unsubscribe = subscribeToMatch({ baseUrl: BASE_URL, token: token || '', clubId: clube.id, matchId: Number(id),
          onScore: scheduleRefresh, onRefresh: scheduleRefresh, onStateChange: setRealtimeState,
          onPoll: value => window.dispatchEvent(new CustomEvent(MATCH_POLL_CHANGED, { detail: value })),
          onReconnect: () => {
            window.dispatchEvent(new CustomEvent(MATCH_POLL_REFRESH, { detail: Number(id) }));
          },
          onRoster: change => rosterChanged.current(change) });
      } catch (e) { if (active) setLoadError((e as Error).message || 'Não foi possível carregar a partida.'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; unsubscribe(); if (refreshTimer !== null) window.clearTimeout(refreshTimer); window.clearInterval(poll); document.removeEventListener('visibilitychange', resume); };
  }, [id, token, clube?.id, usuario?.id]);

  async function mudarStatus() {
    if (!partida || savingStatus || !podeGerenciar) return;
    const next = STATUS_NEXT[partida.status];
    if (!next) return;
    if (next === 'AO_VIVO' && (lineupDirty || escalacao.filter(item => item.titular).length !== (gestao?.partida.titulares_necessarios || 5))) { setActionError(`Defina e salve exatamente ${gestao?.partida.titulares_necessarios || 5} titulares antes de iniciar.`); return; }
    if (next === 'FINALIZADA' && !confirm('Finalizar esta partida? Confira o placar e os eventos antes de confirmar.')) return;
    setSavingStatus(true); setActionError(''); setNotice('');
    try {
      await atualizarStatusPartida(partida.id, next, partida.status);
      refreshVersion.current++;
      await atualizarDados();
      if (next === 'AO_VIVO') { setAba('resumo'); rememberPreparationStep(preparationKey, null); }
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
    if (savingLineup || syncingShirt || !podeGerenciar) return false;
    if (!lineupDirty) return true;
    if (escalacao.some(item => !validShirtNumber(item.numCamisa))) { setActionError('Defina uma camisa de 01 a 99 para todos os titulares e reservas antes de salvar.'); return false; }
    if (new Set(escalacao.map(item => item.numCamisa)).size !== escalacao.length) { setActionError('Dois convocados estão com a mesma camisa. Atualize os números antes de salvar.'); return false; }
    setSavingLineup(true); setActionError(''); setNotice('');
    try {
      await comandoPartida(Number(id), 'escalacao', { jogadores: escalacao.map(e => ({ jogador_id: e.jogador_id, numCamisa: e.numCamisa, titular: e.titular })), versao: gestao?.partida.versao }, 'PUT');
      setLineupDirty(false);
      dirtyRef.current = false;
      await atualizarDados(true);
      setNotice('');
      return true;
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Não foi possível salvar a escalação.'); return false; }
    finally { setSavingLineup(false); }
  }

  function toggleJogador(jogadorId: number) {
    const jogador = jogadores.find(item => item.id === jogadorId);
    if (!podeGerenciar || savingLineup || savingStatus || syncingShirt) return;
    if (!escalacao.some(item => item.jogador_id === jogadorId) && !validShirtNumber(jogador?.numCamisa)) {
      setActionError('Defina o número da camisa do jogador antes de convocá-lo.');
      return;
    }
    if (!escalacao.some(item => item.jogador_id === jogadorId) && escalacao.some(item => item.numCamisa === jogador?.numCamisa)) {
      setActionError('Esta camisa já está em uso por outro convocado. Atualize os números antes de adicionar o jogador.');
      return;
    }
    setActionError('');
    dirtyRef.current = true;
    setLineupDirty(true);
    setEscalacao(previous => {
      const exists = previous.some(item => item.jogador_id === jogadorId);
      if (exists) return previous.filter(item => item.jogador_id !== jogadorId);
      const titular = previous.filter(item => item.titular).length < (gestao?.partida.titulares_necessarios || 5);
      const added = { jogador_id: jogadorId, numCamisa: jogador!.numCamisa!, titular };
      return titular ? [...previous.filter(item => item.titular), added, ...previous.filter(item => !item.titular)] : [...previous, added];
    });
  }

  if (loading) return <LoadingSkeleton kind="match" />;
  if (loadError) return <div role="alert" style={{ padding: 40 }}>{loadError}</div>;
  if (!partida) return <div style={{ color: 'var(--texto-sec)', padding: 40 }}>Partida não encontrada</div>;

  const mandante = partida.mandante || times.find(t => t.id === partida.mandante_id);
  const visitante = partida.visitante || times.find(t => t.id === partida.visitante_id);
  const jogOpts = jogadores.map(j => ({ value: j.id, label: `${j.nome} (#${j.numCamisa || '?'})` }));
  const escalacaoIds = new Set(escalacao.map(e => e.jogador_id));
  const canRecord = (gestao?.podeSumula ?? podeGerenciar) && ['AO_VIVO', 'FINALIZADA'].includes(partida.status);
  const partidaEmAndamento = ['AO_VIVO', 'FINALIZADA'].includes(partida.status);
  const preparando = podeGerenciar && ['AGENDADA', 'PREPARADA'].includes(partida.status);
  const podeEditarDados = preparando && !gestao?.paulista;
  const abaVisivel = partidaEmAndamento ? aba : 'escalacao';
  const disponiveis = jogadores.filter(j => !escalacaoIds.has(j.id));
  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const jogadoresEncontrados = disponiveis.filter(j => normalizar(`${j.nome} ${j.posicao} ${j.numCamisa ?? ''}`).includes(normalizar(buscaJogador.trim())));
  const minhaEquipe = gestao?.equipes.find(e => e.id === gestao.minhaEquipeId);
  const necessarios = gestao?.partida.titulares_necessarios || 5;
  const titulares = escalacao.filter(item => item.titular);
  const reservas = escalacao.filter(item => !item.titular);

  const busy = savingStatus || savingLineup || syncingShirt;
  const camisasUnicas = new Set(escalacao.map(item => item.numCamisa)).size === escalacao.length;
  const goleirosTitulares = titulares.filter(item => (jogadores.find(j => j.id === item.jogador_id)?.posicao || item.jogador?.posicao) === 'Goleiro').length;
  const escalaValida = titulares.length === necessarios && goleirosTitulares === 1 && camisasUnicas && escalacao.every(item => validShirtNumber(item.numCamisa));
  const dadosValidos = Boolean(partida.data && partida.horario && validTimeInput(partida.horario));
  const adversario = gestao?.equipes.find(equipe => equipe.id !== gestao.minhaEquipeId);
  const equipesProntas = Boolean(gestao?.equipes.length && gestao.equipes.every(equipe => equipe.pronta)) && !lineupDirty;
  const responsavelSumula = gestao?.equipes.find(equipe => equipe.clube_id === gestao.partida.sumula_clube_id)?.clube.nome || gestao?.organizador.nome;
  const faltamTitulares = Math.max(0, necessarios - titulares.length);
  const pendenciaEscalacao = faltamTitulares ? `Falta selecionar ${faltamTitulares} ${faltamTitulares === 1 ? 'titular' : 'titulares'}.` : goleirosTitulares !== 1 ? 'Selecione exatamente um goleiro entre os titulares. Os demais podem ficar na reserva.' : !camisasUnicas ? 'Atualize as camisas duplicadas antes de continuar.' : 'Defina uma camisa válida para todos os convocados antes de continuar.';
  const equipeConfirmada = Boolean(minhaEquipe?.pronta && !lineupDirty);
  const podeIniciar = gestao?.podeSumula && equipesProntas && escalaValida && partida.status === 'PREPARADA';
  let resumoEtapa = { titulo: 'Próximo passo: montar sua equipe', descricao: 'Você pode sair e continuar depois.' };
  if (etapa === 1) {
    resumoEtapa = {
      titulo: lineupDirty ? 'Alterações não salvas' : equipeConfirmada ? 'Equipe confirmada' : escalacao.length ? 'Rascunho salvo' : 'Escolha os titulares',
      descricao: !escalaValida ? pendenciaEscalacao : equipeConfirmada ? 'Sua escalação já está publicada. Você pode revisar a equipe.' : 'Salvar e revisar mantém a escalação como rascunho.',
    };
  } else if (etapa === 2) {
    let descricao = 'Publica sua escalação. A partida ainda não será iniciada.';
    if (equipeConfirmada) {
      if (!equipesProntas) descricao = `Aguardando confirmação do ${adversario?.clube.nome || 'adversário'}.`;
      else if (!gestao?.podeSumula) descricao = `As equipes estão prontas. Aguardando o ${responsavelSumula} iniciar.`;
      else descricao = gestao.equipes.length > 1 ? 'As equipes estão prontas. Você já pode iniciar a partida.' : 'Sua equipe está pronta. Você já pode iniciar a partida.';
    }
    resumoEtapa = { titulo: equipeConfirmada ? 'Sua equipe está confirmada' : 'Confirme sua equipe', descricao };
  }


  async function irParaEtapa(proxima: number) {
    if (!preparando || busy) return;
    setActionError('');
    if (proxima > 0 && !dadosValidos) {
      setActionError('Informe uma data e um horário válidos em Editar partida antes de continuar.');
      return;
    }
    if (proxima === 2) {
      if (!escalaValida) { setActionError(pendenciaEscalacao); return; }
      if (lineupDirty && !await salvarEscalacaoAtual()) return;
    }
    setSwapSource(null);
    setEtapa(proxima);
    rememberPreparationStep(preparationKey, proxima);
  }

  async function confirmarPreparacao() {
    if (busy || !preparando) return;
    setActionError('');
    if (!dadosValidos || !escalaValida || lineupDirty) {
      setActionError(!escalaValida ? pendenciaEscalacao : `Revise os dados e salve uma escalação com ${necessarios} titulares antes de confirmar.`);
      return;
    }
    setSavingStatus(true);
    try {
      await comandoPartida(partida!.id, 'preparacao', { versao: gestao?.partida.versao });
      await atualizarDados();
      setNotice('');
      rememberPreparationStep(preparationKey, 2);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Não foi possível confirmar a preparação. Tente novamente.');
    } finally { setSavingStatus(false); }
  }

  function trocarConvocados(origem: number, destino: number) {
    if (!podeGerenciar || busy || origem === destino) return;
    const primeiro = escalacao.find(item => item.jogador_id === origem);
    const segundo = escalacao.find(item => item.jogador_id === destino);
    if (!primeiro || !segundo) return;
    dirtyRef.current = true;
    setEscalacao(previous => previous.map(item => item.jogador_id === origem
      ? { ...segundo, titular: primeiro.titular }
      : item.jogador_id === destino ? { ...primeiro, titular: segundo.titular } : item));
    setLineupDirty(true);
    setSwapSource(null);
    setNotice('');
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
      return <div className={`lineup-row${draggedId === item.jogador_id ? ' is-dragging' : ''}${dropTarget === item.jogador_id || swapSource === item.jogador_id ? ' is-swap-target' : ''}`} key={item.jogador_id} data-lineup-id={item.jogador_id} data-lineup-role={item.titular ? 'titular' : 'reserva'}>
        <span className="lineup-order" aria-label={`Posição ${inicio + index + 1} na escalação`}>{inicio + index + 1}</span>
        {podeGerenciar ? <button type="button" className="lineup-shirt lineup-shirt-edit" disabled={busy}
          aria-label={`Editar camisa de ${nome}`} onClick={() => setShirtPlayer({ id: item.jogador_id, nome, numCamisa: item.numCamisa || undefined })}>
          {item.numCamisa > 0 ? String(item.numCamisa).padStart(2, '0') : <Icon name="shirt" size={22}/>}
        </button> : <span className="lineup-shirt">{item.numCamisa > 0 ? String(item.numCamisa).padStart(2, '0') : '—'}</span>}
        <div className="lineup-player"><strong data-tooltip={nome} data-tooltip-overflow>{nome}</strong>{jogador?.posicao && <span className="lineup-position"><PositionIcon decorative tooltip={false} position={jogador.posicao} />{jogador.posicao}</span>}</div>
        {podeGerenciar && <>
          <button type="button" className="lineup-swap" aria-label={`${swapSource != null && swapSource !== item.jogador_id ? 'Trocar com' : 'Trocar'} ${nome}`} aria-pressed={swapSource === item.jogador_id} disabled={busy}
            data-tooltip="Trocar jogador"
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
          <button type="button" className="lineup-remove" aria-label={`Remover ${nome} da escalação`} disabled={busy} onClick={() => { setSwapSource(null); toggleJogador(item.jogador_id); }}><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        </>}
      </div>;
    });
  }

  function openEvent(type: string) {
    setFormEvento(f => ({ ...f, tipo: type, jogador_id: '', minuto: '' }));
    setEventError(''); setModalEvento(true);
  }

  function onShirtSaved(updated: Jogador, swapped?: ConflitoCamisa) {
    const changes = new Map<number, number | undefined>([[updated.id, updated.numCamisa]]);
    if (swapped) changes.set(swapped.jogador_id, swapped.camisa_anterior ?? undefined);
    for (const playerId of updated.escalacoes_atualizadas?.find(row => row.partida_id === Number(id))?.removidos || []) changes.set(playerId, undefined);
    setJogadores(previous => previous.map(player => changes.has(player.id) ? { ...player, numCamisa: changes.get(player.id) } : player));
    const result = reconcileLineupShirts(escalacao, changes);
    if (result.changed) {
      dirtyRef.current = true;
      setEscalacao(result.lineup);
      setLineupDirty(true);
    }
    setSwapSource(null);
    setDraggedId(null);
    setDropTarget(null);
    drag.current = null;
    setShirtPlayer(null);
    setActionError('');
    const removedNames = result.removed.map(playerId => jogadores.find(player => player.id === playerId)?.nome || 'Jogador').join(', ');
    setNotice(removedNames ? `${removedNames} foi removido da escalação por ficar sem camisa. Defina um novo número para convocá-lo novamente.` : 'Número da camisa atualizado.');
    refreshVersion.current++;
    setSyncingShirt(true);
    void atualizarDados(true)
      .catch(() => setSyncError('A camisa foi salva. Atualize a partida para sincronizar a preparação.'))
      .finally(() => setSyncingShirt(false));
  }

  function onEdited(updated: Partida) {
    refreshVersion.current++;
    setPartida(previous => previous ? { ...previous, ...updated } : updated);
    if (editor === 'match' && preparando) setEtapa(0);
    void atualizarDados();
    setNotice('Alterações salvas.');
  }

  const eventButtons = <section className="event-actions-panel">
    <h2 className="section-title">Registrar evento</h2>
    <div className="event-action-grid">{EVENT_TYPES.map(type => <button key={type.value} className="event-action" disabled={!canRecord || type.unavailable} onClick={() => openEvent(type.value)}>
      <span className="event-icon-box"><EventIcon type={type.value} /></span><span>{type.label}</span>{type.unavailable && <small>Indisponível</small>}
    </button>)}</div>
    <p className="editor-description">{!podeGerenciar ? 'Seu vínculo permite acompanhar a partida. A edição é reservada à gestão do clube.' : !canRecord ? 'Inicie a partida para registrar os acontecimentos do jogo.' : 'Escolha um evento para informar jogador, período e minuto. O placar é ajustado separadamente.'}</p>
  </section>;

  return (
    <div className="partida-detalhe" data-preparation={preparando ? 'true' : undefined} data-live={partida.status === 'AO_VIVO' ? 'true' : undefined}>
      <PaulistaMatchNotice oficial={gestao?.paulista} partida={partida}/>
      <header className="match-detail-header">
        <button type="button" className="match-detail-close" aria-label={detailLocation.state?.fromPaulista ? 'Voltar ao campeonato' : 'Voltar para partidas'} onClick={() => { if (!lineupDirty || confirm('Sair sem salvar as alterações da escalação?')) { if (detailLocation.state?.fromPaulista) { navigate(-1); return; } navigate(new URLSearchParams(location.search).get('retorno')?.startsWith('/competicoes/paulista') ? new URLSearchParams(location.search).get('retorno')! : '/partidas'); } }}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg></button>
        <h1>{partidaEmAndamento ? <><span className="match-detail-desktop-title">{partida.status === 'FINALIZADA' ? 'Resumo da partida' : 'Detalhes da partida'}</span><span className="match-detail-mobile-title">{partida.mandante?.nome} × {partida.visitante?.nome}</span></> : preparando ? 'Preparação da partida' : 'Detalhes da partida'}</h1>
        {podeEditarDados && <div className="match-detail-header-actions">
          <Btn variant="ghost" size="sm" className="match-detail-edit" aria-label="Editar partida" data-tooltip="Editar partida" data-tooltip-icon-only disabled={busy || deleteBusy} onClick={() => setEditor('match')}><Icon name="edit" size={17}/><span>Editar partida</span></Btn>
          {gestao && <MatchActionsMenu disabled={busy || salvandoEvento || deletingEvent !== null || deleteBusy}
          onResponsibility={gestao && gestao.equipes.length > 1 ? () => { setTransferError(''); setResponsibilityOpen(true); } : undefined}
          onDelete={gestao && (gestao.podeSumula || gestao.organizador.id === clube?.id) ? () => { setMotivoCancelamento(''); setDeleteError(''); setConfirmDelete(true); } : undefined}/>}</div>}
      </header>
      {!preparando && actionError && <p className="notice-error" role="alert">{actionError}</p>}
      <Toast message={notice} onClose={() => setNotice('')}/>
      {gestao && preparando && <MatchPreparationHeader data={gestao} dirty={lineupDirty}/>}

      {partida.status === 'AO_VIVO' && realtimeState !== 'connected' && <p role="status" className="live-connection-notice"><Icon name="broadcast" size={17}/>{realtimeState === 'connecting' ? 'Conectando às atualizações ao vivo…' : 'Reconectando ao tempo real. Os dados serão consultados periodicamente.'}</p>}
      {syncError && <p role="alert" className="realtime-status text-vermelho">{syncError}</p>}

      {preparando && <>
        <nav className="preparation-steps" aria-label="Etapas da preparação">
          <ol>{ETAPAS.map((item, index) => <li key={item.titulo}>
            <button type="button" aria-current={etapa === index ? 'step' : undefined} disabled={busy || (index === 2 && (!escalaValida || !dadosValidos))} onClick={() => void irParaEtapa(index)}>
              <span className={`preparation-step-number${index < etapa ? ' is-complete' : ''}`}>{index < etapa ? <Icon name="checkAll" size={16}/> : index + 1}</span>
              <span>{['Dados', 'Escalação', 'Revisão'][index]}</span>
            </button>
          </li>)}</ol>
          <div className="preparation-progress" aria-hidden="true"><span style={{ width: `${((etapa + 1) / ETAPAS.length) * 100}%` }}/></div>
        </nav>
        <div className="preparation-heading"><small>Etapa {etapa + 1} de 3</small><h2 ref={stageHeading} tabIndex={-1}>{ETAPAS[etapa].titulo}</h2><p>{etapa === 1 ? `Selecione ${necessarios} titulares, incluindo exatamente um goleiro, e convoque os reservas.` : ETAPAS[etapa].descricao}</p>{etapa !== 2 && adversario && <button type="button" className="preparation-opponent-link" onClick={() => setOpponentOpen(true)}><Icon name="team" size={17}/>Ver escalação adversária<Icon name="chevronRight" size={15}/></button>}</div>
      </>}
      {!preparando && !partidaEmAndamento && <section className={`match-detail-card${partida.status === 'AO_VIVO' ? ' is-live' : ''}`} aria-label="Informações da partida">
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
        {!gestao && podeGerenciar && partidaEmAndamento && <div className="match-detail-score-edit"><Btn variant="ghost" size="sm" onClick={() => setEditor('score')}><Icon name="edit" size={14}/>Editar placar</Btn></div>}
      </section>}
      {preparando && etapa === 0 && <section className="preparation-data-details" aria-label="Detalhes do confronto">
        <header><h3>Detalhes do confronto</h3></header>
        <div><Icon name="trophy" size={21}/><span><small>Competição</small><strong>{partida.competicao?.nome || 'Amistoso'}</strong></span></div>
        <div><Icon name={partida.emCasa ? 'home' : 'bus'} size={21}/><span><small>Mando da sua equipe</small><strong>{partida.emCasa ? 'Em casa' : 'Fora de casa'}</strong></span></div>
        {adversario && <p className="editor-description"><Icon name="info" size={17}/><span>Alterações de data, horário ou local precisam do aceite do {adversario.clube.nome}.</span></p>}
      </section>}
      {preparando && etapa === 2 && gestao && <section className="preparation-review" aria-label="Escalação para revisão">
        <div className="preparation-review-heading"><div><h3>Equipes convocadas</h3><p>Confira os titulares e as opções no banco de cada equipe.</p></div><Btn variant="ghost" size="sm" aria-label="Alterar sua equipe" onClick={() => void irParaEtapa(1)}><Icon name="edit" size={15}/><span className="review-edit-label">Alterar sua equipe</span></Btn></div>
        <MatchLineupReview data={gestao} lineup={escalacao} players={jogadores} dirty={lineupDirty}/>
      </section>}

      {/* Controles de status */}
      {!gestao && canRecord && partidaEmAndamento && STATUS_NEXT[partida.status] && (
        <div className="partida-acoes">
          <Btn onClick={mudarStatus} disabled={savingStatus}>{savingStatus ? 'Salvando...' : STATUS_BTN[partida.status]}</Btn>
        </div>
      )}

      {/* Abas */}
      {!gestao && !preparando && partidaEmAndamento && <div className="partida-abas">
        {(partidaEmAndamento ? (['resumo', 'eventos', 'escalacao'] as const) : (['escalacao'] as const)).map(a => (
          <button key={a} className={`aba${abaVisivel === a ? ' aba-ativa' : ''}`} onClick={() => setAba(a)}>
            {a === 'resumo' ? 'Resumo' : a === 'eventos' ? `Eventos (${eventos.length})` : `Escalação (${escalacao.length})`}
          </button>
        ))}
      </div>}

      {!gestao && abaVisivel === 'resumo' && (
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

      {!gestao && abaVisivel === 'eventos' && (
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

      {abaVisivel === 'escalacao' && preparando && etapa === 1 && (
        <div className="aba-content">
          <div className="lineup-groups">
            {podeGerenciar && <div className="lineup-swap-help">
              <Icon name="info" size={18}/><p role="status">{swapSource == null ? 'Arraste pelo ícone para trocar jogadores.' : 'Selecione o ícone de troca do outro jogador ou toque novamente no primeiro para cancelar.'}</p>
              <LineupSwapHelp/>
            </div>}
            {escalaValida && !reservas.length && <p className="lineup-reserve-tip"><Icon name="info" size={16}/>Recomendamos convocar alguns reservas para as substituições.</p>}
            <div className="lineup-workspace">
              <div className="lineup-selected">
                <section aria-labelledby="starting-lineup-title">
                  <h2 id="starting-lineup-title">Titulares <span>{titulares.length}/{necessarios}</span></h2>
                  {renderConvocados(titulares, 0)}
                  {Array.from({ length: Math.max(0, necessarios - titulares.length) }, (_, index) => <button
                    type="button" className="lineup-empty-slot" key={index} disabled={busy}
                    aria-label={`Selecionar titular para a vaga ${titulares.length + index + 1}`}
                    onClick={() => document.getElementById('lineup-player-search')?.focus()}>
                    <span className="lineup-order">{titulares.length + index + 1}</span><Icon name="user" size={20}/><span>Selecione um jogador do elenco</span><Icon name="plus" size={17}/>
                  </button>)}
                </section>
                <section aria-labelledby="reserve-lineup-title">
                  <h2 id="reserve-lineup-title">Reservas <span>{reservas.length}</span></h2>
                  {reservas.length ? renderConvocados(reservas, titulares.length) : <button
                    type="button" className="lineup-empty-slot lineup-empty-reserve" disabled={busy || !disponiveis.length || titulares.length < necessarios}
                    onClick={() => { setBuscaJogador(''); document.getElementById('lineup-player-search')?.focus(); }}>
                    <Icon name="user" size={20}/><span>Adicionar reserva<small>{titulares.length < necessarios ? 'Defina os titulares primeiro · opcional' : !disponiveis.length ? 'Nenhum jogador disponível no elenco' : 'Selecione um jogador do elenco · opcional'}</small></span><Icon name="plus" size={17}/>
                  </button>}
                </section>
              </div>
              <section className="lineup-roster" aria-labelledby="available-players-title">
                <h2 id="available-players-title"><Icon name="team" size={19}/>Elenco {partida.categoria?.nome?.toUpperCase()}<span>{disponiveis.length} {disponiveis.length === 1 ? 'disponível' : 'disponíveis'}</span></h2>
                <CollectionSearch id="lineup-player-search" label="Buscar jogador disponível" placeholder="Buscar nome, camisa ou posição" value={buscaJogador} onChange={setBuscaJogador}/>
                <p className="editor-description">Os primeiros {necessarios} convocados são titulares. Os demais entram como reservas.</p>
                <ul className="available-roster">
                  {jogadoresEncontrados.map(j => <li key={j.id} className="available-player">
                    <button type="button" className={`lineup-shirt available-shirt${!j.numCamisa ? ' is-missing' : ''}`} disabled={busy}
                      aria-label={`${j.numCamisa ? 'Editar' : 'Definir'} camisa de ${j.nome}`} onClick={() => setShirtPlayer(j)}>
                      {j.numCamisa ? String(j.numCamisa).padStart(2, '0') : <Icon name="shirt" size={22}/>}
                    </button>
                    <button type="button" className="available-player-add" disabled={busy} aria-label={`Convocar ${j.nome}`}
                      onClick={() => j.numCamisa ? toggleJogador(j.id) : setShirtPlayer(j)}>
                      <span className="available-player-info"><strong data-tooltip={j.nome} data-tooltip-overflow>{j.nome}</strong><span className="lineup-position"><PositionIcon decorative tooltip={false} position={j.posicao}/>{j.posicao}</span></span>
                      <Icon name="plus" size={19}/>
                    </button>
                  </li>)}
                </ul>
                {!jogadoresEncontrados.length && <p className="lineup-empty">{disponiveis.length ? 'Nenhum jogador encontrado para essa busca.' : 'Todos os jogadores já foram convocados.'}</p>}
              </section>
            </div>
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
          <div className="preparation-save-state" role="status">
            <strong>{resumoEtapa.titulo}</strong>
            <small id="lineup-requirements">{resumoEtapa.descricao}</small>
          </div>
          <div className="preparation-footer-buttons">
            {etapa === 2 && <Btn variant="ghost" disabled={busy} onClick={() => void irParaEtapa(1)}><Icon name="chevronLeft" size={16}/>Voltar à escalação</Btn>}
            {etapa === 1 && <Btn variant="ghost" disabled={busy} onClick={async () => { if (await salvarEscalacaoAtual()) { rememberPreparationStep(preparationKey, 1); navigate('/partidas'); } }}>{savingLineup ? 'Salvando…' : 'Salvar e sair'}</Btn>}
            {etapa < 2 ? <Btn disabled={busy || (etapa === 1 && !escalaValida)} aria-describedby={etapa === 1 ? 'lineup-requirements' : undefined} onClick={() => void irParaEtapa(etapa + 1)}>{savingLineup ? 'Salvando…' : etapa === 0 ? 'Montar escalação' : 'Salvar e revisar'}<Icon name="chevronRight" size={16}/></Btn>
              : !equipeConfirmada ? <Btn disabled={busy} onClick={() => void confirmarPreparacao()}>{savingStatus ? 'Confirmando…' : 'Confirmar minha equipe'}<Icon name="checkAll" size={17}/></Btn>
              : podeIniciar && <Btn disabled={busy} onClick={() => void mudarStatus()}>{savingStatus ? 'Iniciando…' : 'Iniciar partida'}<Icon name="chevronRight" size={17}/></Btn>}
          </div>
        </div>
      </div>}

      {gestao && partidaEmAndamento && <MatchOperations data={gestao} refresh={() => atualizarDados()}
        players={jogadores}
        onResponsibility={!gestao.paulista && gestao.equipes.length > 1 ? () => { setTransferError(''); setResponsibilityOpen(true); } : undefined}/>}
      {gestao && !podeGerenciar && !partidaEmAndamento && <PublishedLineups data={gestao}/>}
      {gestao && adversario && <Modal open={opponentOpen} title={`Escalação do ${adversario.clube.nome}`} className="preparation-modal preparation-opponent-modal" onClose={() => setOpponentOpen(false)}>
        <p className="editor-description">{adversario.publicada_em ? 'Escalação publicada pelo adversário. Apenas o próprio clube pode alterá-la.' : 'O adversário ainda não publicou a escalação. Os rascunhos são privados.'}</p>
        {adversario.publicada_em && <PublishedLineups data={{ ...gestao, minhaEquipeId: undefined, equipes: [adversario] }}/>}
      </Modal>}
      <Modal open={responsibilityOpen} className="preparation-modal preparation-responsibility-modal" title="Responsável pela súmula" onClose={() => { if (!transferBusy) setResponsibilityOpen(false); }} footer={<div className="editor-actions">
        <Btn variant="ghost" disabled={transferBusy} onClick={() => setResponsibilityOpen(false)}>Fechar</Btn>
        {gestao?.podePreparar && adversario && ['AGENDADA', 'PREPARADA', 'AO_VIVO'].includes(partida.status) && <Btn disabled={transferBusy} onClick={async () => {
          setTransferBusy(true); setTransferError('');
          try {
            await comandoPartida(partida.id, 'sumula', {});
            setResponsibilityOpen(false);
            setNotice(`Solicitação enviada ao ${adversario.clube.nome}. Seu clube continua responsável até o aceite.`);
          } catch (e) { setTransferError((e as Error).message); }
          finally { setTransferBusy(false); }
        }}>{transferBusy ? 'Enviando…' : gestao.podeSumula ? 'Solicitar transferência' : 'Solicitar responsabilidade'}</Btn>}
      </div>}>
        <div className="preparation-responsible"><Icon name="team" size={24}/><div><small>Clube responsável</small><strong>{responsavelSumula}</strong></div></div>
        <p className="editor-description">O responsável inicia a partida e registra o placar e os eventos. Cada clube continua gerenciando sua própria escalação.</p>
        {gestao?.podePreparar && adversario && ['AGENDADA', 'PREPARADA', 'AO_VIVO'].includes(partida.status) && <p className="editor-description">{gestao.podeSumula ? `A transferência para o ${adversario.clube.nome}` : `A responsabilidade pelo ${clube?.nome || 'seu clube'}`} depende do aceite do outro clube na aba Solicitações.</p>}
        {transferError && <p className="notice-error" role="alert">{transferError}</p>}
      </Modal>
      <Modal open={confirmDelete} title="Cancelar partida" onClose={() => { if (!deleteBusy) setConfirmDelete(false); }} footer={<div className="editor-actions"><Btn disabled={deleteBusy} variant="ghost" onClick={() => setConfirmDelete(false)}>Voltar</Btn><Btn disabled={deleteBusy || !motivoCancelamento.trim()} variant="danger" onClick={async () => {
        setDeleteBusy(true); setDeleteError('');
        try { await comandoPartida(partida.id, 'status', { status: 'CANCELADA', motivo: motivoCancelamento, versao: gestao?.partida.versao }, 'PATCH'); setConfirmDelete(false); await atualizarDados(); }
        catch (e) { setDeleteError((e as Error).message); } finally { setDeleteBusy(false); }
      }}>Confirmar cancelamento</Btn></div>}><p className="editor-description">O histórico será preservado e os clubes serão avisados.</p><Input label="Motivo do cancelamento" value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)}/>{deleteError && <p className="notice-error" role="alert">{deleteError}</p>}</Modal>

      {shirtPlayer && <PlayerShirtDialog player={shirtPlayer} category={partida.categoria?.nome}
        onClose={() => setShirtPlayer(null)} onSaved={onShirtSaved}/>}
      {/* Modal de evento */}
      {editor === 'match' && podeEditarDados && <MatchEditor partida={partida} times={times} approvalClub={adversario?.clube.nome} onClose={() => setEditor(null)} onSaved={onEdited} />}
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
