import { CollectionSearch } from '@web/components/CollectionToolbar';
import { Icon } from '@web/components/Icon';
import { ClubSubChoices, ClubeResumoCadastro, EnderecoFields, enderecoCompleto, EscudoField, mascaraCnpj, SUBS } from '../components/ClubeCadastroFields';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ClubeResumo, PlanoClube, VisaoGlobal } from '@ludora/shared-types';
import { Btn, DesktopState, Input, LoadingSkeleton, Modal } from '../components/AdminUI';
import { AdminIcon } from '../components/AdminIcon';
import { criarClube, fetchVisaoGlobal } from '../services/api';
import { CandidatosClube } from '../components/CandidatosClube';
import { ReaproveitarTime, subCasca } from '../components/ReaproveitarTime';
import { ClubSettingsSection } from '@web/components/ClubSettingsSection';
import { PlatformClubCards } from '../components/PlatformClubCollection';
import { DesktopSelect } from '../components/DesktopSelect';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useClubRegistrationDraft } from '../hooks/useClubRegistrationDraft';
import { Toast } from '@web/components/Toast';
import './Clubes.css';

export const PLANOS: { value: PlanoClube; label: string }[] = [
  { value: 'TRIAL', label: 'Teste (TRIAL)' },
  { value: 'PRO', label: 'Pago (PRO)' },
  { value: 'DEMO', label: 'Demonstração (DEMO)' },
  { value: 'FREE', label: 'Gratuito (FREE)' },
];

const ETAPAS = ['Identidade', 'Configuração', 'Revisão'];

