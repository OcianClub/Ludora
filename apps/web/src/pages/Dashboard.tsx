import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchPartidas, fetchJogadores, fetchTimes, fetchCompeticoes, Partida, Jogador } from '../services/api';
import { StatusBadge, Spinner, Card } from '../components/UI';
import './Dashboard.css';

export default function DashboardPage() {
  const navigate = useNavigate();
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [totalTimes, setTotalTimes] = useState(0);
  const [totalCompeticoes, setTotalCompeticoes] = useState(0);
  const [loading, setLoading] = useState(true);

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
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;

  const aoVivo = partidas.filter(p => p.status === 'AO_VIVO');
  const proximas = partidas.filter(p => p.status === 'AGENDADA').slice(0, 5);
  const recentes = partidas.filter(p => p.status === 'FINALIZADA').slice(0, 5);
  const jogadoresAtivos = jogadores.filter(j => j.ativo).length;

  return (
    <div className="dashboard">
      <div className="page-header">
        <div>
          <h1 className="page-title">Visão Geral</h1>
          <p className="page-sub">Resumo do clube nesta sessão</p>
        </div>
      </div>

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

      <div className="dash-grid">
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
      </div>
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
