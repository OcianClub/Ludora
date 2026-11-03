import { useCallback, useEffect, useRef, useState } from 'react';
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

const VAZIO = { nome: '', cidade: '', estado: '', escudo: '', plano: 'TRIAL', admin_email: '', categorias_padrao: true };
const ETAPAS = ['Identidade', 'Configuração', 'Revisão'];

export default function ClubesPage() {
  const navigate = useNavigate();
  const [clubes, setClubes] = useState<ClubeResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const [form, setForm] = useState(VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');
  const [busca, setBusca] = useState('');
  const [planoFiltro, setPlanoFiltro] = useState('');
  const [etapa, setEtapa] = useState(0);
  const buscaRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => {
    setErro('');
    fetchVisaoGlobal().then((v: VisaoGlobal) => setClubes(v.clubes)).catch(e => setErro(e.message));
  }, []);
  useEffect(carregar, [carregar]);
  useEffect(() => {
    function buscar(event: KeyboardEvent) {
      if (aberto || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return;
      event.preventDefault();
      buscaRef.current?.querySelector('input')?.focus();
    }
    window.addEventListener('keydown', buscar);
    return () => window.removeEventListener('keydown', buscar);
  }, [aberto]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (salvando) return;
    setErroForm('');
    if (etapa === 0 && (form.nome.trim().length < 2 || (form.estado && !/^[a-z]{2}$/i.test(form.estado)))) {
      setErroForm('Informe um nome com pelo menos dois caracteres e, se preencher a UF, use duas letras.');
      return;
    }
    if (etapa < 2) {
      setEtapa(etapa + 1);
      return;
    }
    setSalvando(true);
    try {
      const novo = await criarClube({
        nome: form.nome,
        cidade: form.cidade || undefined,
        estado: form.estado || undefined,
        plano: form.plano as PlanoClube,
        escudo: form.escudo.trim() || undefined,
        categorias_padrao: form.categorias_padrao,
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

  if (erro) return <div className="notice-error" role="alert">{erro} <Btn size="sm" variant="ghost" onClick={carregar}>Tentar novamente</Btn></div>;
  if (!clubes) return <Spinner />;
  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const filtrados = clubes.filter(c => (!planoFiltro || c.plano === planoFiltro)
    && normalizar([c.nome, c.cidade, c.estado].filter(Boolean).join(' ')).includes(normalizar(busca)));
  const duplicado = form.nome.trim().length >= 2 && clubes.some(c => normalizar(c.nome) === normalizar(form.nome));

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">Clubes</h1><p className="page-sub">{clubes.length} cadastrados · clientes da plataforma</p></div>
        <Btn onClick={() => { setForm(VAZIO); setEtapa(0); setErroForm(''); setAberto(true); }}><AdminIcon name="plus" size={18} /> Novo clube</Btn>
      </div>

      <div className="admin-club-filters">
        <div ref={buscaRef}><Input label="Buscar clube" placeholder="Nome, cidade ou UF" value={busca} onChange={e => setBusca(e.target.value)} /></div>
        <Select label="Plano" emptyLabel="Todos os planos" options={PLANOS} value={planoFiltro} onChange={e => setPlanoFiltro(e.target.value)} />
      </div>
      <p className="dica" role="status">{filtrados.length} de {clubes.length} clubes</p>

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

      <Modal open={aberto} onClose={() => { if (!salvando) setAberto(false); }} title="Novo clube">
        <ol className="admin-club-steps" aria-label="Etapas do cadastro">
          {ETAPAS.map((nome, i) => <li key={nome} aria-current={etapa === i ? 'step' : undefined}><span>{i + 1}</span>{nome}</li>)}
        </ol>
        <form onSubmit={salvar} className="form-grid" aria-busy={salvando}>
          {etapa === 0 && <>
          <Input className="full" label="Nome do clube" value={form.nome} maxLength={80} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required />
          {duplicado && <p className="full dica" role="status">Já existe um clube com esse nome. Confira se é um cadastro diferente antes de continuar.</p>}
          <Input label="Cidade" value={form.cidade} onChange={e => setForm(f => ({ ...f, cidade: e.target.value }))} />
          <Input label="UF" maxLength={2} value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))} placeholder="SP" />
          <Input className="full" label="Escudo (URL HTTPS, opcional)" type="url" pattern="https://.+" value={form.escudo} onChange={e => setForm(f => ({ ...f, escudo: e.target.value }))} />
          </>}
          {etapa === 1 && <>
            <Select className="full" label="Plano" emptyLabel="Plano" options={PLANOS} required value={form.plano} onChange={e => setForm(f => ({ ...f, plano: e.target.value }))} />
            <label className="full check"><input type="checkbox" checked={form.categorias_padrao} onChange={e => setForm(f => ({ ...f, categorias_padrao: e.target.checked }))} /> Criar as oito categorias padrão</label>
            <Input className="full" label="E-mail do primeiro administrador (opcional)" type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="E-mail de uma conta já cadastrada" />
            <p className="full dica">A conta informada recebe acesso administrativo imediatamente. Você também pode vincular alguém depois.</p>
          </>}
          {etapa === 2 && <div className="full admin-club-review">
            <div className="linha-clube"><ClubBadge src={form.escudo || undefined} size={44} /><strong>{form.nome.trim()}</strong></div>
            <dl>
              <div><dt>Localização</dt><dd>{[form.cidade, form.estado.toUpperCase()].filter(Boolean).join(' · ') || 'Não informada'}</dd></div>
              <div><dt>Plano</dt><dd>{PLANOS.find(p => p.value === form.plano)?.label}</dd></div>
              <div><dt>Categorias</dt><dd>{form.categorias_padrao ? 'SUB-7, 8, 9, 10, 12, 14, 16 e 18' : 'Sem categorias iniciais'}</dd></div>
              <div><dt>Administrador</dt><dd>{form.admin_email.trim() || 'A definir'}</dd></div>
            </dl>
          </div>}
          {erroForm && <div className="full notice-error" role="alert">{erroForm}</div>}
          <div className="full admin-club-actions">
            <Btn type="button" variant="ghost" disabled={salvando} onClick={() => { setErroForm(''); if (etapa) setEtapa(etapa - 1); else setAberto(false); }}>{etapa ? 'Voltar' : 'Cancelar'}</Btn>
            <Btn type="submit" disabled={salvando}>{salvando ? 'Criando…' : etapa === 2 ? 'Confirmar e criar' : etapa === 1 ? 'Revisar cadastro' : 'Continuar'}</Btn>
          </div>
        </form>
      </Modal>
    </div>
  );
}
