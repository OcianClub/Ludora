import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClubPending } from '../contexts/ClubPendingContext';
import { fetchJogadoresPerfis, requestJson, type Categoria, type HomePartida, type PerfilJogador } from '../services/api';
import type { PropostaPartida } from '../services/sharedMatches';
import { destaquesCategoria, nomeCategoria, podePrepararHome } from '../utils/homeDashboard';
import { Icon, type IconName } from './Icon';

export function HomePending({ category, matches, refreshKey }: {
  category: Categoria;
  matches: HomePartida[];
  refreshKey: number;
}) {
  const { clube } = useAuth();
  const data = useClubPending();
  const [requests, setRequests] = useState<{ clubId: number; items: PropostaPartida[] | null } | null>(null);

  useEffect(() => {
    if (!clube) return;
    const clubId = clube.id;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);
    let active = true;
    requestJson<PropostaPartida[]>('/partidas/solicitacoes', { signal: controller.signal })
      .then(items => { if (active) setRequests({ clubId, items }); })
      .catch(() => { if (active) setRequests({ clubId, items: null }); })
      .finally(() => window.clearTimeout(timeout));
    return () => { active = false; controller.abort(); window.clearTimeout(timeout); };
  }, [clube?.id, refreshKey]);

  const incoming = requests?.clubId === clube?.id ? requests : null;
  const count = incoming?.items?.filter(item => item.respondente_id === clube?.id
    && item.status === 'PENDENTE' && nomeCategoria(item.categoria_nome || '') === nomeCategoria(category.nome)).length;
  const missing = data?.missing?.get(category.id) ?? 0;
  const unassessed = data?.unassessed?.get(category.id) ?? 0;
  const next = matches.find(podePrepararHome);
  const unidentified = matches.filter(match => ['AO_VIVO', 'FINALIZADA'].includes(match.status)
    && (match.sumula_clube_id ?? match.clube_origem_id ?? match.categoria.clube_id) === clube?.id
    && (match.gols_sem_autor ?? 0) > 0);
  const goals = unidentified.reduce((total, match) => total + (match.gols_sem_autor || 0), 0);
  const items: { title: string; copy: string; href: string; icon: IconName; count?: number }[] = [];

  if (count) items.push({ title: 'Solicitações de partida', copy: 'Convites ou alterações aguardando sua resposta',
    href: '/partidas/solicitacoes', icon: 'email', count });
  if (next && !next.minha_equipe_pronta) {
    const required = next.titulares_necessarios || 5;
    const starters = next.titulares_definidos;
    items.push({ title: starters === required ? 'Confirmar sua equipe' : 'Preparar próximo jogo',
      copy: starters == null ? 'Confira a escalação e confirme sua equipe' : `${starters}/${required} titulares · ${starters === required ? 'Revise antes de publicar' : 'Complete a escalação'}`,
      href: `/partidas/${next.id}`, icon: 'team' });
  }
  if (goals) items.push({ title: 'Gols sem autor identificado', copy: 'Registros pendentes nas últimas partidas',
    href: `/partidas/${unidentified[0].id}`, icon: 'ball', count: goals });
  if (missing) items.push({ title: 'Numeração do elenco', copy: 'Jogadores com camisa ainda não definida',
    href: `/jogadores?categoria=${category.id}&camisa=missing`, icon: 'shirt', count: missing });
  const complete = data?.missing != null && incoming?.items != null;

  return <section className="home-pending" aria-labelledby="home-pending-title">
    <div className="home-section-heading"><h2 id="home-pending-title">Pendências</h2><span className="home-category-label">{category.nome.toUpperCase()}</span></div>
    <div className="home-pending-card">
      <div className="home-pending-intro">
        <span className={`home-pending-symbol${items.length ? ' is-alert' : ''}`}><Icon name={items.length ? 'alert' : complete ? 'checkAll' : 'info'} size={24} /></span>
        <div><h3>{items.length ? 'O que precisa da sua atenção' : complete ? 'Tudo em dia' : 'Conferindo a categoria'}</h3>
          <p>{items.length ? 'Resolva os próximos passos da sua equipe.' : complete ? 'Nenhuma ação pendente nesta categoria.' : 'Seus atalhos continuam disponíveis abaixo.'}</p></div>
      </div>
      <div className="home-pending-items">
        {items.map(item => <Link key={item.title} to={item.href}>
          <span className="home-pending-item-icon"><Icon name={item.icon} size={21} /></span>
          <span className="home-pending-item-copy"><strong>{item.title}</strong><small>{item.copy}</small></span>
          {item.count != null && <span className="home-pending-count">{item.count}</span>}
          <Icon name="chevronRight" size={17} />
        </Link>)}
      </div>
      {!complete && <p className="home-pending-note"><Icon name="info" size={16} /><span>{!data || !incoming ? 'Consultando as pendências…' : <>Parte da consulta está indisponível. Confira a <Link to="/partidas">agenda</Link> ou os cadastros do elenco.</>}</span></p>}
      {unassessed > 0 ? <p className="home-pending-note"><Icon name="radar" size={16} /><span>{unassessed} {unassessed === 1 ? 'atleta ainda sem perfil de contribuição' : 'atletas ainda sem perfil de contribuição'}. O perfil depende da amostra de registros, não é uma nota de habilidade. <Link to={`/elenco?categoria_id=${category.id}&perfil=pending`}>Consultar Scout</Link></span></p>
        : complete && <p className="home-pending-note"><Icon name="info" size={16} /><span>{items.length ? 'As ações respeitam seu acesso a esta categoria.' : 'Os próximos jogos e registros pendentes aparecerão aqui.'}</span></p>}
    </div>
  </section>;
}

