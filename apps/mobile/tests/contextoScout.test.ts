import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contextoScoutValido,
  formatarMediaScout,
  resumirContextoScout,
  type ContextoScout,
} from '../src/utils/contextoScout';

test('respostas incompletas ou de outro atleta não entram na ficha', () => {
  assert.equal(contextoScoutValido(contexto(5), 1), true);
  assert.equal(contextoScoutValido(contexto(5), 2), false);
  assert.equal(contextoScoutValido({ jogador_id: 1 }, 1), false);
  const dados = contexto(5);
  dados.partidas[0].gols = -1;
  assert.equal(contextoScoutValido(dados, 1), false);
});

function contexto(quantidade: number): ContextoScout {
  return {
    jogador_id: 1,
    total_partidas: quantidade,
    partidas: Array.from({ length: Math.min(quantidade, 10) }, (_, i) => ({
      id: i + 1,
      data: '2026-10-20',
      adversario: 'Adversário',
      gols: i < 5 ? 2 : 1,
      assistencias: 0,
      defesas: i < 5 ? 0 : 3,
    })),
  };
}

test('sem partidas não inventa média zero nem permite comparação', () => {
  const resumo = resumirContextoScout(contexto(0));
  assert.equal(resumo.poucosRegistros, true);
  assert.equal(resumo.podeComparar, false);
  assert.equal(resumo.metricas[0].recente, null);
  assert.equal(formatarMediaScout(null), '—');
});

test('amostra pequena é sinalizada e grupos incompletos não são comparados', () => {
  assert.equal(resumirContextoScout(contexto(4)).poucosRegistros, true);
  assert.equal(resumirContextoScout(contexto(5)).poucosRegistros, false);
  for (const quantidade of [1, 4, 5, 9]) {
    const resumo = resumirContextoScout(contexto(quantidade));
    assert.equal(resumo.podeComparar, false);
    assert.equal(resumo.metricas[0].anterior, null);
    assert.equal(resumo.metricas[1].recente, 0);
  }
  assert.equal(formatarMediaScout(0), '0,00');
});

test('evolução compara cinco contra cinco sem misturar métricas nem alterar a origem', () => {
  const dados = contexto(30);
  const original = structuredClone(dados);
  const resumo = resumirContextoScout(dados);
  assert.equal(resumo.podeComparar, true);
  assert.equal(resumo.metricas[0].recente, 2);
  assert.equal(resumo.metricas[0].anterior, 1);
  assert.equal(resumo.metricas[2].recente, 0);
  assert.equal(resumo.metricas[2].anterior, 3);
  assert.deepEqual(dados, original);
  assert.equal(formatarMediaScout(1 / 3), '0,33');
});
