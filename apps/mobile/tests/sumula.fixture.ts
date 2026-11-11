import type { GestaoPartida } from '../src/services/partidasCompartilhadas';
export function sumulaFixture(): GestaoPartida {
  return {
    partida: { id: 9876, status: 'AO_VIVO', versao: 1, periodo_atual: 2, data: '2026-11-10', horario: '19:00', titulares_necessarios: 5, sumula_clube_id: 1, organizador_id: 1, mandante_id: 10, visitante_id: 20, gols_mandante: 4, gols_visitante: 1, categoria: { id: 7, nome: 'sub-7' }, mandante: { id: 10, nome: 'Ocian' }, visitante: { id: 20, nome: 'Santos' } },
    organizador: { id: 1, nome: 'Ocian' }, minhaEquipeId: 1, podePreparar: true, podeSumula: true,
    equipes: [1, 2].map((id) => ({ id, clube_id: id, categoria_id: id + 6, time_id: id * 10, pronta: true, publicada_em: '2026-11-10', clube: { id, nome: id === 1 ? 'Ocian' : 'Santos' }, categoria: { id: id + 6, nome: 'sub-7' }, escalacao: Array.from({ length: 7 }, (_, i) => ({ jogador_id: id * 100 + i, numCamisa: i + 1, titular: i < 5, jogador: { nome: `Atleta ${id}-${i}`, posicao: i === 0 || i === 5 ? 'Goleiro' : 'Fixo' } })) })),
    eventos: [
      { id: 1, tipo: 'GOL', time_id: 10, jogador_id: 101, periodo: 1 },
      { id: 2, tipo: 'GOL', time_id: 20, jogador_id: 201, periodo: 1 },
      { id: 3, tipo: 'GOL', time_id: 10, jogador_id: 201, gol_contra: true, periodo: 2 },
      { id: 4, tipo: 'ASSISTENCIA', time_id: 10, jogador_id: 102, periodo: 1 },
    ], auditoria: [{ id: 1, acao: 'EVENTO_REGISTRADO', criado_em: '2026-11-10', dados: { evento_id: 1, assistencia_evento_id: 4 } }],
  };
}
