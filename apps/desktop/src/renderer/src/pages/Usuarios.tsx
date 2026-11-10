import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ClubeResumo, UsuarioGlobal, VisaoGlobal } from '@ludora/shared-types';
import { Btn, DesktopState, Input, LoadingSkeleton, Modal } from '../components/AdminUI';
import { Toast } from '@web/components/Toast';
import { CollectionFilterButton, CollectionFilterDialog, CollectionSearch } from '@web/components/CollectionToolbar';
import { FilterSelect } from '@web/components/FilterSelect';
import { ordenarUsuarios, proximaOrdem, type OrdemUsuario, type ColunaUsuario } from '../../../shared/user-order';
import { Icon } from '@web/components/Icon';
import CadastroPendente from '../components/CadastroPendente';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { removerVinculo, requestJson, revogarSessoes } from '../services/api';
import { OptionTiles } from '../components/OptionTiles';
import { UsuarioClubeEditor } from '../components/UsuarioClubeEditor';
import { CargoClube, PAPEIS_CLUBE } from '../components/CargoClube';
import '@web/components/ThemeToggle.css';

const interno = [
  { value: 'SUPERADMIN', label: 'Administrador Ludora' }, { value: 'SUPORTE', label: 'Suporte' },
  { value: 'DESENVOLVEDOR', label: 'Desenvolvedor' }, { value: 'USUARIO', label: 'Sem acesso interno' },
];
const estados = [{ value: 'ATIVA', label: 'Ativa' }, { value: 'SUSPENSA', label: 'Suspensa' }];
const chaves = ['clube', 'papel', 'interno', 'estado'] as const;
type Filtros = Partial<Record<typeof chaves[number], string>>;
type Confirmacao = {
  conta: UsuarioGlobal;
  alteracao?: { cargo: string; suspenso: boolean; motivo: string };
  desvincular?: UsuarioGlobal['clubes'][number];
};

