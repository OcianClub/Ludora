import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ClubeResumo, PlanoClube, VisaoGlobal } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Btn, Empty, Input, Modal, Select, Spinner } from '@web/components/UI';
import { AdminIcon } from '../components/AdminIcon';
import { criarClube, fetchVisaoGlobal } from '../services/api';

export const PLANOS: { value: PlanoClube; label: string }[] = [
  { value: 'TRIAL', label: 'Teste (TRIAL)' },
  { value: 'PRO', label: 'Pago (PRO)' },
  { value: 'DEMO', label: 'Demonstração (DEMO)' },
  { value: 'FREE', label: 'Gratuito (FREE)' },
];

const VAZIO = { nome: '', cidade: '', estado: '', plano: 'TRIAL', admin_email: '' };

export default function ClubesPage() {
  const navigate = useNavigate();
  const [clubes, setClubes] = useState<ClubeResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [busca, setBusca] = useState('');

  const carregar = useCallback(() => {
    fetchVisaoGlobal().then((v: VisaoGlobal) => setClubes(v.clubes)).catch(e => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErroForm('');
    setSalvando(true);
    try {
      const novo = await criarClube({
        nome: form.nome,
        cidade: form.cidade || undefined,
        estado: form.estado || undefined,
        plano: form.plano as PlanoClube,
        admin_email: form.admin_email || undefined,
      });
      setAberto(false);
      setForm(VAZIO);
      navigate(`/clubes/${novo.id}`);
    } catch (err) {
      setErroForm((err as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  if (erro) return <div className="notice-error" role="alert">{erro}</div>;
  if (!clubes) return <Spinner />;
  const filtrados = clubes.filter(c => c.nome.toLowerCase().includes(busca.trim().toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Clubes</h1><p className="page-sub">{clubes.length} cadastrados · clientes da plataforma</p></div>
        <Btn onClick={() => { setForm(VAZIO); setErroForm(''); setAberto(true); }}><AdminIcon name="plus" size={18} /> Novo clube</Btn>
      </div>

      <div className="filter-bar"><Input label="Buscar" placeholder="Nome do clube..." value={busca} onChange={e => setBusca(e.target.value)} /></div>

      {filtrados.length === 0 ? <Empty icon="🛡" message="Nenhum clube encontrado" /> : (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Clube</th><th>Plano</th><th>Membros</th><th>Jogadores</th><th>Criado em</th><th /></tr></thead>
            <tbody>
              {filtrados.map(c => (
                <tr key={c.id}>
                  <td><Link to={`/clubes/${c.id}`} className="linha-clube"><ClubBadge src={c.escudo} size={32} /><span><strong>{c.nome}</strong><small>{[c.cidade, c.estado].filter(Boolean).join(', ') || '—'}</small></span></Link></td>
                  <td><span className="plano-tag">{c.plano}</span></td>
                  <td>{c.membros}</td><td>{c.jogadores}</td>
                  <td>{new Date(c.criado_em).toLocaleDateString('pt-BR')}</td>
                  <td><Btn size="sm" variant="ghost" onClick={() => navigate(`/clubes/${c.id}`)}>Gerenciar</Btn></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={aberto} onClose={() => setAberto(false)} title="Novo clube">
        <form onSubmit={salvar} className="form-grid">
          <Input className="full" label="Nome do clube" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          <Input label="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
          <Input label="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} placeholder="SP" />
          <Select className="full" label="Plano" emptyLabel="Plano" options={PLANOS} value={form.plano} onChange={e => setForm(f => ({ ...f, plano: e.target.value }))} />
          <Input className="full" label="E-mail do administrador (opcional)" type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="Precisa já ter conta no app" />
          <p className="full dica">Serão criadas as categorias sub-7 a sub-18, como no restante da plataforma.</p>
          {erroForm && <div className="full notice-error" role="alert">{erroForm}</div>}
          <div className="full" style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Btn type="button" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Criando...' : 'Criar clube'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
