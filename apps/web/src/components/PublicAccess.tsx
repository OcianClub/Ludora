import { useEffect, useState, type ReactNode } from 'react';
import { Link, Navigate, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { fetchClubes, getClubeId, requestJson, type Clube } from '../services/api';
import type { GestaoPartida } from '../services/sharedMatches';
import { rememberAccess } from '../services/publicAccess';
import { Icon } from './Icon';
import Layout from './Layout';

export function ManagementAccess({ children }: { children: ReactNode }) {
  const { token, podeEntrarGestao, modo, mudarModo } = useAuth();
  useEffect(() => {
    if (token && podeEntrarGestao && modo !== 'gestao') mudarModo('gestao');
  }, [token, podeEntrarGestao, modo, mudarModo]);
  if (!token) return <AccessRequired />;
  if (!podeEntrarGestao) return <div className="public-access-state"><Icon name="shield" size={28}/><h2>Área de gestão do clube</h2><p>Seu acesso atual permite acompanhar os jogos. Esta área exige um cargo com permissão de gestão.</p><Link className="btn btn-ghost" to="/selecionar-clube">Voltar aos clubes</Link></div>;
  if (modo !== 'gestao') return <div className="public-access-state" role="status">Abrindo a gestão do clube…</div>;
  return <>{children}</>;
}
export function AccessRequired() {
  return <div className="public-access-state"><Icon name="user" size={28} /><h2>Entre para continuar</h2><p>Esta área é pessoal. Os clubes e as partidas continuam disponíveis sem uma conta.</p><Link className="btn btn-primary" to="/login" onClick={() => rememberAccess()}>Entrar</Link><p><Link to="/selecionar-clube">Explorar clubes</Link></p></div>;
}
export function WorkspaceAccess({ children }: { children: ReactNode }) {
  const { clube } = useAuth();
  const { pathname } = useLocation();
  if (!clube && pathname !== '/perfil' && !/^\/partidas\/\d+$/.test(pathname)) return <Navigate to="/selecionar-clube" replace />;
  return <>{children}</>;
}
export function PublicClubEntry() {
  const { clubeId } = useParams();
  const { token, definirClube, mudarModo } = useAuth();
  const [ready, setReady] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true; setError('');
    (async () => {
      const club = await requestJson<Clube>(`/publico/clubes/${clubeId}`);
      const personalized = token ? await fetchClubes().catch(() => []) : [];
      if (!active) return;
      mudarModo('publico'); definirClube(personalized.find(c => c.id === club.id) || club); setReady(clubeId!);
    })().catch(() => { if (active) setError('Não foi possível abrir este clube. Verifique o endereço e tente novamente.'); });
    return () => { active = false; };
  }, [clubeId, token, definirClube, mudarModo]);
  if (error) return <div className="public-access-state" role="alert"><p>{error}</p><Link to="/selecionar-clube">Voltar aos clubes</Link></div>;
  return ready === clubeId ? <Layout /> : <div className="public-access-state" role="status">Abrindo clube…</div>;
}
export function PublicMatchEntry({ children }: { children: ReactNode }) {
  const { id } = useParams();
  const { token, modo, definirClube } = useAuth();
  const [ready, setReady] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (modo === 'gestao') return;
    let active = true; setError('');
    const selected = getClubeId();
    requestJson<GestaoPartida & { clube: Clube }>(`/publico/partidas/${id}${selected ? `?clube_id=${selected}` : ''}`).then(async data => {
      const clubs = token ? await fetchClubes().catch(() => []) : [];
      if (!active) return;
      definirClube(clubs.find(c => c.id === data.clube.id) || data.clube); setReady(id!);
    }).catch(() => { if (active) setError('Não foi possível abrir esta partida.'); });
    return () => { active = false; };
  }, [id, token, modo, definirClube]);
  if (modo === 'gestao' || ready === id) return <>{children}</>;
  return <div className="public-access-state" role={error ? 'alert' : 'status'}><p>{error || 'Abrindo partida…'}</p>{error && <Link to="/selecionar-clube">Voltar aos clubes</Link>}</div>;
}
