import type { GestaoPartida } from '../services/sharedMatches';
import { Icon } from './Icon';

export function MatchPreparationStatus({ data }: { data: GestaoPartida }) {
  const ready = data.equipes.filter(team => team.pronta).length;
  const operator = data.equipes.find(team => team.clube_id === data.partida.sumula_clube_id)?.clube.nome || data.organizador.nome;
  const preparing = ['AGENDADA', 'PREPARADA'].includes(data.partida.status);
  return <section className={`match-coordination${preparing ? '' : ' is-active'}`} aria-label="Organização e preparação das equipes">
    <div className="match-ownership"><span className="match-ownership-icon"><Icon name="handshake" size={21}/></span>
      <div><strong>Organizada por {data.organizador.nome}</strong><p>{data.podeSumula ? 'Seu clube controla o placar e os eventos da partida.' : `Placar e eventos sob responsabilidade do ${operator}.`}</p></div>
    </div>
    {preparing && <div className="match-readiness" role="status">
      <div className="match-readiness-heading"><span>Preparação das equipes</span><small>{ready} de {data.equipes.length} {data.equipes.length === 1 ? 'pronta' : 'prontas'}</small></div>
      <div className="match-readiness-teams">{data.equipes.map(team => <div key={team.id} className={`match-team-readiness${team.pronta ? ' is-ready' : ''}`}>
        <Icon name={team.pronta ? 'checkAll' : 'clock'} size={18}/><span><strong>{team.clube.nome}</strong><small>{team.pronta ? 'Equipe pronta' : 'Aguardando confirmação'}</small></span>
      </div>)}</div>
    </div>}
  </section>;
}

export { PublishedLineups } from './PublishedLineups';
export { MatchLiveBoard as MatchOperations } from './MatchLiveBoard';
