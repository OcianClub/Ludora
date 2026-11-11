import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { JogoPaulista, PainelPaulista } from '../../../../packages/shared-types/src/paulista';
import { invalidateApiReads, requestJson } from '../services/api';
import { consultarPaulistaPublico, listarPaulistaPublico } from '../services/paulistaPublico';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Modal } from '../components/UI';
import { PaulistaSkeleton } from '../components/PaulistaSkeleton';
import { Icon } from '../components/Icon';
import { CategoryFilter } from '../components/CategoryFilter';
import { FilterSelect } from '../components/FilterSelect';
import { CollectionSearch, CollectionViewToggle, CollectionFilterButton, CollectionFilterDialog } from '../components/CollectionToolbar';
import { MatchCard, formatMatchDate } from '../components/MatchCard';
import { MatchListRow } from '../components/MatchListRow';
import { PaulistaHeader } from '../components/PaulistaHeader';
import { PaulistaStandings } from '../components/PaulistaStandings';
import { PaulistaOverview } from '../components/PaulistaOverview';
import { PaulistaBracket } from '../components/PaulistaBracket';
import { usePaulistaUpdates } from '../hooks/usePaulistaUpdates';
import { chavePublicada, estadoJogo, nomeOficial, ordemData, painelDaSelecao, partidaOficial, resumoClube, temResultado, situacaoPublicacao } from '../utils/paulistaView';
import { intervaloAgenda, type PeriodoAgenda } from '../utils/scheduleFilters';
import './Paulista.css';

