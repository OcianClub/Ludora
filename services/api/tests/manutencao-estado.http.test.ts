import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import express from 'express';
import jwt from 'jsonwebtoken';
import { JWT_OPTIONS, JWT_SECRET } from '../src/config/env';
import { prisma } from '../src/lib/prisma';
import { criarManutencaoRoutes } from '../src/modules/manutencao/routes';

test('estado de manutenção mostra apenas pausas ativas globais e do clube gerenciado', async t => {
  const pausas = [
    { escopo: 'GLOBAL', alvoId: 0, ativa: true, operacao: 'ENVIAR_CONVITES', motivo: 'Revisão global de convites' },
    { escopo: 'CLUBE', alvoId: 3, ativa: true, operacao: 'CRIAR_PARTIDAS', motivo: 'Revisão da agenda do clube' },
    { escopo: 'CLUBE', alvoId: 4, ativa: true, operacao: 'CRIAR_PARTIDAS', motivo: 'Revisão de outro clube' },
    { escopo: 'CLUBE', alvoId: 3, ativa: false, operacao: 'ENVIAR_CONVITES', motivo: 'Pausa já encerrada' },
    { escopo: 'EVENTO', alvoId: 3, ativa: true, operacao: 'AGENDA_OFICIAL', motivo: 'Revisão de evento oficial' },
  ];
  function substituir<T extends object, K extends keyof T>(model: T, method: K, replacement: (...args: never[]) => unknown) {
    const original = model[method];
    model[method] = replacement as T[K];
    t.after(() => { model[method] = original; });
  }
  substituir(prisma.usuario, 'findUnique', () => ({ versao_sessao: 0, suspenso: false }));
  substituir(prisma.usuarioClube, 'findUnique', ({ where }: Prisma.UsuarioClubeFindUniqueArgs) => {
    const target = where.usuario_id_clube_id;
    if (target?.clube_id !== 3) return null;
    return { papel: target.usuario_id === 1 ? 'ADMIN' : 'VISITANTE' };
  });
  substituir(prisma.manutencao, 'findMany', ({ where, select }: Prisma.ManutencaoFindManyArgs) => pausas
    .filter(pausa => pausa.ativa === where?.ativa && where?.OR?.some(escopo =>
      escopo.escopo === pausa.escopo && (escopo.alvoId === undefined || escopo.alvoId === pausa.alvoId)))
    .map(pausa => Object.fromEntries(Object.entries(pausa).filter(([key]) => select?.[key as keyof typeof select]))));
  const app = express();
  app.use(criarManutencaoRoutes());
  const server = app.listen(0, '127.0.0.1');
  t.after(() => server.close());
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const consultar = (clube: number, token?: string) => fetch(base + '/manutencao/estado', {
    headers: { 'x-clube-id': String(clube), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  const token = (id: number) => jwt.sign({ id, versao_sessao: 0 }, JWT_SECRET, JWT_OPTIONS);
  const global = { escopo: 'GLOBAL', operacao: 'ENVIAR_CONVITES', motivo: 'Revisão global de convites', label: 'Criação e reenvio de convites' };
  const clube = { escopo: 'CLUBE', operacao: 'CRIAR_PARTIDAS', motivo: 'Revisão da agenda do clube', label: 'Criação de partidas' };
  for (const [clubeId, credencial] of [[3, undefined], [3, 'inválido'], [3, token(2)], [4, token(1)]] as const) {
    const response = await consultar(clubeId, credencial);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.deepEqual(await response.json(), [global]);
  }
  const response = await consultar(3, token(1));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [global, clube]);
});
