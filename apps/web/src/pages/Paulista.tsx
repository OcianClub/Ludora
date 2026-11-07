import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import type { JogoPaulista, PainelPaulista } from '../../../../packages/shared-types/src/paulista';
import { requestJson } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Modal, LoadingSkeleton } from '../components/UI';
import { Icon } from '../components/Icon';
import { ClubBadge } from '../components/Brand';
import { CategoryFilter } from '../components/CategoryFilter';
import { FilterSelect } from '../components/FilterSelect';
import { CollectionSearch, CollectionViewToggle } from '../components/CollectionToolbar';
import { BlockColumns } from '../components/BlockColumns';
import { MatchCard, formatMatchDate } from '../components/MatchCard';
import { MatchListRow } from '../components/MatchListRow';
import { FederationGlobe, OfficialMedal } from '../components/PaulistaIcons';
import { PaulistaStandings } from '../components/PaulistaStandings';
import { PaulistaBracket } from '../components/PaulistaBracket';
import { estadoJogo, nomeOficial, ordemData, partidaOficial, resumoClube, temResultado, situacaoPublicacao, estadoCampanha } from '../utils/paulistaView';
import { intervaloAgenda, type PeriodoAgenda } from '../utils/scheduleFilters';
import './Paulista.css';

type Evento = { id: number; ano: number; categoria: string; divisao: string };
const faixa = (categoria: string) => Number(categoria.match(/\d+/)?.[0]) <= 10 ? 'INICIACAO' : 'BASE';
const hojeSP = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
export default function PaulistaPage() {
  const { clube } = useAuth();
  const [params, setParams] = useSearchParams(), navigate = useNavigate(), location = useLocation();
  const [ready, setReady] = useState<boolean | null>(null), [eventos, setEventos] = useState<Evento[]>([]);
  const [painel, setPainel] = useState<PainelPaulista | null>(null), [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(''), [refresh, setRefresh] = useState(0), [limite, setLimite] = useState(25);
  const modalPeloClique = useRef(false);
  const evento = params.get('evento') || '';
  const meta = eventos.find(e => String(e.id) === evento);
  const ano = Number(params.get('ano') || meta?.ano || eventos[0]?.ano || new Date().getFullYear());
  const phase = params.get('faixa') || (meta ? faixa(meta.categoria) : 'INICIACAO');
  const tab = params.get('aba') === 'pendencias' ? 'avisos' : params.get('aba') || 'visao';
  function filtros(values: Record<string, string>, replace = false) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) { if (value) next.set(key, value); else next.delete(key); }
    setParams(next, { replace }); setLimite(25);
  }
  useEffect(() => {
    let active = true; setLoading(true); setErro('');
    requestJson<{ ativo: boolean; bancoPronto: boolean }>('/paulista/status').then(async status => {
      if (!active) return;
      const enabled = status.ativo && status.bancoPronto; setReady(enabled);
      if (!enabled) { setLoading(false); return; }
      const list = await requestJson<Evento[]>('/paulista/eventos');
      if (!active) return;
      setEventos(list);
      if (!list.length) { setPainel(null); setLoading(false); return; }
      if (!list.some(e => String(e.id) === evento)) {
        const chosen = list.find(e => e.ano === ano && faixa(e.categoria) === phase) || list[0];
        filtros({ evento: String(chosen.id), ano: String(chosen.ano), faixa: faixa(chosen.categoria) }, true);
      }
    }).catch(e => { if (active) { setErro(e.message); setLoading(false); } });
    return () => { active = false; };
  }, [clube?.id, refresh]);
  useEffect(() => {
    if (!ready || !evento || !eventos.some(e => String(e.id) === evento)) return;
    let active = true; setLoading(true); setErro(''); setPainel(null);
    requestJson<PainelPaulista>(`/paulista/eventos/${evento}`).then(p => { if (active) setPainel(p); })
      .catch(e => { if (active) setErro(e.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ready, evento, eventos, clube?.id]);
  const active = useMemo(() => {
    if (!painel || painel.snapshot.ano !== ano || faixa(painel.snapshot.categoria) !== phase) return null;
    // Identidade do cliente apenas na apresentação. A publicação original fica intacta.
    return { ...painel, snapshot: { ...painel.snapshot, equipes: painel.snapshot.equipes.map(e => {
      const v = painel.vinculos.find(v => v.equipeId === e.id);
      return v ? { ...e, nome: v.nome, escudo: v.escudo || e.escudo } : e;
    }) } };
  }, [painel, ano, phase]);
  const minhas = useMemo(() => new Set(active?.vinculos.filter(v => v.clubeId === clube?.id).map(v => v.equipeId)), [active, clube?.id]);
  const summary = active ? resumoClube(active.snapshot, minhas, hojeSP()) : null;
  const teams = new Map(active?.snapshot.equipes.map(e => [e.id, e]));
  const locais = new Map(active?.jogosLocais.map(j => [j.id, j.partidaId]));
  const situacoes = new Map(active?.jogosLocais.map(j => [j.id, j.status]));
  const meusJogos = new Set(summary?.jogos.map(j => j.id));
  const pendencias = active?.pendencias.filter(p => meusJogos.has(p.jogoId)) || [];
  const etapa = params.get('etapa') || 'todas', search = params.get('busca') || '', status = params.get('situacao') || 'todas';
  const period = params.get('periodo') || 'all', range = intervaloAgenda(['all', 'today', 'week', 'month'].includes(period) ? period as PeriodoAgenda : 'all');
  const jogos = (active?.snapshot.jogos || []).filter(j => {
    const own = minhas.has(j.mandanteId) || minhas.has(j.visitanteId);
    const text = `${teams.get(j.mandanteId)?.nome} ${teams.get(j.visitanteId)?.nome} ${j.local || ''}`.toLocaleLowerCase('pt-BR');
    return own && (etapa === 'todas' || (etapa === 'classificacao' ? /CLASSIFICA/i.test(j.fase) : !/CLASSIFICA/i.test(j.fase)))
      && text.includes(search.toLocaleLowerCase('pt-BR'))
      && (status === 'todas' || !j.ocorrencia && status === situacaoPublicacao(j, situacoes.get(j.id)) || status === 'finalizadas' && temResultado(j) || status === 'adiadas' && j.ocorrencia === 'ADIADA' || status === 'wo' && j.ocorrencia === 'WO' || status === 'pendentes' && !temResultado(j) && !j.ocorrencia)
      && (!range.inicio || !!j.data && j.data >= range.inicio) && (!range.fim || !!j.data && j.data <= range.fim);
  }).sort(ordemData);
  const selecionado = active?.snapshot.jogos.find(j => j.id === params.get('jogo'));
  function abrirJogo(j: JogoPaulista) {
    const localId = locais.get(j.id), own = minhas.has(j.mandanteId) || minhas.has(j.visitanteId);
    if (localId && own) navigate(`/partidas/${localId}?${new URLSearchParams({ retorno: location.pathname + location.search })}`, { state: { fromPaulista: true } });
    else { modalPeloClique.current = true; filtros({ jogo: j.id }); }
  }
  function fecharLeitura() {
    if (modalPeloClique.current) { modalPeloClique.current = false; navigate(-1); }
    else filtros({ jogo: '' }, true);
  }
  function card(j: JogoPaulista, list = false) {
    if (!active) return null;
    const p = partidaOficial(active.snapshot, j, minhas, locais.get(j.id), situacoes.get(j.id));
    return <div className="paulista-fixture" key={j.id}>{list
      ? <MatchListRow partida={p} onOpen={() => abrirJogo(j)}/>
      : <MatchCard partida={p} featured={summary?.proxima?.id === j.id || p.status === 'AO_VIVO'} onOpen={() => abrirJogo(j)}/>}
      {(j.ocorrencia || !temResultado(j)) && <small className="paulista-fixture-state">{estadoJogo(j)}</small>}
    </div>;
  }
  function selecionarFaixa(value: string) {
    const e = eventos.find(e => e.ano === ano && faixa(e.categoria) === value);
    filtros({ faixa: value, ...(e ? { evento: String(e.id) } : {}), tabela: '', grupo: '', chave: '' });
  }
  const chave = summary?.chaves.includes(params.get('chave') as any) ? params.get('chave')! : summary?.chaves[0];
  return <div className="paulista-page">
    <header className="paulista-header"><button type="button" className="paulista-reload" disabled={loading} aria-label="Recarregar dados da tela" data-tooltip="Recarrega o Ludora; a sincronização com a Federação é programada no servidor" onClick={() => setRefresh(v => v + 1)}>{loading ? '…' : '↻'}</button><div><Link className="paulista-back" to="/competicoes"><Icon name="chevronLeft" size={17}/>Voltar</Link><h1 className="page-title">Campeonato Paulista</h1><p className="page-sub">Futsal · {clube?.nome}</p></div>
      {!!eventos.length && <FilterSelect label="Temporada" value={String(ano)} emptyLabel="Selecionar" options={[...new Set(eventos.map(e => e.ano))].map(a => ({ value: a, label: String(a) }))} onChange={v => {
        const e = eventos.find(e => e.ano === Number(v) && faixa(e.categoria) === phase);
        filtros({ ano: v, ...(e ? { evento: String(e.id) } : {}), tabela: '', grupo: '', chave: '' });
      }}/>}</header>
    {erro && <div className="notice-error" role="alert">{erro}<Btn variant="ghost" size="sm" onClick={() => setRefresh(v => v + 1)}>Tentar novamente</Btn></div>}
    {ready === null && loading && <LoadingSkeleton kind="cards"/>}
    {ready === false && !erro && <p className="collection-empty">Os dados do Paulista ainda não estão disponíveis neste ambiente. Suas competições do clube continuam disponíveis.</p>}
    {ready && <>
              <span className="paulista-division" aria-label={active ? `Divisão oficial ${active.snapshot.divisao}` : 'Divisão não confirmada'}>{active?.snapshot.divisao || '—'}</span>
      <div className="paulista-category-band"><CategoryFilter phase={phase} onPhase={selecionarFaixa}
        categories={eventos.filter(e => e.ano === ano).map(e => ({ id: e.id, nome: e.categoria, tipo: faixa(e.categoria) }))}
        selected={active ? { id: active.snapshot.id, nome: active.snapshot.categoria, tipo: phase } : undefined}
        onSelect={nome => { const e = eventos.find(e => e.ano === ano && e.categoria === nome); if (e) filtros({ evento: String(e.id), tabela: '', grupo: '', chave: '' }); }}/>

        {active && <a href={active.snapshot.fonte} target="_blank" rel="noreferrer" className="paulista-source-link" aria-label="Abrir página oficial da Federação Paulista de Futsal em nova aba" data-tooltip="Abrir página oficial da Federação Paulista de Futsal"><FederationGlobe/></a>}
      </div>
      {loading && <LoadingSkeleton kind="cards"/>}
      {!loading && !erro && !active && <section className="paulista-empty"><Icon name="calendar" size={28}/><h2>Nenhuma participação confirmada</h2><p>A participação do clube na {phase === 'BASE' ? 'Base' : 'Iniciação'} em {ano} ainda não está confirmada no Ludora. Consulte outro grupo de categorias ou aguarde a conferência do calendário.</p></section>}
      {active && summary && !loading && <>
        <nav className="paulista-tabs" aria-label="Informações do campeonato">{[['visao', 'Visão geral'], ['jogos', 'Jogos'], ['classificacao', 'Classificação'], ['chaveamento', 'Chaveamento'], ...(pendencias.length ? [['avisos', `Avisos (${pendencias.length})`]] : [])].map(([v, label]) => <button type="button" key={v} aria-current={tab === v ? 'page' : undefined} onClick={() => filtros({ aba: v })}>{label}</button>)}</nav>
        {tab === 'visao' && <>
          <section className="paulista-overview"><div className="paulista-position"><span className="eyebrow">SEU {active.snapshot.categoria.toUpperCase()} · POSIÇÃO OFICIAL</span><strong>{summary.classificacao ? `${summary.classificacao.posicao}º` : '—'}</strong><span>{summary.classificacao ? nomeOficial(summary.classificacao.grupo) : 'Posição oficial ainda não publicada'}</span><Btn size="sm" variant="ghost" onClick={() => filtros({ aba: 'classificacao' })}>Ver classificação<Icon name="chevronRight" size={15}/></Btn></div>
            <div className="paulista-season-facts"><dl><div><dt>Pontos</dt><dd>{summary.classificacao?.pontos ?? '—'}</dd></div><div><dt>Saldo</dt><dd>{summary.classificacao?.saldo ?? '—'}</dd></div><div><dt>Jogos</dt><dd>{summary.classificacao?.jogos ?? '—'}</dd></div></dl>
              {chave ? <><OfficialMedal chave={chave}/><p>{estadoCampanha(active.snapshot, minhas)}</p><Btn size="sm" variant="ghost" onClick={() => filtros({ aba: 'chaveamento' })}>Ver caminho da chave</Btn></> : <p>Fase de classificação · aguardando publicação de chave eliminatória.</p>}
            </div>
          </section>
          <div className="paulista-overview-bottom"><section className="paulista-next"><div className="paulista-section-heading"><div><span className="eyebrow">CALENDÁRIO OFICIAL</span><h2>{summary.proxima ? 'Próxima partida' : summary.ultimo ? 'Último resultado publicado' : 'Aguardando confirmação do calendário'}</h2></div><Btn size="sm" variant="ghost" onClick={() => filtros({ aba: 'jogos' })}>Ver jogos<Icon name="chevronRight" size={15}/></Btn></div>
            {summary.proxima || summary.ultimo ? card((summary.proxima || summary.ultimo)!) : <p className="collection-empty">Não há partida com data e resultado confirmados para mostrar aqui.</p>}
            {!summary.proxima && <p className="page-sub">Nenhuma próxima partida oficial publicada para este SUB.</p>}
            {!!summary.pendentes.length && <p className="paulista-notice">{summary.pendentes.length} {summary.pendentes.length === 1 ? 'jogo aguarda' : 'jogos aguardam'} resultado, data ou revisão de ocorrência. <button onClick={() => filtros({ aba: 'jogos' })}>Consultar calendário</button></p>}
          </section><section className="paulista-preview"><span className="eyebrow">CAMINHO DO CLUBE</span><h2>{chave ? `Chave ${nomeOficial(chave)}` : 'Classificação em andamento'}</h2>{chave && summary.jogos.filter(j => j.fase.includes(chave)).slice(-2).map(j => <div key={j.id}><strong>{nomeOficial(teams.get(j.mandanteId)?.nome || '')} {j.golsMandante ?? '—'} × {j.golsVisitante ?? '—'} {nomeOficial(teams.get(j.visitanteId)?.nome || '')}</strong><small>{nomeOficial(j.fase)} · {estadoJogo(j)}</small></div>)}<p>{chave ? 'Participação publicada. O placar isolado não confirma eliminação ou encerramento da competição.' : 'Aguardando publicação de chave eliminatória.'}</p><button type="button" className="btn btn-ghost" onClick={() => filtros({ aba: 'chaveamento' })}>Ver chaveamento<Icon name="chevronRight" size={16}/></button></section></div>
        </>}
        {tab === 'jogos' && <section aria-label="Jogos oficiais">
          <div className="paulista-game-toolbar"><CollectionSearch label="Buscar adversário ou local" value={search} onChange={v => filtros({ busca: v })} placeholder="Adversário ou local"/>
            <FilterSelect label="Etapa" value={etapa} emptyLabel="Todas" onChange={v => filtros({ etapa: v })} options={[{ value: 'todas', label: 'Todas as etapas' }, { value: 'classificacao', label: 'Classificação' }, { value: 'eliminatorias', label: 'Eliminatórias' }]}/>

            <FilterSelect label="Situação" value={status} emptyLabel="Todas" onChange={v => filtros({ situacao: v })} options={[{ value: 'todas', label: 'Todas' }, { value: 'AO_VIVO', label: 'Ao vivo' }, { value: 'PREPARADA', label: 'Preparadas' }, { value: 'AGENDADA', label: 'Agendadas' }, { value: 'finalizadas', label: 'Finalizadas' }, { value: 'CANCELADA', label: 'Canceladas' }, { value: 'pendentes', label: 'Sem resultado publicado' }, { value: 'adiadas', label: 'Adiadas' }, { value: 'wo', label: 'W.O.' }]}/>
            <FilterSelect label="Período" value={period} emptyLabel="Todo o período" onChange={v => filtros({ periodo: v })} options={[{ value: 'all', label: 'Todo o período' }, { value: 'today', label: 'Hoje' }, { value: 'week', label: 'Esta semana' }, { value: 'month', label: 'Este mês' }]}/>
          </div>
          <div className="paulista-results-toolbar"><p role="status">{jogos.length} jogos encontrados · por data</p><CollectionViewToggle value={params.get('visualizacao') || 'grid'} onChange={v => filtros({ visualizacao: v })} options={[{ value: 'grid', label: 'Cards', icon: 'grid' }, { value: 'list', label: 'Lista', icon: 'list' }]}/></div>
          {[...new Set(jogos.slice(0, limite).map(j => j.data))].map(dia => <section key={dia || 'pendente'} className="paulista-day-group"><h3>{formatMatchDate(dia || '')}</h3><BlockColumns list={params.get('visualizacao') === 'list'}>{jogos.slice(0, limite).filter(j => j.data === dia).map(j => card(j, params.get('visualizacao') === 'list'))}</BlockColumns></section>)}
          {!jogos.length && <p className="collection-empty">Nenhum jogo oficial corresponde aos filtros. Altere a busca, a situação ou o período para consultar outros jogos.</p>}
          {jogos.length > limite && <Btn variant="ghost" onClick={() => setLimite(v => v + 25)}>Mostrar mais jogos</Btn>}
        </section>}
        {tab === 'classificacao' && <PaulistaStandings snapshot={active.snapshot} minhas={minhas} fase={params.get('tabela') || ''} grupo={params.get('grupo') || ''} onFilter={filtros}/>}
        {tab === 'chaveamento' && <section>{chave ? <><div className="paulista-section-heading"><div><span className="eyebrow">CAMINHO OFICIAL DO SEU SUB</span><h2>Chave {nomeOficial(chave)}</h2></div><OfficialMedal chave={chave}/></div>{summary.chaves.length > 1 && <FilterSelect label="Chaves publicadas do clube" value={chave} emptyLabel="Selecionar" onChange={v => filtros({ chave: v })} options={summary.chaves.map(v => ({ value: v, label: nomeOficial(v) }))}/>}<PaulistaBracket snapshot={active.snapshot} chave={chave} minhas={minhas} onOpen={abrirJogo}/></> : <p className="collection-empty">A federação ainda não publicou a chave eliminatória do seu SUB. A posição na tabela não determina uma medalha.</p>}</section>}
        {tab === 'avisos' && <section><h2>Dados em conferência</h2>{pendencias.map(p => <article className="paulista-notice" key={`${p.jogoId}:${p.tipo}`}><strong>{p.tipo === 'PLACAR' ? 'Resultado oficial e anotação do clube' : 'Alteração oficial em revisão'}</strong>{p.tipo === 'PLACAR' && <p>Federação: {p.dados.oficial.join(' × ')} · Clube: {p.dados.local.join(' × ')}</p>}<p>{p.estado === 'EM_REVISAO' ? 'Revisão solicitada ao clube: confira a súmula e os acontecimentos na partida. Os registros dos atletas foram preservados.' : 'Os registros dos atletas foram preservados. A equipe Ludora acompanha a revisão.'}</p>{p.dados.partidaId && <Link to={`/partidas/${p.dados.partidaId}`}>Ver partida</Link>}</article>)}{!pendencias.length && <p>Nenhuma pendência para este clube.</p>}</section>}
      </>}
    </>}
    {selecionado && <Modal open title="Detalhes oficiais da partida" onClose={fecharLeitura}>
      <div className="paulista-reading-score"><strong>{nomeOficial(teams.get(selecionado.mandanteId)?.nome || 'Mandante')}</strong><b>{selecionado.ocorrencia === 'WO' ? 'W.O.' : `${selecionado.golsMandante ?? '—'} × ${selecionado.golsVisitante ?? '—'}`}</b><strong>{nomeOficial(teams.get(selecionado.visitanteId)?.nome || 'Visitante')}</strong></div>
      <dl className="paulista-reading-facts"><div><dt>Etapa</dt><dd>{nomeOficial(selecionado.fase)}</dd></div><div><dt>Data e horário</dt><dd>{formatMatchDate(selecionado.data || '')} · {selecionado.horario || 'A confirmar'}</dd></div><div><dt>Local</dt><dd>{selecionado.local || 'A confirmar'}</dd></div><div><dt>Estado</dt><dd>{estadoJogo(selecionado)}</dd></div></dl><p className="page-sub">Dados publicados pela federação. Escalações e acontecimentos do clube ficam na súmula da partida, quando disponíveis.</p>
    </Modal>}
  </div>;
}
