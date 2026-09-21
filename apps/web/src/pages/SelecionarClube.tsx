import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchClubes, seguirClube, Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Empty } from '../components/UI';
import './SelecionarClube.css';

export default function SelecionarClubePage() {
  const { definirClube, logout } = useAuth();
  const navigate = useNavigate();
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [seguindoId, setSeguindoId] = useState<number | null>(null);

  useEffect(() => {
    fetchClubes().then(setClubes).catch(() => setErro('Erro ao carregar clubes')).finally(() => setLoading(false));
  }, []);

  async function selecionar(clube: Clube) {
    setErro('');
    if (clube.meuPapel) {
      definirClube(clube);
      navigate('/dashboard');
      return;
    }

    setSeguindoId(clube.id);
    try {
      const vinculo = await seguirClube(clube.id);
      definirClube({ ...clube, meuPapel: vinculo.papel || 'TORCEDOR', isSeguindo: true });
      navigate('/dashboard');
    } catch (err: any) {
      setErro(err.message || 'Não foi possível acompanhar o clube');
    } finally {
      setSeguindoId(null);
    }
  }

  return (
    <div className="selecionar-page">
      <div className="selecionar-header">
        <span className="auth-logo" style={{ fontFamily: 'var(--font-titulo)', fontSize: 22, fontWeight: 700, color: 'var(--primaria)', letterSpacing: 2 }}>LUDORA</span>
        <button className="btn btn-ghost btn-sm" onClick={logout}>Sair</button>
      </div>
      <div className="selecionar-body">
        <div className="selecionar-intro">
          <span className="selecionar-kicker">ÁREA DO TORCEDOR</span>
          <h1 className="selecionar-titulo">Qual clube você quer acompanhar?</h1>
          <p className="selecionar-sub">
            Veja partidas, elenco e competições. Contas criadas pelo web entram como torcedor;
            perfis de gestão são cadastrados exclusivamente no desktop.
          </p>
        </div>
        {loading && <Spinner />}
        {erro && <div style={{ color: 'var(--titulo-erro)', textAlign: 'center', marginTop: 24 }}>{erro}</div>}
        {!loading && !erro && clubes.length === 0 && <Empty message="Nenhum clube disponível" />}
        <div className="clube-grid">
          {clubes.map(c => (
            <article key={c.id} className="clube-card">
              <div className="clube-escudo">{c.escudo ? <img src={c.escudo} alt="" /> : <span>{c.nome[0]}</span>}</div>
              <div className="clube-info">
                <span className="clube-nome">{c.nome}</span>
                {c.cidade && <span className="clube-cidade">{c.cidade}{c.estado ? `, ${c.estado}` : ''}</span>}
                {typeof c.seguidores === 'number' && <span className="clube-seguidores">{c.seguidores} torcedor(es)</span>}
              </div>
              {c.meuPapel && <span className="clube-papel">{c.meuPapel}</span>}
              <button className={`btn ${c.meuPapel ? 'btn-ghost' : 'btn-primary'} btn-sm clube-acao`} onClick={() => selecionar(c)} disabled={seguindoId === c.id}>
                {seguindoId === c.id ? 'Aguarde...' : c.meuPapel ? 'Acessar clube' : 'Seguir como torcedor'}
              </button>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
