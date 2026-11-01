import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AddressInfo } from 'node:net';
import express from 'express';
import jwt from 'jsonwebtoken';
import { Server } from 'socket.io';

import { JWT_OPTIONS, JWT_SECRET } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { criarPartidaRoutes } from '../src/modules/partidas/partida.routes';
import membrosRoutes from '../src/modules/clubes/membros.routes';
import vinculosRoutes from '../src/modules/clubes/vinculo-time.routes';
import jogadoresRoutes from '../src/modules/jogadores/jogador.routes';

test('consultas alternativas respeitam categorias e falhas de persistência não expõem detalhes', async t => {
  let role = 'TECNICO';
  let grouped = 0;
  let failPersistence = false;
  const secret = 'postgres://usuario:senha@interno QUERY prisma.jogador';
  const players = [{ id: 1, categoria_id: 9, clube_id: 2 }, { id: 2, categoria_id: 10, clube_id: 2 }];
  function replace(target: any, key: string, value: any) {
    const previous = target[key];
    target[key] = value;
    t.after(() => { target[key] = previous; });
  }
  replace(prisma.usuario, 'findUnique', async () => ({ versao_sessao: 0 }));
  replace(prisma.clube, 'findUnique', async () => ({ id: 2 }));
  replace(prisma.usuarioClube, 'findUnique', async () => ({
    id: 1, papel: role, acesso_todas_categorias: false, categorias: [{ categoria_id: 9 }],
  }));
  replace(prisma.jogador, 'count', async ({ where }: any) => {
    const player = players.find(value => value.id === where.id);
    return player && player.clube_id === where.categoria.clube_id &&
      (!where.categoria_id || where.categoria_id.in.includes(player.categoria_id)) ? 1 : 0;
  });
  replace(prisma.jogador, 'findFirst', async () => ({ categoria_id: 9 }));
  replace(prisma.evento, 'groupBy', async () => { grouped++; return [{ tipo: 'GOL', _count: { tipo: 2 } }]; });
  replace(prisma, '$transaction', async () => { throw new Error(secret); });
  replace(prisma.escalacaoPartida, 'count', async () => {
    if (failPersistence) throw new Error(secret);
    return 0;
  });

  const app = express();
  app.use(express.json(), criarPartidaRoutes(new Server()), membrosRoutes, vinculosRoutes, jogadoresRoutes);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  t.after(() => new Promise<void>(resolve => server.close(() => resolve())));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const token = jwt.sign({ id: 1, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const request = (path: string, method = 'GET', body?: unknown, club = 2) => fetch(base + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'x-clube-id': String(club), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  await t.test('técnico consulta apenas atleta de categoria permitida; outro clube e IDs inválidos são recusados', async () => {
    assert.equal((await request('/jogadores/1/estatisticas')).status, 200);
    assert.equal((await request('/jogadores/2/estatisticas')).status, 404);
    assert.equal((await request('/jogadores/1/estatisticas', 'GET', undefined, 3)).status, 404);
    assert.equal((await request('/jogadores/abc/estatisticas')).status, 400);
    assert.equal(grouped, 1, 'nenhum agregado é consultado depois de acesso recusado');
  });
  await t.test('administrador e consulta pública preservam os respectivos acessos existentes', async () => {
    role = 'ADMIN';
    assert.equal((await request('/jogadores/2/estatisticas')).status, 200);
    role = 'TORCEDOR';
    assert.equal((await request('/jogadores/2/estatisticas')).status, 200);
    assert.equal(grouped, 3);
  });
  await t.test('exceções de banco em membros, vínculos e exclusão não chegam à resposta', async () => {
    role = 'ADMIN';
    failPersistence = true;
    const responses = await Promise.all([
      request('/membros/5', 'PATCH', { papel: 'TECNICO', categoria_ids: [9] }),
      request('/times/vinculo', 'PATCH', { time_ids: [20], clube_id: 3, motivo: 'Correção de identidade' }),
      request('/jogadores/1', 'DELETE'),
    ]);
    for (const response of responses) {
      assert.equal(response.status, 500);
      const text = await response.text();
      assert.doesNotMatch(text, /postgres|senha|prisma|QUERY/);
      assert.match(text, /Não foi possível/);
    }
  });
});
