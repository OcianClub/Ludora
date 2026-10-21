import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPartidas, fetchJogadores, fetchTimes, fetchCategorias, fetchEscalacao, type Partida, type Categoria } from '../services/api';
import { Spinner, Btn } from '../components/UI';
import { MatchCard, formatMatchDate } from '../components/MatchCard';
import { Icon } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import { teamName } from '../utils/teamIdentity';
import '../components/BlockColumns.css';
import './Dashboard.css';

export default function DashboardPage() {
  const { clube, podeGerenciar } = useAuth();
  const [matches,setMatches]=useState<Partida[]>([]);
  const [categories,setCategories]=useState<Categoria[]>([]);
  const [phase,setPhase]=useState('INICIACAO');
  const [category,setCategory]=useState('');
  const [totalPlayers,setTotalPlayers]=useState(0);
  const [loading,setLoading]=useState(true),[error,setError]=useState('');
  const [version,setVersion]=useState(0);
  const [starters,setStarters]=useState<number|null>(null);
  const [lineupError,setLineupError]=useState('');
  useEffect(()=>{
    let active=true,pending=false;
    const refresh=async()=>{
      if(pending)return;pending=true;
      try {
        const [p,j,t,c]=await Promise.all([fetchPartidas(),fetchJogadores(),fetchTimes(),fetchCategorias()]);
        if(!active)return;
        setMatches(p.map(m=>({...m,mandante:m.mandante||t.find(x=>x.id===m.mandante_id),visitante:m.visitante||t.find(x=>x.id===m.visitante_id)})));
        setCategories(c.sort((a,b)=>Number(a.nome.replace(/\D/g,''))-Number(b.nome.replace(/\D/g,''))));
        setTotalPlayers(j.filter(p=>p.ativo).length);setError('');
      }catch(e){if(active)setError((e as Error).message);}
      finally{pending=false;if(active)setLoading(false);}
    };
    setLoading(true);setCategory('');void refresh();
    const timer=window.setInterval(()=>{if(!document.hidden)void refresh();},30000);
    return()=>{active=false;window.clearInterval(timer);};
  },[clube?.id,version]);
  const available=categories.filter(c=>c.tipo===phase);
  const current=available.find(c=>c.nome===category)||available[0];
  const selected=matches.filter(m=>m.categoria?.nome.toLowerCase()===current?.nome.toLowerCase()||m.categoria_id===current?.id);
  const today=new Date();
  const date=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const chronological=(a:Partida,b:Partida)=>(a.data.slice(0,10)+(a.horario||'')).localeCompare(b.data.slice(0,10)+(b.horario||''));
  const upcoming=selected.filter(m=>['AGENDADA','PREPARADA'].includes(m.status)&&m.data.slice(0,10)>=date).sort(chronological);
  const live=selected.filter(m=>m.status==='AO_VIVO').sort((a,b)=>Number(!!a.somente_leitura)-Number(!!b.somente_leitura)||chronological(a,b));
  const hero=live[0]||upcoming[0];
  const history=selected.filter(m=>m.status==='FINALIZADA').sort((a,b)=>chronological(b,a)).slice(0,5);
  const result=(m:Partida)=>{const a=m.emCasa?m.gols_mandante:m.gols_visitante,b=m.emCasa?m.gols_visitante:m.gols_mandante;return a>b?'V':a<b?'D':'E';};
  const counts=history.reduce((count,m)=>{count[result(m)]++;return count;},{V:0,E:0,D:0});
  const preparation=podeGerenciar&&hero&&!hero.somente_leitura&&['AGENDADA','PREPARADA'].includes(hero.status);
  useEffect(()=>{
    let active=true;setStarters(null);setLineupError('');
    if(preparation&&hero)fetchEscalacao(hero.id).then(rows=>{if(active)setStarters(rows.filter(r=>r.titular).length);}).catch(()=>{if(active)setLineupError('Não foi possível consultar a escalação.');});
    return()=>{active=false;};
  },[preparation,hero?.id,version]);
  if(loading)return <Spinner/>;
  return <div className="dashboard">
    <div className="page-header"><div><span className="eyebrow">FUTSAL · DIA A DIA DO CLUBE</span><h1 className="page-title">{clube?.nome}</h1><p className="page-sub">Escolha um sub para acompanhar a equipe dentro da quadra.</p></div><Btn variant="ghost" size="sm" onClick={()=>setVersion(v=>v+1)}>Atualizar</Btn></div>
    <div className="home-navigation"><div className="alunos-tabs" role="group" aria-label="Fase"><button aria-pressed={phase==='INICIACAO'} onClick={()=>{setPhase('INICIACAO');setCategory('');}}>Iniciação</button><button aria-pressed={phase==='BASE'} onClick={()=>{setPhase('BASE');setCategory('');}}>Base</button></div>
      <div className="category-tabs" role="group" aria-label="Categoria da visão geral">{available.map(c=><button key={c.id} aria-pressed={current?.id===c.id} onClick={()=>setCategory(c.nome)}>{c.nome.toUpperCase()}</button>)}</div></div>
    {error&&<p className="notice-error" role="alert">{error}</p>}
    {!current?<p className="dashboard-empty">Nenhuma categoria disponível nesta fase.</p>:<>
      <div className="home-focus">
        <section><div className="collection-heading"><div><h2>{hero?.status==='AO_VIVO'?'Agora na quadra':hero?.data.slice(0,10)===date?'É dia de jogo':'Próxima partida'}</h2><p>{current.nome.toUpperCase()} · {hero?(hero.emCasa?'Em casa':'Fora de casa'):'Aguardando agendamento'}</p></div>{hero?.status==='AO_VIVO'&&<span className="home-live">AO VIVO</span>}</div>
          {hero?<MatchCard partida={hero} featured actions={podeGerenciar&&!hero.somente_leitura&&<Link to={`/partidas/${hero.id}`} className="btn btn-ghost btn-sm">{hero.status==='AO_VIVO'?'Gerenciar partida':'Detalhes e escalação'}</Link>}/>:<div className="dashboard-empty">Sem partida marcada para este sub.<Link to="/partidas" className="btn btn-ghost btn-sm">Abrir agenda</Link></div>}
          {live.length>1&&<div className="home-extra-live">{live.slice(1).map(m=><Link key={m.id} to={`/partidas/${m.id}`}>Também ao vivo: {teamName(m.mandante?.nome||'')} × {teamName(m.visitante?.nome||'')} <Icon name="arrow" size={14}/></Link>)}</div>}
        </section>
        <aside className="home-side">
          <section className="category-moment"><div className="collection-heading"><div><h2>Momento da categoria</h2><p>{current.nome.toUpperCase()} · últimas {history.length || 5} partidas</p></div><Icon name="ball" size={20}/></div>
            <div className="moment-results">{[...history].reverse().map(m=><Link key={m.id} className={`moment-result result-${result(m)}`} to={`/partidas/${m.id}`} title={`${{V:'Vitória',E:'Empate',D:'Derrota'}[result(m)]} · ${m.gols_mandante} × ${m.gols_visitante}`} aria-label={`${{V:'Vitória',E:'Empate',D:'Derrota'}[result(m)]} em ${formatMatchDate(m.data)}, ver partida`}><strong>{result(m)}</strong><small>{formatMatchDate(m.data).slice(0,5)}</small></Link>)}</div>
            {history.length?<><p className="moment-summary"><span>{counts.V} vitórias</span> · {counts.E} empates · {counts.D} derrotas</p><small>Mais recente à direita · clique para ver a partida</small></>:<p>Os resultados aparecem após a primeira partida finalizada.</p>}
          </section>
          {preparation&&<section className="home-preparation"><span className="eyebrow">ÁREA DO GESTOR</span><h2>{starters===5?'Equipe pronta':'Prepare sua equipe'}</h2><p>{lineupError|| (starters===null?'Consultando titulares…':`${starters} de 5 titulares definidos`)}</p><div className="starter-slots" aria-hidden="true">{Array.from({length:5},(_,i)=><span key={i} className={starters!==null&&i<starters?'filled':''}><Icon name="player" size={18}/></span>)}</div><Link to={`/partidas/${hero.id}`} className="btn btn-ghost btn-sm">{starters===5?'Revisar escalação':'Preparar escalação'}<Icon name="arrow" size={14}/></Link></section>}
          <div className="home-club-summary"><Link to="/jogadores"><strong>{totalPlayers}</strong><span>jogadores no clube</span></Link><Link to="/times"><strong>{categories.length}</strong><span>categorias</span></Link></div>
        </aside>
      </div>
      <div className="home-secondary"><section><div className="collection-heading"><div><h2>Na sequência</h2><p>Próximos compromissos do {current.nome.toUpperCase()}</p></div><Link to="/partidas">Ver agenda →</Link></div><div className="home-agenda">{upcoming.filter(m=>m.id!==hero?.id).slice(0,3).map(m=><Link key={m.id} to={`/partidas/${m.id}`}><time>{formatMatchDate(m.data).slice(0,5)}<small>{m.horario||'A definir'}</small></time><span><strong>{teamName((m.emCasa?m.visitante:m.mandante)?.nome||'Adversário')}</strong><small>{m.emCasa?'Em casa':'Fora de casa'}</small></span><Icon name="arrow" size={16}/></Link>)}{upcoming.filter(m=>m.id!==hero?.id).length===0&&<p className="dashboard-empty">Sem outros jogos agendados.</p>}</div></section>
      <section><div className="collection-heading"><div><h2>Últimos confrontos</h2><p>Histórico do sub selecionado</p></div></div><div className="home-agenda">{history.slice(0,3).map(m=><Link key={m.id} to={`/partidas/${m.id}`}><time>{formatMatchDate(m.data).slice(0,5)}</time><span><strong>{teamName((m.emCasa?m.visitante:m.mandante)?.nome||'Adversário')}</strong><small>{m.emCasa?'Em casa':'Fora de casa'}</small></span><strong>{m.emCasa?m.gols_mandante:m.gols_visitante} : {m.emCasa?m.gols_visitante:m.gols_mandante}</strong></Link>)}{!history.length&&<p className="dashboard-empty">Sem resultados nesta categoria.</p>}</div></section></div>
    </>}
    <p className="home-update-note">Atualização a cada 30 segundos enquanto a página está visível.</p>
  </div>;
}
