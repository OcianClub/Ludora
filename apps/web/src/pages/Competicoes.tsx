import { useEffect, useState } from 'react';
import { fetchCompeticoes, criarCompeticao, atualizarCompeticao, deletarCompeticao, Competicao } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

const TIPOS = [{ value: 'BASE', label: 'Base' }, { value: 'INICIACAO', label: 'Iniciação' }];
const FORM_VAZIO = { nome: '', ano: new Date().getFullYear().toString(), tipo: 'BASE' };

export default function CompeticoesPage() {
  const { podeGerenciar } = useAuth();
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Competicao | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function carregar() {
    fetchCompeticoes().then(setCompeticoes).catch(console.error).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  function abrirNovo() { setEditando(null); setForm(FORM_VAZIO); setErro(''); setModal(true); }
  function abrirEditar(c: Competicao) {
    setEditando(c);
    setForm({ nome: c.nome, ano: c.ano.toString(), tipo: c.tipo });
    setErro(''); setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      const dados = { nome: form.nome, ano: Number(form.ano), tipo: form.tipo };
      if (editando) await atualizarCompeticao(editando.id, dados);
      else await criarCompeticao(dados);
      setModal(false); carregar();
    } catch (err: any) { setErro(err.message); }
    finally { setSalvando(false); }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir competição?')) return;
    try { await deletarCompeticao(id); carregar(); } catch (err: any) { alert(err.message); }
  }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Competições</h1><p className="page-sub">{competicoes.length} cadastradas</p></div>
        {podeGerenciar && <Btn onClick={abrirNovo}>+ Nova competição</Btn>}
      </div>

      {loading ? <Spinner /> : competicoes.length === 0 ? <Empty icon="🏆" message="Nenhuma competição ainda" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Ano</th><th>Tipo</th>{podeGerenciar && <th>Ações</th>}</tr></thead>
            <tbody>
              {competicoes.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.nome}</strong></td>
                  <td>{c.ano}</td>
                  <td>{c.tipo === 'BASE' ? 'Base' : 'Iniciação'}</td>
                  {podeGerenciar && <td><div className="actions"><Btn variant="ghost" size="sm" onClick={() => abrirEditar(c)}>Editar</Btn><Btn variant="danger" size="sm" onClick={() => excluir(c.id)}>Excluir</Btn></div></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar competição' : 'Nova competição'}>
        <form onSubmit={salvar} className="form-grid">
          <Input label="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className="full" />
          <Input label="Ano" type="number" value={form.ano} onChange={e => setForm(f => ({ ...f, ano: e.target.value }))} required />
          <Select label="Tipo" options={TIPOS} value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))} required />
          {erro && <div style={{ color: 'var(--titulo-erro)', fontSize: 13, gridColumn: '1/-1' }}>{erro}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', gridColumn: '1/-1' }}>
            <Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