export function useHomeHighlights(categoryId: number, enabled: boolean, refreshKey: number) {
  const { clube } = useAuth();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{ key: string; players: PerfilJogador[] | null; error: boolean } | null>(null);
  const key = `${clube?.id}:${categoryId}`;
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    let active = true;
    fetchJogadoresPerfis(categoryId, controller.signal)
      .then(players => { if (active) setState({ key, players, error: false }); })
      .catch(() => { if (active) setState(previous => ({ key, players: previous?.key === key ? previous.players : null, error: true })); });
    return () => { active = false; controller.abort(); };
  }, [key, enabled, retry, refreshKey]);
  const current = state?.key === key ? state : null;
  const leaders = useMemo(() => destaquesCategoria(current?.players || []), [current?.players]);
  return { leaders, loading: !current, error: current?.error, retry: () => setRetry(value => value + 1) };
}

export function HomeHighlights({ category, highlights }: {
  category: Categoria;
  highlights: ReturnType<typeof useHomeHighlights>;
}) {
  return <section className="home-highlights" aria-labelledby="home-highlights-title">
    <div className="home-section-heading"><h2 id="home-highlights-title">Destaques da categoria</h2><Link to={`/elenco?categoria_id=${category.id}`}>Ver Scout<Icon name="chevronRight" size={15} /></Link></div>
    <div className="home-highlights-card">
      <p className="home-section-copy">Gols e assistências registrados no {category.nome.toUpperCase()}</p>
      {highlights.loading ? <div className="home-highlights-loading home-placeholder" role="status" aria-label="Carregando destaques" />
        : highlights.leaders.length ? <div className="home-highlight-leaders">
          {highlights.leaders.map(leader => <Link key={leader.campo} to={`/elenco?categoria_id=${category.id}&ordem=${leader.campo === 'totalGols' ? 'goals' : 'assists'}`}>
            <Icon name={leader.campo === 'totalGols' ? 'ball' : 'switchClub'} size={22} />
            <span><small>{leader.campo === 'totalGols' ? 'Mais gols' : 'Mais assistências'}</small><strong data-tooltip={leader.jogador.nome} data-tooltip-overflow>{leader.jogador.nome}</strong>{leader.empatados > 0 && <small>+{leader.empatados} {leader.empatados === 1 ? 'atleta empatado' : 'atletas empatados'}</small>}</span>
            <b>{leader.valor}</b><Icon name="chevronRight" size={16} />
          </Link>)}
        </div> : null}
      {highlights.error && <p className="home-highlight-error" role="status">Não foi possível atualizar os destaques. <button type="button" onClick={highlights.retry}>Tentar novamente</button></p>}
    </div>
  </section>;
}
