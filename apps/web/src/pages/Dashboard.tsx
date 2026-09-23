import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPartidas, fetchJogadores, fetchTimes, fetchCompeticoes, Partida, Jogador } from '../services/api';
import { Spinner, Card, Empty } from '../components/UI';
import { MatchCard } from '../components/MatchCard';
import { Icon, IconName } from '../components/Icon';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

export default function DashboardPage() {
  const { usuario, clube, podeGerenciar } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [totalTimes, setTotalTimes] = useState(0);
  const [totalCompeticoes, setTotalCompeticoes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([fetchPartidas(), fetchJogadores(), fetchTimes(), fetchCompeticoes()])
      .then(([p, j, t, c]) => {
        setPartidas(p.map(match => ({ ...match, mandante: match.mandante || t.find(team => team.id === match.mandante_id), visitante: match.visitante || t.find(team => team.id === match.visitante_id) })));
        setJogadores(j);
        setTotalTimes(t.length);
        setTotalCompeticoes(c.length);
      }).catch(() => setErro('Não foi possível carregar os dados do clube. Tente novamente em instantes.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  const aoVivo = partidas.filter(p => p.status === 'AO_VIVO');
  const proximas = partidas.filter(p => ['AGENDADA', 'PREPARADA'].includes(p.status))
    .sort((a, b) => `${a.data.slice(0, 10)}${a.horario || ''}`.localeCompare(`${b.data.slice(0, 10)}${b.horario || ''}`));
  const recentes = partidas.filter(p => p.status === 'FINALIZADA')
    .sort((a, b) => `${b.data.slice(0, 10)}${b.horario || ''}`.localeCompare(`${a.data.slice(0, 10)}${a.horario || ''}`)).slice(0, 2);
  const destaque = aoVivo[0] || proximas[0];
  const stats: { label: string; value: number; icon: IconName }[] = [
    { label: 'Jogadores ativos', value: jogadores.filter(j => j.ativo).length, icon: 'team' },
    { label: 'Times', value: totalTimes, icon: 'shield' },
    { label: 'Competições', value: totalCompeticoes, icon: 'trophy' },
    { label: 'Partidas', value: partidas.length, icon: 'ball' },
  ];

  return <div className="dashboard">
    <div className="page-header">
      <div><span className="eyebrow">VISÃO GERAL</span><h1 className="page-title">Olá, {usuario?.nome?.split(' ')[0] || 'torcedor'}.</h1><p className="page-sub">Tudo pronto para acompanhar o {clube?.nome || 'seu clube'}?</p></div>
      <Link className="btn btn-ghost btn-sm" to="/partidas"><Icon name="calendar" size={16} />Ver agenda</Link>
    </div>
    {erro ? <div className="notice-error" role="alert">{erro}</div> : <>
      <div className="dashboard-top">
        <section><h2 className="section-title">{aoVivo.length ? 'Em campo agora' : 'Próximo jogo'}</h2>
          {destaque ? <MatchCard partida={destaque} featured /> : <Card className="dashboard-no-match"><Empty icon="⚽" message="Nenhuma partida agendada por enquanto." /><Link to="/partidas" className="btn btn-ghost btn-sm">Consultar partidas</Link></Card>}
        </section>
        <section><h2 className="section-title">O clube em números</h2>
          <div className="dashboard-stats">{stats.map(stat => <div className="stat-card" key={stat.label}><div className="stat-card-heading"><p className="stat-label">{stat.label}</p><Icon name={stat.icon} size={18} /></div><p className="stat-value">{stat.value}</p><p className="stat-sub">No clube selecionado</p></div>)}</div>
          <p className="dashboard-note">{podeGerenciar ? 'Seu perfil tem acesso às ações de gestão do clube.' : 'Você acompanha este clube como torcedor.'}</p>
        </section>
      </div>
      {aoVivo.length > 1 && <section className="dash-section"><h2 className="section-title">Outras partidas ao vivo</h2><div className="matches-grid">{aoVivo.slice(1).map(p => <MatchCard key={p.id} partida={p} />)}</div></section>}
      <div className="dashboard-bottom">
        <section><div className="dashboard-section-heading"><h2 className="section-title">Na agenda</h2><Link to="/partidas">Ver todas <Icon name="arrow" size={14} /></Link></div>
          <div className="dashboard-match-list">{proximas.slice(0, 2).map(p => <MatchCard key={p.id} partida={p} />)}{proximas.length === 0 && <div className="dashboard-empty">Os próximos jogos aparecerão aqui quando forem agendados.</div>}</div>
        </section>
        <section><h2 className="section-title">Últimos resultados</h2><div className="dashboard-match-list">{recentes.map(p => <MatchCard key={p.id} partida={p} />)}{recentes.length === 0 && <div className="dashboard-empty">Ainda não há partidas finalizadas para exibir.</div>}</div></section>
      </div>
    </>}
    <div className="dashboard-shortcuts">
      <Link to="/elenco"><Icon name="team" /><span><strong>Conheça o elenco</strong><small>Jogadores do clube</small></span><Icon name="arrow" size={18} /></Link>
      <Link to="/times"><Icon name="shield" /><span><strong>Nossos times</strong><small>Equipes cadastradas</small></span><Icon name="arrow" size={18} /></Link>
      <Link to="/competicoes"><Icon name="trophy" /><span><strong>Competições</strong><small>Campeonatos do clube</small></span><Icon name="arrow" size={18} /></Link>
    </div>
  </div>;
}
