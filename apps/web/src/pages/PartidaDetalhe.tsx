import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import {
  fetchPartidas, atualizarStatusPartida, fetchEventosPartida, registrarEvento, deletarEvento,
  fetchEscalacao, salvarEscalacao, fetchJogadoresPerfis, fetchTimes,
  Partida, Evento, EscalacaoItem, PerfilJogador, Time, BASE_URL
} from '../services/api';
import { Btn, Modal, Select, StatusBadge, Spinner, Card } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import './PartidaDetalhe.css';

const TIPO_EVENTO_OPTS = [
  { value: 'GOL', label: '⚽ Gol' },
  { value: 'ASSISTENCIA', label: '🅰️ Assistência' },
  { value: 'DEFESA', label: '🧤 Defesa' },
  { value: 'FALTA', label: '⚠️ Falta' },
  { value: 'CARTAO_AMARELO', label: '🟡 Cartão Amarelo' },
  { value: 'CARTAO_VERMELHO', label: '🔴 Cartão Vermelho' },
  { value: 'CARTAO_AZUL', label: '🔵 Cartão Azul' },
];

const STATUS_FLOW = ['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA'];
const STATUS_NEXT: Record<string, string> = { AGENDADA: 'PREPARADA', PREPARADA: 'AO_VIVO', AO_VIVO: 'FINALIZADA' };
const STATUS_BTN: Record<string, string> = { AGENDADA: 'Iniciar preparação', PREPARADA: 'Iniciar partida', AO_VIVO: 'Finalizar partida' };

