import { CollectionSearch } from '@web/components/CollectionToolbar';
import { FilterSelect } from '@web/components/FilterSelect';
import { Icon } from '@web/components/Icon';
import { ClubSubChoices, ClubeResumoCadastro, ENDERECO_VAZIO, EnderecoFields, enderecoCompleto, EscudoField, mascaraCnpj, SUBS } from '../components/ClubeCadastroFields';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate } from 'react-router-dom';
import type { ClubeResumo, PlanoClube, VisaoGlobal } from '@ludora/shared-types';
import { ClubBadge } from '@web/components/Brand';
import { Btn, Empty, Input, Modal, Spinner } from '@web/components/UI';
import { AdminIcon } from '../components/AdminIcon';
import { criarClube, fetchVisaoGlobal } from '../services/api';
import { CandidatosClube, type Candidato } from '../components/CandidatosClube';
import { ReaproveitarTime, type CascaPrevia } from '../components/ReaproveitarTime';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';

export const PLANOS: { value: PlanoClube; label: string }[] = [
  { value: 'TRIAL', label: 'Teste (TRIAL)' },
  { value: 'PRO', label: 'Pago (PRO)' },
  { value: 'DEMO', label: 'Demonstração (DEMO)' },
  { value: 'FREE', label: 'Gratuito (FREE)' },
];