type Evento = { id: number; ano: number; categoria: string; divisao: string };
const tituloAviso: Record<string, string> = { PLACAR: 'Placar divergente', ALTERACAO_OFICIAL: 'Mudança de calendário', IDENTIDADE: 'Identidade em conferência', OCORRENCIA_OFICIAL: 'Ocorrência em conferência' };
const mensagemAviso: Record<string, string> = {
  AGUARDANDO_CLUBE: 'A equipe Ludora pediu que o clube confira a súmula e os acontecimentos da partida.',
  EM_REVISAO: 'Encaminhado para análise pela equipe Ludora.',
  CONFERIDA: 'A equipe Ludora registrou a conferência da publicação.',
};
const faixa = (categoria: string) => Number(categoria.match(/\d+/)?.[0]) <= 10 ? 'INICIACAO' : 'BASE';
const dayFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' });
const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
const hojeSP = () => dayFormatter.format(new Date());
const nomeMes = (mes: string) => monthFormatter.format(new Date(`${mes}-01T12:00:00`));
export default function PaulistaPage({ competitionHome = false }: { competitionHome?: boolean }) {
  const { clube, token, modo } = useAuth();
  const publico = modo === 'publico';
  const [params, setParams] = useSearchParams(), navigate = useNavigate(), location = useLocation();
  const [ready, setReady] = useState<boolean | null>(null), [eventos, setEventos] = useState<Evento[]>([]);
  const escopo = `${clube?.id}:${publico ? 'publico' : token}`;
  const [consulta, setConsulta] = useState<{ painel: PainelPaulista; escopo: string } | null>(null);
  const painel = consulta?.escopo === escopo ? consulta.painel : null;
  const setPainel = useCallback((value: PainelPaulista | null) => setConsulta(value ? { painel: value, escopo } : null), [escopo]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(''), [refresh, setRefresh] = useState(0), [limite, setLimite] = useState(25);
  const modalPeloClique = useRef(false);
  const navegacaoAbas = useRef<HTMLElement>(null);
  const [standingsFiltersTarget, setStandingsFiltersTarget] = useState<HTMLDivElement | null>(null);
  const page = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(() => window.innerWidth <= 760);
  useEffect(() => {
    if (!page.current) return;
    // Use available content width so an expanded sidebar cannot squeeze desktop cards.
    const observer = new ResizeObserver(([entry]) => setCompact(entry.contentRect.width <= 760));
    observer.observe(page.current);
    return () => observer.disconnect();
  }, []);
  const [filtroAberto, setFiltroAberto] = useState(false);
  const [rascunho, setRascunho] = useState({ etapa: 'todas', situacao: 'todas', periodo: 'all', ordem: 'asc' });
  const evento = params.get('evento') || '';
  const meta = eventos.find(e => String(e.id) === evento);
  const updates = usePaulistaUpdates(evento, clube?.id, token, !loading && !!painel && String(painel.snapshot.id) === evento, setPainel, meta, publico ? clube || undefined : undefined);
  const ano = Number(params.get('ano') || meta?.ano || eventos[0]?.ano || new Date().getFullYear());
  const phase = params.get('faixa') || (meta ? faixa(meta.categoria) : 'INICIACAO');
  const requestedTab = params.get('aba') === 'pendencias' ? 'avisos' : params.get('aba');
  const tab = requestedTab && ['visao', 'jogos', 'classificacao', 'chaveamento', 'avisos'].includes(requestedTab) ? requestedTab : 'visao';
  useEffect(() => {
    const nav = navegacaoAbas.current;
    const atual = nav?.querySelector<HTMLButtonElement>('[aria-current="page"]');
    if (!nav || !atual) return;
    const item = atual.getBoundingClientRect(), area = nav.getBoundingClientRect();
    const deslocamento = item.left < area.left ? item.left - area.left : item.right > area.right ? item.right - area.right : 0;
    if (deslocamento) nav.scrollLeft += deslocamento;
  }, [tab, loading, painel]);
  const filtros = useCallback((values: Record<string, string>, replace = false) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    if (next.toString() === params.toString()) return;
    // A detail dialog or view toggle must not collapse rows already loaded.
    if (Object.keys(values).some(key => ['evento', 'ano', 'faixa', 'etapa', 'busca', 'situacao', 'periodo', 'ordem'].includes(key) && next.get(key) !== params.get(key))) setLimite(25);
    setParams(next, { replace });
  }, [params, setParams]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true; setLoading(!(painel && meta && painelDaSelecao(painel, meta, clube?.id))); setErro('');
    const carregar = async () => {
      if (publico) {
        if (!clube) return [];
        if (refresh) invalidateApiReads(`/publico/clubes/${clube.id}/paulista`);
        const list = await listarPaulistaPublico(clube.id, { signal: controller.signal });
        if (active) setReady(true);
        return list;
      }
      const status = await requestJson<{ ativo: boolean; bancoPronto: boolean }>('/paulista/status', { signal: controller.signal });
      if (!active) return [];
      const enabled = status.ativo && status.bancoPronto; setReady(enabled);
      if (!enabled) return [];
      return requestJson<Evento[]>('/paulista/eventos', { signal: controller.signal });
    };
    carregar().then(list => {
      if (!active) return;
      setEventos(list);
      if (!list.length) { setPainel(null); setLoading(false); return; }
      if (!list.some(e => String(e.id) === evento)) {
        const chosen = list.find(e => e.ano === ano && faixa(e.categoria) === phase) || list[0];
        filtros({ evento: String(chosen.id), ano: String(chosen.ano), faixa: faixa(chosen.categoria) }, true);
      }
    }).catch(e => { if (active) { setErro(e.message); setLoading(false); } });
    return () => { active = false; controller.abort(); };
  }, [clube?.id, token, publico, refresh]);
  useEffect(() => {
    if (!ready || !evento || !eventos.some(e => String(e.id) === evento)) return;
    const controller = new AbortController();
    const esperado = eventos.find(e => String(e.id) === evento)!;
    const preserved = !!painel && painelDaSelecao(painel, esperado, clube?.id);
    let active = true; setLoading(!preserved); setErro('');
    if (!preserved) setPainel(null);
    const consulta = publico && clube
      ? consultarPaulistaPublico(evento, clube, { signal: controller.signal })
      : requestJson<PainelPaulista>(`/paulista/eventos/${evento}`, { signal: controller.signal });
    consulta.then(p => {
      if (!active) return;
      if (!painelDaSelecao(p, esperado, clube?.id)) throw new Error('Os dados recebidos não correspondem ao clube, categoria e divisão selecionados. Atualize para tentar novamente.');
      setPainel(p);
    })
      .catch(e => { if (active) setErro(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [ready, evento, eventos, clube?.id, token, publico]);
  const active = useMemo(() => {
    if (!painel || !meta || !painelDaSelecao(painel, meta, clube?.id) || painel.snapshot.ano !== ano || faixa(painel.snapshot.categoria) !== phase) return null;
    // Identidade do cliente apenas na apresentação. A publicação original fica intacta.
    return { ...painel, snapshot: { ...painel.snapshot, equipes: painel.snapshot.equipes.map(e => {
      const v = painel.vinculos.find(v => v.equipeId === e.id);
      return v ? { ...e, nome: v.nome, escudo: v.escudo || e.escudo } : e;
    }) } };
  }, [painel, meta, clube?.id, ano, phase]);
  const minhas = useMemo(() => new Set(active?.vinculos.filter(v => v.clubeId === clube?.id).map(v => v.equipeId)), [active, clube?.id]);
  const hoje = hojeSP();
  const summary = useMemo(() => active ? resumoClube(active.snapshot, minhas, hoje) : null, [active, minhas, hoje]);
  const teams = useMemo(() => new Map(active?.snapshot.equipes.map(e => [e.id, e])), [active]);
  const locais = useMemo(() => new Map(active?.jogosLocais.map(j => [j.id, j.partidaId])), [active]);
  const situacoes = useMemo(() => new Map(active?.jogosLocais.map(j => [j.id, j.status])), [active]);
  const pendencias = useMemo(() => {
    const meusJogos = new Set(summary?.jogos.map(j => j.id));
    return active?.pendencias.filter(p => meusJogos.has(p.jogoId)) || [];
  }, [active, summary]);
  const etapa = params.get('etapa') || 'todas', search = params.get('busca') || '', status = params.get('situacao') || 'todas';
  const period = params.get('periodo') || 'all';
  const range = useMemo(() => intervaloAgenda(['all', 'today', 'week', 'month'].includes(period) ? period as PeriodoAgenda : 'all'), [period, hoje]);
  const ordem = params.get('ordem') === 'desc' ? 'desc' : 'asc';
  const mesesPublicados = useMemo(() => [...new Set(summary?.jogos.map(j => j.data?.slice(0, 7)).filter((m): m is string => !!m && /^\d{4}-\d{2}$/.test(m)))].sort().reverse(), [summary]);
  const jogos = useMemo(() => {
    const busca = search.toLocaleLowerCase('pt-BR');
    return (summary?.jogos || []).filter(j => {
    const own = minhas.has(j.mandanteId) || minhas.has(j.visitanteId);
    const text = `${teams.get(j.mandanteId)?.nome} ${teams.get(j.visitanteId)?.nome} ${j.local || ''}`.toLocaleLowerCase('pt-BR');
    return own && (etapa === 'todas' || (etapa === 'classificacao' ? /CLASSIFICA/i.test(j.fase) : !/CLASSIFICA/i.test(j.fase)))
      && text.includes(busca)
      && (status === 'todas' || !j.ocorrencia && status === situacaoPublicacao(j, situacoes.get(j.id)) || status === 'finalizadas' && temResultado(j) || status === 'adiadas' && j.ocorrencia === 'ADIADA' || status === 'wo' && j.ocorrencia === 'WO' || status === 'pendentes' && !temResultado(j) && !j.ocorrencia)
      && (!range.inicio || !!j.data && j.data >= range.inicio) && (!range.fim || !!j.data && j.data <= range.fim)
      && (!period.startsWith('mes:') || j.data?.startsWith(period.slice(4)));
    }).sort((a, b) => !a.data !== !b.data ? (a.data ? -1 : 1) : ordemData(a, b) * (ordem === 'desc' ? -1 : 1));
  }, [summary, minhas, teams, situacoes, etapa, search, status, range.inicio, range.fim, period, ordem]);
  const selecionado = active?.snapshot.jogos.find(j => j.id === params.get('jogo'));
  const abrirJogo = useCallback((j: JogoPaulista) => {
    const localId = locais.get(j.id), own = minhas.has(j.mandanteId) || minhas.has(j.visitanteId);
    if (localId && own) navigate(`/partidas/${localId}?${new URLSearchParams({ retorno: location.pathname + location.search })}`, { state: { fromPaulista: true } });
    else { modalPeloClique.current = true; filtros({ jogo: j.id }); }
  }, [locais, minhas, navigate, location.pathname, location.search, filtros]);
  function fecharLeitura() {
    if (modalPeloClique.current) { modalPeloClique.current = false; navigate(-1); }
    else filtros({ jogo: '' }, true);
  }
  const card = useCallback((j: JogoPaulista, list = false) => {
    if (!active) return null;
    const p = partidaOficial(active.snapshot, j, minhas, locais.get(j.id), situacoes.get(j.id));
    return <div className="paulista-fixture" key={j.id} data-game-id={j.id}>{list
      ? <MatchListRow partida={p} onOpen={() => abrirJogo(j)}/>
      : <MatchCard partida={p} compact={compact} officialLayout={!compact} featured={summary?.proxima?.id === j.id || p.status === 'AO_VIVO'} onOpen={() => abrirJogo(j)} competitionContext={<>
          {!/CLASSIFICA/i.test(j.fase) && <small title={nomeOficial(j.fase)}>{nomeOficial(j.fase)}</small>}
        </>}/>}
      {(j.ocorrencia || !temResultado(j)) && <small className="paulista-fixture-state">{estadoJogo(j)}</small>}
    </div>;
  }, [active, minhas, locais, situacoes, compact, summary?.proxima?.id, abrirJogo]);
  function selecionarFaixa(value: string) {
    const e = eventos.find(e => e.ano === ano && faixa(e.categoria) === value);
    filtros({ faixa: value, ...(e ? { evento: String(e.id) } : {}), tabela: '', grupo: '', chave: '' });
  }
  const chave = summary?.chaves.includes(params.get('chave') as any) ? params.get('chave')! : summary?.chaves[0];
  const quantidadeFiltros = Number(etapa !== 'todas') + Number(status !== 'todas') + Number(period !== 'all');
  const visualizacao = params.get('visualizacao');
  const listaJogos = useMemo(() => {
    if (tab !== 'jogos') return null;
    const grupos = new Map<string, JogoPaulista[]>();
    for (const jogo of jogos.slice(0, limite)) {
      const mes = jogo.data?.slice(0, 7) || 'sem-data';
      if (!grupos.has(mes)) grupos.set(mes, []);
      grupos.get(mes)!.push(jogo);
    }
    return [...grupos].map(([mes, partidas]) => <section key={mes} className="paulista-day-group"><h3>{mes === 'sem-data' ? 'Data a confirmar' : nomeMes(mes).replace(/^./, letter => letter.toUpperCase())}</h3><div className={`paulista-fixtures-grid${!compact && visualizacao === 'list' ? ' is-list' : ''}`}>{partidas.map(j => card(j, !compact && visualizacao === 'list'))}</div></section>);
  }, [tab, jogos, limite, card, compact, visualizacao]);
  const filtrosAtivos = [
    { key: 'etapa', active: etapa !== 'todas', label: etapa === 'classificacao' ? 'Classificação' : 'Eliminatórias' },
    { key: 'situacao', active: status !== 'todas', label: ({ finalizadas: 'Finalizadas', adiadas: 'Adiadas', wo: 'W.O.', pendentes: 'Sem resultado publicado', AGENDADA: 'Agendadas', PREPARADA: 'Preparadas', AO_VIVO: 'Ao vivo', CANCELADA: 'Canceladas' } as Record<string, string>)[status] || status },
    { key: 'periodo', active: period !== 'all', label: period.startsWith('mes:') && mesesPublicados.includes(period.slice(4)) ? nomeMes(period.slice(4)) : ({ today: 'Hoje', week: 'Esta semana', month: 'Este mês' } as Record<string, string>)[period] || period },
  ].filter(f => f.active);
  return <div ref={page} className="paulista-page" data-competition-home={competitionHome || undefined}>
    {ready && <div className="paulista-category-band"><CategoryFilter phase={phase} onPhase={selecionarFaixa}
        categories={eventos.filter(e => e.ano === ano).map(e => ({ id: e.id, nome: e.categoria, tipo: faixa(e.categoria) }))}
        selected={active ? { id: active.snapshot.id, nome: active.snapshot.categoria, tipo: phase } : undefined}
        onSelect={nome => { const e = eventos.find(e => e.ano === ano && e.categoria === nome); if (e) filtros({ evento: String(e.id), tabela: '', grupo: '', chave: '' }); }}/>

      </div>}
    <PaulistaHeader division={meta?.ano === ano && faixa(meta.categoria) === phase ? meta.divisao : undefined} year={ano} years={[...new Set(eventos.map(e => e.ano))]} source={active?.snapshot.fonte} busy={loading || updates.updating} home={competitionHome} onYear={v => {
        const e = eventos.find(e => e.ano === Number(v) && faixa(e.categoria) === phase);
        filtros({ ano: v, ...(e ? { evento: String(e.id) } : {}), tabela: '', grupo: '', chave: '' });
      }} onRefresh={() => active ? updates.refresh() : setRefresh(v => v + 1)}/>
    {erro && <div className="notice-error" role="alert">{erro}<Btn variant="ghost" size="sm" onClick={() => setRefresh(v => v + 1)}>Tentar novamente</Btn></div>}
    {updates.erro && !erro && <div className="paulista-update-notice" role="status"><Icon name="alert" size={16}/><span>{updates.erro}</span><Btn size="sm" variant="ghost" onClick={updates.refresh}>Tentar atualizar</Btn></div>}
    {ready === null && loading && <PaulistaSkeleton tab={tab}/>}
    {ready === false && !erro && <section className="paulista-empty" role="status"><Icon name="trophy" size={28}/><h2>Campeonato Paulista indisponível</h2><p>Os dados oficiais ainda não estão disponíveis neste ambiente. Tente atualizar a página mais tarde.</p></section>}
    {ready && <>
      {loading && <PaulistaSkeleton tab={tab}/>}
      {!loading && !erro && !active && <section className="paulista-empty"><Icon name="calendar" size={28}/><h2>Nenhuma participação confirmada</h2><p>A participação do clube na {phase === 'BASE' ? 'Base' : 'Iniciação'} em {ano} ainda não está confirmada no Ludora. Consulte outro grupo de categorias ou aguarde a conferência do calendário.</p></section>}
      {active && summary && !loading && <>
        <div className="paulista-tabs-row"><nav ref={navegacaoAbas} className="paulista-tabs" aria-label="Informações do campeonato" onKeyDown={event => {
          if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
          const index = buttons.indexOf(event.target as HTMLButtonElement);
          if (index < 0) return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowLeft' ? buttons.length - 1 : 1)) % buttons.length;
          buttons[next].focus({ preventScroll: true });
          buttons[next].click();
        }}>{[['visao', 'Visão geral'], ['jogos', 'Jogos'], ['classificacao', 'Classificação'], ['chaveamento', 'Chaveamento'], ...(pendencias.length ? [['avisos', `Avisos (${pendencias.length})`]] : [])].map(([v, label]) => <button type="button" key={v} aria-current={tab === v ? 'page' : undefined} onClick={() => filtros({ aba: v })}>{label}</button>)}</nav><div className="paulista-tabs-filters" ref={setStandingsFiltersTarget}/></div>
        {tab === 'visao' && <PaulistaOverview snapshot={active.snapshot} summary={summary} minhas={minhas} clubeNome={clube?.nome} chave={chave} pendentes={summary.pendentes.length} situacoes={situacoes} onTab={aba => filtros({ aba })} onOpen={abrirJogo}/>}
        {tab === 'jogos' && <section aria-label="Jogos oficiais">
          <div className="paulista-game-toolbar"><CollectionSearch label="Buscar adversário ou local" value={search} onChange={v => filtros({ busca: v }, true)} placeholder="Adversário ou local"/>
            <CollectionFilterButton label="Filtrar jogos oficiais" text={compact ? undefined : 'Mais filtros'} count={quantidadeFiltros} onClick={() => { setRascunho({ etapa, situacao: status, periodo: period, ordem }); setFiltroAberto(true); }}/>
            {!compact && <CollectionViewToggle value={params.get('visualizacao') || 'grid'} onChange={v => filtros({ visualizacao: v })} options={[{ value: 'grid', label: 'Cards', icon: 'grid' }, { value: 'list', label: 'Lista', icon: 'list' }]}/>}
          </div>
          <div className="paulista-results-toolbar"><p role="status"><strong>{jogos.length} jogos</strong> do {clube?.nome} no campeonato · {ordem === 'desc' ? 'mais recentes primeiro' : 'por data'}</p>{quantidadeFiltros > 0 && <button type="button" onClick={() => filtros({ etapa: '', situacao: '', periodo: '' })}>Limpar filtros ({quantidadeFiltros})</button>}</div>
          {!!filtrosAtivos.length && <div className="paulista-active-filters" aria-label="Filtros aplicados">{filtrosAtivos.map(f => <button type="button" key={f.key} aria-label={`Remover filtro: ${f.label}`} onClick={() => filtros({ [f.key]: '' })}>{f.label}<Icon name="cancel" size={13}/></button>)}</div>}
          {listaJogos}
          {!jogos.length && <p className="collection-empty">Nenhum jogo oficial corresponde aos filtros. Altere a busca, a situação ou o período para consultar outros jogos.</p>}
          {jogos.length > limite && <Btn variant="ghost" onClick={() => setLimite(v => v + 25)}>Mostrar mais jogos</Btn>}
        </section>}
        {tab === 'classificacao' && <PaulistaStandings snapshot={active.snapshot} minhas={minhas} fase={params.get('tabela') || ''} grupo={params.get('grupo') || ''} onFilter={filtros} filtersTarget={compact ? null : standingsFiltersTarget}/>}
        {tab === 'chaveamento' && <section>{chave ? <>{summary.chaves.length > 1 && <FilterSelect label="Chaves publicadas do clube" value={chave} emptyLabel="Selecionar" onChange={v => filtros({ chave: v })} options={summary.chaves.map(v => ({ value: v, label: nomeOficial(v) }))}/>}<PaulistaBracket key={`${active.snapshot.id}:${chave}`} snapshot={active.snapshot} chave={chave} minhas={minhas} onOpen={abrirJogo}/></> : <p className="collection-empty">A federação ainda não publicou a chave eliminatória do seu SUB. A posição na tabela não determina uma medalha.</p>}</section>}
        {tab === 'avisos' && <section><h2>Dados em conferência</h2>{pendencias.map(p => {
          const jogo = active.snapshot.jogos.find(j => j.id === p.jogoId);
          return <article className="paulista-notice" key={`${p.jogoId}:${p.tipo}`}>
          <strong>{tituloAviso[p.tipo] || 'Alteração oficial em revisão'}</strong>
          {jogo && <p>{nomeOficial(teams.get(jogo.mandanteId)?.nome || 'Mandante')} × {nomeOficial(teams.get(jogo.visitanteId)?.nome || 'Visitante')}</p>}
          {p.tipo === 'PLACAR' && <p>Federação {p.dados.oficial.join(' × ')} · Clube {p.dados.local.join(' × ')}</p>}
          <p>{mensagemAviso[p.estado] || 'A equipe Ludora acompanha a revisão.'} Os registros dos atletas foram preservados.</p>
          {p.dados.partidaId && <Link to={`/partidas/${p.dados.partidaId}`}>Ver partida</Link>}
        </article>; })}{!pendencias.length && <p>Nenhuma pendência para este clube.</p>}</section>}
      </>}
    </>}
    <CollectionFilterDialog open={filtroAberto} title="Filtrar jogos oficiais" onClose={() => setFiltroAberto(false)} onClear={() => setRascunho({ etapa: 'todas', situacao: 'todas', periodo: 'all', ordem: 'asc' })} onApply={() => { filtros(rascunho); setFiltroAberto(false); }}>
      <div className="paulista-filter-fields"><FilterSelect overlayInDialog label="Etapa" value={rascunho.etapa} emptyLabel="Todas" onChange={v => setRascunho(r => ({ ...r, etapa: v }))} options={[{ value: 'todas', label: 'Todas as etapas' }, { value: 'classificacao', label: 'Classificação' }, { value: 'eliminatorias', label: 'Eliminatórias' }]}/>
      <FilterSelect overlayInDialog label="Situação" value={rascunho.situacao} emptyLabel="Todas" onChange={v => setRascunho(r => ({ ...r, situacao: v }))} options={[{ value: 'todas', label: 'Todas' }, { value: 'AO_VIVO', label: 'Ao vivo' }, { value: 'PREPARADA', label: 'Preparadas' }, { value: 'AGENDADA', label: 'Agendadas' }, { value: 'finalizadas', label: 'Finalizadas' }, { value: 'CANCELADA', label: 'Canceladas' }, { value: 'pendentes', label: 'Sem resultado publicado' }, { value: 'adiadas', label: 'Adiadas' }, { value: 'wo', label: 'W.O.' }]}/>
      <FilterSelect overlayInDialog label="Período" value={rascunho.periodo} emptyLabel="Todo o período" onChange={v => setRascunho(r => ({ ...r, periodo: v }))} options={[{ value: 'all', label: 'Todo o período' }, { value: 'today', label: 'Hoje' }, { value: 'week', label: 'Esta semana' }, { value: 'month', label: 'Este mês' }, ...mesesPublicados.map(m => ({ value: `mes:${m}`, label: nomeMes(m) }))]}/>
      <FilterSelect overlayInDialog label="Ordenar por data" value={rascunho.ordem} emptyLabel="Selecionar ordem" onChange={v => setRascunho(r => ({ ...r, ordem: v }))} options={[{ value: 'asc', label: 'Mais antigos primeiro' }, { value: 'desc', label: 'Mais recentes primeiro' }]}/></div>
    </CollectionFilterDialog>
    {selecionado && <Modal open title="Detalhes oficiais da partida" onClose={fecharLeitura}>
      <div className="paulista-reading-score"><strong>{nomeOficial(teams.get(selecionado.mandanteId)?.nome || 'Mandante')}</strong><b>{selecionado.ocorrencia === 'WO' ? 'W.O.' : `${selecionado.golsMandante ?? '—'} × ${selecionado.golsVisitante ?? '—'}`}</b><strong>{nomeOficial(teams.get(selecionado.visitanteId)?.nome || 'Visitante')}</strong></div>
      <dl className="paulista-reading-facts"><div><dt>Etapa</dt><dd>{nomeOficial(selecionado.fase)}</dd></div><div><dt>Data e horário</dt><dd>{formatMatchDate(selecionado.data || '')} · {selecionado.horario || 'A confirmar'}</dd></div><div><dt>Local</dt><dd>{selecionado.local || 'A confirmar'}</dd></div><div><dt>Estado</dt><dd>{estadoJogo(selecionado)}</dd></div></dl><p className="page-sub">Dados publicados pela federação. Escalações e acontecimentos do clube ficam na súmula da partida, quando disponíveis.</p>
    </Modal>}
  </div>;
}
