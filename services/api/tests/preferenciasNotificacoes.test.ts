import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import type { PrismaClient } from '@prisma/client';
import type { Server } from 'socket.io';
import {
  validarPreferenciasPush,
  filtroPushPorTipo,
} from '../src/modules/notificacoes/preferencias.utils';

test('preferências de push não removem o histórico nem os eventos internos', async () => {
  process.env.JWT_SECRET ||= 'segredo-local-dos-testes-notificacoes';
  const { criarNotificacoesDoClube } = await import(
    '../src/services/notificacoes.service.js'
  );
  const salvas: any[] = [];
  const eventos: any[] = [];
  const banco = {
    usuarioClube: {
      async findMany({ where }: any) {
        assert.deepEqual(where, { clube_id: 7 });
        return [{ usuario_id: 1 }, { usuario_id: 2 }];
      },
    },
    notificacao: {
      async create({ data }: any) {
        salvas.push(data);
        return data;
      },
    },
    async $transaction(operacoes: any[]) {
      return Promise.all(operacoes);
    },
  } as unknown as PrismaClient;
  const io = {
    to(sala: string) {
      return {
        emit(evento: string, dados: unknown) {
          eventos.push({ sala, evento, dados });
        },
      };
    },
  } as unknown as Server;
  await criarNotificacoesDoClube(
    { io, clubeId: 7, tipo: 'GOL_PARTIDA', titulo: 'Gol', corpo: '1 a 0' },
    banco,
    async () => {}
  );
  assert.equal(salvas.length, 2);
  assert.equal(eventos.length, 2);
  assert.equal(eventos[0].sala, 'usuario:1');
  assert.equal(eventos[1].sala, 'usuario:2');
  assert.equal(eventos[0].evento, 'notificacao_criada');
});

test('preferências aceitam somente os três campos booleanos e atualização parcial', () => {
  assert.deepEqual(validarPreferenciasPush({ push_gols: false }), {
    push_gols: false,
  });
  for (const body of [
    null,
    [],
    {},
    { push_gols: 'false' },
    { push_gols: 0 },
    { usuario_id: 2 },
    { push_gols: true, clube_id: 4 },
  ]) {
    assert.equal(validarPreferenciasPush(body), null);
  }
  assert.deepEqual(filtroPushPorTipo('GOL_PARTIDA'), { push_gols: true });
  assert.deepEqual(filtroPushPorTipo('PARTIDA_AGENDADA'), {
    push_agendamentos: true,
  });
  assert.deepEqual(filtroPushPorTipo('RESULTADO_PARTIDA'), {
    push_resultados: true,
  });
});

test('preferências listam e alteram somente os vínculos da própria conta', async () => {
  process.env.JWT_SECRET ||= 'segredo-local-dos-testes-notificacoes';
  const { criarPreferenciasNotificacoesRoutes } = await import(
    '../src/modules/notificacoes/preferencias.routes.js'
  );
  const registros = [
    {
      usuario_id: 1,
      clube_id: 2,
      clube: { nome: 'Ludora' },
      push_gols: true,
      push_agendamentos: true,
      push_resultados: true,
    },
    {
      usuario_id: 9,
      clube_id: 3,
      clube: { nome: 'Outro clube' },
      push_gols: true,
      push_agendamentos: true,
      push_resultados: true,
    },
  ];
  const corresponde = (registro: (typeof registros)[number], where: any) =>
    registro.usuario_id === where.usuario_id &&
    (!where.clube_id || registro.clube_id === where.clube_id);
  const banco = {
    usuarioClube: {
      async findMany({ where }: any) {
        return registros.filter((registro) => corresponde(registro, where));
      },
      async updateMany({ where, data }: any) {
        const registro = registros.find((item) => corresponde(item, where));
        if (!registro) return { count: 0 };
        Object.assign(registro, data);
        return { count: 1 };
      },
      async findFirst({ where }: any) {
        return registros.find((registro) => corresponde(registro, where));
      },
    },
  } as unknown as PrismaClient;
  const app = express();
  app.use(express.json());
  app.use(
    criarPreferenciasNotificacoesRoutes(banco, (req, res, next) => {
      if (req.headers.authorization !== 'Bearer teste')
        return void res.sendStatus(401);
      (req as any).usuarioId = 1;
      next();
    })
  );
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const endereco = server.address() as { port: number };
  const base = `http://127.0.0.1:${endereco.port}/notificacoes/preferencias`;
  const headers = {
    Authorization: 'Bearer teste',
    'Content-Type': 'application/json',
  };
  try {
    assert.equal((await fetch(base)).status, 401);
    const lista = (await (await fetch(base, { headers })).json()) as any;
    assert.equal(lista.preferencias.length, 1);
    assert.equal(lista.preferencias[0].clube_id, 2);
    const alterar = (id: number, body: unknown) =>
      fetch(`${base}/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
    const resposta = await alterar(2, { push_gols: false });
    assert.equal(resposta.status, 200);
    const salvo = (await resposta.json()) as any;
    assert.equal(salvo.push_gols, false);
    assert.equal(salvo.push_resultados, true);
    assert.equal((await alterar(3, { push_gols: false })).status, 403);
    assert.equal(registros[1].push_gols, true);
    assert.equal((await alterar(2, { push_gols: 'false' })).status, 400);
    assert.equal((await alterar(2, { usuario_id: 9 })).status, 400);
    assert.equal((await alterar(-1, { push_gols: false })).status, 400);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

test('push exige preferência do evento, clube correto e permissão geral; nenhum dispositivo gera nenhum envio', async () => {
  process.env.JWT_SECRET ||= 'segredo-local-dos-testes-notificacoes';
  const { enviarPushParaUsuarios } = await import(
    '../src/services/notificacoes.service.js'
  );
  let consulta: any;
  let dispositivos: { token: string }[] = [{ token: 'ExpoPushToken[teste]' }];
  const banco = {
    dispositivoPush: {
      async findMany(args: any) {
        consulta = args;
        return dispositivos;
      },
    },
  } as unknown as PrismaClient;
  const envios: any[] = [];
  const enviar = (async (_url, options) => {
    envios.push(JSON.parse(options!.body as string));
    return new Response('{}', { status: 200 });
  }) as typeof fetch;
  for (const [tipo, campo] of [
    ['GOL_PARTIDA', 'push_gols'],
    ['PARTIDA_AGENDADA', 'push_agendamentos'],
    ['RESULTADO_PARTIDA', 'push_resultados'],
  ] as const) {
    await enviarPushParaUsuarios(
      [1, 2],
      7,
      tipo,
      'Título',
      'Corpo',
      { clube_id: 7 },
      banco,
      enviar
    );
    assert.deepEqual(consulta.where, {
      usuario_id: { in: [1, 2] },
      usuario: {
        notificacoes_ativas: true,
        clubes: { some: { clube_id: 7, [campo]: true } },
      },
    });
  }
  assert.equal(envios.length, 3);
  assert.equal(envios[0][0].to, 'ExpoPushToken[teste]');
  dispositivos = [];
  await enviarPushParaUsuarios(
    [1],
    7,
    'GOL_PARTIDA',
    'Título',
    'Corpo',
    undefined,
    banco,
    enviar
  );
  assert.equal(envios.length, 3);
});
