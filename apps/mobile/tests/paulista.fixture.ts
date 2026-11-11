import type { EventoPublicoPaulista } from '../src/utils/paulista';
/** Publicação fictícia e determinística. Nenhuma conexão à API ou à federação. */
export function paulistaFixture(): EventoPublicoPaulista[] {
  const equipes = Array.from({ length: 24 }, (_, i) => ({ id: i + 1, nome: i === 11 ? 'OCIAN PRAIA CLUBE' : `Equipe ${i + 1} com nome longo`, escudo: null }));
  const classificacao = equipes.map((e, i) => ({ faseId: 'initial', fase: 'FASE DE CLASSIFICAÇÃO', grupo: 'CHAVE ÚNICA', equipeId: e.id, posicao: i + 1, pontos: e.id === 12 ? 33 : 25 - i, jogos: 23, vitorias: 10, empates: 3, derrotas: 10, golsPro: 74, golsContra: 59, saldo: 15 }));
  const jogo = (id: string, fase: string, a: number, b: number, golsMandante: number, golsVisitante: number, data: string) => ({ id, faseId: id, fase, mandanteId: a, visitanteId: b, golsMandante, golsVisitante, data, horario: '19:30', local: 'Ginásio de teste', sumulaId: null, ocorrencia: null });
  const jogos = ['OURO', 'PRATA', 'BRONZE'].flatMap((chave, index) => Array.from({ length: 4 }, (_, i) => jogo(`q${index}-${i}`, `QUARTAS DE FINAIS - ${chave}`, index * 8 + i * 2 + 1, index * 8 + i * 2 + 2, 3, 0, '2026-09-06')));
  const own = jogos.find(j => j.visitanteId === 12)!;
  own.mandanteId = 12; own.visitanteId = 13;
  jogos.find(j => j.mandanteId === 13)!.mandanteId = 11;
  jogos.push(jogo('semi', 'SEMIFINAL - PRATA', 9, 12, 6, 4, '2026-09-13'), jogo('final', 'FINAL - PRATA', 9, 15, 4, 3, '2026-09-20'));
  const evento = { id: 900, ano: 2026, categoria: 'SUB-7', divisao: 'A2', fonte: 'https://eventos.admfutsal.com.br/evento/900', equipes, classificacao, jogos, equipesClube: [12], verificadoEm: '2026-11-10T12:00:00Z' };
  return [evento, { ...evento, id: 901, categoria: 'SUB-8', jogos: [], fonte: 'https://eventos.admfutsal.com.br/evento/901' }, { ...evento, id: 800, ano: 2025, jogos: [], fonte: 'https://eventos.admfutsal.com.br/evento/800' }];
}
