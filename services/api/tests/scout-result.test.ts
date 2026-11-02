import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { validarResultadosScout } from '../src/services/scout-result';

const resultado = (id = 1) => ({ jogador_id: id, versao: 2, perfil_ml: 'Armador', nota_geral: null,
  scores: { gols_por_convocacao: .2, assistencias_por_convocacao: .8, defesas_por_convocacao: 0 },
  convocacoes: 8, grupo_tamanho: 0, semelhantes: [], metodo: 'v2-registros-por-convocacao' });

test('Scout aceita somente resultado completo dos atletas enviados ao serviço', () => {
  assert.deepEqual(validarResultadosScout([resultado(1), resultado(2)], new Set([1, 2])), [resultado(1), resultado(2)]);
  for (const rows of [[], [resultado(3)], [resultado(1), resultado(1)], [{ ...resultado(), nota_geral: NaN }], [{ ...resultado(), scores: { ...resultado().scores, defesas_por_convocacao: -1 } }], [{ ...resultado(), perfil_ml: 'Desconhecido' }], [{ ...resultado(), semelhantes: [{ jogador_id: 999, distancia: 0 }] }]]) {
    assert.throws(() => validarResultadosScout(rows, new Set(rows.length === 2 ? [1, 2] : [1])));
  }
});

test('Scout agrega eventos no banco, conta escalações e transmite chave sem dados pessoais', async t => {
  process.env.PYTHON_AI_URL = 'http://127.0.0.1:8000';
  process.env.JWT_SECRET ||= 'teste-local-scout-sem-acesso-a-banco';
  process.env.ML_API_KEY = 'chave-somente-teste';
  const { prisma } = await import('../src/lib/prisma.js');
  const { processarMachineLearning } = await import('../src/services/scout-ia.service.js');
  const replace = (obj: any, key: string, fn: any) => { const previous = obj[key]; obj[key] = fn; t.after(() => { obj[key] = previous; }); };
  let consulta: any;
  let agrupar: any;
  let enviado: any;
  let config: any;
  const escritas: any[] = [];
  replace(prisma.jogador, 'findMany', async (args: any) => { consulta = args; return [1, 2, 3].map(id => ({ id, categoria_id: 7, posicao: 'Alas', _count: { escalacoes: 8 } })); });
  replace(prisma.evento, 'groupBy', async (args: any) => { agrupar = args; return [{ jogador_id: 1, tipo: 'GOL', _count: { _all: 42 } }]; });
  replace(axios, 'post', async (_url: string, payload: any, options: any) => { enviado = payload; config = options; return { data: [1, 2, 3].map(resultado) }; });
  replace(prisma.jogador, 'update', (args: any) => { escritas.push(args); return Promise.resolve({}); });
  replace(prisma, '$transaction', async (ops: any[]) => Promise.all(ops));
  await processarMachineLearning(7);
  assert.equal(consulta.where.categoria.clube_id, 7);
  assert.equal(consulta.include, undefined);
  assert.deepEqual(agrupar.by, ['jogador_id', 'tipo']);
  assert.deepEqual(agrupar.where.jogador_id.in, [1, 2, 3]);
  assert.equal(enviado[0].GOL, 42);
  assert.equal(enviado[0].jogos_disputados, 8);
  assert.equal(consulta.select._count.select.escalacoes.where.partida.status, 'FINALIZADA');
  assert.equal(agrupar.where.partida.status, 'FINALIZADA');
  assert.equal(enviado[0].categoria_id, 7);
  assert.equal(enviado[0].nome, undefined);
  assert.equal(config.headers['X-ML-API-Key'], 'chave-somente-teste');
  assert.equal(config.maxRedirects, 0);
  assert.equal(escritas.length, 3);
  assert.equal(escritas[0].data.nota_geral, null);
  assert.equal(escritas[0].data.scores_ml.versao, 2);
  escritas.length = 0;
  replace(axios, 'post', async () => ({ data: [resultado(999), resultado(2), resultado(3)] }));
  await processarMachineLearning(7);
  assert.equal(escritas.length, 0, 'resposta com ID de outro clube não pode gravar');
  replace(prisma.jogador, 'findMany', async () => [1, 2, 3].map(id => ({ id, categoria_id: id === 2 ? 9 : 7, posicao: 'Alas', _count: { escalacoes: 8 } })));
  replace(axios, 'post', async () => ({ data: [
    { ...resultado(1), semelhantes: [{ jogador_id: 2, distancia: .1 }] }, resultado(2), resultado(3),
  ] }));
  await processarMachineLearning(7);
  assert.equal(escritas.length, 0, 'semelhança não pode atravessar categorias');

  let chamadas = 0;
  let release!: () => void;
  const bloqueio = new Promise<void>(resolve => { release = resolve; });
  replace(axios, 'post', async () => {
    chamadas++;
    if (chamadas === 1) await bloqueio;
    return { data: [1, 2, 3].map(resultado) };
  });
  const primeiro = processarMachineLearning(7);
  const segundo = processarMachineLearning(7);
  const terceiro = processarMachineLearning(7);
  assert.equal(primeiro, segundo);
  assert.equal(segundo, terceiro);
  release();
  await Promise.all([primeiro, segundo, terceiro]);
  assert.equal(chamadas, 2, 'disparos simultâneos compartilham o trabalho e fazem uma atualização final');
});
