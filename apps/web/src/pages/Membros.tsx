import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchCategorias, requestJson, type Categoria } from '../services/api';
import { Btn, Modal, Spinner } from '../components/UI';
import { Choice } from '../components/CollectionControls';
import { CollectionSearch, CollectionFilterButton, CollectionFilterDialog } from '../components/CollectionToolbar';
import { Icon, type IconName } from '../components/Icon';
import { InviteComposer } from '../components/InviteComposer';
import './Membros.css';

type Member = { id: number; papel: string; acesso_todas_categorias: boolean; usuario: { id: number; nome: string }; categorias: { categoria_id: number }[] };
type Invite = { id: string; email: string; papel: string; acesso_todas_categorias: boolean; situacao: string; expira_em: string; categorias: { id: number; nome: string }[] };
type InviteResult = { convite: { email: string; expira_em: string }; email_enviado: boolean; aviso?: string; codigo?: string };
type SortKey = 'nome' | 'cargo' | 'acesso' | 'email' | 'situacao' | 'validade';
type SortOrder = { key: SortKey; direction: 'asc' | 'desc' } | null;
type Tab = 'equipe' | 'visitantes' | 'convites';
const roles = [
  { value: 'ADMIN', label: 'Administrador', description: 'Gerencia o clube, todas as categorias, pessoas e acessos.' },
  { value: 'TECNICO', label: 'Técnico', description: 'Gerencia jogadores e partidas nas categorias atribuídas. Não gerencia pessoas e acessos.' },
  { value: 'MESARIO', label: 'Mesário', description: 'Pode trabalhar com partidas e registros nas categorias atribuídas. Não gerencia pessoas e acessos.' },
  { value: 'OLHEIRO', label: 'Olheiro', description: 'Consulta o conteúdo público do clube. Relatórios privados e permissões personalizadas ainda não estão disponíveis.' },
  { value: 'TORCEDOR', label: 'Visitante', description: 'Consulta o conteúdo público do clube, sem permissão de gestão.' },
];
const roleName = (role: string) => roles.find(item => item.value === role)?.label || role;
const scopedRole = (role: string) => role === 'TECNICO' || role === 'MESARIO';
const inviteStatus: Record<string, string> = { PENDENTE: 'Pendente', ACEITO: 'Aceito', REVOGADO: 'Cancelado', EXPIRADO: 'Expirado' };

