import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPartidas, criarPartida, deletarPartida, fetchTimes, fetchCategorias, fetchCompeticoes, Partida, Time, Categoria, Competicao } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty, StatusBadge } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

const STATUSES = [
  { value: 'AGENDADA', label: 'Agendada' }, { value: 'PREPARADA', label: 'Preparada' },
  { value: 'AO_VIVO', label: 'Ao Vivo' }, { value: 'FINALIZADA', label: 'Finalizada' }, { value: 'CANCELADA', label: 'Cancelada' },
];
const FORM_VAZIO = { mandante_id: '', visitante_id: '', data: '', horario: '', local: '', categoria_id: '', competicao_id: '', rodada: '', emCasa: 'true' };

export default function PartidasPage() {
  const { podeGerenciar } = useAuth();
  const navigate = useNavigate();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function carregar() {
    Promise.all([fetchPartidas(), fetchTimes(), fetchCategorias(), fetchCompeticoes()])
      .then(([p, t, c, comp]) => { setPartidas(p); setTimes(t); setCategorias(c); setCompeticoes(comp); })
      .catch(console.error).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  async function recarregar(status?: string, cat?: string) {
    setLoading(true);
    try {
      const p = await fetchPartidas({ status: status || undefined, categoria_id: cat ? Number(cat) : undefined });
      setPartidas(p);
    } catch { } finally { setLoading(false); }
  }

  function mudarFiltro(status: string, cat: string) {
    setFiltroStatus(status); setFiltroCategoria(cat);
    recarregar(status, cat);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      await criarPartida({
        mandante_id: Number(form.mandante_id), visitante_id: Number(form.visitante_id),
        data: form.data, horario: form.horario, local: form.local || undefined,
        categoria_id: Number(form.categoria_id),
        competicao_id: form.competicao_id ? Number(form.competicao_id) : undefined,
        rodada: form.rodada ? Number(form.rodada) : undefined,
        emCasa: form.emCasa === 'true',
      });
      setModal(false); carregar();
    } catch (err: any) { setErro(err.message); }
    finally { setSalvando(false); }
  }

  async function excluir(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm('Excluir partida?')) return;
    try { await deletarPartida(id); carregar(); } catch (err: any) { alert(err.message); }
  }

  const timeOpts = times.map(t => ({ value: t.id, label: t.nome }));
  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const compOpts = competicoes.map(c => ({ value: c.id, label: `${c.nome} (${c.ano})` }));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Partidas</h1><p className="page-sub">{partidas.length} encontradas</p></div>
        {podeGerenciar && <Btn onClick={() => { setForm(FORM_VAZIO); setErro(''); setModal(true); }}>+ Nova partida</Btn>}
      </div>

      <div className="filter-bar">
        <Select label="Status" options={STATUSES} value={filtroStatus} onChange={e => mudarFiltro(e.target.value, filtroCategoria)} />
        <Select label="Categoria" options={catOpts} value={filtroCategoria} onChange={e => mudarFiltro(filtroStatus, e.target.value)} />
        {(filtroStatus || filtroCategoria) && <Btn variant="ghost" size="sm" onClick={() => mudarFiltro('', '')}>Limpar</Btn>}
      </div>

      {loading ? <Spinner /> : partidas.length === 0 ? <Empty icon="⚽" message="Nenhuma partida publicada para os filtros selecionados" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Mandante</th><th>Placar</th><th>Visitante</th><th>Categoria</th><th>Status</th>{podeGerenciar && <th>Ações</th>}</tr></thead>
            <tbody>
              {partidas.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/partidas/${p.id}`)}>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <div>{p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '—'}</div>
                    {p.horario && <div style={{ fontSize: 11, color: 'var(--texto-sec)' }}>{p.horario}</div>}
                  </td>
                  <td><strong>{p.mandante?.nome || times.find(t => t.id === p.mandante_id)?.nome || '—'}</strong></td>
                  <td style={{ textAlign: 'center', fontFamily: 'var(--font-titulo)', fontSize: 18, fontWeight: 700, color: 'var(--primaria)' }}>{p.gols_mandante} × {p.gols_visitante}</td>
                  <td><strong>{p.visitante?.nome || times.find(t => t.id === p.visitante_id)?.nome || '—'}</strong></td>
                  <td>{p.categoria?.nome || categorias.find(c => c.id === p.categoria_id)?.nome || '—'}</td>
                  <td><StatusBadge status={p.status} /></td>
                  {podeGerenciar && <td onClick={e => e.stopPropagation()}><div className="actions"><Btn variant="ghost" size="sm" onClick={() => navigate(`/partidas/${p.id}`)}>Detalhe</Btn><Btn variant="danger" size="sm" onClick={e => excluir(p.id, e)}>Excluir</Btn></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title="Nova partida">
        <form onSubmit={salvar} className="form-grid">
          <Select label="Mandante" options={timeOpts} value={form.mandante_id} onChange={e => setForm(f => ({ ...f, mandante_id: e.target.value }))} required />
          <Select label="Visitante" options={timeOpts} value={form.visitante_id} onChange={e => setForm(f => ({ ...f, visitante_id: e.target.value }))} required />
          <Input label="Data" type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} required />
          <Input label="Horário" type="time" value={form.horario} onChange={e => setForm(f => ({ ...f, horario: e.target.value }))} />
          <Input label="Local" value={form.local} onChange={e => setForm(f => ({ ...f, local: e.target.value }))} className="full" />
          <Select label="Categoria" options={catOpts} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))} required />
          <Select label="Competição" options={compOpts} value={form.competicao_id} onChange={e => setForm(f => ({ ...f, competicao_id: e.target.value }))} />
          <Input label="Rodada" type="number" value={form.rodada} onChange={e => setForm(f => ({ ...f, rodada: e.target.value }))} />
          <Select label="Mando" options={[{ value: 'true', label: 'Em casa' }, { value: 'false', label: 'Fora' }]} value={form.emCasa} onChange={e => setForm(f => ({ ...f, emCasa: e.target.value }))} />
          {erro && <div style={{ color: 'var(--titulo-erro)', fontSize: 13, gridColumn: '1/-1' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1/-1' }}>
            <Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Criar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
