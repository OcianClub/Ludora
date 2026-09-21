import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPartidas, fetchJogadores, fetchTimes, fetchCompeticoes, Partida, Jogador } from '../services/api';
import { StatusBadge, Spinner, Card } from '../components/UI';
import { useAuth } from '../contexts/AuthContext';
import './Dashboard.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const { usuario, clube, podeGerenciar } = useAuth();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [totalTimes, setTotalTimes] = useState(0);
  const [totalCompeticoes, setTotalCompeticoes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    Promise.all([
      fetchPartidas(),
      fetchJogadores(),
      fetchTimes(),
      fetchCompeticoes(),
    ]).then(([p, j, t, c]) => {
      setPartidas(p);
      setJogadores(j);
      setTotalTimes(t.length);
      setTotalCompeticoes(c.length);
    }).catch(err => {
      console.error(err);
      setErro('Não foi possível carregar os dados do clube. Tente novamente em instantes.');
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const aoVivo = partidas.filter(p => p.status === 'AO_VIVO');
  const proximas = partidas.filter(p => p.status === 'AGENDADA').slice(0, 5);
  const recentes = partidas.filter(p => p.status === 'FINALIZADA').slice(0, 5);
  const jogadoresAtivos = jogadores.filter(j => j.ativo).length;
  const semDados = partidas.length === 0 && jogadoresAtivos === 0 && totalTimes === 0 && totalCompeticoes === 0;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Olá, {usuario?.nome?.split(' ')[0] || 'torcedor'}!</h1>
          <p className="page-sub">Acompanhe as novidades do {clube?.nome || 'seu clube'}.</p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/perfil')}>Meu perfil</button>
      </div>

      {!podeGerenciar && (
        <div className="torcedor-banner">
          <div>
            <span className="torcedor-kicker">ÁREA DO TORCEDOR</span>
            <strong>Você está acompanhando {clube?.nome}</strong>
            <p>Consulte partidas, elenco e competições. A gestão do clube é realizada no aplicativo desktop.</p>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/selecionar-clube')}>Trocar clube</button>
        </div>
      )}

      {erro && <div className="dash-erro">{erro}</div>}

      <div className="stat-grid">
        <div className="stat-card">
          <p className="stat-label">Jogadores ativos</p>
          <p className="stat-value text-primaria">{jogadoresAtivos}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Times</p>
          <p className="stat-value">{totalTimes}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Competições</p>
          <p className="stat-value">{totalCompeticoes}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Partidas ao vivo</p>
          <p className="stat-value text-amarelo">{aoVivo.length}</p>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total de partidas</p>
          <p className="stat-value">{partidas.length}</p>
        </div>
      </div>

      {semDados && !erro && (
        <Card className="dash-vazio">
          <div className="dash-vazio-icon">⚽</div>
          <div>
            <h2>O clube ainda não publicou dados</h2>
            <p>Quando a equipe cadastrar jogadores, partidas e competições pelo desktop, tudo aparecerá aqui automaticamente.</p>
          </div>
          <div className="dash-vazio-acoes">
            <button className="btn btn-primary btn-sm" onClick={() => navigate('/partidas')}>Ver partidas</button>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/selecionar-clube')}>Encontrar outro clube</button>
          </div>
        </Card>
      )}

      {!semDados && (
        <div className="atalhos-torcedor">
          <button onClick={() => navigate('/partidas')}><span>⚽</span><strong>Partidas</strong><small>Agenda e resultados</small></button>
          <button onClick={() => navigate('/elenco')}><span>👥</span><strong>Elenco</strong><small>Conheça os jogadores</small></button>
          <button onClick={() => navigate('/competicoes')}><span>🏆</span><strong>Competições</strong><small>Campeonatos do clube</small></button>
        </div>
      )}

      {aoVivo.length > 0 && (
        <div className="dash-section">
          <h2 className="dash-section-title">⚡ Ao vivo agora</h2>
          <div className="partida-ao-vivo-list">
            {aoVivo.map(p => (
              <div key={p.id} className="partida-ao-vivo" onClick={() => navigate(`/partidas/${p.id}`)}>
                <StatusBadge status="AO_VIVO" />
                <span className="partida-times">
                  {p.mandante?.nome || '—'} <strong>{p.gols_mandante} × {p.gols_visitante}</strong> {p.visitante?.nome || '—'}
                </span>
                {p.categoria && <span className="partida-cat">{p.categoria.nome}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {!semDados && <div className="dash-grid">
        <Card>
          <h2 className="dash-section-title">Próximas partidas</h2>
          {proximas.length === 0
            ? <p className="text-sec" style={{ fontSize: 13, marginTop: 10 }}>Nenhuma partida agendada</p>
            : proximas.map(p => <PartidaRow key={p.id} partida={p} onClick={() => navigate(`/partidas/${p.id}`)} />)
          }
        </Card>
        <Card>
          <h2 className="dash-section-title">Resultados recentes</h2>
          {recentes.length === 0
            ? <p className="text-sec" style={{ fontSize: 13, marginTop: 10 }}>Nenhum resultado ainda</p>
            : recentes.map(p => <PartidaRow key={p.id} partida={p} onClick={() => navigate(`/partidas/${p.id}`)} />)
          }
        </Card>
      </div>}
    </div>
  );
}

function PartidaRow({ partida: p, onClick }: { partida: Partida; onClick: () => void }) {
  return (
    <div className="dash-partida-row" onClick={onClick}>
      <div className="dash-partida-main">
        <span>{p.mandante?.nome || '—'}</span>
        <span className="dash-placar">{p.gols_mandante} × {p.gols_visitante}</span>
        <span>{p.visitante?.nome || '—'}</span>
      </div>
      <div className="dash-partida-meta">
        {p.data && <span>{new Date(p.data).toLocaleDateString('pt-BR')}</span>}
        {p.horario && <span>{p.horario}</span>}
        {p.categoria && <span>{p.categoria.nome}</span>}
      </div>
    </div>
  );
}