export default function PartidaDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { podeGerenciar } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  const [partida, setPartida] = useState<Partida | null>(null);
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [escalacao, setEscalacao] = useState<EscalacaoItem[]>([]);
  const [jogadores, setJogadores] = useState<PerfilJogador[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [aba, setAba] = useState<'resumo' | 'eventos' | 'escalacao'>('resumo');

  // modal evento
  const [modalEvento, setModalEvento] = useState(false);
  const [formEvento, setFormEvento] = useState({ tipo: 'GOL', periodo: '1', minuto: '', jogador_id: '' });
  const [salvandoEvento, setSalvandoEvento] = useState(false);

  async function carregar() {
    if (!id) return;
    try {
      const [ps, evs, esc] = await Promise.all([
        fetchPartidas(),
        fetchEventosPartida(Number(id)),
        fetchEscalacao(Number(id)),
      ]);
      const p = ps.find(x => x.id === Number(id));
      setPartida(p || null);
      setEventos(evs);
      setEscalacao(esc);
      if (p) {
        const [jogs, ts] = await Promise.all([fetchJogadoresPerfis(p.categoria_id), fetchTimes()]);
        setJogadores(jogs);
        setTimes(ts);
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    carregar();
    // WebSocket para atualizações ao vivo
    const socket = io(BASE_URL);
    socketRef.current = socket;
    socket.on('placarAtualizado', (data: any) => {
      if (data.partida_id === Number(id)) {
        setPartida(prev => prev ? { ...prev, gols_mandante: data.gols_mandante, gols_visitante: data.gols_visitante } : prev);
      }
    });
    socket.on('eventoRegistrado', (data: any) => {
      if (data.partida_id === Number(id)) setEventos(prev => [...prev, data]);
    });
    return () => { socket.disconnect(); };
  }, [id]);

  async function mudarStatus() {
    if (!partida) return;
    const next = STATUS_NEXT[partida.status];
    if (!next) return;
    await atualizarStatusPartida(partida.id, next);
    setPartida(p => p ? { ...p, status: next } : p);
  }

  async function adicionarEvento(e: React.FormEvent) {
    e.preventDefault(); setSalvandoEvento(true);
    try {
      await registrarEvento(Number(id), {
        tipo: formEvento.tipo, periodo: Number(formEvento.periodo),
        minuto: formEvento.minuto ? Number(formEvento.minuto) : undefined,
        jogador_id: formEvento.jogador_id ? Number(formEvento.jogador_id) : undefined,
      });
      setModalEvento(false);
      const evs = await fetchEventosPartida(Number(id));
      setEventos(evs);
      // Recarrega placar
      const ps = await fetchPartidas();
      const p = ps.find(x => x.id === Number(id));
      if (p) setPartida(p);
    } catch (err: any) { alert(err.message); }
    finally { setSalvandoEvento(false); }
  }

  async function removerEvento(eventoId: number) {
    if (!confirm('Remover evento?')) return;
    await deletarEvento(eventoId);
    setEventos(prev => prev.filter(e => e.id !== eventoId));
    const ps = await fetchPartidas();
    const p = ps.find(x => x.id === Number(id));
    if (p) setPartida(p);
  }

  // Escalação: toggle titular
  async function salvarEscalacaoAtual() {
    await salvarEscalacao(Number(id), escalacao.map(e => ({ jogador_id: e.jogador_id, numCamisa: e.numCamisa, titular: e.titular })));
    alert('Escalação salva!');
  }

  function toggleJogador(jogadorId: number) {
    const idx = escalacao.findIndex(e => e.jogador_id === jogadorId);
    if (idx >= 0) {
      setEscalacao(prev => prev.filter(e => e.jogador_id !== jogadorId));
    } else {
      setEscalacao(prev => [...prev, { jogador_id: jogadorId, numCamisa: 0, titular: true }]);
    }
  }

  if (loading) return <Spinner />;
  if (!partida) return <div style={{ color: 'var(--texto-sec)', padding: 40 }}>Partida não encontrada</div>;

  const mandante = times.find(t => t.id === partida.mandante_id);
  const visitante = times.find(t => t.id === partida.visitante_id);
  const jogOpts = jogadores.map(j => ({ value: j.id, label: `${j.nome} (#${j.numCamisa || '?'})` }));
  const escalacaoIds = new Set(escalacao.map(e => e.jogador_id));

  return (
    <div className="partida-detalhe">
      <button className="btn-voltar" onClick={() => navigate('/partidas')}>← Partidas</button>

      {/* Placar hero */}
      <div className="placar-hero">
        <div className="placar-time">
          <span className="placar-time-nome">{mandante?.nome || '—'}</span>
          <span className="placar-casa">{partida.emCasa ? '🏠 Casa' : ''}</span>
        </div>
        <div className="placar-centro">
          <div className="placar-gols">
            <span>{partida.gols_mandante}</span>
            <span className="placar-x">×</span>
            <span>{partida.gols_visitante}</span>
          </div>
          <StatusBadge status={partida.status} />
          {partida.data && <div className="placar-meta">{new Date(partida.data).toLocaleDateString('pt-BR')}{partida.horario ? ` · ${partida.horario}` : ''}</div>}
          {partida.local && <div className="placar-meta">{partida.local}</div>}
        </div>
        <div className="placar-time">
          <span className="placar-time-nome">{visitante?.nome || '—'}</span>
        </div>
      </div>

      {/* Controles de status */}
      {podeGerenciar && STATUS_NEXT[partida.status] && (
        <div className="partida-acoes">
          <Btn onClick={mudarStatus}>{STATUS_BTN[partida.status]}</Btn>
          {partida.status === 'AO_VIVO' && <Btn variant="ghost" onClick={() => setModalEvento(true)}>+ Registrar evento</Btn>}
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
          {podeGerenciar && partida.status !== 'AGENDADA' && (
            <div style={{ marginBottom: 16 }}>
              <Btn onClick={() => setModalEvento(true)}>+ Registrar evento</Btn>
            </div>
          )}
          {eventos.length === 0
            ? <p className="text-sec">Nenhum evento registrado</p>
            : (
              <div className="eventos-list">
                {eventos.map(ev => {
                  const jog = jogadores.find(j => j.id === ev.jogador_id);
                  const tipo = TIPO_EVENTO_OPTS.find(t => t.value === ev.tipo);
                  return (
                    <div key={ev.id} className="evento-item">
                      <span className="evento-tipo">{tipo?.label || ev.tipo}</span>
                      <span className="evento-jog">{jog?.nome || '—'}</span>
                      <span className="evento-meta">P{ev.periodo}{ev.minuto ? ` · ${ev.minuto}'` : ''}</span>
                      {podeGerenciar && <button className="btn-remover-ev" onClick={() => removerEvento(ev.id)}>✕</button>}
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
              <Btn onClick={salvarEscalacaoAtual}>Salvar escalação</Btn>
            </div>
          )}
          <div className="escalacao-grid">
            {jogadores.map(j => {
              const selecionado = escalacaoIds.has(j.id);
              return (
                <div key={j.id} className={`escalacao-item${selecionado ? ' selecionado' : ''}`} onClick={() => podeGerenciar && toggleJogador(j.id)}>
                  <div className="esc-camisa">#{j.numCamisa || '?'}</div>
                  <div className="esc-nome">{j.nome}</div>
                  <div className="esc-posicao">{j.posicao}</div>
                  {selecionado && <div className="esc-check">✓</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal de evento */}
      <Modal open={modalEvento} onClose={() => setModalEvento(false)} title="Registrar evento">
        <form onSubmit={adicionarEvento} className="form-grid">
          <Select label="Tipo" options={TIPO_EVENTO_OPTS} value={formEvento.tipo} onChange={e => setFormEvento(f => ({ ...f, tipo: e.target.value }))} required className="full" />
          <Select label="Período" options={[{ value: '1', label: '1º Período' }, { value: '2', label: '2º Período' }]} value={formEvento.periodo} onChange={e => setFormEvento(f => ({ ...f, periodo: e.target.value }))} required />
          <div className="field"><label className="field-label">Minuto</label><input className="field-input" type="number" min="0" max="99" value={formEvento.minuto} onChange={e => setFormEvento(f => ({ ...f, minuto: e.target.value }))} placeholder="Opcional" /></div>
          <Select label="Jogador" options={jogOpts} value={formEvento.jogador_id} onChange={e => setFormEvento(f => ({ ...f, jogador_id: e.target.value }))} className="full" />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1/-1' }}>
            <Btn variant="ghost" type="button" onClick={() => setModalEvento(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvandoEvento}>{salvandoEvento ? 'Registrando...' : 'Registrar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
