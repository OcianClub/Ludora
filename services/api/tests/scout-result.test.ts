import assert from 'node:assert/strict';
import { test } from 'node:test';
import axios from 'axios';
import { validarResultadosScout } from '../src/services/scout-result';

const resultado = (id = 1) => ({ jogador_id: id, perfil_ml: 'Armador', nota_geral: 40, scores: { finalizacao: 20, visao_de_jogo: 80, defesa: 0, disciplina: 100, intensidade: 0, tecnica: 40 } });

test('Scout aceita somente resultado completo dos atletas enviados ao serviço', () => {
  assert.deepEqual(validarResultadosScout([resultado(1), resultado(2)], new Set([1, 2])), [resultado(1), resultado(2)]);
  for (const rows of [[], [resultado(3)], [resultado(1), resultado(1)], [{ ...resultado(), nota_geral: NaN }], [{ ...resultado(), scores: { ...resultado().scores, defesa: -1 } }], [{ ...resultado(), perfil_ml: 'Desconhecido' }]]) {
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
  replace(prisma.jogador, 'findMany', async (args: any) => { consulta = args; return [1, 2, 3].map(id => ({ id, _count: { escalacoes: 8 } })); });
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
  assert.equal(enviado[0].nome, undefined);
  assert.equal(config.headers['X-ML-API-Key'], 'chave-somente-teste');
  assert.equal(config.maxRedirects, 0);
  assert.equal(escritas.length, 3);
  escritas.length = 0;
  replace(axios, 'post', async () => ({ data: [resultado(999), resultado(2), resultado(3)] }));
  await processarMachineLearning(7);
  assert.equal(escritas.length, 0, 'resposta com ID de outro clube não pode gravar');
});
