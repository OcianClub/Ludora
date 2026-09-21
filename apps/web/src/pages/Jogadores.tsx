import { useEffect, useState } from 'react';
import { fetchJogadores, criarJogador, atualizarJogador, deletarJogador, fetchCategorias, Jogador, Categoria } from '../services/api';
import { Btn, Modal, Input, Select, Spinner, Empty, PerfilBadge } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';

const POSICOES = ['Goleiro','Fixo','Ala Direito','Ala Esquerdo','Pivô'].map(v => ({ value: v, label: v }));

const FORM_VAZIO = { nome: '', cpf: '', dtNasc: '', posicao: '', numCamisa: '', categoria_id: '' };

export default function JogadoresPage() {
  const { podeGerenciar } = useAuth();
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroPerfil, setFiltroPerfil] = useState('');
  const [modal, setModal] = useState(false);
  const [editando, setEditando] = useState<Jogador | null>(null);
  const [form, setForm] = useState(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  function carregar() {
    Promise.all([fetchJogadores(), fetchCategorias()])
      .then(([j, c]) => { setJogadores(j); setCategorias(c); })
      .catch(console.error).finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  function abrirNovo() { setEditando(null); setForm(FORM_VAZIO); setErro(''); setModal(true); }
  function abrirEditar(j: Jogador) {
    setEditando(j);
    setForm({ nome: j.nome, cpf: j.cpf, dtNasc: j.dtNasc.slice(0, 10), posicao: j.posicao, numCamisa: j.numCamisa?.toString() || '', categoria_id: j.categoria_id.toString() });
    setErro(''); setModal(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault(); setErro(''); setSalvando(true);
    try {
      const dados = { ...form, numCamisa: form.numCamisa ? Number(form.numCamisa) : undefined, categoria_id: Number(form.categoria_id) };
      if (editando) await atualizarJogador(editando.id, dados);
      else await criarJogador(dados as any);
      setModal(false); carregar();
    } catch (err: any) { setErro(err.message); }
    finally { setSalvando(false); }
  }

  async function excluir(id: number) {
    if (!confirm('Excluir jogador?')) return;
    try { await deletarJogador(id); carregar(); } catch (err: any) { alert(err.message); }
  }

  const catOpts = categorias.map(c => ({ value: c.id, label: c.nome }));
  const perfis = ['Ofensivo', 'Defensivo', 'Equilibrado'];

  const filtrados = jogadores.filter(j => {
    const ok1 = !busca || j.nome.toLowerCase().includes(busca.toLowerCase());
    const ok2 = !filtroCategoria || j.categoria_id === Number(filtroCategoria);
    const ok3 = !filtroPerfil || j.perfil_ml === filtroPerfil;
    return ok1 && ok2 && ok3;
  });

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Jogadores</h1><p className="page-sub">{jogadores.length} cadastrados</p></div>
        {podeGerenciar && <Btn onClick={abrirNovo}>+ Novo jogador</Btn>}
      </div>

      <div className="filter-bar">
        <div className="field"><label className="field-label">Buscar</label><input className="field-input" placeholder="Nome..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <Select label="Categoria" options={catOpts} value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} />
        <Select label="Perfil" options={perfis.map(p => ({ value: p, label: p }))} value={filtroPerfil} onChange={e => setFiltroPerfil(e.target.value)} />
        {(busca || filtroCategoria || filtroPerfil) && <Btn variant="ghost" size="sm" onClick={() => { setBusca(''); setFiltroCategoria(''); setFiltroPerfil(''); }}>Limpar</Btn>}
      </div>

      {loading ? <Spinner /> : filtrados.length === 0 ? <Empty icon="🏃" message="O clube ainda não publicou jogadores nesta categoria" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nome</th><th>Posição</th><th>Camisa</th><th>Categoria</th><th>Perfil IA</th><th>Nota</th>{podeGerenciar && <th>Ações</th>}</tr></thead>
            <tbody>
              {filtrados.map(j => {
                const cat = categorias.find(c => c.id === j.categoria_id);
                return (
                  <tr key={j.id}>
                    <td><strong>{j.nome}</strong></td>
                    <td>{j.posicao}</td>
                    <td>{j.numCamisa ?? '—'}</td>
                    <td>{cat?.nome || '—'}</td>
                    <td><PerfilBadge perfil={j.perfil_ml} /></td>
                    <td>{j.nota_geral != null ? j.nota_geral.toFixed(1) : '—'}</td>
                    {podeGerenciar && <td><div className="actions"><Btn variant="ghost" size="sm" onClick={() => abrirEditar(j)}>Editar</Btn><Btn variant="danger" size="sm" onClick={() => excluir(j.id)}>Excluir</Btn></div></td>}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modal} onClose={() => setModal(false)} title={editando ? 'Editar jogador' : 'Novo jogador'}>
        <form onSubmit={salvar} className="form-grid">
          <Input label="Nome" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required className="full" />
          <Input label="CPF" value={form.cpf} onChange={e => setForm(f => ({ ...f, cpf: e.target.value }))} required placeholder="000.000.000-00" />
          <Input label="Data de nascimento" type="date" value={form.dtNasc} onChange={e => setForm(f => ({ ...f, dtNasc: e.target.value }))} required />
          <Select label="Posição" options={POSICOES} value={form.posicao} onChange={e => setForm(f => ({ ...f, posicao: e.target.value }))} required />
          <Input label="Nº camisa" type="number" value={form.numCamisa} onChange={e => setForm(f => ({ ...f, numCamisa: e.target.value }))} />
          <Select label="Categoria" options={catOpts} value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))} required />
          {erro && <div style={{ gridColumn: '1/-1', color: 'var(--titulo-erro)', fontSize: 13 }}>{erro}</div>}
          <div style={{ gridColumn: '1/-1', display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn variant="ghost" type="button" onClick={() => setModal(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
