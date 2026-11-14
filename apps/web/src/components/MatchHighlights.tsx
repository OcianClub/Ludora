import { useMemo, useState } from 'react';
import type { GestaoPartida } from '../services/sharedMatches';
import { recordHighlights } from '../utils/matchHighlights';
import { ResponsivePanel } from './ResponsivePanel';
import { Icon } from './Icon';
import './MatchHighlights.css';

export function MatchHighlights({ data, period }: { data: GestaoPartida; period: number | null }) {
  const records = useMemo(() => recordHighlights(data, period), [data, period]);
  const live = data.partida.status === 'AO_VIVO';
  const [ties, setTies] = useState<{ anchor: HTMLButtonElement; title: string; players: { id: number; name: string; shirt: number; teamName: string }[] } | null>(null);
  const showPlayer = (player: { name: string; shirt: number; teamName: string }) => <div className="highlight-player"><span className="highlight-shirt">{String(player.shirt).padStart(2, '0')}</span><div><strong title={player.name}>{player.name}</strong><small title={player.teamName}>{player.teamName}</small></div></div>;
  return <article className="match-highlights" aria-label="Destaques calculados pelo Ludora">
    <header><div><h3>Destaques da partida</h3><small className="highlight-scope">{period === null ? 'Partida inteira' : `${period}º tempo`} · Registros do Ludora</small></div>{live && <small>Provisórios</small>}</header>
    <div className="match-highlights-columns">
      <section className="match-record-highlight" aria-label="Destaques dos registros">
        {(['attack', 'saves'] as const).map(key => {
          const players = records[key];
          return <div className="highlight-category" key={key}>
            <h4><Icon name={key === 'attack' ? 'ball' : 'defense'} size={17} />{key === 'attack' ? 'Participação em gols' : 'Mais defesas'}</h4>
            {players.length ? <>
              <div className="highlight-result">
                {showPlayer(players[0])}
                <dl className="highlight-stats">
                  {key === 'attack' ? <><div><dt>Gols</dt><dd>{players[0].goals}</dd></div><div><dt>Assist.</dt><dd>{players[0].assists}</dd></div></> : <div><dt>{players[0].saves === 1 ? 'Defesa' : 'Defesas'}</dt><dd>{players[0].saves}</dd></div>}
                </dl>
              </div>
              {players.length > 1 && <button type="button" className="highlight-ties" aria-haspopup="dialog" aria-expanded={ties?.players === players} onClick={event => setTies(ties?.players === players ? null : { anchor: event.currentTarget, title: key === 'attack' ? 'Empatados em participação em gols' : 'Empatados em defesas', players })}>Ver +{players.length - 1} {players.length === 2 ? 'atleta empatado' : 'atletas empatados'}<Icon name="chevronRight" size={13} /></button>}
            </> : <p className="highlight-empty">{key === 'attack' ? 'Nenhum gol ou assistência com autoria neste recorte.' : 'Nenhuma defesa com autoria neste recorte.'}</p>}
          </div>;
        })}
        {records.unidentified && <p className="highlight-empty highlight-incomplete"><Icon name="info" size={14} />Há lances sem autoria. Os destaques podem mudar.</p>}
      </section>
    </div>
    <ResponsivePanel anchor={ties?.anchor ?? null} title={ties?.title || 'Atletas empatados'} onClose={() => setTies(null)}><ul className="highlight-tied-list">{ties?.players.map(player => <li key={player.id}>{showPlayer(player)}</li>)}</ul></ResponsivePanel>
  </article>;
}
