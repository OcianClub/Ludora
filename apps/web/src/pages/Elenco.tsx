import { useEffect, useState } from 'react';
import { fetchJogadoresPerfis, fetchCategorias, type PerfilJogador, type Categoria } from '../services/api';
import { Btn, Input, Modal, Spinner, PerfilBadge } from '../components/UI';
import { Choice, PositionBadge, POSITIONS, normalizePosition, ViewToggle, type ViewMode } from '../components/CollectionControls';
import { useAuth } from '../contexts/AuthContext';
import { Icon } from '../components/Icon';
import './Elenco.css';
import { BlockColumns } from '../components/BlockColumns';
function hasAssessment(player: PerfilJogador) { return !!player.perfil_ml && !/^sem\b/i.test(player.perfil_ml) && player.nota_geral != null; }
function Metrics({ player, full = false }: { player: PerfilJogador; full?: boolean }) {
  const metrics = [{label:'Partidas',value:player.totalPartidas,type:'games'},{label:'Gols',value:player.totalGols,type:'goals'},{label:'Assistências',value:player.totalAssistencias,type:'assists'},
    ...(full?[{label:'Defesas',value:player.totalDefesas,type:'saves'},{label:'Cartões',value:player.totalCartoes,type:'cards'},{label:'Faltas',value:player.totalFaltas,type:'fouls'}]:[])];
  return <dl className="scout-metrics">{metrics.map(m=><div key={m.type} className={`scout-metric metric-${m.type}`}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}</dl>;
}
export default function ElencoPage() {
  const { clube } = useAuth();
  const [players,setPlayers]=useState<PerfilJogador[]>([]);
  const [categories,setCategories]=useState<Categoria[]>([]);
  const [category,setCategory]=useState('');
  const [position,setPosition]=useState('');
  const [search,setSearch]=useState('');
  const [order,setOrder]=useState('name');
  const [view,setView]=useState<ViewMode>('grid');
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [version,setVersion]=useState(0);
  const [selected,setSelected]=useState<PerfilJogador|null>(null);
  useEffect(()=>{
    let active=true;setLoading(true);setError('');setSelected(null);
    Promise.all([fetchJogadoresPerfis(),fetchCategorias()]).then(([p,c])=>{if(active){const sorted=[...c].sort((a,b)=>a.nome.localeCompare(b.nome,'pt-BR',{numeric:true}));setPlayers(p);setCategories(sorted);setCategory(String(sorted[0]?.id || ''));}})
      .catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[clube?.id,version]);
  const filtered=players.filter(p=>(!category||p.categoria_id===Number(category))&&(!position||normalizePosition(p.posicao)===position)&&p.nome.toLocaleLowerCase().includes(search.toLocaleLowerCase())).sort((a,b)=>{
    if(order==='goals')return b.totalGols-a.totalGols||a.nome.localeCompare(b.nome);
    if(order==='rating')return (hasAssessment(b)?b.nota_geral!:-1)-(hasAssessment(a)?a.nota_geral!:-1)||a.nome.localeCompare(b.nome);
    return a.nome.localeCompare(b.nome,'pt-BR');
  });
  const categoryName=(id:number)=>categories.find(c=>c.id===id)?.nome.toUpperCase()||'Sem categoria';
  return <div className="scout-page">
    <div className="page-header"><div><span className="scout-eyebrow">ANÁLISE DO ELENCO</span><h1 className="page-title">Scout dos jogadores</h1><p className="page-sub">Estatísticas registradas em partidas e avaliação disponível de cada atleta.</p></div></div>
    <div className="category-tabs" role="group" aria-label="Categoria do scout">{categories.map(c=><button key={c.id} aria-pressed={category===String(c.id)} onClick={()=>setCategory(String(c.id))}>{c.nome.toUpperCase()}</button>)}</div>
    <div className="collection-toolbar"><Input label="Buscar jogador" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Nome do atleta..."/>

      <Choice label="Posição" value={position} onChange={setPosition} options={[{value:'',label:'Todas'},...POSITIONS.map(value=>({value,label:value}))]}/>
      <Choice label="Ordenar" value={order} onChange={setOrder} options={[{value:'name',label:'Nome A–Z'},{value:'goals',label:'Mais gols'},{value:'rating',label:'Maior nota de IA'}]}/>
      <ViewToggle value={view} onChange={setView}/>
    </div>
    <div className="collection-heading"><div><h2>Atletas · {categoryName(Number(category))}</h2><p>{filtered.length} jogadores · {filtered.filter(p=>p.totalPartidas>0).length} com partidas registradas</p></div><span className="club-label">Estatísticas acumuladas</span></div>
    {loading?<Spinner/>:error?<div role="alert" className="notice-error">{error}<Btn onClick={()=>setVersion(v=>v+1)}>Tentar novamente</Btn></div>:
      <BlockColumns list={view === 'list'}>{filtered.map(player=><article key={player.id} className={`scout-player scout-card-${view}`}>
        <header className="scout-player-heading"><span className="scout-shirt">{player.numCamisa??'—'}</span><div><span className="scout-category">{categoryName(player.categoria_id)}</span><h2>{player.nome}</h2><PositionBadge position={player.posicao}/></div></header>
        <div className={`scout-assessment ${hasAssessment(player)?'is-assessed':''}`}><span>Avaliação de IA</span>{hasAssessment(player)?<><strong>{player.nota_geral!.toFixed(1)}</strong><PerfilBadge perfil={player.perfil_ml}/></>:<strong className="scout-pending">Ainda não avaliado</strong>}</div>
        <div className="scout-performance"><h3>EM PARTIDAS</h3><Metrics player={player}/></div>
        <footer><span>{player.totalPartidas?`${player.totalPartidas} partida(s) com registro`:'Sem partidas registradas'}</span><Btn variant="ghost" size="sm" onClick={()=>setSelected(player)}>Ver scout <Icon name="arrow" size={14}/></Btn></footer>
      </article>)}{!filtered.length&&<p className="collection-empty">Nenhum atleta encontrado para esses filtros.</p>}</BlockColumns>}
    <Modal open={selected!==null} onClose={()=>setSelected(null)} title={selected?`Scout · ${selected.nome}`:'Scout'}>{selected&&<>
      <div className="scout-detail-heading"><span className="scout-category">{categoryName(selected.categoria_id)}</span><PositionBadge position={selected.posicao}/></div>
      <h3 className="scout-section-title">Desempenho em partidas</h3><Metrics player={selected} full/>
      <h3 className="scout-section-title">Avaliação de IA</h3>{hasAssessment(selected)?<div className="scout-assessment is-assessed"><strong>{selected.nota_geral!.toFixed(1)}</strong><PerfilBadge perfil={selected.perfil_ml}/></div>:<p className="scout-help">Ainda não há avaliação disponível. Isso não significa nota zero.</p>}
      <p className="scout-help">Estatísticas acumuladas. Não há filtro de temporada aplicado nesta tela.</p>
    </>}</Modal>
  </div>;
}
