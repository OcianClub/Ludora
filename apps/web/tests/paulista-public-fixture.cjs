// Publicação controlada de teste. Nenhuma consulta ou escrita no banco/federação.
exports.eventos = function eventos() {
  const equipes = [{ id: 20, nome: 'Ocian', escudo: null }, { id: 30, nome: 'Santos', escudo: null }, { id: 40, nome: 'Aurora FC', escudo: null }];
  const jogo = (id, faseId, fase, mandanteId, visitanteId, a, b) => ({ id, faseId, fase, mandanteId, visitanteId, data: '2026-09-01', horario: '19:30', local: 'Arena de teste', golsMandante: a, golsVisitante: b, sumulaId: null, ocorrencia: null });
  return [7, 8].map((sub, index) => ({ id: 925 + index, ano: 2026, categoria: `SUB-${sub}`, divisao: index ? 'A1' : 'A2', fonte: `https://eventos.admfutsal.com.br/evento/${925 + index}`,
    equipes, equipesClube: [20], verificadoEm: '2026-11-10T12:00:00Z', fasesExcluidas: [],
    jogos: [jogo('q', '1', 'QUARTAS DE FINAIS - PRATA', 20, 30, 3, 0), jogo('s', '2', 'SEMIFINAL PRATA', 20, 40, 1, 2), jogo('f', '3', 'FINAL PRATA', 40, 30, 2, 1)],
    classificacao: equipes.map((e, i) => ({ faseId: '0', fase: 'FASE DE CLASSIFICAÇÃO', grupo: 'CHAVE ÚNICA', equipeId: e.id, posicao: i + 1, pontos: 9 - i, jogos: 5, vitorias: 3, empates: 0, derrotas: 2, golsPro: 8, golsContra: 4, saldo: 4 })),
  }));
};
