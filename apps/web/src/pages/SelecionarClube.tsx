import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchClubes, seguirClube, Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Spinner, Empty, PapelBadge } from '../components/UI';
import { Brand, ClubBadge } from '../components/Brand';
import { Icon } from '../components/Icon';
import './SelecionarClube.css';

export default function SelecionarClubePage() {
  const { definirClube, clube: clubeAtual } = useAuth();
  const navigate = useNavigate();
  const [clubes, setClubes] = useState<Clube[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState('');
  const [seguindoId, setSeguindoId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    fetchClubes().then(setClubes).catch(() => setErro('Erro ao carregar clubes')).finally(() => setLoading(false));
  }, []);

  function selecionar(clube: Clube) {
    definirClube(clube);
    navigate('/dashboard');
  }

  async function acompanhar(clube: Clube) {
    setErro('');
    setSeguindoId(clube.id);
    try {
      const vinculo = await seguirClube(clube.id);
      setClubes(atuais => atuais.map(item => item.id === clube.id
        ? { ...item, meuPapel: vinculo.papel || 'TORCEDOR', isSeguindo: true }
        : item));
    } catch (err: any) {
      setErro(err.message || 'Não foi possível acompanhar o clube');
    } finally {
      setSeguindoId(null);
    }
  }

  const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const encontrados = clubes.filter(c => normalizar(`${c.nome} ${c.cidade || ''} ${c.estado || ''}`).includes(normalizar(busca.trim())));
  const meusClubes = clubes.filter(c => c.meuPapel);

  return (
    <div className="selecionar-page">
      <div className="selecionar-header">
        <Brand />
        <div className="selecionar-header-acoes">
          {clubeAtual && <Link className="btn btn-ghost btn-md" to="/dashboard"><Icon name="chevronLeft" size={18} />Voltar ao clube</Link>}
          <Link className="profile-link" to="/perfil" aria-label="Meu perfil"><Icon name="user" /></Link>
        </div>
      </div>
      <div className="selecionar-body">
        <div className="selecionar-intro">
          <span className="eyebrow">SEUS CLUBES NO LUDORA</span>
          <h1 className="selecionar-titulo">{clubeAtual ? 'Trocar clube' : 'Escolha um clube'}</h1>
          <p className="selecionar-sub">
            Acesse um clube para acompanhar partidas ou gerenciar a equipe conforme seu papel.
          </p>
        </div>
        {loading && <Spinner />}
        {erro && <div className="notice-error" role="alert">{erro}</div>}
        {!loading && !erro && clubes.length === 0 && <Empty message="Nenhum clube disponível" />}
        {meusClubes.length > 0 && <section className="my-clubs">
          <h2 className="section-title">Seus clubes</h2>
          <div className="my-clubs-list">{meusClubes.map(c => <button key={c.id} className="my-club" onClick={() => selecionar(c)}>
            <ClubBadge src={c.escudo} name={c.nome} size={50} /><span>{c.nome}</span>
          </button>)}</div>
        </section>}
        {!loading && clubes.length > 0 && <>
          <div className="club-search"><Icon name="search" /><label className="sr-only" htmlFor="club-search">Buscar clube por nome ou cidade</label><input id="club-search" type="search" placeholder="Buscar clube por nome ou cidade..." value={busca} onChange={e => setBusca(e.target.value)} /></div>
          <div className="club-results-heading"><h2 className="section-title">Explore os clubes</h2><span role="status">{encontrados.length} encontrado(s)</span></div>
          {encontrados.length === 0 && <Empty message="Nenhum clube encontrado. Tente outro nome ou cidade." />}
        </>}
        <div className="clube-grid">
          {encontrados.map(c => (
            <article key={c.id} className="clube-card">
              <ClubBadge src={c.escudo} name={c.nome} size={50} />
              <div className="clube-info">
                <span className="clube-nome">{c.nome}</span>
                {c.cidade && <span className="clube-cidade"><Icon name="location" size={13} />{c.cidade}{c.estado ? `, ${c.estado}` : ''}</span>}
                {typeof c.seguidores === 'number' && <span className="clube-seguidores">{c.seguidores} torcedor(es)</span>}
              </div>
              {c.meuPapel && <PapelBadge papel={c.meuPapel} />}
              <div className="clube-acoes">
                {!c.meuPapel && !c.isSeguindo && <button className="btn btn-ghost btn-md" onClick={() => acompanhar(c)} disabled={seguindoId !== null}>{seguindoId === c.id ? 'Seguindo…' : 'Seguir clube'}</button>}
                <button className="btn btn-primary btn-md" onClick={() => selecionar(c)} disabled={seguindoId === c.id}>Acessar clube<Icon name="chevronRight" size={18} /></button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
