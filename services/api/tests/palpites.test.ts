import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import type { AddressInfo } from 'node:net';
import { criarPalpitesRoutes } from '../src/modules/partidas/palpites.routes';
import { registrarPalpite, consultarPalpite, resumirVotos, ErroPalpite } from '../src/modules/partidas/palpites.service';
import { JWT_SECRET, JWT_OPTIONS } from '../src/config/env';

function fixture(legada = false) {
  let status = 'AO_VIVO', revisao = 0, exists = true;
  const votos = new Map<number, string>();
  const vinculos = new Map<string, { papel: string; acesso_todas_categorias: boolean; categorias: { categoria_id: number }[] }>();
  const emitted: { rooms: string[]; event: string; data: any }[] = [];
  const io: any = { to: (rooms: string[]) => ({ emit: (event: string, data: any) => emitted.push({ rooms, event, data }) }) };
  io.of = () => io;
  const partida = () => ({ id: 77, status, palpites_versao: revisao, categoria: { id: 8, clube_id: 2 }, participantes: legada ? [] : [{ clube_id: 2, categoria_id: 8 }, { clube_id: 3, categoria_id: 15 }], mandante: { clube_representado_id: 2 }, visitante: { clube_representado_id: 3 } });
  let serial = Promise.resolve();
  const banco: any = {
    usuario: { findUnique: async ({ where }: any) => where.id > 0 && where.id < 20 ? { versao_sessao: 0 } : null },
    usuarioClube: { findUnique: async ({ where }: any) => {
      const { usuario_id, clube_id } = where.usuario_id_clube_id;
      return vinculos.get(`${usuario_id}:${clube_id}`) ?? null;
    } },
    partida: {
      findUnique: async ({ where, select }: any) => { assert.equal(select.eventos, undefined); assert.equal(select.jogadores_escalonados, undefined); return exists && where.id === 77 ? partida() : null; },
      update: async ({ data }: any) => { assert.deepEqual(data, { palpites_versao: { increment: 1 } }); revisao++; return partida(); },
    },
    votoPartida: {
      findUnique: async ({ where }: any) => votos.has(where.partida_id_usuario_id.usuario_id) ? { escolha: votos.get(where.partida_id_usuario_id.usuario_id) } : null,
      upsert: async ({ create }: any) => { votos.set(create.usuario_id, create.escolha); },
      groupBy: async ({ where }: any) => {
        assert.equal(where.partida_id, 77);
        return ['MANDANTE', 'EMPATE', 'VISITANTE'].map(escolha => ({ escolha, _count: { _all: [...votos.values()].filter(value => value === escolha).length } }));
      },
    },
    $queryRaw: async (sql: TemplateStringsArray, id: number) => { assert.equal(id, 77); assert.match(sql.join('?'), /FOR UPDATE/); },
    $transaction: (fn: (tx: any) => Promise<unknown>) => {
      const result = serial.then(() => fn(banco));
      serial = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  return { banco, io, votos, emitted, vinculos, setStatus: (value: string) => { status = value; }, missing: () => { exists = false; } };
}

test('percentuais: zeros, arredondamento e soma exata de 100', () => {
  assert.deepEqual(resumirVotos({ MANDANTE: 0, EMPATE: 0, VISITANTE: 0 }).percentuais, { MANDANTE: 0, EMPATE: 0, VISITANTE: 0 });
  assert.deepEqual(resumirVotos({ MANDANTE: 1, EMPATE: 1, VISITANTE: 1 }).percentuais, { MANDANTE: 34, EMPATE: 33, VISITANTE: 33 });
  for (let i = 1; i < 50; i++) assert.equal(Object.values(resumirVotos({ MANDANTE: i, EMPATE: 7, VISITANTE: 3 }).percentuais).reduce((a, b) => a + b), 100);
});

test('voto é único por conta, pode mudar e repetir não incrementa a revisão', async () => {
  const f = fixture();
  const first = await registrarPalpite(f.banco, 77, 1, 'MANDANTE');
  assert.equal(first.resultado.total, 1); assert.equal(first.resultado.meuVoto, 'MANDANTE');
  const duplicate = await registrarPalpite(f.banco, 77, 1, 'MANDANTE');
  assert.equal(duplicate.alterado, false); assert.equal(duplicate.resultado.revisao, 1);
  await Promise.all([registrarPalpite(f.banco, 77, 1, 'EMPATE'), registrarPalpite(f.banco, 77, 1, 'VISITANTE'), registrarPalpite(f.banco, 77, 2, 'MANDANTE')]);
  const result = await consultarPalpite(f.banco, 77, 1);
  assert.equal(result.total, 2); assert.equal(result.meuVoto, 'VISITANTE'); assert.equal(result.votos.MANDANTE, 1);
  assert.deepEqual(first.clubes, [2, 3]);
});

test('encerra/cancela a votação e mantém os resultados; consulta pública não retorna escolha privada', async () => {
  const f = fixture(); await registrarPalpite(f.banco, 77, 1, 'MANDANTE');
  for (const status of ['FINALIZADA', 'CANCELADA']) {
    f.setStatus(status);
    await assert.rejects(() => registrarPalpite(f.banco, 77, 2, 'EMPATE'), (erro: unknown) => erro instanceof ErroPalpite && erro.status === 409);
    const result = await consultarPalpite(f.banco, 77);
    assert.equal(result.aberta, false); assert.equal(result.total, 1); assert.equal(result.meuVoto, null);
  }
  f.missing(); await assert.rejects(() => consultarPalpite(f.banco, 77), (e: unknown) => e instanceof ErroPalpite && e.status === 404);
});

test('gestão dos dois lados bloqueia o palpite e mantém o voto de quem está fora do escopo', async () => {
  const f = fixture();
  f.vinculos.set('1:2', { papel: 'TECNICO', acesso_todas_categorias: false, categorias: [{ categoria_id: 8 }] });
  f.vinculos.set('2:3', { papel: 'MESARIO', acesso_todas_categorias: true, categorias: [] });
  f.vinculos.set('3:3', { papel: 'ADMIN', acesso_todas_categorias: false, categorias: [] });
  f.vinculos.set('4:3', { papel: 'TECNICO', acesso_todas_categorias: false, categorias: [{ categoria_id: 8 }] });
  f.vinculos.set('5:4', { papel: 'ADMIN', acesso_todas_categorias: true, categorias: [] });
  f.vinculos.set('6:2', { papel: 'TORCEDOR', acesso_todas_categorias: false, categorias: [] });
  f.vinculos.set('7:3', { papel: 'OLHEIRO', acesso_todas_categorias: true, categorias: [] });

  for (const status of ['AGENDADA', 'PREPARADA', 'AO_VIVO']) {
    f.setStatus(status);
    for (const usuario of [1, 2, 3]) {
      assert.equal((await consultarPalpite(f.banco, 77, usuario)).podeVotar, false);
      await assert.rejects(() => registrarPalpite(f.banco, 77, usuario, 'EMPATE'), (e: unknown) => e instanceof ErroPalpite && e.status === 403);
    }
  }
  assert.equal(f.votos.size, 0);
  for (const usuario of [4, 5, 6, 7, 8]) {
    assert.equal((await registrarPalpite(f.banco, 77, usuario, 'EMPATE')).resultado.podeVotar, true);
  }
  assert.equal((await consultarPalpite(f.banco, 77)).total, 5);

  const legada = fixture(true);
  legada.vinculos.set('1:2', { papel: 'TECNICO', acesso_todas_categorias: false, categorias: [{ categoria_id: 8 }] });
  await assert.rejects(() => registrarPalpite(legada.banco, 77, 1, 'EMPATE'), (e: unknown) => e instanceof ErroPalpite && e.status === 403);
});

test('HTTP: anônimo só consulta; autenticação, validação, identidade e realtime sem dados privados', async t => {
  const f = fixture(), app = express(); app.use(express.json(), criarPalpitesRoutes(f.io, f.banco));
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = async (url: string, body?: unknown, token?: string) => fetch(base + url, {
    method: body ? 'PUT' : 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const token = jwt.sign({ id: 1, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const tecnico = jwt.sign({ id: 2, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  f.vinculos.set('2:3', { papel: 'TECNICO', acesso_todas_categorias: false, categorias: [{ categoria_id: 15 }] });
  const read = await call('/publico/partidas/77/palpite'); assert.equal(read.status, 200); assert.equal(read.headers.get('cache-control'), 'no-store');
  assert.equal((await read.json()).podeVotar, undefined);
  assert.equal((await (await call('/partidas/77/palpite', undefined, tecnico)).json()).podeVotar, false);
  assert.equal((await call('/partidas/77/palpite', { escolha: 'EMPATE' }, tecnico)).status, 403);
  assert.equal((await call('/partidas/77/palpite', { escolha: 'MANDANTE' })).status, 401);
  assert.equal((await call('/partidas/77/palpite', { escolha: 'INVALIDA' }, token)).status, 400);
  assert.equal((await call('/partidas/0/palpite', undefined, token)).status, 400);
  assert.equal((await call('/partidas/77/palpite', { escolha: 'EMPATE' }, 'invalid')).status, 401);
  const changed = await call('/partidas/77/palpite', { escolha: 'MANDANTE', usuario_id: 9 }, token);
  assert.equal(changed.status, 200); assert.equal((await changed.json()).meuVoto, 'MANDANTE'); assert.deepEqual([...f.votos.keys()], [1]);
  assert.equal(f.emitted.length, 2); assert.equal(f.emitted[0].event, 'palpite_atualizado');
  assert.deepEqual(f.emitted[0].rooms, ['clube:2', 'clube:3']);
  for (const emitted of f.emitted) { assert.equal(emitted.data.meuVoto, undefined); assert.equal(emitted.data.usuario_id, undefined); assert.equal(emitted.data.podeVotar, undefined); }
  assert.equal((await (await call('/publico/partidas/77/palpite', undefined, token)).json()).meuVoto, null);
  assert.equal((await (await call('/partidas/77/palpite', undefined, token)).json()).meuVoto, 'MANDANTE');
  f.setStatus('FINALIZADA'); assert.equal((await call('/partidas/77/palpite', { escolha: 'VISITANTE' }, token)).status, 409);
});
