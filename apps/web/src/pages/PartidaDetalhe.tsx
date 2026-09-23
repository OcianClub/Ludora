import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  fetchPartidas, atualizarStatusPartida, fetchEventosPartida, registrarEvento, deletarEvento,
  fetchEscalacao, salvarEscalacao, fetchJogadoresPerfis, fetchTimes,
  Partida, Evento, EscalacaoItem, PerfilJogador, Time, BASE_URL
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

const STATUS_NEXT: Record<string, string> = { AGENDADA: 'PREPARADA', PREPARADA: 'AO_VIVO', AO_VIVO: 'FINALIZADA' };
const STATUS_BTN: Record<string, string> = { AGENDADA: 'Iniciar preparação', PREPARADA: 'Iniciar partida', AO_VIVO: 'Finalizar partida' };

export default function PartidaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { podeGerenciar, token, clube } = useAuth();

  const [partida, setPartida] = useState<Partida | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [escalacao, setEscalacao] = useState<EscalacaoItem[]>([]);
  const [jogadores, setJogadores] = useState<PerfilJogador[]>([]);
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
  const [deletingEvent, setDeletingEvent] = useState<number | null>(null);
  const refreshVersion = useRef(0);

  // modal evento
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
          fetchJogadoresPerfis(match.categoria_id), fetchTimes(),
        ]);
        if (!active) return;
        setJogadores(players);
        setTimes(teams);

        if (token && clube) {
          unsubscribe = subscribeToMatch({
            baseUrl: BASE_URL,
            token,
            clubId: clube.id,
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
    if (next === 'FINALIZADA' && !confirm('Finalizar esta partida? Confira o placar e os eventos antes de confirmar.')) return;
    setSavingStatus(true); setActionError(''); setNotice('');
    try {
      await atualizarStatusPartida(partida.id, next);
      refreshVersion.current++;
      setPartida(p => p ? { ...p, status: next } : p);
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

  // Escalação: toggle titular
  async function salvarEscalacaoAtual() {
    if (savingLineup || !podeGerenciar) return;
    setSavingLineup(true); setActionError(''); setNotice('');
    try {
      await salvarEscalacao(Number(id), escalacao.map(e => ({ jogador_id: e.jogador_id, numCamisa: e.numCamisa, titular: e.titular })));
      setNotice('Escalação salva.');
    } catch (err) { setActionError(err instanceof Error ? err.message : 'Não foi possível salvar a escalação.'); }
    finally { setSavingLineup(false); }
  }

  function toggleJogador(jogadorId: number) {
    const idx = escalacao.findIndex(e => e.jogador_id === jogadorId);
    if (idx >= 0) {
      setEscalacao(prev => prev.filter(e => e.jogador_id !== jogadorId));
    } else {
      setEscalacao(prev => [...prev, { jogador_id: jogadorId, numCamisa: jogadores.find(j => j.id === jogadorId)?.numCamisa || 0, titular: true }]);
    }
  }

  if (loading) return <Spinner />;
  if (loadError) return <div role="alert" style={{ padding: 40 }}>{loadError}</div>;
  if (!partida) return <div style={{ color: 'var(--texto-sec)', padding: 40 }}>Partida não encontrada</div>;

  const mandante = times.find(t => t.id === partida.mandante_id);
  const visitante = times.find(t => t.id === partida.visitante_id);
  const jogOpts = jogadores.map(j => ({ value: j.id, label: `${j.nome} (#${j.numCamisa || '?'})` }));
  const escalacaoIds = new Set(escalacao.map(e => e.jogador_id));
  const canRecord = podeGerenciar && ['AO_VIVO', 'FINALIZADA'].includes(partida.status);

  function openEvent(type: string) {
    setFormEvento(f => ({ ...f, tipo: type, jogador_id: '', minuto: '' }));
    setEventError(''); setModalEvento(true);
  }

  function onEdited(updated: Partida) {
    refreshVersion.current++;
    setPartida(previous => previous ? { ...previous, ...updated } : updated);
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
      <button className="btn-voltar" onClick={() => navigate('/partidas')}>← Partidas</button>
      <div className="page-header match-detail-header"><div><span className="eyebrow">DENTRO DE CAMPO</span><h1 className="page-title">Detalhes da partida</h1></div>
        {podeGerenciar && <Btn variant="ghost" onClick={() => setEditor('match')}><Icon name="edit" size={17} />Editar partida</Btn>}
      </div>
      {actionError && <p className="notice-error" role="alert">{actionError}</p>}
      {notice && <p className="match-notice" role="status">{notice}</p>}

      <p role="status" className="realtime-status">
        {realtimeState === 'connected'
          ? 'Conectado às atualizações de placar e novos eventos.'
          : realtimeState === 'connecting'
            ? 'Conectando às atualizações ao vivo…'
            : 'Atualizações ao vivo indisponíveis. Recarregue a página para consultar os dados atuais.'}
      </p>
      {syncError && <p role="alert" className="realtime-status text-vermelho">{syncError}</p>}

      {/* Placar hero */}
      <div className={`placar-hero${partida.status === 'AO_VIVO' ? ' placar-live' : ''}`}>
        <div className="placar-time">
          <ClubBadge src={mandante?.escudo || partida.mandante?.escudo} size={64} />
          <span className="placar-time-nome">{mandante?.nome || partida.mandante?.nome || '—'}</span>
          <span className="placar-casa">Mandante</span>
        </div>
        <div className="placar-centro">
          <div className="placar-gols">
            {['AO_VIVO', 'FINALIZADA'].includes(partida.status) ? <><span>{partida.gols_mandante}</span>
            <span className="placar-x">×</span>
            <span>{partida.gols_visitante}</span></> : <span className="placar-x">VS</span>}
          </div>
          <StatusBadge status={partida.status} />
          {partida.data && <div className="placar-meta">{formatMatchDate(partida.data)}{partida.horario ? ` · ${partida.horario}` : ''}</div>}
          {partida.local && <div className="placar-meta">{partida.local}</div>}
          {podeGerenciar && ['AO_VIVO', 'FINALIZADA'].includes(partida.status) && <Btn variant="ghost" size="sm" onClick={() => setEditor('score')}><Icon name="edit" size={14} />Editar placar</Btn>}
        </div>
        <div className="placar-time">
          <ClubBadge src={visitante?.escudo || partida.visitante?.escudo} size={64} />
          <span className="placar-time-nome">{visitante?.nome || partida.visitante?.nome || '—'}</span>
          <span className="placar-casa">Visitante</span>
        </div>
      </div>

      {/* Controles de status */}
      {podeGerenciar && STATUS_NEXT[partida.status] && (
        <div className="partida-acoes">
          <Btn onClick={mudarStatus} disabled={savingStatus}>{savingStatus ? 'Salvando...' : STATUS_BTN[partida.status]}</Btn>
        </div>
      )}

      {/* Abas */}
      <div className="partida-abas">
        {(['resumo', 'eventos', 'escalacao'] as const).map(a => (
          <button key={a} className={`aba${aba === a ? ' aba-ativa' : ''}`} onClick={() => setAba(a)}>
            {a === 'resumo' ? 'Resumo' : a === 'eventos' ? `Eventos (${eventos.length})` : `Escalação (${escalacao.length})`}
          </button>
        ))}
      </div>

      {aba === 'resumo' && (
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

      {aba === 'eventos' && (
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
                      <span className="evento-description"><strong>{tipo?.label || ev.tipo}</strong><small>{jog?.nome || 'Sem jogador vinculado'}</small></span>
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

      {aba === 'escalacao' && (
        <div className="aba-content">
          {podeGerenciar && (
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <Btn onClick={salvarEscalacaoAtual} disabled={savingLineup}>{savingLineup ? 'Salvando...' : 'Salvar escalação'}</Btn>
            </div>
          )}
          <div className="escalacao-grid">
            {jogadores.map(j => {
              const selecionado = escalacaoIds.has(j.id);
              return (
                <button type="button" key={j.id} className={`escalacao-item${selecionado ? ' selecionado' : ''}`} aria-pressed={selecionado} disabled={!podeGerenciar || savingLineup} onClick={() => toggleJogador(j.id)}>
                  <div className="esc-camisa">#{j.numCamisa || '?'}</div>
                  <div className="esc-nome">{j.nome}</div>
                  <div className="esc-posicao">{j.posicao}</div>
                  {selecionado && <div className="esc-check">✓</div>}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
