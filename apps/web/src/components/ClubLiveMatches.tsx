import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { BASE_URL, requestJson, type Clube } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { dataHome, hojeCalendario } from '../utils/homeDashboard';
import { teamName } from '../utils/teamIdentity';
import './ClubLiveMatches.css';

type LiveMatch = { id: number; data: string; horario: string | null; categoria: string; clube_ids: number[];
  gols_mandante: number; gols_visitante: number; mandante: { nome: string; escudo?: string }; visitante: { nome: string; escudo?: string } };

export function ClubLiveMatches({ clubs }: { clubs: Clube[] }) {
  const { token, clubeSelecionado } = useAuth();
  const [matches, setMatches] = useState<LiveMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const refreshRef = useRef<() => void>(() => {});
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ overflow: false, start: true, end: false });
  const ordered = useMemo(() => {
    const followed = new Set(clubs.filter(c => c.meuPapel || c.isSeguindo).map(c => c.id));
    return [...matches].sort((a, b) => Number(b.clube_ids.some(id => followed.has(id))) - Number(a.clube_ids.some(id => followed.has(id))));
  }, [matches, clubs]);

  useEffect(() => {
    let active = true, running = false, queued = false;
    const controller = new AbortController();
    async function refresh(recheck = false) {
      if (running) { queued ||= recheck; return; }
      running = true;
      do {
        queued = false;
        try {
          const rows = await requestJson<LiveMatch[]>('/publico/partidas/ao-vivo', { signal: controller.signal });
          if (!Array.isArray(rows)) throw Error('Resposta inválida');
          if (active) { setMatches(rows); setError(false); }
        } catch { if (active) setError(true); }
      } while (active && queued);
      running = false;
      if (active) setLoading(false);
    }
    const update = () => { if (!document.hidden) void refresh(true); };
    refreshRef.current = update;
    const socket = io(`${BASE_URL}/publico`, { auth: { descoberta: true } });
    let connected = false;
    socket.on('ao_vivo_alterado', update);
    socket.on('connect', () => { if (connected) update(); connected = true; });
    const initial = window.setTimeout(() => void refresh(), 0);
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 30000);
    document.addEventListener('visibilitychange', update);
    window.addEventListener('online', update);
    return () => {
      active = false; controller.abort(); clearTimeout(initial); clearInterval(timer);
      socket.removeAllListeners(); socket.disconnect();
      document.removeEventListener('visibilitychange', update); window.removeEventListener('online', update);
    };
  }, [token]);

  useEffect(() => {
    const element = track.current;
    if (!element) return;
    const measure = () => setEdges({ overflow: element.scrollWidth > element.clientWidth + 2,
      start: element.scrollLeft <= 2, end: element.scrollLeft + element.clientWidth >= element.scrollWidth - 2 });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    measure(); element.addEventListener('scroll', measure, { passive: true });
    return () => { observer.disconnect(); element.removeEventListener('scroll', measure); };
  }, [ordered.length, loading, error]);

  function move(direction: number) {
    const element = track.current;
    if (!element) return;
    element.scrollBy({ left: direction * (element.querySelector('a')?.getBoundingClientRect().width || element.clientWidth) + direction * 12,
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
  }
  function clubFor(match: LiveMatch) {
    const manager = (club: Clube) => ['ADMIN', 'TECNICO', 'MESARIO'].includes(club.meuPapel || '');
    if (clubeSelecionado && match.clube_ids.includes(clubeSelecionado.id) && manager(clubeSelecionado)) return clubeSelecionado.id;
    return clubs.find(club => match.clube_ids.includes(club.id) && manager(club))?.id
      || (clubeSelecionado && match.clube_ids.includes(clubeSelecionado.id) ? clubeSelecionado.id : match.clube_ids[0]);
  }
  if (!loading && !error && !matches.length) return null;
  return <section className="club-picker-section club-live-section" aria-labelledby="club-live-title">
    <h2 id="club-live-title"><Icon name="broadcast" size={18}/>Ao vivo no Ludora</h2>
    {loading && !matches.length ? <div className="club-live-loading" role="status" aria-label="Carregando partidas ao vivo">{[1, 2, 3].map(id => <span key={id}/>)}</div> : <>
      {matches.length > 0 && <div className="club-live-carousel">
        {edges.overflow && <button type="button" className="club-live-prev" aria-label="Partidas ao vivo anteriores" aria-controls="club-live-track" disabled={edges.start} onClick={() => move(-1)}><Icon name="chevronLeft" size={20}/></button>}
        <div className="club-live-track" id="club-live-track" ref={track} role="region" aria-label="Partidas ao vivo" aria-roledescription="carrossel" tabIndex={edges.overflow ? 0 : undefined}
          onKeyDown={event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); move(event.key === 'ArrowRight' ? 1 : -1); } }}>
          {ordered.map(match => <Link key={match.id} className="club-live-match" to={`/partidas/${match.id}?clube_id=${clubFor(match)}`}
            aria-label={`Acompanhar ${teamName(match.mandante.nome)} ${match.gols_mandante} a ${match.gols_visitante} ${teamName(match.visitante.nome)}, ${match.categoria}`}>
            <div className="club-live-meta"><small>{match.categoria.toUpperCase()}</small></div>
            <div className="club-live-scoreboard">
              <div><ClubBadge src={match.mandante.escudo} name={teamName(match.mandante.nome)} size={38}/><strong>{teamName(match.mandante.nome)}</strong></div>
              <b>{match.gols_mandante}<span aria-hidden="true">–</span>{match.gols_visitante}</b>
              <div><ClubBadge src={match.visitante.escudo} name={teamName(match.visitante.nome)} size={38}/><strong>{teamName(match.visitante.nome)}</strong></div>
            </div>
            <div className="club-live-footer"><time dateTime={match.data}>{match.data.slice(0, 10) === hojeCalendario() ? 'Hoje' : dataHome(match.data)}{match.horario ? ` · ${match.horario}` : ''}</time><Icon name="chevronRight" size={16}/></div>
          </Link>)}
        </div>
        {edges.overflow && <button type="button" className="club-live-next" aria-label="Próximas partidas ao vivo" aria-controls="club-live-track" disabled={edges.end} onClick={() => move(1)}><Icon name="chevronRight" size={20}/></button>}
      </div>}
      {error && <p className="club-live-error" role="status">Não foi possível atualizar os jogos ao vivo. <button type="button" onClick={() => refreshRef.current()}>Tentar novamente</button></p>}
    </>}
  </section>;
}
