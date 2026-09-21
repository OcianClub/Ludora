import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchClubes, seguirClube, Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Empty } from '../components/UI';
import './SelecionarClube.css';

export default function SelecionarClubePage() {
  const { definirClube, logout } = useAuth();
  const navigate = useNavigate();
  const [clubes, setClubes] = useState<(Clube & { meuPapel?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');

  useEffect(() => {
    fetchClubes().then(setClubes).catch(() => setErro('Erro ao carregar clubes')).finally(() => setLoading(false));
  }, []);

  async function selecionar(clube: Clube & { meuPapel?: string }) {
    // Se ainda não é membro, segue como torcedor
    if (!clube.meuPapel) {
      try { await seguirClube(clube.id); clube.meuPapel = 'TORCEDOR'; } catch {}
    }
    definirClube(clube);
    navigate('/dashboard');
  }

  return (
    <div className="selecionar-page">
      <div className="selecionar-header">
        <span className="auth-logo" style={{ fontFamily: 'var(--font-titulo)', fontSize: 22, fontWeight: 700, color: 'var(--primaria)', letterSpacing: 2 }}>LUDORA</span>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sair</button>
      </div>
      <div className="selecionar-body">
        <h1 className="selecionar-titulo">Selecionar clube</h1>
        <p className="selecionar-sub">Escolha o clube que deseja gerenciar nesta sessão</p>
        {loading && <Spinner />}
        {erro && <div style={{ color: 'var(--titulo-erro)', textAlign: 'center', marginTop: 24 }}>{erro}</div>}
        {!loading && !erro && clubes.length === 0 && <Empty message="Nenhum clube disponível" />}
        <div className="clube-grid">
          {clubes.map(c => (
            <button key={c.id} className="clube-card" onClick={() => selecionar(c)}>
              <div className="clube-escudo">{c.escudo ? <img src={c.escudo} alt="" /> : <span>{c.nome[0]}</span>}</div>
              <div className="clube-info">
                <span className="clube-nome">{c.nome}</span>
                {c.cidade && <span className="clube-cidade">{c.cidade}{c.estado ? `, ${c.estado}` : ''}</span>}
              </div>
              {c.meuPapel && <span className="clube-papel">{c.meuPapel}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
