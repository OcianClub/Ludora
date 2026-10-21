import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resumirPartidas } from '../src/utils/resumoPartidas';

test('Home desempata horários iguais de forma consistente, mesmo com resposta reduzida ou fora de ordem', () => {
  const base = {
    data: '2026-10-20',
    horario: '18:00',
    emCasa: true,
    gols_mandante: 1,
    gols_visitante: 0,
  };
  const partidas = [8, 3, 6, 2, 1, 7, 5, 4].map((id) => ({
    ...base,
    id,
    status: 'FINALIZADA',
  }));
  partidas.push(
    ...[11, 9, 10].map((id) => ({ ...base, id, status: 'AGENDADA' }))
  );
  partidas.push(...[13, 12].map((id) => ({ ...base, id, status: 'AO_VIVO' })));
  const resumo = resumirPartidas(partidas, new Date(2026, 9, 20));
  assert.deepEqual(
    resumo.historico.map((p) => p.id),
    [1, 2, 3, 4, 5]
  );
  assert.equal(resumo.proximoJogo?.id, 12);
  assert.deepEqual(
    resumo.agenda.map((p) => p.id),
    [9, 10]
  );
  const reduzida = resumirPartidas(
    [...resumo.historico, resumo.proximoJogo!, ...resumo.agenda],
    new Date(2026, 9, 20)
  );
  assert.deepEqual(reduzida.historico, resumo.historico);
  assert.deepEqual(reduzida.proximoJogo, resumo.proximoJogo);
  assert.deepEqual(reduzida.agenda, resumo.agenda);
});