export default function UsuariosPage() {
  const { usuario } = useAdminAuth();
  const [params, setParams] = useSearchParams();
  const aba = params.get('aba') === 'cadastro' ? 'cadastro' : 'contas';
  const [ordem, setOrdem] = useState<OrdemUsuario>(null);
  const [usuarios, setUsuarios] = useState<UsuarioGlobal[] | null>(null);
  const [clubes, setClubes] = useState<ClubeResumo[]>([]);
  const [erroClubes, setErroClubes] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [filtros, setFiltros] = useState<Filtros | null>(null);
  const [selecionado, setSelecionado] = useState<UsuarioGlobal | null>(null);
  const [confirmacao, setConfirmacao] = useState<Confirmacao | null>(null);
  const [ciente, setCiente] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erroSessao, setErroSessao] = useState('');
  const [cargo, setCargo] = useState('');
  const [estado, setEstado] = useState('');
  const [motivo, setMotivo] = useState('');
  const [editarClube, setEditarClube] = useState<UsuarioGlobal['clubes'][number] | 'novo' | null>(null);
  const [papelAnterior, setPapelAnterior] = useState('SUPORTE');
  const [refresh, setRefresh] = useState(0);
  const query = new URLSearchParams([...params].filter(([key]) => ['busca', ...chaves].includes(key))).toString();
  const ler = (key: string) => params.get(key) || '';
  function alterar(patch: Record<string, string>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    setParams(next, { replace });
  }
  useEffect(() => { void requestJson<Pick<VisaoGlobal, 'clubes'>>('/admin/overview').then(v => setClubes(v.clubes)).catch(e => setErroClubes(e.message)); }, [refresh]);
  useEffect(() => {
    if (aba === 'cadastro') return;
    let atual = true;
    setErro(''); setUsuarios(null);
    const timer = window.setTimeout(async () => {
      try { const dados = await requestJson<UsuarioGlobal[]>(`/admin/usuarios?${query}`); if (atual) setUsuarios(dados); }
      catch (e) { if (atual) setErro((e as Error).message); }
    }, 180);
    return () => { atual = false; clearTimeout(timer); };
  }, [aba, query, refresh]);
  function abrir(u: UsuarioGlobal) {
    setSelecionado(u); setConfirmacao(null); setErroSessao(''); setCargo(u.papel_plataforma); setEstado(u.suspenso ? 'SUSPENSA' : 'ATIVA'); setMotivo('');
    setPapelAnterior(u.papel_plataforma === 'USUARIO' ? '' : u.papel_plataforma);
  }
  function revisar(acao: 'acesso' | 'sessao') {
    if (!selecionado || ocupado) return;
    setErroSessao(''); setCiente(false);
    const suspenso = estado === 'SUSPENSA';
    const motivoPadrao = cargo !== selecionado.papel_plataforma && suspenso !== selecionado.suspenso
      ? 'Papel interno e situação alterados no painel.' : cargo !== selecionado.papel_plataforma
        ? 'Papel interno alterado no painel.' : suspenso ? 'Conta suspensa pelo painel.' : 'Conta reativada pelo painel.';
    setConfirmacao({ conta: selecionado, alteracao: acao === 'acesso' ? { cargo, suspenso, motivo: motivo.trim() || motivoPadrao } : undefined });
  }
  async function operar() {
    if (!confirmacao || !ciente || ocupado) return;
    const { conta, alteracao, desvincular } = confirmacao;
    setOcupado(true); setErroSessao('');
    try {
      if (desvincular) await removerVinculo(desvincular.clube_id, conta.id);
      else if (alteracao) await requestJson(`/admin/usuarios/${conta.id}/controle`, { method: 'PATCH', body: alteracao });
      else await revogarSessoes(conta.id);
      setAviso(desvincular ? 'Vínculo removido.' : alteracao ? 'Acesso atualizado. As sessões anteriores foram encerradas.' : 'Sessões encerradas.');
      setConfirmacao(null);
      setSelecionado(desvincular ? { ...conta, clubes: conta.clubes.filter(c => c.clube_id !== desvincular.clube_id) } : null);
      setRefresh(n => n + 1);
    } catch (e) { setErroSessao((e as Error).message); }
    finally { setOcupado(false); }
  }
  const options = { clube: clubes.map(c => ({ value: c.id, label: c.nome })), papel: [...PAPEIS_CLUBE], interno, estado: estados };
  const labels = { clube: 'Clube', papel: 'Cargo no clube', interno: 'Papel interno', estado: 'Situação da conta' };
  const ativos = chaves.filter(k => ler(k));
  const ordenados = useMemo(() => ordenarUsuarios(usuarios || [], ordem), [usuarios, ordem]);
  const grupos = [
    { titulo: 'Equipe Ludora', contas: ordenados.filter(u => u.papel_plataforma !== 'USUARIO') },
    { titulo: 'Contas de clube', contas: ordenados.filter(u => u.papel_plataforma === 'USUARIO') },
  ];
  const suspender = confirmacao?.alteracao?.suspenso && !confirmacao.conta.suspenso;
  function cabecalho(coluna: ColunaUsuario, texto: string) {
    const direcao = ordem?.coluna === coluna ? ordem.direcao : undefined;
    return <div role="columnheader" aria-sort={direcao === 'asc' ? 'ascending' : direcao === 'desc' ? 'descending' : 'none'}>
      <button type="button" onClick={() => setOrdem(o => proximaOrdem(o, coluna))} aria-label={`Ordenar por ${texto}`} data-direction={direcao}>
        {texto}<span className="desktop-sort-indicator" aria-hidden="true"><i/><i/></span>
      </button>
    </div>;
  }
  return <div className="ticket-page match-schedule desktop-users-page">
    <header className="page-header"><div><span className="ticket-kicker">Pessoas e permissões</span><h1 className="page-title">Usuários</h1><p className="page-sub">Gerencie contas, cargos e tarefas de cadastro.</p></div></header>
    <div className="schedule-status-summary" role="group" aria-label="Área de usuários">
      <button type="button" aria-pressed={aba === 'contas'} onClick={() => { setFiltros(null); alterar({ aba: '', clube: '', busca: '' }); }}>Contas e acessos</button>
      <button type="button" aria-pressed={aba === 'cadastro'} onClick={() => { setFiltros(null); alterar({ aba: 'cadastro', clube: '', busca: '' }); }}>Cadastro dos clubes</button>
    </div>
    {aba === 'cadastro' ? <CadastroPendente/> : <>
      <div className="user-toolbar"><CollectionSearch label="Buscar usuários" placeholder="Nome ou e-mail…" value={ler('busca')} onChange={busca => alterar({ busca: busca.slice(0, 80) }, true)}/>
        <CollectionFilterButton label="Mais filtros" count={ativos.length} onClick={() => setFiltros(filtros ? null : Object.fromEntries(chaves.map(k => [k, ler(k)])))}/></div>
      {filtros && <CollectionFilterDialog open title="Filtrar usuários" onClose={() => setFiltros(null)} onClear={() => setFiltros({})}
        onApply={() => { alterar(Object.fromEntries(chaves.map(k => [k, filtros[k] || '']))); setFiltros(null); }}>
        <FilterSelect label="Clube" value={filtros.clube || ''} emptyLabel="Todos os clubes" options={options.clube} onChange={v => setFiltros({ ...filtros, clube: v })} overlayInDialog/>
        {erroClubes && <p role="alert">Não foi possível consultar os clubes. <Btn variant="ghost" size="sm" onClick={() => setRefresh(n => n + 1)}>Tentar novamente</Btn></p>}
        {chaves.filter(k => k !== 'clube').map(k => <OptionTiles key={k} label={labels[k]} options={[{ value: '', label: 'Todos' }, ...options[k]]} value={filtros[k] || ''} onChange={v => setFiltros({ ...filtros, [k]: v })}/>)}
      </CollectionFilterDialog>}
      {!!ativos.length && <div className="schedule-active-filters" aria-label="Filtros ativos">{ativos.map(k => <button key={k} onClick={() => alterar({ [k]: '' })}>{options[k].find(o => String(o.value) === ler(k))?.label || labels[k]}<Icon name="minus" size={14}/></button>)}<Btn variant="ghost" size="sm" onClick={() => alterar(Object.fromEntries(chaves.map(k => [k, ''])))}>Limpar filtros</Btn></div>}
      {erro ? <DesktopState error title="Falha ao consultar usuários" description={erro} onRetry={() => setRefresh(n => n + 1)}/> : !usuarios ? <LoadingSkeleton kind="rows" label="Carregando usuários"/> : <>
        <div className="user-list-heading"><p className="ticket-count">{usuarios.length === 50 ? '50 contas mais recentes · refine a busca para encontrar outras' : `${usuarios.length} conta(s)`}</p>
          <span className="desktop-sort-description" role="status">{ordem ? `${{ conta: 'Conta', clube: 'Clube', cargo: 'Cargo', situacao: 'Situação' }[ordem.coluna]} · ${ordem.direcao === 'asc' ? 'crescente' : 'decrescente'}` : 'Ordem padrão'}</span></div>
        {!usuarios.length && <DesktopState title="Nenhuma conta encontrada" description="Revise a busca e os filtros." icon="people"/>}
        {grupos.filter(g => g.contas.length).map(g => <section key={g.titulo} className="ticket-day"><h2>{g.titulo}</h2>
          <div className="desktop-users-table" role="table" aria-label={g.titulo} tabIndex={0}>
            <div role="rowgroup"><div className="desktop-users-head" role="row">{cabecalho('conta', 'Conta')}{cabecalho('clube', 'Clube')}{cabecalho('cargo', 'Cargo')}{cabecalho('situacao', 'Situação')}<span role="columnheader" className="sr-only">Acesso</span></div></div>
            <div role="rowgroup">{g.contas.map(u => <div key={u.id} className="desktop-user-line" role="row" onClick={e => { if (!(e.target as HTMLElement).closest('button')) abrir(u); }}>
              <div className="desktop-user-name" role="cell"><span className="user-identity-avatar" aria-hidden="true">{u.nome.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span><span><strong title={u.nome}>{u.nome}</strong><small title={u.email}>{u.email}</small></span></div>
              <div className="desktop-user-clubs" role="cell" title={u.clubes.map(c => c.nome).join(', ')}><span>{u.clubes[0]?.nome || 'Sem clube vinculado'}</span>{u.clubes.length > 1 && <small>+{u.clubes.length - 1} {u.clubes.length === 2 ? 'clube' : 'clubes'}</small>}</div>
              <div className="desktop-user-role" role="cell">{u.papel_plataforma !== 'USUARIO' ? <span className="user-role" data-role={u.papel_plataforma}>{interno.find(o => o.value === u.papel_plataforma)?.label}</span> : u.clubes[0] ? <CargoClube papel={u.clubes[0].papel}/> : <small>Sem cargo</small>}</div>
              <div className="desktop-user-state" role="cell" data-suspended={u.suspenso}><span className="user-active-dot" aria-hidden="true"/>{u.suspenso ? 'Suspensa' : 'Ativa'}</div>
              <div role="cell"><button type="button" className="desktop-icon-action" aria-label={`Gerenciar ${u.nome}`} onClick={() => abrir(u)}><Icon name="chevronRight" size={17}/></button></div>
            </div>)}</div>
          </div></section>)}
      </>}
      <Toast message={aviso} onClose={() => setAviso('')}/>
    </>}
    {selecionado && !confirmacao && !editarClube && <Modal title="Gerenciar conta" open onClose={() => { if (!ocupado) setSelecionado(null); }} className="chamado-manual-dialog user-details-dialog"
      footer={selecionado.id !== usuario?.id && !selecionado.cargoLegado ? <div className="schedule-review-actions"><Btn variant="ghost" onClick={() => setSelecionado(null)}>Fechar</Btn><Btn disabled={ocupado || !cargo || (motivo.trim().length > 0 && motivo.trim().length < 10) || cargo === selecionado.papel_plataforma && (estado === 'SUSPENSA') === selecionado.suspenso} onClick={() => revisar('acesso')}>Revisar acesso</Btn></div> : undefined}>
      <div className="schedule-review"><div className="user-identity"><span className="user-identity-avatar" aria-hidden="true">{selecionado.nome.trim().slice(0, 1).toLocaleUpperCase('pt-BR')}</span><div><strong>{selecionado.nome}</strong><p>{selecionado.email}</p></div><button type="button" className="desktop-icon-action" aria-label="Encerrar sessões" data-tooltip="Encerrar sessões em todos os dispositivos" onClick={() => revisar('sessao')}><Icon name="logout" size={20}/></button></div><section className="desktop-form-section"><h3>Cargos por clube</h3>
        {selecionado.clubes.length ? <div><div className="user-membership user-membership-head"><span>Clube</span><span>Cargo</span></div>{selecionado.clubes.map(c => <div className="user-membership" key={c.clube_id}><strong>{c.nome}</strong><CargoClube papel={c.papel}/>
          <Btn type="button" size="sm" variant="ghost" aria-label={`Editar acesso em ${c.nome}`} data-tooltip="Editar acesso no clube" onClick={() => setEditarClube(c)}><Icon name="edit" size={16}/></Btn>
          <Btn type="button" size="sm" variant="ghost" aria-label={`Desvincular de ${c.nome}`} data-tooltip="Remover vínculo com o clube" onClick={() => { setCiente(false); setErroSessao(''); setConfirmacao({ conta: selecionado, desvincular: c }); }}><Icon name="trash" size={16}/></Btn>
        </div>)}</div> : <p>Nenhum vínculo com clube.</p>}
        <Btn type="button" variant="ghost" className="user-add-club" onClick={() => setEditarClube('novo')}><Icon name="plus" size={17}/> Vincular a um clube</Btn></section>
        {selecionado.id === usuario?.id || selecionado.cargoLegado ? <p>Conta protegida. A alteração exige revisão por outro administrador ou pela configuração de acesso legado.</p> : <>
          <section className="desktop-form-section"><div className="paulista-follow"><strong>Acesso à equipe Ludora</strong><button type="button" className="settings-switch" role="switch" aria-label="Papel interno" aria-checked={cargo !== 'USUARIO'} onClick={() => { if (cargo !== 'USUARIO') { setPapelAnterior(cargo); setCargo('USUARIO'); } else setCargo(papelAnterior || 'SUPORTE'); }}><span className="settings-switch-thumb" aria-hidden="true"/></button></div>
          {cargo !== 'USUARIO' && <OptionTiles label="Cargo na Ludora" value={cargo} options={interno.filter(p => p.value !== 'USUARIO')} onChange={setCargo}/>}
          </section><section className="desktop-form-section"><div className="paulista-follow" data-inativa={estado === 'SUSPENSA'}><div><strong>Situação da conta</strong><p>{estado === 'ATIVA' ? 'Ativa' : 'Suspensa'}</p></div>
            <button type="button" className="settings-switch" role="switch" aria-label="Situação da conta" aria-checked={estado === 'ATIVA'} onClick={() => setEstado(estado === 'ATIVA' ? 'SUSPENSA' : 'ATIVA')}><span className="settings-switch-thumb" aria-hidden="true"/></button></div>
          <details><summary>Adicionar motivo (opcional)</summary><Input label="Motivo da alteração" value={motivo} maxLength={300} onChange={e => setMotivo(e.target.value)}/></details>
          <p>Mudar o acesso encerra as sessões. Suspender também bloqueia novas entradas.</p>
          </section>
        </>}
        {erroSessao && <p className="notice-error" role="alert">{erroSessao}</p>}
      </div>
    </Modal>}
    {selecionado && editarClube && <UsuarioClubeEditor conta={selecionado} clubes={clubes} vinculo={editarClube === 'novo' ? null : editarClube} onClose={() => setEditarClube(null)} onSaved={v => {
      setSelecionado({ ...selecionado, clubes: [...selecionado.clubes.filter(c => c.clube_id !== v.clube_id), v] });
      setEditarClube(null); setAviso('Acesso ao clube salvo.'); setRefresh(n => n + 1);
    }}/>}
    {confirmacao && <Modal open title={confirmacao.desvincular ? 'Desvincular do clube' : suspender ? 'Suspender conta' : confirmacao.alteracao ? 'Confirmar mudança de acesso' : 'Encerrar sessões'}
      onClose={() => { if (!ocupado) setConfirmacao(null); }} className="schedule-review-dialog"
      footer={<div className="schedule-review-actions"><Btn variant="ghost" disabled={ocupado} onClick={() => setConfirmacao(null)}>Voltar</Btn>
        <Btn variant="danger" className="btn-danger-solid" disabled={ocupado || !ciente} onClick={() => void operar()}>{ocupado ? 'Registrando…' : 'Confirmar alteração'}</Btn></div>}>
      <div className="schedule-review">
        <div><strong>{confirmacao.conta.nome}</strong><p>{confirmacao.conta.email}</p></div>
        {confirmacao.alteracao && <p>{interno.find(o => o.value === confirmacao.alteracao?.cargo)?.label} · Conta {confirmacao.alteracao.suspenso ? 'suspensa' : 'ativa'}</p>}
        <p>{confirmacao.desvincular ? `Esta conta perderá o acesso de membro em ${confirmacao.desvincular.nome}.` : suspender ? 'A conta será desconectada em todos os dispositivos e novas entradas ficarão bloqueadas até reativação.' : 'A conta será desconectada em todos os dispositivos e precisará entrar novamente.'}</p>
        <label className="check"><input type="checkbox" checked={ciente} onChange={e => setCiente(e.target.checked)}/> Confirmo a ação para esta conta.</label>
        {erroSessao && <p className="notice-error" role="alert">{erroSessao}</p>}
      </div>
    </Modal>}
  </div>;
}
