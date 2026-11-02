import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  contextoScoutValido,
  formatarMediaScout,
  resumirContextoScout,
  observacoesContextoScout,
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

test('insights descrevem apenas o recorte e não comparam grupos incompletos ou dados provisórios', () => {
  assert.match(observacoesContextoScout(contexto(0))[0].titulo, /sem registros/);
  const parcial = observacoesContextoScout(contexto(4));
  assert.ok(parcial.some(o => o.texto.includes('4 de 10')));
  assert.ok(!parcial.some(o => o.texto.includes('A média passou')));
  const completo = observacoesContextoScout(contexto(25));
  assert.ok(completo.some(o => o.texto.includes('1,00 para 2,00')));
  const vivo = contexto(10);
  vivo.recorte = { tipo: 'partida', provisorio: true, ano: null, partida_id: 1, competicao_id: null };
  assert.ok(!observacoesContextoScout(vivo).some(o => o.texto.includes('A média passou')));
});

test('contrato v2 rejeita seletores, eventos e modelo inválidos antes de renderizar', () => {
  const valido: ContextoScout = {
    ...contexto(0), versao: 2,
    recorte: { tipo: 'geral', provisorio: false, ano: null, partida_id: null, competicao_id: null },
    totais: { convocacoes: 0, titularidades: 0, titularidades_desconhecidas: 0, gols: 0, assistencias: 0,
      defesas: 0, faltas: 0, amarelos: 0, vermelhos: 0, azuis: 0, gols_contra: 0 },
    opcoes: { partidas: [], competicoes: [] }, por_tempo: [], semelhantes: [], modelo: null,
  };
  assert.equal(contextoScoutValido(valido, 1), true);
  for (const invalido of [
    { ...valido, opcoes: { partidas: [null], competicoes: [] } },
    { ...valido, por_tempo: [{ periodo: 1, gols: -1, assistencias: 0, defesas: 0 }] },
    { ...valido, semelhantes: [{ id: 1, nome: 'Mesmo atleta', numCamisa: null }] },
    { ...valido, modelo: { versao: 2, calculado_em: 'sem data', grupo_tamanho: 5 } },
    { ...valido, totais: { ...valido.totais, gols: undefined } },
    { ...valido, total_partidas: 1, partidas: [{ ...contexto(1).partidas[0], status: 'FINALIZADA', eventos: [{ id: 1, tipo: 'GOL', periodo: -1, minuto: null, gol_contra: false }] }] },
  ]) assert.equal(contextoScoutValido(invalido, 1), false);
});
