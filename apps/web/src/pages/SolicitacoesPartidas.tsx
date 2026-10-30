import { io } from 'socket.io-client';
import { BASE_URL } from '../services/config';
import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { carregarPropostas, responderProposta, type PropostaPartida } from '../services/sharedMatches';
import { Btn, Input, Modal, Spinner } from '../components/UI';
import { Icon } from '../components/Icon';
import { InfoNotice } from '../components/InfoNotice';
import { MatchDateField, MatchTimeField } from '../components/MatchDateTime';
import { formatMatchDate } from '../components/MatchCard';
import './SharedMatches.css';

export default function SolicitacoesPartidas() {
  const { clube, token } = useAuth();
  const currentClub = useRef(clube?.id);
  currentClub.current = clube?.id;
  const [params] = useSearchParams();
  const [items, setItems] = useState<PropostaPartida[]>([]);
  const [loading, setLoading] = useState(true), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<PropostaPartida | null>(null);
  const [acao, setAcao] = useState('ACEITAR'), [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ data: '', horario: '', local: '', motivo: '' });
  const [filtro, setFiltro] = useState('PENDENTE');
  const highlighted = useRef<string | null>(null);
  useEffect(() => {
    const id = params.get('id');
    const item = items.find(proposal => proposal.id === id);
    if (!item || highlighted.current === id) return;
    highlighted.current = id;
    if (item.status !== 'PENDENTE') setFiltro('');
    requestAnimationFrame(() => document.querySelector('[data-highlight]')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
  }, [items, params]);
  async function refresh() {
    setError('');
    const sourceClub = clube?.id;
    try { const data = await carregarPropostas(); if (currentClub.current === sourceClub) setItems(data); } catch (e) { if (currentClub.current === sourceClub) setError((e as Error).message); } finally { if (currentClub.current === sourceClub) setLoading(false); }
  }
  useEffect(() => {
    setItems([]); setLoading(true);
    void refresh();
    if (!clube || !token) return;
    const socket = io(BASE_URL, { auth: { token, clubeId: clube.id } });
    socket.on('solicitacao_partida', () => { void refresh(); });
    socket.on('connect', () => { void refresh(); });
    const timer = setInterval(() => { if (!socket.connected) void refresh(); }, 12000);
    return () => { socket.disconnect(); clearInterval(timer); };
  }, [clube?.id, token]);
  function open(p: PropostaPartida, next: string) {
    setSelected(p); setAcao(next); setError('');
    setForm({ data: p.dados.data || '', horario: p.dados.horario || '', local: p.dados.local || '', motivo: '' });
  }
  async function respond() {
    if (!selected || busy) return;
    setBusy(true); setError('');
    try {
      await responderProposta(selected, acao, form);
      setSelected(null); setNotice(acao === 'ACEITAR' ? 'Confronto confirmado. Cada clube já pode preparar sua equipe.' : acao === 'SUGERIR' ? 'Alteração enviada. Aguarde a resposta do outro clube.' : 'Resposta registrada.');
      await refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="shared-matches-page">
    <header className="page-header"><div><h1 className="page-title">Solicitações de partidas</h1><p className="page-sub">Combine os confrontos e acompanhe as respostas dos clubes.</p></div><Link className="btn btn-ghost btn-md" to="/partidas"><Icon name="chevronLeft" size={18}/>Voltar às partidas</Link></header>
    <div className="shared-status-tabs" role="group" aria-label="Filtrar solicitações">{[['PENDENTE', 'Pendentes'], ['', 'Todas']].map(([v, l]) => <button key={l} aria-pressed={filtro === v} onClick={() => setFiltro(v)}>{l}</button>)}</div>
    {notice && <p role="status" className="match-notice">{notice}</p>}
    {!selected && error && <p role="alert" className="notice-error">{error}<button onClick={() => void refresh()}>Tentar novamente</button></p>}
    {loading ? <Spinner/> : <div className="shared-proposal-list">{items.filter(p => !filtro || p.status === filtro).map(p => {
      const recebida = p.respondente_id === clube?.id;
      const sugestao = p.dados.sugestao;
      const autorSugestao = sugestao?.clube_id === p.origem_id ? p.origem.nome : p.destino.nome;
      return <article className="shared-proposal" key={p.id} data-highlight={params.get('id') === p.id || undefined}>
        <div className="shared-proposal-title"><Icon name={p.tipo === 'SUMULA' ? 'switchClub' : 'calendar'} size={22}/><div><h2>{p.origem?.nome} × {p.destino?.nome}</h2><small>{p.categoria_nome?.toUpperCase()} · {p.tipo === 'CRIACAO' ? 'Novo confronto' : p.tipo === 'SUMULA' ? 'Transferência de súmula' : 'Alteração da partida'} · {p.status.toLowerCase()}</small></div></div>
        {p.tipo !== 'SUMULA' && <p><strong>{p.dados.data ? formatMatchDate(p.dados.data) : 'Data a definir'}</strong> · {p.dados.horario} · {p.dados.local || 'Local a definir'}</p>}
        <p className="text-sec">{p.status === 'PENDENTE' ? sugestao ? recebida ? `${autorSugestao} sugeriu novos dados. Confira e responda.` : 'Sua sugestão foi enviada. Aguardando o outro clube.' : recebida ? 'Seu clube precisa responder a esta proposta.' : 'Aguardando a resposta do outro clube.' : p.motivo || 'Solicitação encerrada.'}</p>
        {sugestao?.motivo && <p className="shared-proposal-observation"><Icon name="info" size={17}/>{sugestao.motivo}</p>}
        <div className="shared-inline-actions">{p.status === 'PENDENTE' && recebida && <><Btn onClick={() => open(p, 'ACEITAR')}>Aceitar</Btn>{p.tipo !== 'SUMULA' && <Btn variant="ghost" onClick={() => open(p, 'SUGERIR')}>Sugerir alteração</Btn>}<Btn variant="ghost" onClick={() => open(p, 'RECUSAR')}>Recusar</Btn></>}
          {p.status === 'PENDENTE' && p.origem_id === clube?.id && <Btn variant="ghost" onClick={() => open(p, 'CANCELAR')}>Cancelar proposta</Btn>}
          {p.partida_id && <Link className="btn btn-ghost btn-sm" to={`/partidas/${p.partida_id}`}>Abrir partida<Icon name="chevronRight" size={16}/></Link>}
        </div>
      </article>;
    })}{!items.some(p => !filtro || p.status === filtro) && <p className="collection-empty">Nenhuma solicitação {filtro ? 'pendente' : 'encontrada'}.</p>}</div>}
    <Modal open={!!selected} title={acao === 'SUGERIR' ? 'Sugerir alteração' : acao === 'ACEITAR' ? 'Aceitar proposta' : acao === 'RECUSAR' ? 'Recusar proposta' : 'Cancelar proposta'} onClose={() => { if (!busy) { setSelected(null); setError(''); } }} footer={<div className="editor-actions"><Btn disabled={busy} variant="ghost" onClick={() => { setSelected(null); setError(''); }}>Voltar</Btn><Btn disabled={busy} onClick={() => void respond()}>{busy ? 'Salvando…' : 'Confirmar'}</Btn></div>}>
      {selected && <><InfoNotice title="Confira antes de confirmar">{selected.origem?.nome} × {selected.destino?.nome} · {selected.categoria_nome?.toUpperCase()}. {acao === 'ACEITAR' ? 'O aceite confirma os dados desta versão da proposta.' : 'O outro clube será informado da sua resposta.'}</InfoNotice>
      {acao === 'ACEITAR' && selected.tipo !== 'SUMULA' && <p className="editor-description">{selected.dados.data ? formatMatchDate(selected.dados.data) : ''} · {selected.dados.horario}<br/>{selected.dados.local || 'Local a definir'}</p>}
      {acao === 'SUGERIR' && <div className="form-grid"><MatchDateField value={form.data} onChange={data => setForm(f => ({ ...f, data }))}/><MatchTimeField value={form.horario} onChange={horario => setForm(f => ({ ...f, horario }))}/><div className="full"><Input label="Local" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))}/></div></div>}
      {acao !== 'ACEITAR' && <Input label="Motivo ou observação (opcional)" maxLength={500} value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}/>}
      {error && <p role="alert" className="notice-error">{error}</p>}</>}
    </Modal>
  </div>;
}
