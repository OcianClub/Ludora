import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cachedJson, deixarDeSeguirClube, fetchClubes, seguirClube, type Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Modal } from '../components/UI';
import { ClubRowsSkeleton } from '../components/StandaloneLoading';
import { ClubBadge } from '../components/Brand';
import { PublicHeader } from '../components/PublicLayout';
import { rememberAccess } from '../services/publicAccess';
import { CollectionSearch } from '../components/CollectionToolbar';
import { Icon, type IconName } from '../components/Icon';
import './SelecionarClube.css';

const normalizar = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const temCargo = (clube: Clube) => Boolean(clube.meuPapel && clube.meuPapel !== 'TORCEDOR');
const segue = (clube: Clube) => Boolean(clube.isSeguindo || clube.meuPapel);
const papeis: Record<string, { label: string; icon: IconName }> = {
  ADMIN: { label: 'Administrador', icon: 'defense' },
  TECNICO: { label: 'Técnico', icon: 'table' },
  OLHEIRO: { label: 'Olheiro', icon: 'eye' },
  MESARIO: { label: 'Mesário', icon: 'calendar' },
};

export default function SelecionarClubePage() {
  const { definirClube, clubeSelecionado: clubeAtual, token, mudarModo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [clubes, setClubes] = useState<Clube[]>(() => cachedJson<Clube[]>('/clubes') || []);
  const [loading, setLoading] = useState(() => !cachedJson('/clubes'));
  const [erro, setErro] = useState('');
  const accessNotice = (location.state as { message?: string } | null)?.message;
  const [seguindoId, setSeguindoId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [confirmarSaida, setConfirmarSaida] = useState<Clube | null>(null);
  const [entrarParaSeguir, setEntrarParaSeguir] = useState<Clube | null>(null);

  useEffect(() => {
    let ativo = true;
    setLoading(!cachedJson('/clubes'));
    setErro('');
    fetchClubes().then(result => { if (ativo) setClubes(result); })
      .catch(() => { if (ativo) setErro('Não foi possível carregar os clubes. Verifique sua conexão e tente novamente.'); })
      .finally(() => { if (ativo) setLoading(false); });
    return () => { ativo = false; };
  }, [tentativa, token]);

  function selecionar(clube: Clube) {
    mudarModo('publico');
    definirClube(clube);
    navigate(`/clubes/${clube.id}`);
  }

  async function acompanhar(clube: Clube) {
    if (!token) { setEntrarParaSeguir(clube); return; }
    if (seguindoId !== null) return;
    setErro('');
    setSeguindoId(clube.id);
    try {
      const vinculo = await seguirClube(clube.id);
      setClubes(atuais => atuais.map(item => item.id === clube.id
        ? { ...item, meuPapel: vinculo.papel || 'TORCEDOR', isSeguindo: true, seguidores: vinculo.seguidores ?? item.seguidores }
        : item));
    } catch (err: any) {
      setErro(err.message || 'Não foi possível acompanhar o clube. Tente novamente.');
    } finally {
      setSeguindoId(null);
    }
  }

  async function deixarDeAcompanhar(clube: Clube) {
    if (seguindoId !== null || temCargo(clube)) return;
    setErro('');
    setSeguindoId(clube.id);
    try {
      const resultado = await deixarDeSeguirClube(clube.id);
      setClubes(atuais => atuais.map(item => item.id === clube.id
        ? { ...item, meuPapel: null, isSeguindo: false, seguidores: resultado.seguidores ?? item.seguidores }
        : item));
      if (clubeAtual?.id === clube.id) definirClube({ ...clubeAtual, meuPapel: null, isSeguindo: false });
      setConfirmarSaida(null);
    } catch (err: any) {
      setErro(err.message || 'Não foi possível deixar de seguir o clube. Tente novamente.');
    } finally {
      setSeguindoId(null);
    }
  }

  const query = normalizar(busca.trim());
  const ordenar = (a: Clube, b: Clube) => Number(b.id === clubeAtual?.id) - Number(a.id === clubeAtual?.id) || a.nome.localeCompare(b.nome, 'pt-BR');
  const gerenciados = clubes.filter(temCargo).sort(ordenar);
  const seguindo = clubes.filter(item => !temCargo(item) && segue(item)).sort(ordenar);
  const descobertos = clubes.filter(item => !temCargo(item) && !segue(item)).sort(ordenar);
  const resultados = query ? clubes.filter(item => normalizar(`${item.nome} ${item.cidade || ''} ${item.estado || ''}`).includes(query)).sort(ordenar) : descobertos;

  function solicitarSaida(clube: Clube) {
    if (matchMedia('(max-width: 760px), (pointer: coarse)').matches) {
      setErro('');
      setConfirmarSaida(clube);
    } else void deixarDeAcompanhar(clube);
  }

  function contextoAcesso(clube: Clube) {
    const acesso = clube.meuPapel === 'OLHEIRO' ? 'Conteúdo público'
      : clube.meuPapel === 'ADMIN' || clube.acessoTodasCategorias ? 'Todas as categorias'
      : clube.categoriasAcesso?.map(item => item.nome.toUpperCase()).join(', ');
    return acesso || 'Categorias atribuídas pelo clube';
  }

  function card(clube: Clube, descoberta = false) {
    const vinculado = segue(clube);
    const cargo = temCargo(clube);
    const papel = clube.meuPapel ? papeis[clube.meuPapel] : undefined;
    const local = [clube.cidade, clube.estado].filter(Boolean).join(', ');
    const detalhes = cargo ? contextoAcesso(clube)
      : [local, typeof clube.seguidores === 'number' ? `${clube.seguidores} ${clube.seguidores === 1 ? 'seguidor' : 'seguidores'}` : ''].filter(Boolean).join(' · ');
    return <article className="club-picker-card" key={clube.id} data-club-id={clube.id}>
      <button className="club-picker-main" type="button" onClick={() => selecionar(clube)} aria-label={`Acessar ${clube.nome}`} />
      <ClubBadge src={clube.escudo} name={clube.nome} size={48}/>
      <div className="club-picker-info">
        <div className="club-picker-name"><strong>{clube.nome}</strong>{clube.id === clubeAtual?.id && <span className="club-picker-current">Atual</span>}</div>
        {detalhes && <span className="club-picker-details">{detalhes}</span>}
        {(cargo || Boolean(clube.partidasAoVivo)) && <div className="club-picker-tags">
          {cargo && papel && <span className={`club-picker-role role-${clube.meuPapel?.toLowerCase()}`}><Icon name={papel.icon} size={13}/>{papel.label}</span>}
          {Boolean(clube.partidasAoVivo) && <span className="club-picker-live" aria-label={`${clube.partidasAoVivo} ${clube.partidasAoVivo === 1 ? 'partida ao vivo' : 'partidas ao vivo'}`}><Icon name="broadcast" size={14}/>Ao vivo</span>}
        </div>}
      </div>
      <span className="club-picker-chevron"><Icon name="chevronRight" size={18}/></span>
      {!cargo && (descoberta ? <button type="button" className={`club-picker-follow${vinculado ? ' is-following' : ''}`} onClick={() => vinculado ? solicitarSaida(clube) : void acompanhar(clube)} disabled={seguindoId !== null} aria-label={`${vinculado ? 'Deixar de seguir' : 'Seguir'} ${clube.nome}`}>
        {seguindoId === clube.id ? 'Aguarde…' : vinculado ? <>Seguindo <Icon name="checkAll" size={14}/></> : 'Seguir'}
      </button> : <button type="button" className="club-picker-favorite" aria-pressed={vinculado} aria-label={`Deixar de seguir ${clube.nome}`} onClick={() => solicitarSaida(clube)} disabled={seguindoId !== null}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true"><path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/></svg>
      </button>)}
    </article>;
  }

  return <div className="selecionar-page">
    <PublicHeader />
    <main className="selecionar-body" data-tooltip-disabled>
      <div className="selecionar-intro"><h1>Encontre o seu clube</h1><p>Acesse qualquer clube. Seguir serve para deixar seus favoritos salvos aqui.</p></div>
      {accessNotice && <p className="editor-description" role="status">{accessNotice}</p>}
      {erro && <div className="club-picker-error" role="alert"><span>{erro}</span>{!clubes.length && <button type="button" onClick={() => setTentativa(value => value + 1)}>Tentar novamente</button>}</div>}
      {loading ? <ClubRowsSkeleton /> : <>
        {!query && gerenciados.length > 0 && <section className="club-picker-section" aria-labelledby="clubs-roles">
          <h2 id="clubs-roles" className="club-picker-section-title">Com cargo <span>{gerenciados.length}</span></h2>
          <div className="club-picker-grid">{gerenciados.map(item => card(item))}</div>
        </section>}
        {!query && seguindo.length > 0 && <section className="club-picker-section" aria-labelledby="clubs-following">
          <h2 id="clubs-following" className="club-picker-section-title">Que você segue <span>{seguindo.length}</span></h2>
          <div className="club-picker-grid">{seguindo.map(item => card(item))}</div>
        </section>}
        <section className="club-picker-section club-picker-discover" aria-labelledby="clubs-discover">
          <h2 id="clubs-discover" className="club-picker-section-title">Descobrir</h2>
          <CollectionSearch label="Buscar clube" placeholder="Buscar clube por nome ou cidade..." value={busca} onChange={setBusca}/>
          {query && <div className="club-picker-search-summary" role="status"><span>{resultados.length} {resultados.length === 1 ? 'clube encontrado' : 'clubes encontrados'}</span><button type="button" onClick={() => setBusca('')}>Limpar busca</button></div>}
          {resultados.length ? <div className="club-picker-grid">{resultados.map(item => card(item, true))}</div> : !erro && <div className="club-picker-empty"><Icon name="shield" size={24}/><p>{!clubes.length ? 'Ainda não há clubes cadastrados no Ludora.' : query ? 'Nenhum clube encontrado. Tente outro nome ou cidade.' : 'Você já acompanha todos os clubes disponíveis. Novos clubes aparecerão aqui.'}</p></div>}
        </section>
      </>}

    </main>
    <Modal open={!!entrarParaSeguir} title="Salve seus clubes favoritos" className="club-follow-login-dialog" onClose={() => setEntrarParaSeguir(null)} footer={<div className="club-follow-login-actions"><Btn variant="ghost" onClick={() => setEntrarParaSeguir(null)}>Continuar explorando</Btn><Link className="btn btn-primary btn-md" to="/login" onClick={() => rememberAccess('/selecionar-clube', entrarParaSeguir?.id)}>Entrar e seguir<Icon name="arrow" size={16} /></Link></div>}>
      <div className="club-follow-login-club"><ClubBadge src={entrarParaSeguir?.escudo} name={entrarParaSeguir?.nome || 'Clube'} size={44}/><div><span>Você quer acompanhar</span><strong>{entrarParaSeguir?.nome}</strong></div></div>
      <p>Entre na sua conta para seguir este clube e encontrar seus favoritos em qualquer dispositivo.</p>
      <div className="club-follow-login-benefit"><Icon name="bell" size={18}/><span>Escolha os avisos que deseja receber.</span></div>
    </Modal>
    <Modal open={!!confirmarSaida} title="Deixar de seguir?" className="club-picker-confirm" onClose={() => { if (seguindoId === null) { setConfirmarSaida(null); setErro(''); } }}>
      <p>O {confirmarSaida?.nome} sairá dos seus favoritos. Você ainda poderá acessar o clube pela busca.</p>
      {erro && <p role="alert" className="club-picker-error">{erro}</p>}
      <div className="collection-dialog-actions"><Btn variant="ghost" disabled={seguindoId !== null} onClick={() => { setConfirmarSaida(null); setErro(''); }}>Cancelar</Btn><Btn disabled={seguindoId !== null} onClick={() => { if (confirmarSaida) void deixarDeAcompanhar(confirmarSaida); }}>{seguindoId !== null ? 'Aguarde…' : 'Deixar de seguir'}</Btn></div>
    </Modal>
  </div>;
}
