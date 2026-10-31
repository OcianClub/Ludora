import { useMemo, useState } from 'react';
import type { GestaoPartida } from '../services/sharedMatches';
import { Icon } from './Icon';
import { PositionIcon } from './PositionIcon';
import { eventAuthorTeam } from '../utils/matchEvents';

export function PublishedLineups({ data, statistics = false }: { data: GestaoPartida; statistics?: boolean }) {
  const [selected, setSelected] = useState<number | null>(null);
  const sides = [
    { ...data.partida.mandante, id: data.partida.mandante_id },
    { ...data.partida.visitante, id: data.partida.visitante_id },
  ];
  const equipe =
    data.equipes.find((team) => team.time_id === (selected ?? data.equipes.find(team => team.id === data.minhaEquipeId)?.time_id ?? sides[0].id));
  const activeId = selected ?? equipe?.time_id ?? sides[0].id;
  const totals = useMemo(() => {
    const result = new Map<string, Record<string, number>>();
    for (const event of data.eventos) {
      if (!event.jogador_id || (event.tipo === 'GOL' && event.gol_contra)) continue;
      const key = `${eventAuthorTeam(data, event)}:${event.jogador_id}`;
      const counts = result.get(key) || {};
      counts[event.tipo] = (counts[event.tipo] || 0) + 1;
      result.set(key, counts);
    }
    return result;
  }, [data.eventos, data.partida.mandante_id, data.partida.visitante_id]);
  return (
    <section className={`lineup-groups published-lineups${statistics ? ' with-statistics' : ''}`} aria-label="Escalações das equipes">
      <div className="shared-lineup-tabs" role="group" aria-label="Escolher equipe">
        {sides.map((team) => (
          <button
            type="button"
            key={team.id}
            aria-pressed={team.id === activeId}
            onClick={() => setSelected(team.id)}
            onKeyDown={event => {
              if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
              event.preventDefault();
              const other = sides.find(side => side.id !== activeId)!;
              setSelected(other.id);
              event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('button')[sides.indexOf(other)]?.focus();
            }}
          >
            <Icon name="team" size={17} />
            {team.nome}
          </button>
        ))}
      </div>
      {!equipe || !equipe.publicada_em ? (
        <p className="lineup-empty">{equipe ? `O ${equipe.clube.nome} ainda não publicou a escalação.` : sides.find(team => team.id === activeId)?.clube_representado_id ? 'Este clube está no Ludora, mas ainda não possui escalação vinculada a este confronto. A equipe deve ser vinculada pelo fluxo de solicitação de partida.' : 'Equipe externa: não há escalação cadastrada no Ludora.'}</p>
      ) : (
        <div className="lineup-columns">
          {[true, false].map((titular) => {
            const players = equipe.escalacao.filter((player) => player.titular === titular);
            const offset = titular ? 0 : equipe.escalacao.filter((player) => player.titular).length;
            return (
              <section key={String(titular)}>
                <h2>
                  {titular ? 'Em campo' : 'Reservas'}
                  <span>{players.length}</span>
                </h2>
                {players.map((player, index) => (
                  <div className="lineup-row" key={player.jogador_id}>
                    {!statistics && <span className="lineup-order">{offset + index + 1}</span>}
                    <span className="lineup-shirt">
                      {String(player.numCamisa).padStart(2, '0')}
                    </span>
                    <div className="lineup-player">
                      <strong title={player.jogador?.nome}>{player.jogador?.nome}</strong>
                      <span className="lineup-position">
                        <PositionIcon position={player.jogador?.posicao || ''} />
                        {player.jogador?.posicao}
                      </span>
                    </div>
                    {!statistics && titular && <span className="lineup-starter-tag">Titular</span>}
                    {statistics && <div className="live-player-statistics" aria-label={`Estatísticas de ${player.jogador?.nome}`}>
                      {[
                        ['GOL', 'GOL', 'Gols'], ['ASSISTENCIA', 'AST', 'Assistências'],
                        ['FALTA', 'FAL', 'Faltas'], ['CARTAO_AMARELO', 'AMA', 'Cartões amarelos'],
                        ...(['DEFESA', 'CARTAO_VERMELHO', 'CARTAO_AZUL'].filter(type => (totals.get(`${equipe.time_id}:${player.jogador_id}`)?.[type] || 0) > 0).map(type => [type, type === 'DEFESA' ? 'DEF' : type === 'CARTAO_AZUL' ? 'AZU' : 'VER', type === 'DEFESA' ? 'Defesas' : type === 'CARTAO_AZUL' ? 'Cartões azuis' : 'Cartões vermelhos'])),
                      ].map(([type, label, title]) => <span key={type} title={title} aria-label={`${title}: ${totals.get(`${equipe.time_id}:${player.jogador_id}`)?.[type] || 0}`}><b>{totals.get(`${equipe.time_id}:${player.jogador_id}`)?.[type] || 0}</b><small>{label}</small></span>)}
                    </div>}
                  </div>
                ))}
                {!players.length && <p className="lineup-empty">Nenhum reserva convocado.</p>}
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
