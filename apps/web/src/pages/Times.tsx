import { cachedJson, fetchTimes, fetchCategorias, type Time, type Categoria } from '../services/api';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ClubBadge } from '../components/Brand';
import { CollectionSearch, CollectionViewToggle } from '../components/CollectionToolbar';
import { CategoryFilter } from '../components/CategoryFilter';
import { useClubCategory } from '../hooks/useClubCategory';
import { FilterSelect } from '../components/FilterSelect';
import { Icon } from '../components/Icon';
import { TeamInsights } from '../components/TeamInsights';
import { Btn, Modal, LoadingSkeleton } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import { teamKey, teamName } from '../utils/teamIdentity';
import './Times.css';

type TeamGroup = { key: string; name: string; crest?: string; clubId?: number | null; items: Time[] };
type Scope = 'all' | 'linked' | 'external';
const numberOf = (category?: Categoria) => Number(category?.nome.replace(/\D/g, '') || 0);

export default function TimesPage() {
  const { podeGerenciar, clube } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [times, setTimes] = useState<Time[]>(() => cachedJson<Time[]>('/times') || []);
  const [categorias, setCategorias] = useState<Categoria[]>(() => cachedJson<Categoria[]>('/categorias') || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [version, setVersion] = useState(0);
  const [scope, setScope] = useState<Scope>('all');
  const [search, setSearch] = useState('');
  const [order, setOrder] = useState('');
  const [view, setView] = useState('cards');
  const [mobile, setMobile] = useState(() => matchMedia('(max-width: 760px)').matches);
  const [selected, setSelected] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string[]>([]);
  const { phase, selected: category } = useClubCategory(categorias, params.get('categoria_id'), params.get('fase'));

  useEffect(() => {
    const media = matchMedia('(max-width: 760px)');
    const update = () => setMobile(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSelected(null); setExpanded([]);
    Promise.all([fetchTimes(), fetchCategorias()]).then(([rows, cats]) => {
      if (active) {
        setTimes(rows.filter(time => !time.arquivado));
        setCategorias([...cats].sort((a, b) => numberOf(a) - numberOf(b)));
      }
    }).catch(() => { if (active) setError('Não foi possível carregar os times. Confira sua conexão e tente novamente.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [clube?.id, version]);

  const groups = useMemo(() => {
    const map = new Map<string, TeamGroup>();
    for (const time of times) {
      if (time.arquivado) continue;
      const key = time.clube_representado_id ? 'club:' + time.clube_representado_id : teamKey(time.nome);
      const current = map.get(key);
      if (current) current.items.push(time);
      else map.set(key, { key, name: time.clubeRepresentado?.nome || teamName(time.nome),
        crest: time.clubeRepresentado?.escudo || time.escudo, clubId: time.clube_representado_id, items: [time] });
    }
    return [...map.values()];
  }, [times]);
  const inCategory = groups.filter(group => !category || group.items.some(time => time.categoria_id === category.id));
  const counts = { all: inCategory.length, linked: inCategory.filter(group => !!group.clubId).length,
    external: inCategory.filter(group => !group.clubId).length };
  const visible = inCategory.filter(group => (scope === 'all' || (scope === 'linked' ? !!group.clubId : !group.clubId))
    && group.name.toLocaleLowerCase('pt-BR').includes(search.trim().toLocaleLowerCase('pt-BR')))
    .sort((a, b) => (order === 'categories' ? b.items.length - a.items.length : 0)
      || a.name.localeCompare(b.name, 'pt-BR') * (order === 'desc' ? -1 : 1));
  const selectedGroup = groups.find(group => group.key === selected);
  const sections = [
    { title: 'Meu time', key: 'own', items: visible.filter(group => group.clubId === clube?.id) },
    { title: 'Clubes Ludora', key: 'linked', items: visible.filter(group => !!group.clubId && group.clubId !== clube?.id) },
    { title: 'Times fora do Ludora', key: 'external', items: visible.filter(group => !group.clubId) },
  ];

  function selectPhase(value: string) {
    setParams(current => { const next = new URLSearchParams(current); next.set('fase', value); next.delete('categoria_id'); return next; },
      { replace: true, preventScrollReset: true });
  }
  function selectCategory(name: string) {
    const target = categorias.find(item => item.nome === name);
    if (target) setParams(current => { const next = new URLSearchParams(current); next.set('categoria_id', String(target.id)); next.delete('fase'); return next; },
      { replace: true, preventScrollReset: true });
  }
  function newMatchUrl(group: TeamGroup) {
    if (!category) return null;
    const opponent = group.items.find(time => time.categoria_id === category.id);
    const own = times.find(time => time.clube_representado_id === clube?.id && time.categoria_id === category.id && !time.arquivado);
    return own && opponent ? '/partidas?organizar=1&categoria_id=' + category.id
      + (group.clubId === clube?.id ? '' : '&adversario_id=' + opponent.id) : null;
  }
  function renderTeam(group: TeamGroup) {
    const own = group.clubId === clube?.id;
    const cats = [...group.items].sort((a, b) => numberOf(categorias.find(cat => cat.id === a.categoria_id)) - numberOf(categorias.find(cat => cat.id === b.categoria_id)));
    const open = expanded.includes(group.key);
    const match = newMatchUrl(group);
    return <article className={'teams-card' + (own ? ' is-own' : '')} key={group.key} aria-label={group.name}>
      <div className="teams-card-identity">
        <ClubBadge src={group.crest} name={group.name} size={48}/>
        <div className="teams-card-name"><div className="teams-name-line"><h3 data-tooltip={group.name} data-tooltip-overflow>{group.name}</h3>
          {group.clubId && <span className="teams-membership is-club">{own ? 'Seu clube' : 'No Ludora'}</span>}</div>
          <p>{group.items.length} {group.items.length === 1 ? 'categoria' : 'categorias'}</p>
        </div>
      </div>
      <div className="teams-preview" aria-label="Categorias do time">{(open ? cats : cats.slice(0, 3)).map(time =>
        <span key={time.id}>{categorias.find(cat => cat.id === time.categoria_id)?.nome.toUpperCase() || 'Categoria'}</span>)}
        {cats.length > 3 && <button type="button" aria-expanded={open} aria-label={(open ? 'Ocultar categorias de ' : 'Mostrar todas as categorias de ') + group.name}
          onClick={() => setExpanded(current => open ? current.filter(key => key !== group.key) : [...current, group.key])}>{open ? 'Menos' : '+' + (cats.length - 3)}</button>}
      </div>
      <div className="teams-card-actions">
        {podeGerenciar && match && <Link className="btn btn-ghost btn-sm teams-quick-match" to={match}><Icon name="plus" size={15}/>Nova partida</Link>}
        <Btn className="teams-open" variant="ghost" size="sm" onClick={() => setSelected(group.key)}>Ver time<Icon name="chevronRight" size={15}/></Btn>
      </div>
    </article>;
  }

  return <div className="teams-page teams-page--directory">
    <header className="teams-page-header"><div><h1 className="page-title">Times</h1><p className="page-sub">Seu clube e os times que fazem parte dos seus confrontos.</p></div></header>
    <CategoryFilter categories={categorias} phase={phase} selected={category} onPhase={selectPhase} onSelect={selectCategory}/>
    <div className="teams-tabs" role="tablist" aria-label="Origem dos times">
      {([['all', 'Todos'], ['linked', 'No Ludora'], ['external', 'Fora do Ludora']] as const).map(([value, label]) =>
        <button key={value} type="button" role="tab" aria-selected={scope === value} aria-pressed={scope === value} onClick={() => setScope(value)}>{label}<span>{counts[value]}</span></button>)}
    </div>
    <div className="teams-toolbar"><CollectionSearch id="teams-search" label="Buscar time" placeholder="Buscar time pelo nome…" value={search} onChange={setSearch}/>
      <div className="teams-sort"><FilterSelect label="Ordenar times" value={order} onChange={setOrder} emptyLabel="Nome A–Z" compactLabel={order === 'desc' ? 'Z–A' : order === 'categories' ? 'Qtd.' : 'A–Z'} options={[{ value: 'desc', label: 'Nome Z–A' }, { value: 'categories', label: 'Mais categorias' }]}/></div>
    </div>
    <div className="teams-results"><span>{visible.length} {visible.length === 1 ? 'time' : 'times'}</span>
      {!mobile && <CollectionViewToggle value={view} onChange={setView} options={[{ value: 'cards', label: 'Cards', icon: 'grid' }, { value: 'list', label: 'Lista', icon: 'list' }]}/>}
    </div>
    {loading ? <LoadingSkeleton kind="cards"/> : error ? <div role="alert" className="teams-empty"><Icon name="alert" size={28}/><p>{error}</p><Btn variant="ghost" onClick={() => setVersion(v => v + 1)}>Tentar novamente</Btn></div> : <>
      {sections.filter(section => section.items.length).map(section => section.key === 'external' ? <details className="teams-section" key={section.key} aria-labelledby={'teams-' + section.key}>
        <summary><h2 id={'teams-' + section.key}>{section.title}</h2><span>{section.items.length}</span><Icon name="chevronRight" size={17}/></summary>
        <div className={'teams-grid' + (!mobile && view === 'list' ? ' is-list' : '')}>{section.items.map(renderTeam)}</div>
      </details> : <section className="teams-section" key={section.key} aria-labelledby={'teams-' + section.key}>
        <div className="teams-section-heading"><h2 id={'teams-' + section.key}>{section.title}</h2><span>{section.items.length}</span></div>
        <div className={'teams-grid' + (!mobile && view === 'list' ? ' is-list' : '')}>{section.items.map(renderTeam)}</div>
      </section>)}
      {!visible.length && <div className="teams-empty"><Icon name="shield" size={30}/><h2>Nenhum time encontrado</h2><p>Não há times disponíveis para os filtros selecionados.</p>
        {search && <Btn variant="ghost" onClick={() => { setSearch(''); setScope('all'); }}>Limpar busca</Btn>}</div>}
    </>}
    <Modal open={!!selectedGroup} title={selectedGroup?.name || 'Time'} className="teams-drawer" onClose={() => setSelected(null)}
      heading={selectedGroup && <span className="teams-drawer-identity"><ClubBadge src={selectedGroup.crest} name={selectedGroup.name} size={44}/><span><strong>{selectedGroup.name}</strong><small>{selectedGroup.items.length} categorias</small></span></span>}
      headerActions={selectedGroup?.clubId && selectedGroup.clubId !== clube?.id ? <details className="teams-menu teams-header-menu" onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) event.currentTarget.open = false;
      }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); event.currentTarget.open = false; event.currentTarget.querySelector('summary')?.focus(); } }}>
        <summary aria-label={'Opções de ' + selectedGroup.name}>···</summary><div><button className="teams-visit-club" type="button" onClick={() => navigate('/clubes/' + selectedGroup.clubId)}><Icon name="switchClub" size={16}/>Visitar clube</button></div>
      </details> : undefined}>
      {selectedGroup && <>
        {podeGerenciar && newMatchUrl(selectedGroup) && <Link className="btn btn-primary teams-panel-create" to={newMatchUrl(selectedGroup)!}><Icon name="plus" size={17}/>{selectedGroup.clubId === clube?.id ? 'Organizar partida' : 'Nova partida contra ' + selectedGroup.name}</Link>}
        {selectedGroup.clubId !== clube?.id && clube && <TeamInsights key={selectedGroup.key} teamId={selectedGroup.items[0].id} clubeId={clube.id} clubeName={clube.nome} categoria={category} opponentName={selectedGroup.name}/>}
        {selectedGroup.clubId === clube?.id && <p className="teams-notice">Este é o clube que você está acessando. Consulte os resultados e a agenda na Visão geral.</p>}
        <details className="teams-management" open={selectedGroup.clubId === clube?.id}>
          <summary><span><Icon name="team" size={17}/>Categorias <small>{selectedGroup.items.length}</small></span><span>Ver categorias<Icon name="chevronRight" size={15}/></span></summary>
          {(['INICIACAO', 'BASE'] as const).map(kind => {
            const rows = selectedGroup.items.filter(time => categorias.find(cat => cat.id === time.categoria_id)?.tipo === kind)
              .sort((a, b) => numberOf(categorias.find(cat => cat.id === a.categoria_id)) - numberOf(categorias.find(cat => cat.id === b.categoria_id)));
            return rows.length ? <section className="teams-panel-section" key={kind}><h3>{kind === 'BASE' ? 'Base' : 'Iniciação'} <span>· {rows.length}</span></h3>
              {rows.map(time => <div className="teams-category-row" key={time.id}><strong>{categorias.find(cat => cat.id === time.categoria_id)?.nome.toUpperCase()}</strong></div>)}</section> : null;
          })}
        </details>
      </>}
    </Modal>
  </div>;
}
