import { useEffect, useState } from 'react';
import { fetchTimes, criarTime, atualizarTime, deletarTime, fetchCategorias, Time, Categoria } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

const FORM_VAZIO = { nome: '', escudo: '', categoria_id: '' };

export default function TimesPage() {
  const { podeGerenciar } = useAuth();
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Time | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function carregar() {
    Promise.all([fetchTimes(), fetchCategorias()])
      .then(([t, c]) => { setTimes(t); setCategorias(c); })
      .catch(console.error).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  function abrirNovo() { setEditando(null); setForm(FORM_VAZIO); setErro(''); setModal(true); }
  function abrirEditar(t: Time) {
    setEditando(t);
    setForm({ nome: t.nome, escudo: t.escudo || '', categoria_id: t.categoria_id?.toString() || '' });
    setErro(''); setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    const dados = { nome: form.nome, escudo: form.escudo || undefined, categorias_ids: form.categoria_id ? [Number(form.categoria_id)] : [] };
    try {
      if (editando) await atualizarTime(editando.id, dados);
      else await criarTime(dados);
      setModal(false); carregar();
    } catch (err: any) { setErro(err.message); }
    finally { setSalvando(false); }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir time?')) return;
    try { await deletarTime(id); carregar(); } catch (err: any) { alert(err.message); }
  }

  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const filtrados = times.filter(t => !busca || t.nome.toLowerCase().includes(busca.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Times</h1><p className="page-sub">{times.length} cadastrados</p></div>
        {podeGerenciar && <Btn onClick={abrirNovo}>+ Novo time</Btn>}
      </div>

      <div className="filter-bar">
        <div className="field"><label className="field-label">Buscar</label><input className="field-input" placeholder="Nome do time..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
      </div>

      {loading ? <Spinner /> : filtrados.length === 0 ? <Empty icon="🛡" message="O clube ainda não publicou seus times" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Categoria</th>{podeGerenciar && <th>Ações</th>}</tr></thead>
            <tbody>
              {filtrados.map(t => {
                const cat = categorias.find(c => c.id === t.categoria_id);
                return (
                  <tr key={t.id}>
                    <td><strong>{t.nome}</strong></td>
                    <td>{cat?.nome || '—'}</td>
                    {podeGerenciar && <td><div className="actions"><Btn variant="ghost" size="sm" onClick={() => abrirEditar(t)}>Editar</Btn><Btn variant="danger" size="sm" onClick={() => excluir(t.id)}>Excluir</Btn></div></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar time' : 'Novo time'}>
        <form onSubmit={salvar} className="form-grid">
          <Input label="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className="full" />
          <Input label="URL do escudo" value={form.escudo} onChange={e => setForm(f => ({ ...f, escudo: e.target.value }))} placeholder="https://..." className="full" />
          <Select label="Categoria" options={catOpts} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))} className="full" />
          {erro && <div style={{ color: 'var(--titulo-erro)', fontSize: 13 }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }} className="full">
            <Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
