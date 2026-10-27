import type { Time } from '../services/api';

type Selection = { mandante_id: string; visitante_id: string; emCasa: string };
export function selectMatchTeam(teams: Time[], clubId: number, categoryId: number, side: 'mandante' | 'visitante', teamId: number, current: {mandante_id:string;visitante_id:string}): Selection {
  const available = teams.filter(t => t.categoria_id === categoryId);
  const selected = available.find(t => t.id === teamId);
  if (!selected) throw new Error('Time indisponível nesta categoria.');
  const own = available.filter(t => t.clube_representado_id === clubId);
  if (own.length !== 1) throw new Error('Esta categoria precisa ter exatamente um time vinculado ao seu clube. Confira o cadastro em Times.');
  const otherSide = side === 'mandante' ? 'visitante_id' : 'mandante_id';
  const selectedKey = side === 'mandante' ? 'mandante_id' : 'visitante_id';
  const opposite = available.find(t => String(t.id) === current[otherSide]);
  const previous = available.find(t => String(t.id) === current[selectedKey]);
  const opponent = [opposite, previous].find(t => t && t.id !== own[0].id);
  const otherId = selected.id === own[0].id
    ? (opponent ? String(opponent.id) : '')
    : String(own[0].id);
  return {
    mandante_id: side === 'mandante' ? String(selected.id) : otherId,
    visitante_id: side === 'visitante' ? String(selected.id) : otherId,
    emCasa: String(side === 'mandante' ? selected.id === own[0].id : selected.id !== own[0].id),
  };
}

export function matchHasOwnTeam(home: Time | undefined, away: Time | undefined, clubId: number) {
  return !!home && !!away && home.id !== away.id && (Number(home.clube_representado_id === clubId) + Number(away.clube_representado_id === clubId) === 1);
}