export default function ClubesPage() {
  const navigate = useNavigate();
  const [clubes, setClubes] = useState<ClubeResumo[] | null>(null);
  const [erro, setErro] = useState('');
  const [aberto, setAberto] = useState(false);
  const { usuario } = useAdminAuth();
  const { form, setForm, etapa, setEtapa, alcancada, candidato, setCandidato, ready, error: erroRascunho, save: salvarRascunho, reset: limparRascunho, hasDraft } = useClubRegistrationDraft(usuario!.id);
  const [aviso, setAviso] = useState('');
  const [salvando, setSalvando] = useState(false);
  const enviando = useRef(false);
  const vivo = useRef(true);
  useEffect(()=>{vivo.current=true;return()=>{vivo.current=false;};},[]);
  const [erroForm, setErroForm] = useState('');
  const [params, setParams] = useSearchParams();
  const busca = params.get('busca') || '';
  const planoFiltro = params.get('plano') || '';
  function filtrar(campo: string, valor: string) {
    setParams(anterior => { const next = new URLSearchParams(anterior); if (valor) next.set(campo, valor); else next.delete(campo); return next; }, { replace: true });
  }
  const [descartar, setDescartar] = useState(false);
  function fechar() {
    if (salvando) return;
    if (!salvarRascunho()) return;
    setAberto(false);
    if (hasDraft) setAviso('Rascunho salvo neste dispositivo. Retome quando quiser.');
  }
  const [buscandoCasca, setBuscandoCasca] = useState(false);
  const buscaRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(() => {
    setErro('');
    fetchVisaoGlobal().then((v: VisaoGlobal) => {if(vivo.current)setClubes(v.clubes);}).catch(e => {if(vivo.current)setErro(e.message);});
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

  function validarCadastro(destino: number) {
    setErroForm('');
    if (form.nome.trim().length < 2 || form.cnpj.replace(/\D/g, '').length !== 14 || !enderecoCompleto(form.endereco)) {
      setErroForm('Informe nome, CNPJ e o endereço completo da sede.');
      setEtapa(0);
      return false;
    }
    if (destino >= 2 && form.admin_email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.admin_email.trim())) { setErroForm('Informe um e-mail válido para o administrador.'); setEtapa(1); return false; }
    return true;
  }
  function irParaEtapa(proxima: number) {
    if (salvando || proxima > alcancada) return;
    if (proxima > etapa && !validarCadastro(proxima)) return;
    setErroForm(''); setEtapa(proxima);
  }
  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando.current || !validarCadastro(etapa + 1)) return;
    if (etapa < 2) {
      setEtapa(etapa + 1);
      return;
    }
    const reaproveitados = form.casca?.times.filter(t=>!form.casca?.agrupada || subCasca(t) === null || form.subs.includes(subCasca(t)!));
    if (form.casca && !reaproveitados?.length) { setErroForm('Mantenha ao menos um SUB do time reaproveitado ou remova o vínculo na etapa Identidade.');return; }
    enviando.current=true;setSalvando(true);
    try {
      const novo = await criarClube({
        nome: form.nome,
        cnpj: form.cnpj,
        endereco: form.endereco,
        plano: form.plano as PlanoClube,
        escudo_arquivo: form.escudo,
        subs: form.subs,
        casca_id: form.casca?.agrupada ? reaproveitados?.[0]?.id : form.casca?.time.id,
        casca_ids: reaproveitados?.map(t => t.id),
        casca_agrupada: form.casca?.agrupada,
        admin_email: form.admin_email || undefined,
      });
      if(!vivo.current)return;
      setAberto(false);
      limparRascunho();
      navigate(candidato ? `/paulista?clube=${novo.id}&evento=${candidato.eventoId}&equipe=${candidato.equipeId}` : `/clubes/${novo.id}`);
    } catch (err) {
      if(vivo.current)setErroForm((err as Error).message);
    } finally {
      enviando.current=false;if(vivo.current)setSalvando(false);
    }
  }

  if (erro) return <DesktopState error title="Não foi possível carregar os clubes" description={erro} onRetry={carregar}/>;
  if (!clubes) return <LoadingSkeleton kind="cards" label="Carregando clubes"/>;
  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const filtrados = clubes.filter(c => (!planoFiltro || c.plano === planoFiltro)
    && normalizar([c.nome, c.cidade, c.estado].filter(Boolean).join(' ')).includes(normalizar(busca)));
  const duplicado = form.nome.trim().length >= 2 && clubes.some(c => normalizar(c.nome) === normalizar(form.nome));

  return (
    <div className="desktop-clubs-page">
      <div className="page-header">
        <div><h1 className="page-title">Clubes</h1><p className="page-sub">{clubes.length} cadastrados · clientes da plataforma</p></div>
        <Btn disabled={!ready} onClick={() => { setErroForm(''); setAviso(''); setAberto(true); }}><AdminIcon name="plus" size={18} /> Novo clube</Btn>
      </div>
      <Toast message={aviso} onClose={()=>setAviso('')}/>
      {erroRascunho && <p className="notice-error" role="alert">{erroRascunho}</p>}
      {ready && hasDraft && !aberto && <div className="club-draft-notice"><Icon name="edit" size={18}/><div><strong>Cadastro em andamento{form.nome.trim() ? ` · ${form.nome.trim()}` : ''}</strong><p>Etapa {etapa + 1} de 3 · Salvo neste dispositivo</p></div><Btn size="sm" variant="ghost" onClick={()=>setDescartar(true)}>Descartar rascunho</Btn><Btn size="sm" onClick={()=>{setErroForm('');setAberto(true);}}>Retomar cadastro</Btn></div>}

      <div className="schedule-filter-primary ticket-toolbar club-toolbar">
        <div ref={buscaRef}><CollectionSearch label="Buscar clube" placeholder="Buscar nome, cidade ou UF…" value={busca} onChange={v => filtrar('busca', v)}/></div>
        <DesktopSelect label="Plano" options={[{value:'',label:'Todos os planos'},...PLANOS]} value={planoFiltro} onChange={v => filtrar('plano', v)}/>
      </div>
      {(busca || planoFiltro) && <div className="schedule-active-filters"><button type="button" onClick={() => setParams({}, { replace: true })}>Limpar filtros<Icon name="cancel" size={14}/></button></div>}
      <p className="ticket-count" role="status">{filtrados.length} de {clubes.length} clubes</p>
      {filtrados.length === 0 ? <DesktopState icon="shield" title="Nenhum clube encontrado" description={busca || planoFiltro ? 'Ajuste a busca ou o plano selecionado.' : 'Os clubes cadastrados aparecerão aqui.'}/> : <PlatformClubCards clubes={filtrados} returnTo={`/clubes${params.size ? `?${params}` : ''}`}/>}

      <Modal open={aberto && !buscandoCasca && !descartar} onClose={fechar} title="Novo clube" className="schedule-create-dialog club-create-dialog"
        footer={<div className="schedule-review-actions">
          <Btn type="button" variant="ghost" disabled={salvando} onClick={() => { setErroForm(''); if (etapa) setEtapa(etapa - 1); else fechar(); }}>{etapa ? 'Voltar' : 'Fechar'}</Btn>
          <Btn type="submit" form="novo-clube" disabled={salvando}>{salvando ? 'Criando…' : etapa === 2 ? 'Confirmar e criar' : etapa === 1 ? 'Revisar cadastro' : 'Continuar'}</Btn>
        </div>}>
        <ol className="admin-club-steps" aria-label="Etapas do cadastro">
          {ETAPAS.map((nome, i) => <li key={nome} aria-current={etapa === i ? 'step' : undefined}><button type="button" aria-label={`Etapa ${i + 1}: ${nome}`} disabled={salvando || i > alcancada} onClick={()=>irParaEtapa(i)}><span>{i < etapa ? <Icon name="checkAll" size={14}/> : i + 1}</span>{nome}</button></li>)}
        </ol>
        <p className="club-draft-hint">{erroRascunho || 'Seu progresso é salvo neste dispositivo. Você pode fechar e continuar depois.'}</p>
        <form id="novo-clube" onSubmit={salvar} className="desktop-club-settings" aria-busy={salvando}>
          {etapa === 0 && <>
            <ClubSettingsSection icon="shield" title="Identidade do clube" description="Cadastre a identidade ou reaproveite um adversário já registrado.">
              <div className="form-grid">
                <Input className="full" label="Nome do clube" value={form.nome} maxLength={80} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} required/>
                {duplicado && <p className="full dica" role="status">Já existe um clube com esse nome. Confira se é um cadastro diferente antes de continuar.</p>}
                <div className="full club-shell-choice">
                  <Btn type="button" variant="ghost" onClick={() => setBuscandoCasca(true)}><Icon name="team" size={17}/>{form.casca ? 'Trocar time existente' : 'Reaproveitar time existente'}</Btn>
                  {form.casca && <><span>{form.casca.time.nome} · SUBs selecionados na configuração</span><Btn type="button" size="sm" variant="ghost" onClick={() => setForm(f => ({ ...f, casca: null }))}>Limpar vínculo</Btn></>}
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
                <DesktopSelect label="Plano" showLabel fullWidth expandInDialog options={PLANOS} value={form.plano} onChange={plano => setForm(f => ({ ...f, plano }))}/>
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
              {form.casca && <div className="full"><dt>Time reaproveitado</dt><dd>{form.casca.time.nome} · {form.subs.map(s=>`SUB-${s}`).join(', ') || 'Selecione as categorias'}</dd></div>}
              {candidato && <div className="full"><dt>Histórico oficial a revisar após o cadastro</dt><dd>{candidato.nome} · {candidato.categoria.toUpperCase()} · {candidato.divisao} · {candidato.ano}</dd></div>}
            </>}/>}
          {erroForm && <div className="full notice-error" role="alert">{erroForm}</div>}
        </form>
      </Modal>
      {buscandoCasca && <ReaproveitarTime buscaInicial={form.casca?.time.nome || form.nome} onClose={() => setBuscandoCasca(false)}
        onConfirm={casca => { setForm(f => ({ ...f, nome: f.nome.trim() ? f.nome : casca.time.nome, subs: casca.subsSelecionados || f.subs, casca })); setBuscandoCasca(false); }}/>}
      <Modal open={descartar} title="Descartar rascunho?" onClose={() => setDescartar(false)}>
        <p>Os dados deste cadastro ainda não foram enviados. Descartá-los remove apenas o rascunho deste dispositivo.</p><div className="schedule-review-actions">
          <Btn variant="ghost" onClick={() => setDescartar(false)}>Manter rascunho</Btn>
          <Btn variant="danger" onClick={() => { limparRascunho(); setDescartar(false); setAberto(false); }}>Descartar rascunho</Btn>
        </div>
      </Modal>
    </div>
  );
}