export default function MembrosPage() {
  const { clube, usuario } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [categories, setCategories] = useState<Categoria[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [tab, setTab] = useState<Tab>('equipe');
  const [sort, setSort] = useState<SortOrder>(null);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [draftFilters, setDraftFilters] = useState({ role: '', category: '', status: '' });
  const [selected, setSelected] = useState<Member | null>(null);
  const [role, setRole] = useState('TECNICO');
  const [all, setAll] = useState(false);
  const [ids, setIds] = useState<number[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [permissionsOpen, setPermissionsOpen] = useState(false);
  const [revoke, setRevoke] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);
  const [inviteVersion, setInviteVersion] = useState(0);

  useEffect(() => {
    let active = true;
    setSelected(null); setInviteOpen(false); setRevoke(null); setFiltersOpen(false);
    setError(''); setNotice(''); setLoading(true);
    if (clube?.meuPapel !== 'ADMIN') { setLoading(false); return; }
    Promise.all([requestJson<Member[]>('/membros'), fetchCategorias()])
      .then(([people, cats]) => { if (active) { setMembers(people); setCategories(cats); } })
      .catch(() => { if (active) setError('Não foi possível carregar as pessoas. Verifique sua conexão e tente novamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clube?.id, clube?.meuPapel, version]);

  useEffect(() => {
    if (clube?.meuPapel !== 'ADMIN') return;
    let active = true;
    setInviteLoading(true); setInviteError(''); setInvites([]);
    requestJson<{ convites: Invite[] }>('/convites?limite=100')
      .then(data => { if (active) setInvites(data.convites); })
      .catch(() => { if (active) setInviteError('Não foi possível carregar os convites. Tente novamente.'); })
      .finally(() => { if (active) setInviteLoading(false); });
    return () => { active = false; };
  }, [clube?.id, clube?.meuPapel, inviteVersion]);

  const sortedCategories = useMemo(() => [...categories].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true })), [categories]);
  const team = members.filter(member => member.papel !== 'TORCEDOR');
  const visitors = members.filter(member => member.papel === 'TORCEDOR');
  const people = (tab === 'visitantes' ? visitors : team).filter(member => member.usuario.nome.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR'))
    && (!roleFilter || member.papel === roleFilter)
    && (!categoryFilter || member.papel === 'ADMIN' || member.acesso_todas_categorias || member.categorias.some(category => category.categoria_id === Number(categoryFilter))));
  const visibleInvites = invites.filter(invite => (invite.email || 'Código sem e-mail').toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')) && (!statusFilter || invite.situacao === statusFilter));
  const categoryText = (item: { papel: string; acesso_todas_categorias: boolean; categorias: { categoria_id: number }[] }) => item.papel === 'ADMIN' || item.acesso_todas_categorias ? 'Todas as categorias' : scopedRole(item.papel) ? item.categorias.map(c => categories.find(cat => cat.id === c.categoria_id)?.nome.toUpperCase()).filter(Boolean).join(', ') || 'Nenhuma categoria atribuída' : 'Conteúdo público';
  const compare = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' }) * (sort?.direction === 'desc' ? -1 : 1);
  const orderedPeople = [...people].sort((a, b) => {
    const own = Number(b.usuario.id === usuario?.id) - Number(a.usuario.id === usuario?.id);
    if (own || !sort) return own;
    const value = (member: Member) => sort.key === 'cargo' ? roleName(member.papel) : sort.key === 'acesso' ? categoryText(member) : member.usuario.nome;
    return compare(value(a), value(b));
  });
  const orderedInvites = [...visibleInvites].sort((a, b) => {
    if (!sort) return 0;
    const value = (invite: Invite) => sort.key === 'cargo' ? roleName(invite.papel) : sort.key === 'situacao' ? inviteStatus[invite.situacao] || invite.situacao : sort.key === 'validade' ? invite.expira_em : invite.email;
    return compare(value(a), value(b));
  });
  function sortHeader(key: SortKey, label: string) {
    const active = sort?.key === key;
    const next = !active ? 'crescente' : sort.direction === 'asc' ? 'decrescente' : 'padrão';
    return <th scope="col" aria-sort={active ? sort.direction === 'asc' ? 'ascending' : 'descending' : 'none'}><button type="button" onClick={() => setSort(!active ? { key, direction: 'asc' } : sort.direction === 'asc' ? { key, direction: 'desc' } : null)} aria-label={`${label}: ordenar em ordem ${next}`}>{label}<span aria-hidden="true" className={active ? 'is-active' : ''}>{active ? sort.direction === 'asc' ? '↑' : '↓' : '↕'}</span></button></th>;
  }
  function roleBadge(value: string) {
    const icons: Record<string, IconName> = { ADMIN: 'shield', TECNICO: 'table', OLHEIRO: 'eye', MESARIO: 'whistle', TORCEDOR: 'user' };
    return <span className={`members-role role-${value.toLowerCase()}`}><Icon name={icons[value] || 'user'} size={13}/>{roleName(value)}</span>;
  }
  function memberInitials(name: string) {
    return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map(word => Array.from(word)[0]).join('').toLocaleUpperCase('pt-BR');
  }
  function memberAccess(member: Member) {
    if (member.papel === 'ADMIN' || member.acesso_todas_categorias || !scopedRole(member.papel)) return categoryText(member);
    const assigned = sortedCategories.filter(category => member.categorias.some(item => item.categoria_id === category.id));
    if (!assigned.length) return categoryText(member);
    return <div className="members-access-subs" aria-label="Categorias permitidas">{assigned.map(category => <span key={category.id}>{category.nome.toUpperCase()}</span>)}</div>;
  }
  const scopeValid = !scopedRole(role) || all || ids.length > 0;
  const toggleCategory = (id: number) => setIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const scopeFields = scopedRole(role) && <fieldset className="member-scope"><legend>Categorias permitidas</legend><label className="member-all"><input type="checkbox" checked={all} onChange={event => setAll(event.target.checked)} /> Todas as categorias</label>{!all && <div className="member-category-grid">{sortedCategories.map(category => <label key={category.id}><input type="checkbox" checked={ids.includes(category.id)} onChange={() => toggleCategory(category.id)} />{category.nome.toUpperCase()}</label>)}</div>}{!all && !categories.length && <p>Nenhuma categoria disponível.</p>}</fieldset>;
  function openMember(member: Member) { setSelected(member); setRole(member.papel); setAll(member.acesso_todas_categorias); setIds(member.categorias.map(category => category.categoria_id)); setFormError(''); }
  function openInvite() { setInviteOpen(true); }
  async function save() {
    if (!selected || busy) return;
    if (!scopeValid) { setFormError('Selecione ao menos uma categoria ou permita acesso a todas.'); return; }
    setBusy(true); setFormError('');
    try { await requestJson(`/membros/${selected.id}`, { method: 'PATCH', body: JSON.stringify({ papel: role, acesso_todas_categorias: all, categoria_ids: ids }) }); setSelected(null); setNotice('Acesso atualizado com sucesso.'); setVersion(value => value + 1); }
    catch (err) { setFormError(err instanceof Error ? err.message : 'Não foi possível atualizar o acesso.'); }
    finally { setBusy(false); }
  }
  async function changeInvite(invite: Invite, action: 'revogar' | 'reenviar') {
    if (busy) return;
    setBusy(true); setFormError('');
    try {
      const result = await requestJson<InviteResult>(`/convites/${encodeURIComponent(invite.id)}/${action}`, { method: 'POST' });
      setRevoke(null); setNotice(action === 'revogar' ? 'Convite cancelado.' : result.email_enviado ? 'Convite reenviado por e-mail.' : result.aviso || 'Convite atualizado, mas o e-mail não foi enviado.');
      setInviteVersion(value => value + 1);
    } catch (err) { if (action === 'revogar') setFormError(err instanceof Error ? err.message : 'Não foi possível revogar o convite.'); else setNotice(err instanceof Error ? err.message : 'Não foi possível reenviar o convite.'); }
    finally { setBusy(false); }
  }
  if (clube?.meuPapel !== 'ADMIN') return <p className="notice-error">Somente o administrador do clube pode gerenciar pessoas.</p>;
  return <div className="members-page">
    <div className="page-header members-heading"><div><span className="eyebrow">ADMINISTRAÇÃO DO CLUBE</span><h1 className="page-title">Pessoas e acessos</h1><p className="page-sub">Gerencie a equipe e as permissões do {clube.nome}.</p></div><Btn onClick={openInvite}><Icon name="plus" size={17}/> Convidar pessoa</Btn></div>
    <div className="members-tabs" role="group" aria-label="Tipos de pessoas">
      {([{ value: 'equipe', label: 'Equipe', count: team.length }, { value: 'visitantes', label: 'Visitantes', count: visitors.length }, { value: 'convites', label: 'Convites', count: inviteLoading || inviteError ? null : invites.length }] as const).map(item => <button key={item.value} type="button" aria-pressed={tab === item.value} onClick={() => { setTab(item.value); setSearch(''); setRoleFilter(''); setCategoryFilter(''); setStatusFilter(''); setSort(null); }}><span>{item.label}</span>{item.count !== null && <small>{item.count}</small>}</button>)}
      <button type="button" className="members-help" onClick={() => setPermissionsOpen(true)}><Icon name="info" size={17}/> Entenda os cargos</button>
    </div>
    <div className={`members-controls${tab !== 'equipe' ? ' members-controls--simple' : ''}`}><CollectionSearch label={tab === 'convites' ? 'Buscar convite por e-mail' : 'Buscar pessoa'} placeholder={tab === 'convites' ? 'Buscar por e-mail' : 'Buscar pelo nome'} value={search} onChange={setSearch}/>
      {tab !== 'visitantes' && <>
        <div className="members-desktop-filters">
          {tab === 'equipe' ? <><Choice label="Cargo" value={roleFilter} onChange={setRoleFilter} options={[{ value: '', label: 'Todos os cargos' }, ...roles.filter(item => item.value !== 'TORCEDOR')]}/><Choice label="Categoria" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: '', label: 'Todas as categorias' }, ...sortedCategories.map(category => ({ value: String(category.id), label: category.nome.toUpperCase() }))]}/></>
            : <Choice label="Situação" value={statusFilter} onChange={setStatusFilter} options={[{ value: '', label: 'Todas as situações' }, ...Object.entries(inviteStatus).map(([value, label]) => ({ value, label }))]}/>}
        </div>
        <CollectionFilterButton className="members-mobile-filters" label="Mais filtros" count={tab === 'equipe' ? [roleFilter, categoryFilter].filter(Boolean).length : Number(!!statusFilter)} onClick={() => { setDraftFilters({ role: roleFilter, category: categoryFilter, status: statusFilter }); setFiltersOpen(true); }}/>
      </>}

    </div>
    {notice && <p role="status" className="members-notice">{notice}<button type="button" onClick={() => setNotice('')} aria-label="Fechar aviso">×</button></p>}
    {tab === 'convites' ? <section aria-label="Convites enviados">{inviteError ? <div className="members-empty" role="alert"><p>{inviteError}</p><Btn variant="ghost" onClick={() => setInviteVersion(value => value + 1)}>Tentar novamente</Btn></div> : inviteLoading ? <Spinner/> : visibleInvites.length ? <><p className="members-count">{visibleInvites.length} {visibleInvites.length === 1 ? 'convite' : 'convites'} <span>· até 100 mais recentes</span></p><div className="members-table-wrap" role="region" aria-label="Tabela, role horizontalmente para ver todas as colunas" tabIndex={0}><table className="members-table members-invites-table"><thead><tr>{sortHeader('email', 'E-mail')}{sortHeader('cargo', 'Cargo')}{sortHeader('situacao', 'Situação')}{sortHeader('validade', 'Validade')}<th><span className="sr-only">Ações</span></th></tr></thead><tbody>{orderedInvites.map(invite => <tr key={invite.id}><td data-label="E-mail"><strong>{invite.email || 'Código sem e-mail'}</strong></td><td data-label="Cargo">{roleBadge(invite.papel)}</td><td data-label="Situação"><span className={`members-status status-${invite.situacao.toLowerCase()}`}>{inviteStatus[invite.situacao] || invite.situacao}</span></td><td data-label="Validade">{new Date(invite.expira_em).toLocaleDateString('pt-BR')}</td><td className="members-actions">{invite.email && invite.situacao !== 'ACEITO' && <button type="button" disabled={busy} onClick={() => void changeInvite(invite, 'reenviar')}>Reenviar</button>}{invite.situacao === 'PENDENTE' && <button type="button" disabled={busy} onClick={() => { setFormError(''); setRevoke(invite); }}>Cancelar convite</button>}</td></tr>)}</tbody></table></div></> : <div className="members-empty"><Icon name="user" size={26}/><strong>Nenhum convite encontrado</strong><p>{search || statusFilter ? 'Ajuste a busca ou a situação selecionada.' : 'Convide alguém para trabalhar no clube.'}</p>{!search && !statusFilter && <Btn variant="ghost" onClick={openInvite}>Convidar pessoa</Btn>}</div>}</section> : <section aria-label="Pessoas do clube">{error ? <div className="members-empty" role="alert"><p>{error}</p><Btn variant="ghost" onClick={() => setVersion(value => value + 1)}>Tentar novamente</Btn></div> : loading ? <Spinner/> : people.length ? <><p className="members-count">{people.length} {people.length === 1 ? 'pessoa' : 'pessoas'}</p><div className="members-table-wrap" role="region" aria-label="Tabela, role horizontalmente para ver todas as colunas" tabIndex={0}><table className="members-table"><thead><tr>{sortHeader('nome', 'Pessoa')}{sortHeader('cargo', 'Cargo')}{sortHeader('acesso', 'Acesso')}<th><span className="sr-only">Gerenciar</span></th></tr></thead><tbody>{orderedPeople.map(member => <tr key={member.id} className={member.usuario.id === usuario?.id ? 'members-row-self' : undefined}><td data-label="Pessoa"><div className="members-person"><span className="members-initials" aria-hidden="true">{memberInitials(member.usuario.nome)}</span><strong>{member.usuario.nome}{member.usuario.id === usuario?.id && <small>Você</small>}</strong></div></td><td data-label="Cargo">{roleBadge(member.papel)}</td><td data-label="Acesso">{memberAccess(member)}</td><td className="members-actions">{member.usuario.id === usuario?.id ? <span className="members-self-action">Seu acesso</span> : <button type="button" onClick={() => openMember(member)}>Gerenciar <Icon name="chevronRight" size={16}/></button>}</td></tr>)}</tbody></table></div></> : <div className="members-empty"><Icon name="team" size={26}/><strong>Nenhuma pessoa encontrada</strong><p>{search || roleFilter || categoryFilter ? 'Tente outra busca ou ajuste os filtros.' : tab === 'equipe' ? 'As pessoas com acesso de gestão aparecerão aqui.' : 'Quem acompanha o clube aparecerá aqui.'}</p></div>}</section>}
    <CollectionFilterDialog open={filtersOpen} title={tab === 'convites' ? 'Filtrar convites' : 'Filtrar pessoas'} className="members-filter-dialog" onClose={() => setFiltersOpen(false)}
      onClear={() => setDraftFilters({ role: '', category: '', status: '' })}
      onApply={() => { setRoleFilter(draftFilters.role); setCategoryFilter(draftFilters.category); setStatusFilter(draftFilters.status); setFiltersOpen(false); }}>
      {tab === 'equipe' ? <>
        <fieldset className="members-filter-options"><legend>Cargo</legend><div>{[{ value: '', label: 'Todos os cargos' }, ...roles.filter(item => item.value !== 'TORCEDOR')].map(item => <button key={item.value} type="button" aria-pressed={draftFilters.role === item.value} onClick={() => setDraftFilters(current => ({ ...current, role: item.value }))}>{item.label}</button>)}</div></fieldset>
        <fieldset className="members-filter-options"><legend>Categoria</legend><div>{[{ value: '', label: 'Todas as categorias' }, ...sortedCategories.map(category => ({ value: String(category.id), label: category.nome.toUpperCase() }))].map(item => <button key={item.value} type="button" aria-pressed={draftFilters.category === item.value} onClick={() => setDraftFilters(current => ({ ...current, category: item.value }))}>{item.label}</button>)}</div></fieldset>
      </> : <fieldset className="members-filter-options"><legend>Situação</legend><div>{[{ value: '', label: 'Todas as situações' }, ...Object.entries(inviteStatus).map(([value, label]) => ({ value, label }))].map(item => <button key={item.value} type="button" aria-pressed={draftFilters.status === item.value} onClick={() => setDraftFilters(current => ({ ...current, status: item.value }))}>{item.label}</button>)}</div></fieldset>}
    </CollectionFilterDialog>
    <Modal open={permissionsOpen} onClose={() => setPermissionsOpen(false)} title="Cargos e permissões" className="members-modal"><p className="members-modal-intro">Os acessos são definidos para cada clube.</p><div className="members-role-guide">{roles.map(item => <div key={item.value}><strong>{item.label}</strong><p>{item.description}</p></div>)}</div></Modal>
    <Modal open={!!selected} onClose={() => { if (!busy) setSelected(null); }} title={`Acesso de ${selected?.usuario.nome || ''}`} className="members-modal members-access-modal"><p className="members-modal-intro">Defina o cargo e as categorias que esta pessoa pode gerenciar.</p><Choice inlineOptions label="Cargo no clube" value={role} onChange={value => { setRole(value); setIds([]); setAll(false); setFormError(''); }} options={roles}/><p className="members-role-description">{roles.find(item => item.value === role)?.description}</p>{scopeFields}{role === 'ADMIN' && <p className="member-warning"><Icon name="alert" size={18}/> Esse cargo concede acesso à gestão de todas as categorias e pessoas do clube.</p>}{formError && <p role="alert" className="members-form-error">{formError}</p>}<div className="members-modal-actions"><Btn variant="ghost" disabled={busy} onClick={() => setSelected(null)}>Cancelar</Btn><Btn disabled={busy} onClick={() => void save()}>{busy ? 'Salvando…' : 'Salvar acesso'}</Btn></div></Modal>
    <InviteComposer key={clube.id} open={inviteOpen} onClose={() => setInviteOpen(false)} clubName={clube.nome} categories={categories}
      onCreated={() => { setInviteVersion(value => value + 1); setTab('convites'); setSearch(''); setStatusFilter(''); }}
      onViewInvites={() => { setInviteOpen(false); setTab('convites'); setSearch(''); setStatusFilter('PENDENTE'); }} />
    <Modal open={!!revoke} onClose={() => { if (!busy) setRevoke(null); }} title="Cancelar convite?" className="members-modal"><p>O convite para <strong>{revoke?.email || 'quem receber o código'}</strong> deixará de funcionar. Você poderá reenviá-lo depois.</p>{formError && <p role="alert" className="members-form-error">{formError}</p>}<div className="members-modal-actions"><Btn variant="ghost" disabled={busy} onClick={() => setRevoke(null)}>Cancelar</Btn><Btn variant="danger" disabled={busy} onClick={() => revoke && void changeInvite(revoke, 'revogar')}>{busy ? 'Cancelando…' : 'Cancelar convite'}</Btn></div></Modal>
  </div>;
}
