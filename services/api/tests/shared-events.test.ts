import test from 'node:test';
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { criarCompartilhadasRoutes } from '../src/modules/partidas/compartilhadas.routes';

test('súmula: gols, pendências, autoria, permissões e reenvio sem acessar banco real', async t => {
  let p: any;
  let events: any[];
  let audits: any[];
  let nextId = 1;
  let correcaoAceita = false;
  const roster = [
    { jogador_id: 101, time_id: 10, titular: true, numCamisa: 1 }, { jogador_id: 102, time_id: 10, titular: true, numCamisa: 2 },
    { jogador_id: 103, time_id: 10, titular: false, numCamisa: 3 }, { jogador_id: 201, time_id: 20, titular: true, numCamisa: 1 },
  ];
  const withPlayer = (event: any) => ({ ...event, jogador: event.jogador_id ? { nome: `Jogador ${event.jogador_id}` } : null });
  function reset() {
    nextId = 1; events = []; audits = []; correcaoAceita = false;
    p = { id: 1, data: new Date('2026-10-30'), horario: '19:30', status: 'AO_VIVO', versao: 0, mandante_id: 10, visitante_id: 20, sumula_clube_id: 2, organizador_id: 2,
      categoria: { clube_id: 2 }, mandante: { nome: 'Ocian', clube_representado_id: 2 }, visitante: { nome: 'Santos', clube_representado_id: 3 },
      participantes: [{ clube_id: 2, time_id: 10, categoria_id: 7 }, { clube_id: 3, time_id: 20, categoria_id: 8 }],
      gols_mandante: 0, gols_visitante: 0, periodo_atual: 1 };
  }
  const tx: any = {
    propostaPartida: { findFirst: async () => correcaoAceita ? { id: 1 } : null },
    partida: {
      findUnique: async () => p,
      updateMany: async ({ where }: any) => { if (where.versao !== p.versao) return { count: 0 }; p.versao++; return { count: 1 }; },
      update: async ({ data }: any) => { for (const [key, value] of Object.entries(data)) p[key] = typeof value === 'object' ? p[key] + ((value as any).increment ?? -(value as any).decrement) : value; return p; },
    },
    usuarioClube: { findUnique: async ({ where }: any) => ({ papel: where.usuario_id_clube_id.usuario_id === 99 ? 'TORCEDOR' : 'ADMIN', categorias: [] }) },
    escalacaoPartida: {
      count: async ({ where }: any) => roster.filter(row => Object.entries(where).every(([key, value]) => key === 'partida_id' || row[key as keyof typeof row] === value)).length,
      findMany: async ({ where }: any) => roster.filter(row => row.time_id === where.time_id && where.jogador_id.in.includes(row.jogador_id)),
      updateMany: async ({ where, data }: any) => {
        assert.equal(where.time_id, 10, 'A substituição deve se limitar ao time atual');
        const rows = roster.filter(row => row.time_id === where.time_id && row.jogador_id === where.jogador_id);
        rows.forEach(row => Object.assign(row, data)); return { count: rows.length };
      },
    },
    evento: {
      create: async ({ data }: any) => { const event = { id: nextId++, ...data }; events.push(event); return withPlayer(event); },
      findUnique: async ({ where }: any) => { const event = events.find(e => e.id === where.id); return event ? withPlayer(event) : null; },
      findFirst: async ({ where }: any) => events.find(e => e.id === where.id && e.partida_id === where.partida_id) || null,
      update: async ({ where, data }: any) => { const event = events.find(e => e.id === where.id); Object.assign(event, data); return withPlayer(event); },
      delete: async ({ where }: any) => { events = events.filter(e => e.id !== where.id); },
      deleteMany: async ({ where }: any) => { events = events.filter(e => e.id !== where.id); },
    },
    auditoriaPartida: {
      create: async ({ data }: any) => { audits.push({ id: audits.length + 1, ...data }); },
      findFirst: async ({ where }: any) => audits.find(a => a.partida_id === where.partida_id && a.acao === where.acao
        && (!where.usuario_id || a.usuario_id === where.usuario_id) && (!where.clube_id || a.clube_id === where.clube_id)
        && a.dados[where.dados.path[0]] === where.dados.equals) || null,
    },
  };
  function replace(target: any, key: string, value: any) { const old = target[key]; target[key] = value; t.after(() => { target[key] = old; }); }
  replace(prisma, '$transaction', async (callback: any) => {
    const snapshot = structuredClone({ p, events, audits });
    try { return await callback(tx); } catch (error) { ({ p, events, audits } = snapshot); throw error; }
  });
  replace(prisma.partida, 'findUniqueOrThrow', async () => p);
  replace(prisma.participantePartida, 'findMany', async () => []);
  replace(prisma.usuarioClube, 'findMany', async () => []);
  const broadcasts: string[] = [];
  const router = criarCompartilhadasRoutes({ of: () => ({ to: () => ({ emit() {} }) }), to: () => ({ emit: (name: string) => broadcasts.push(name) }) } as any);
  async function call(method: string, path: string, body: any, club = 2, eventId?: number, expected = 201, user = club) {
    const layer = (router as any).stack.find((item: any) => item.route?.path === path && item.route.methods[method]);
    let status = 200, result: any;
    const res = { status(code: number) { status = code; return res; }, json(value: any) { result = value; return res; } };
    await layer.route.stack.at(-1).handle({ clubeId: club, usuarioId: user, params: { id: path === '/eventos/:id' ? eventId : 1, eventoId: eventId }, body }, res);
    assert.equal(status, expected, JSON.stringify(result));
    return result;
  }
  const post = '/partidas/:id/eventos', patch = '/partidas/:id/eventos/:eventoId';
  await t.test('gol e assistência são atômicos; repetir envio não duplica o placar ou as notificações', async () => {
    reset(); broadcasts.length = 0;
    const body = { tipo: 'GOL', time_id: 10, jogador_id: 101, assistencia_jogador_id: 102, request_id: 'request-goal-000001', versao: 0 };
    const goal = await call('post', post, body);
    assert.equal(p.gols_mandante, 1); assert.equal(events.length, 2);
    await call('patch', patch, { jogador_id: 102, motivo: 'Correção', versao: p.versao }, 2, goal.id, 400);
    await call('patch', patch, { jogador_id: 101, motivo: 'Correção', versao: p.versao }, 2, events[1].id, 400);
    const count = broadcasts.length;
    assert.equal((await call('post', post, body, 2, undefined, 200)).id, goal.id);
    assert.equal(events.length, 2); assert.equal(p.gols_mandante, 1); assert.equal(broadcasts.length, count);
    await call('post', post, { ...body, jogador_id: 102 }, 2, undefined, 409);
    const removal = { motivo: 'Gol anulado', versao: p.versao, partida_id: p.id, request_id: 'request-remove-000001' };
    await call('delete', '/eventos/:id', removal, 2, goal.id, 200);
    assert.equal(p.gols_mandante, 0); assert.equal(events.length, 0);
    const afterRemoval = broadcasts.length;
    await call('delete', '/eventos/:id', removal, 2, goal.id, 200);
    assert.equal(broadcasts.length, afterRemoval, 'Reenvio da reversão não repete notificações');
    assert.equal(p.gols_mandante, 0);
  });
  await t.test('gol sem autor exige escolha explícita e pode ser identificado depois sem alterar placar', async () => {
    reset();
    await call('post', post, { tipo: 'GOL', time_id: 20 }, 2, undefined, 400);
    const goal = await call('post', post, { tipo: 'GOL', time_id: 20, autor_pendente: true });
    assert.equal(p.gols_visitante, 1); assert.equal(goal.jogador_id, null);
    await call('patch', patch, { jogador_id: 101, versao: p.versao }, 3, goal.id, 400);
    await call('patch', patch, { jogador_id: 201, versao: p.versao }, 4, goal.id, 404);
    await call('patch', patch, { jogador_id: 201, versao: p.versao }, 3, goal.id, 403, 99);
    p.status = 'FINALIZADA';
    await call('patch', patch, { jogador_id: 201, motivo: 'Identificação do autor', versao: p.versao }, 3, goal.id, 403);
    correcaoAceita = true;
    await call('patch', patch, { jogador_id: 201, motivo: 'Identificação do autor', versao: p.versao }, 3, goal.id, 200);
    correcaoAceita = false;
    assert.equal(p.gols_visitante, 1); assert.equal(events.length, 1); assert.equal(events[0].jogador_id, 201);
    await call('patch', patch, { jogador_id: 201, versao: p.versao }, 3, goal.id, 403);
  });
  await t.test('oponente não pode registrar placar; autoria precisa pertencer à equipe correta e estar em campo', async () => {
    reset();
    await call('post', post, { tipo: 'GOL', time_id: 20, jogador_id: 201 }, 3, undefined, 403);
    await call('post', post, { tipo: 'GOL', time_id: 10, jogador_id: 201 }, 2, undefined, 400);
    await call('post', post, { tipo: 'GOL', time_id: 10, jogador_id: 103 }, 2, undefined, 400);
    await call('post', post, { tipo: 'GOL', time_id: 10, jogador_id: 101, assistencia_jogador_id: 101 }, 2, undefined, 400);
    assert.equal(events.length, 0); assert.equal(p.gols_mandante, 0);
  });
  await t.test('gol contra beneficia o adversário e correções de autoria preservam o resultado', async () => {
    reset();
    const goal = await call('post', post, { tipo: 'GOL', time_id: 20, gol_contra: true, jogador_id: 101 });
    assert.equal(p.gols_visitante, 1); assert.equal(goal.gol_contra, true);
    p.status = 'FINALIZADA';
    await call('patch', patch, { jogador_id: 102, versao: p.versao }, 2, goal.id, 400);
    await call('patch', patch, { jogador_id: 102, motivo: 'Camisa identificada', versao: p.versao }, 2, goal.id, 200);
    assert.equal(p.gols_visitante, 1); assert.equal(events[0].jogador_id, 102);
  });
  await t.test('local ao vivo exige responsável, valor válido e versão atual', async () => {
    reset();
    const endpoint = '/partidas/:id/local';
    await call('patch', endpoint, { local: 'Ginásio Ocian', versao: p.versao }, 3, undefined, 403);
    await call('patch', endpoint, { local: ' ', versao: p.versao }, 2, undefined, 400);
    await call('patch', endpoint, { local: 'Ginásio Ocian', versao: 9 }, 2, undefined, 409);
    await call('patch', endpoint, { local: ' Ginásio Ocian ', versao: p.versao }, 2, undefined, 200);
    assert.equal(p.local, 'Ginásio Ocian');
    assert.equal(audits.at(-1).acao, 'LOCAL_DEFINIDO');
    p.status = 'FINALIZADA';
    await call('patch', endpoint, { local: 'Outro local', versao: p.versao }, 2, undefined, 400);
  });
  await t.test('adversário externo registra gol sem atleta e sem exigir pendência', async () => {
    reset(); p.participantes = p.participantes.slice(0, 1); p.visitante = { nome: 'Externo', clube_representado_id: null };
    await call('post', post, { tipo: 'GOL', time_id: 20 });
    assert.equal(p.gols_visitante, 1); assert.equal(events[0].jogador_id, null);
    p.status = 'FINALIZADA';
    await call('post', post, { tipo: 'GOL', time_id: 20 }, 2, undefined, 400);
  });
  await t.test('todos os tipos respeitam jogador, equipe, permissão, minuto e versão da súmula', async () => {
    for (const tipo of ['GOL', 'ASSISTENCIA', 'DEFESA', 'FALTA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL']) {
      reset();
      const body = { tipo, time_id: 10, jogador_id: 101, minuto: 0, periodo: 1 };
      for (const extra of [{ minuto: -1 }, { minuto: '1x' }, { minuto: 201 }, { periodo: 0 }, { periodo: 11 }, { jogador_id: 201 }, { jogador_id: 103 }, { versao: 9 }]) {
        await call('post', post, { ...body, ...extra }, 2, undefined, 'versao' in extra ? 409 : 400);
      }
      await call('post', post, body, 2, undefined, 403, 99);
      assert.equal(events.length, 0); assert.equal(p.versao, 0);
      const saved = await call('post', post, body);
      assert.equal(saved.minuto, 0); assert.equal(events.length, 1);
      await call('delete', '/eventos/:id', { partida_id: 1, versao: p.versao }, 2, saved.id, 200);
      assert.equal(events.length, 0); assert.equal(p.gols_mandante, 0);
    }
  });
  await t.test('limite de gols e conflito de versão não deixam efeitos parciais', async () => {
    reset(); p.gols_mandante = 99;
    await call('post', post, { tipo: 'GOL', time_id: 10, jogador_id: 101, versao: 0 }, 2, undefined, 400);
    assert.equal(p.gols_mandante, 99); assert.equal(events.length, 0); assert.equal(audits.length, 0);
    reset();
    await call('post', post, { tipo: 'GOL', time_id: 10, jogador_id: 101, versao: 0 });
    await call('post', post, { tipo: 'GOL', time_id: 10, jogador_id: 102, versao: 0 }, 2, undefined, 409);
    assert.equal(events.length, 1); assert.equal(p.gols_mandante, 1);
  });
  await t.test('encerrada exige justificativa inclusive para identificar gol pendente e remover evento', async () => {
    reset();
    const goal = await call('post', post, { tipo: 'GOL', time_id: 10, autor_pendente: true });
    p.status = 'FINALIZADA';
    await call('patch', patch, { jogador_id: 101 }, 2, goal.id, 400);
    await call('delete', '/eventos/:id', { partida_id: 1 }, 2, goal.id, 400);
    assert.equal(events[0].jogador_id, null); assert.equal(p.gols_mandante, 1);
    await call('patch', patch, { jogador_id: 101, motivo: 'Identificação após conferir a súmula' }, 2, goal.id, 200);
    await call('delete', '/eventos/:id', { partida_id: 1, motivo: 'Anulação confirmada' }, 2, goal.id, 200);
    assert.equal(events.length, 0); assert.equal(p.gols_mandante, 0);
  });
  await t.test('substituição respeita titular/reserva, clube, camisa, situação e versão; reenvio não troca de novo', async () => {
    reset(); const path = '/partidas/:id/substituicoes';
    for (const body of [{ sai: 101, entra: 101 }, { sai: 103, entra: 102 }, { sai: 101, entra: 201 }, { sai: 101, entra: 999 }]) {
      await call('post', path, body, 2, undefined, 400);
    }
    await call('post', path, { sai: 101, entra: 103 }, 2, undefined, 403, 99);
    await call('post', path, { sai: 101, entra: 103 }, 3, undefined, 400);
    roster[2].numCamisa = 0;
    await call('post', path, { sai: 101, entra: 103 }, 2, undefined, 400);
    roster[2].numCamisa = 3;
    await call('post', path, { sai: 101, entra: 103, versao: 7 }, 2, undefined, 409);
    await call('post', path, { sai: 101, entra: 103, versao: 0 }, 2, undefined, 200);
    assert.equal(roster[0].titular, false); assert.equal(roster[2].titular, true);
    await call('post', path, { sai: 101, entra: 103, versao: 0 }, 2, undefined, 400);
    assert.equal(audits.filter(a => a.acao === 'SUBSTITUICAO').length, 1);
    p.status = 'FINALIZADA';
    await call('post', path, { sai: 103, entra: 101 }, 2, undefined, 400);
    roster[0].titular = true; roster[2].titular = false;
  });
});