const VAZIO = { nome: '', cnpj: '', endereco: ENDERECO_VAZIO, escudo: null as string | null, plano: 'TRIAL', admin_email: '', subs: [...SUBS], casca: null as CascaPrevia | null };
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
  const [descartar, setDescartar] = useState(false);
  const bypass = useRef(false);
  const sujo = aberto && JSON.stringify(form) !== JSON.stringify(VAZIO);
  const bloqueio = useBlocker(() => sujo && !bypass.current);
  function fechar() {
    if (salvando) return;
    if (sujo) setDescartar(true); else setAberto(false);
  }
  const [etapa, setEtapa] = useState(0);
  const [candidato, setCandidato] = useState<Candidato | null>(null);
  const [buscandoCasca, setBuscandoCasca] = useState(false);
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
    if (etapa === 0 && (form.nome.trim().length < 2 || form.cnpj.replace(/\D/g, '').length !== 14 || !enderecoCompleto(form.endereco))) {
      setErroForm('Informe nome, CNPJ e o endereço completo da sede.');
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
        cnpj: form.cnpj,
        endereco: form.endereco,
        plano: form.plano as PlanoClube,
        escudo_arquivo: form.escudo,
        subs: form.subs,
        casca_id: form.casca?.time.id,
        casca_ids: form.casca?.times.map(t => t.id),
        admin_email: form.admin_email || undefined,
      });
      bypass.current = true;
      setAberto(false);
      setForm(VAZIO);
      navigate(candidato ? `/paulista?clube=${novo.id}&evento=${candidato.eventoId}&equipe=${candidato.equipeId}` : `/clubes/${novo.id}`);
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
        <Btn onClick={() => { bypass.current = false; setForm(VAZIO); setCandidato(null); setEtapa(0); setErroForm(''); setAberto(true); }}><AdminIcon name="plus" size={18} /> Novo clube</Btn>
      </div>

      <div className="schedule-filter-primary ticket-toolbar club-toolbar">
        <div ref={buscaRef}><CollectionSearch label="Buscar clube" placeholder="Buscar nome, cidade ou UF…" value={busca} onChange={setBusca}/></div>
        <FilterSelect label="Plano" emptyLabel="Todos os planos" options={PLANOS} value={planoFiltro} onChange={setPlanoFiltro}/>
      </div>
      <p className="ticket-count" role="status">{filtrados.length} de {clubes.length} clubes</p>
      {filtrados.length === 0 ? <Empty icon="🛡" message="Nenhum clube encontrado" /> : <div className="club-directory">
        {filtrados.map(c => <Link key={c.id} to={`/clubes/${c.id}`} className="club-directory-card">
          <ClubBadge src={c.escudo} name={c.nome} size={46}/><span className="ticket-card-copy"><strong>{c.nome}</strong><small>{[c.cidade, c.estado].filter(Boolean).join(', ') || 'Localização pendente'}</small></span>
          <Icon name="chevronRight" size={17}/><span className="club-directory-meta">{c.ativo ? c.plano : 'Indisponível'} · {c.categorias} SUBs · {c.membros} pessoas</span>
        </Link>)}
      </div>}

      <Modal open={aberto} onClose={fechar} title="Novo clube" className="schedule-create-dialog club-create-dialog"
        footer={<div className="schedule-review-actions">
          <Btn type="button" variant="ghost" disabled={salvando} onClick={() => { setErroForm(''); if (etapa) setEtapa(etapa - 1); else fechar(); }}>{etapa ? 'Voltar' : 'Cancelar'}</Btn>
          <Btn type="submit" form="novo-clube" disabled={salvando}>{salvando ? 'Criando…' : etapa === 2 ? 'Confirmar e criar' : etapa === 1 ? 'Revisar cadastro' : 'Continuar'}</Btn>
        </div>}>
        <ol className="admin-club-steps" aria-label="Etapas do cadastro">
          {ETAPAS.map((nome, i) => <li key={nome} aria-current={etapa === i ? 'step' : undefined}><span>{i + 1}</span>{nome}</li>)}
        </ol>
        <form id="novo-clube" onSubmit={salvar} className="desktop-club-settings" aria-busy={salvando}>
          {etapa === 0 && <>
            <ClubSettingsSection icon="shield" title="Identidade do clube" description="Cadastre a identidade ou reaproveite um adversário já registrado.">
              <div className="form-grid">
                <Input className="full" label="Nome do clube" value={form.nome} maxLength={80} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required/>
                {duplicado && <p className="full dica" role="status">Já existe um clube com esse nome. Confira se é um cadastro diferente antes de continuar.</p>}
                <div className="full club-shell-choice">
                  <Btn type="button" variant="ghost" onClick={() => setBuscandoCasca(true)}><Icon name="team" size={17}/>{form.casca ? 'Trocar time existente' : 'Reaproveitar time existente'}</Btn>
                  {form.casca && <><span>{form.casca.time.nome} · {form.casca.times.length} cadastro(s)</span><Btn type="button" size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, casca: null }))}>Limpar vínculo</Btn></>}
                </div>
                <Input className="full" label="CNPJ" inputMode="numeric" maxLength={18} value={form.cnpj} onChange={e => setForm(f => ({ ...f, cnpj: mascaraCnpj(e.target.value) }))}/>
                <EscudoField value={form.escudo} nome={form.nome} onChange={escudo => setForm(f => ({ ...f, escudo }))}/>
              </div>
            </ClubSettingsSection>
            <EnderecoFields value={form.endereco} onChange={endereco => setForm(f => ({ ...f, endereco }))}/>
          </>}
          {etapa === 1 && <>
            <CandidatosClube nome={form.nome} selected={candidato} onSelect={setCandidato} />
            <ClubSettingsSection icon="settings" title="Plano e acesso">
              <div className="form-grid">
                <FilterSelect label="Plano" emptyLabel="A definir" options={PLANOS} value={form.plano} onChange={plano => setForm(f => ({ ...f, plano }))}/>
                <Input className="full" label="E-mail do primeiro administrador (opcional)" type="email" value={form.admin_email} onChange={e => setForm(f => ({ ...f, admin_email: e.target.value }))} placeholder="E-mail de uma conta já cadastrada"/>
              </div>
              <p className="club-settings-hint">Você também pode vincular um administrador depois.</p>
            </ClubSettingsSection>
            <ClubSettingsSection icon="team" title="Categorias do clube">
              <ClubSubChoices options={SUBS.map(id => ({ id, nome: `SUB-${id}`, tipo: id <= 10 ? 'INICIACAO' : 'BASE' }))} selected={form.subs}
                onChange={sub => setForm(f => ({ ...f, subs: f.subs.includes(sub) ? f.subs.filter(n => n !== sub) : [...f.subs, sub] }))}/>
            </ClubSettingsSection>
          </>}
          {etapa === 2 && <ClubeResumoCadastro nome={form.nome.trim()} escudo={form.escudo} cnpj={form.cnpj} endereco={form.endereco}
            plano={PLANOS.find(p => p.value === form.plano)?.label || form.plano} extra={<>
              <div className="full"><dt>Categorias</dt><dd>{SUBS.filter(v => form.subs.includes(v)).map(v => `SUB-${v}`).join(', ') || 'Sem categorias iniciais'}</dd></div>
              <div className="full"><dt>Administrador</dt><dd>{form.admin_email.trim() || 'A definir'}</dd></div>
              {form.casca && <div className="full"><dt>Time reaproveitado</dt><dd>{form.casca.time.nome} · {form.casca.times.length} cadastro(s)</dd></div>}
            </>}/>}
          {erroForm && <div className="full notice-error" role="alert">{erroForm}</div>}
        </form>
      </Modal>
      {buscandoCasca && <ReaproveitarTime buscaInicial={form.casca?.time.nome || form.nome} onClose={() => setBuscandoCasca(false)}
        onConfirm={casca => { setForm(f => ({ ...f, nome: f.nome.trim() ? f.nome : casca.time.nome, casca })); setBuscandoCasca(false); }}/>}
      <Modal open={descartar || bloqueio.state === 'blocked'} title="Descartar alterações?" onClose={() => { setDescartar(false); if (bloqueio.state === 'blocked') bloqueio.reset(); }}>
        <p>O cadastro ainda não foi salvo.</p><div className="schedule-review-actions">
          <Btn variant="ghost" onClick={() => { setDescartar(false); if (bloqueio.state === 'blocked') bloqueio.reset(); }}>Continuar editando</Btn>
          <Btn className="btn-danger-solid" onClick={() => { setDescartar(false); setAberto(false); setForm(VAZIO); setCandidato(null); if (bloqueio.state === 'blocked') bloqueio.proceed(); }}>Descartar e sair</Btn>
        </div>
      </Modal>
    </div>
  );
}
