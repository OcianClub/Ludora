import { useEffect, useId, useRef, useState } from 'react';
import type { EscalacaoItem, PerfilJogador } from '../services/api';
import type { GestaoPartida } from '../services/sharedMatches';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { PositionIcon } from './PositionIcon';

function preparationTeams(data: GestaoPartida) {
  return [data.partida.mandante, data.partida.visitante].map((team, index) => {
    const id = index === 0 ? data.partida.mandante_id : data.partida.visitante_id;
    const participant = data.equipes.find(item => item.time_id === id);
    return { id, name: team?.nome || participant?.clube.nome || (index === 0 ? 'Mandante' : 'Visitante'),
      crest: team?.escudo, participant, home: index === 0 };
  });
}

export function MatchPreparationHeader({ data, dirty }: { data: GestaoPartida; dirty: boolean }) {
  const date = new Date(`${data.partida.data.slice(0, 10)}T12:00:00Z`);
  const formattedDate = Number.isNaN(date.getTime()) ? 'Data a definir' : date.toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).replace(/ de /g, ' ').replace(/\./g, '').toUpperCase();
  const teams = preparationTeams(data);
  function renderTeam(team: typeof teams[number]) {
    const ownDraft = team.participant?.id === data.minhaEquipeId && dirty;
    const ready = team.participant?.pronta && !ownDraft;
    const organizer = team.participant?.clube_id === data.organizador.id;
    return <div className="preparation-header-team" key={team.id}>
      <ClubBadge src={team.crest} name={team.name} size={64}/>
      <strong>{team.name}</strong>
      <span className="preparation-header-role">{team.home ? 'Mandante' : 'Visitante'}{organizer && <span className="preparation-organizer"><Icon name="handshake" size={12}/>Organizador</span>}</span>
      <span className={`preparation-header-readiness${ready ? ' is-ready' : ''}`}>
        <Icon name={ready ? 'checkAll' : 'team'} size={15}/>
        <span className="preparation-readiness-label"><span className="preparation-readiness-prefix">{team.participant ? 'Equipe ' : 'Time '}</span>{ready ? 'confirmada' : team.participant ? 'a confirmar' : 'externo'}</span>
      </span>
    </div>;
  }
  return <section className="preparation-context-header" aria-label="Informações da partida">
    {renderTeam(teams[0])}
    <div className="preparation-header-center">
      <span className="preparation-header-category">{data.partida.categoria?.nome?.toUpperCase()}</span>
      <time className="preparation-header-date" dateTime={data.partida.data.slice(0, 10)}>{formattedDate}</time>
      <time className="preparation-header-time" dateTime={data.partida.horario}>{data.partida.horario || 'A definir'}</time>
    </div>
    {renderTeam(teams[1])}
    <p className="preparation-header-location"><Icon name="location" size={17}/>{data.partida.local || 'Local a definir'}</p>
  </section>;
}

export function LineupSwapHelp() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const helpId = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      trigger.current?.focus({ preventScroll: true });
    }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div className="lineup-help-details" ref={container} onBlur={event => {
    if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
  }}>
    <button type="button" ref={trigger} aria-expanded={open} aria-controls={helpId}
      onClick={() => setOpen(value => !value)}>Como trocar</button>
    {open && <p id={helpId}>Arraste o ícone de troca de um convocado sobre outro. Pelo teclado, selecione o ícone do primeiro jogador e depois o do segundo. Isso também permite trocar um titular por um reserva.</p>}
  </div>;
}

type Player = Pick<PerfilJogador, 'id' | 'nome' | 'numCamisa' | 'posicao'>;
export function MatchLineupReview({ data, lineup, players, dirty = false }: { data: GestaoPartida; lineup: EscalacaoItem[]; players: Player[]; dirty?: boolean }) {
  return <div className="preparation-review-teams">{preparationTeams(data).map(team => {
    const own = team.participant?.id === data.minhaEquipeId;
    const visible = own || Boolean(team.participant?.publicada_em);
    const roster = own ? lineup : visible ? team.participant?.escalacao || [] : [];
    return <section className="preparation-review-team" aria-label={`Escalação do ${team.name}`} key={team.id}>
      <header className="review-team-heading"><ClubBadge src={team.crest} name={team.name} size={32}/><div className="review-team-identity"><h3>{team.name}</h3><span>{team.participant ? `${own ? 'Sua equipe' : 'Adversário'} · ${team.participant.pronta && !(own && dirty) ? 'Confirmada' : 'A confirmar'}` : 'Time externo'}</span></div></header>
      {!visible ? <p className="review-team-unavailable"><Icon name="info" size={18}/><span>{team.participant ? 'Aguardando o clube publicar a escalação. Os rascunhos são privados.' : 'Adversário fora do Ludora. A escalação não está disponível no sistema.'}</span></p>
        : <div className="preparation-review-lists">{[true, false].map(starter => {
          const selected = roster.filter(player => player.titular === starter);
          return <section key={String(starter)}><h4>{starter ? 'Titulares' : 'Reservas'}<span>{starter ? `${selected.length}/${data.partida.titulares_necessarios || 5}` : selected.length}</span></h4>
            <ul>{selected.map(item => {
              const player = own ? players.find(player => player.id === item.jogador_id) || item.jogador : item.jogador;
              return <li key={item.jogador_id}><span className="review-player-shirt">{String(item.numCamisa).padStart(2, '0')}</span>
                <div><strong>{player?.nome || 'Jogador'}</strong>{player?.posicao && <span className="lineup-position"><PositionIcon position={player.posicao}/>{player.posicao}</span>}</div>
              </li>;
            })}</ul>
            {!selected.length && <p className="lineup-empty">{starter ? 'Nenhum titular convocado.' : 'Nenhum reserva convocado.'}</p>}
          </section>;
        })}</div>}
    </section>;
  })}</div>;
}
