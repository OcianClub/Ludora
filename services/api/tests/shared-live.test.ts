import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { criarCompartilhadasRoutes } from "../src/modules/partidas/compartilhadas.routes";
import { podeCorrigirSumula } from "../src/modules/partidas/compartilhadas.service";

test("súmula compartilhada: eventos, autoria, repetição e autorização pós-jogo", async (t) => {
  const p: any = {
    id: 1,
    versao: 0,
    status: "AO_VIVO",
    periodo_atual: 1,
    organizador_id: 2,
    sumula_clube_id: 2,
    mandante_id: 10,
    visitante_id: 20,
    gols_mandante: 0,
    gols_visitante: 0,
    categoria: { clube_id: 2 },
    mandante: { nome: "Ocian", clube_representado_id: 2 },
    visitante: { nome: "Santos", clube_representado_id: 3 },
    participantes: [
      { id: 1, clube_id: 2, categoria_id: 7, time_id: 10 },
      { id: 2, clube_id: 3, categoria_id: 8, time_id: 20 },
    ],
  };
  let eventos: any[] = [],
    auditoria: any[] = [],
    proposta: any;
  let aprovadoEm: Date | undefined;
  let papel = "ADMIN";
  let filtroContagem: any;
  function mock(target: any, name: string, value: any) {
    const old = target[name];
    target[name] = value;
    t.after(() => {
      target[name] = old;
    });
  }
  mock(prisma, "$transaction", async (fn: any) => fn(prisma));
  mock(prisma.partida, "findUnique", async () => p);
  mock(prisma.partida, "findUniqueOrThrow", async () => ({
    ...p,
    participantes: [],
  }));
  mock(prisma.usuarioClube, "findUnique", async () => ({
    papel,
    categorias: [{ categoria_id: 8 }],
    acesso_todas_categorias: false,
  }));
  mock(prisma.usuarioClube, "findMany", async () => []);
  mock(prisma.participantePartida, "findMany", async () => []);
  mock(prisma.dispositivoPush, "findMany", async () => []);
  mock(prisma.clube, "findMany", async () => []);
  mock(prisma.categoria, "findUniqueOrThrow", async () => ({ id: 8 }));
  mock(prisma.escalacaoPartida, "count", async ({ where }: any) =>
    Number(
      (where.time_id === 10 && where.jogador_id === 100) ||
        (where.time_id === 20 && where.jogador_id === 200),
    ),
  );
  mock(prisma.partida, "updateMany", async () => {
    p.versao++;
    return { count: 1 };
  });
  mock(prisma.partida, "update", async ({ data }: any) => {
    for (const [key, value] of Object.entries(data) as any)
      p[key] =
        typeof value === "object"
          ? p[key] + (value.increment || -value.decrement)
          : value;
    return p;
  });
  mock(prisma.evento, "create", async ({ data }: any) => {
    const e = { id: eventos.length + 1, ...data };
    eventos.push(e);
    return e;
  });
  mock(prisma.evento, "findUnique", async ({ where }: any) =>
    eventos.find((e) => e.id === where.id),
  );
  mock(prisma.evento, "findFirst", async ({ where }: any) =>
    eventos.find((e) => e.id === where.id && e.partida_id === where.partida_id),
  );
  mock(prisma.evento, "update", async ({ where, data }: any) =>
    Object.assign(
      eventos.find((e) => e.id === where.id),
      data,
    ),
  );
  mock(prisma.evento, "delete", async ({ where }: any) => {
    eventos = eventos.filter((e) => e.id !== where.id);
  });
  mock(prisma.auditoriaPartida, "create", async ({ data }: any) => {
    const a = { id: auditoria.length + 1, ...data };
    auditoria.push(a);
    return a;
  });
  mock(prisma.auditoriaPartida, "findFirst", async ({ where }: any) =>
    auditoria.find(
      (a) =>
        a.acao === where.acao &&
        a.dados[where.dados.path[0]] === where.dados.equals,
    ),
  );
  mock(prisma.propostaPartida, "count", async ({ where }: any) => {
    filtroContagem = where;
    return Number(proposta?.status === "PENDENTE");
  });
  mock(prisma.propostaPartida, "create", async ({ data }: any) => {
    proposta = { id: "proposta-1", versao: 0, status: "PENDENTE", ...data };
    return proposta;
  });
  mock(prisma.propostaPartida, "findUnique", async () => proposta);
  mock(prisma.propostaPartida, "findUniqueOrThrow", async () => proposta);
  mock(prisma.propostaPartida, "update", async ({ data }: any) => {
    Object.assign(proposta, data);
    aprovadoEm = data.respondido_em;
    return proposta;
  });
  mock(prisma.propostaPartida, "findFirst", async ({ where }: any) =>
    aprovadoEm &&
    aprovadoEm >= where.respondido_em.gte &&
    where.origem_id === 3 &&
    where.destino_id === 2
      ? { id: "proposta-1" }
      : null,
  );
  const router = criarCompartilhadasRoutes({
    of: () => ({ to: () => ({ emit() {} }) }),
    to: () => ({ emit() {} }),
  } as any);
  async function call(
    method: string,
    path: string,
    body: any = {},
    club = 2,
    params = { id: "1", eventoId: "1" },
  ) {
    const route = (router as any).stack.find(
      (l: any) => l.route?.path === path && l.route.methods[method],
    ).route;
    let status = 200,
      result: any;
    const res = {
      status(n: number) {
        status = n;
        return res;
      },
      json(value: any) {
        result = value;
      },
    };
    await route.stack.at(-1).handle(
      {
        usuarioId: 1,
        clubeId: club,
        params,
        body: { versao: p.versao, ...body },
      },
      res,
    );
    return { status, result };
  }
  await t.test(
    "somente operador lança; gol contra usa jogador adversário e soma para o beneficiário",
    async () => {
      assert.equal(
        (
          await call(
            "post",
            "/partidas/:id/eventos",
            { tipo: "GOL", time_id: 10, jogador_id: 100 },
            3,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call("post", "/partidas/:id/eventos", {
            tipo: "GOL",
            time_id: 10,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("post", "/partidas/:id/eventos", {
            tipo: "GOL",
            time_id: 10,
            gol_contra: true,
            jogador_id: 100,
          })
        ).status,
        400,
      );
      const body = {
        tipo: "GOL",
        time_id: 10,
        gol_contra: true,
        jogador_id: 200,
        request_id: "mobile-idempotente-12345",
      };
      assert.equal(
        (await call("post", "/partidas/:id/eventos", body)).status,
        201,
      );
      assert.equal(p.gols_mandante, 1);
      assert.equal(p.gols_visitante, 0);
      assert.equal(
        (await call("post", "/partidas/:id/eventos", body)).status,
        200,
      );
      assert.equal(eventos.length, 1);
      assert.equal(p.gols_mandante, 1);
    },
  );
  await t.test(
    "remoção ao vivo admite motivo vazio e repetição não desconta outro gol",
    async () => {
      const body = { partida_id: 1, request_id: "mobile-remocao-123456" };
      assert.equal((await call("delete", "/eventos/:id", body)).status, 200);
      assert.equal((await call("delete", "/eventos/:id", body)).status, 200);
      assert.equal(p.gols_mandante, 0);
      assert.equal(eventos.length, 0);
    },
  );
  await t.test(
    "todos os eventos admitem identificação pendente explícita; externo não exige atleta",
    async () => {
      assert.equal(
        (
          await call("post", "/partidas/:id/eventos", {
            tipo: "FALTA",
            time_id: 10,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call("post", "/partidas/:id/eventos", {
            tipo: "FALTA",
            time_id: 10,
            autor_pendente: true,
          })
        ).status,
        201,
      );
      const other = p.participantes.pop();
      assert.equal(
        (
          await call("post", "/partidas/:id/eventos", {
            tipo: "GOL",
            time_id: 20,
          })
        ).status,
        201,
      );
      p.participantes.push(other);
    },
  );
  await t.test(
    "encerrada exige motivo e impede identificar pendência adversária sem aceite",
    async () => {
      p.status = "FINALIZADA";
      eventos.push({
        id: 50,
        partida_id: 1,
        tipo: "GOL",
        time_id: 20,
        jogador_id: null,
      });
      assert.equal(
        (
          await call(
            "patch",
            "/partidas/:id/eventos/:eventoId",
            { jogador_id: 200, motivo: "Identificação" },
            3,
            { id: "1", eventoId: "50" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call("post", "/partidas/:id/eventos", {
            tipo: "FALTA",
            time_id: 10,
            jogador_id: 100,
          })
        ).status,
        400,
      );
      assert.equal((await call("delete", "/eventos/:id")).status, 400);
    },
  );
  await t.test(
    "solicitação exige motivo e aceite do responsável; autorização expira em 30 minutos",
    async () => {
      assert.equal(
        (await call("post", "/partidas/:id/correcoes", {}, 3)).status,
        400,
      );
      assert.equal(
        (
          await call(
            "post",
            "/partidas/:id/correcoes",
            { motivo: "Corrigir autoria" },
            3,
          )
        ).status,
        201,
      );
      assert.equal(
        (
          await call(
            "post",
            "/partidas/:id/correcoes",
            { motivo: "Duplicada" },
            3,
          )
        ).status,
        409,
      );
      const response = await call(
        "post",
        "/partidas/solicitacoes/:id/responder",
        { acao: "ACEITAR", versao: 0 },
        2,
        { id: "proposta-1", eventoId: "" },
      );
      assert.equal(response.status, 200, JSON.stringify(response));
      assert.equal(
        await podeCorrigirSumula(prisma, p, { usuarioId: 1, clubeId: 3 }),
        true,
      );
      assert.equal(
        (
          await call(
            "patch",
            "/partidas/:id/eventos/:eventoId",
            { jogador_id: 200, motivo: "Autoria corrigida" },
            3,
            { id: "1", eventoId: "50" },
          )
        ).status,
        200,
      );
      aprovadoEm = new Date(Date.now() - 31 * 60_000);
      assert.equal(
        await podeCorrigirSumula(prisma, p, { usuarioId: 1, clubeId: 3 }),
        false,
      );
      p.status = "AO_VIVO";
      aprovadoEm = new Date();
      assert.equal(
        await podeCorrigirSumula(prisma, p, { usuarioId: 1, clubeId: 3 }),
        false,
      );
    },
  );
  await t.test(
    "troca de operador ao vivo exige aceite e revoga o controle do operador antigo",
    async () => {
      p.status = "AO_VIVO";
      p.sumula_clube_id = 2;
      proposta = undefined;
      const pedido = await call("post", "/partidas/:id/sumula", {}, 3);
      assert.equal(pedido.status, 200);
      assert.equal(proposta.dados.responsavel_atual_id, 2);
      assert.equal(proposta.dados.novo_responsavel_id, 3);
      assert.equal(p.sumula_clube_id, 2);
      assert.equal(
        (
          await call(
            "post",
            "/partidas/solicitacoes/:id/responder",
            { acao: "ACEITAR", versao: 0 },
            3,
            { id: proposta.id, eventoId: "" },
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "post",
            "/partidas/solicitacoes/:id/responder",
            { acao: "ACEITAR", versao: 0 },
            2,
            { id: proposta.id, eventoId: "" },
          )
        ).status,
        200,
      );
      assert.equal(p.sumula_clube_id, 3);
      assert.equal(
        (
          await call(
            "post",
            "/partidas/:id/eventos",
            { tipo: "FALTA", time_id: 10, jogador_id: 100 },
            2,
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await call(
            "post",
            "/partidas/:id/eventos",
            { tipo: "FALTA", time_id: 20, jogador_id: 200 },
            3,
          )
        ).status,
        201,
      );
      assert.equal(auditoria.at(-1).dados.evento.tipo, "FALTA");
      proposta = undefined;
      assert.equal(
        (await call("post", "/partidas/:id/sumula", {}, 3)).status,
        200,
      );
      assert.equal(proposta.dados.novo_responsavel_id, 2);
      p.sumula_clube_id = 2;
      assert.equal(
        (
          await call(
            "post",
            "/partidas/solicitacoes/:id/responder",
            { acao: "ACEITAR", versao: 0 },
            2,
            { id: proposta.id, eventoId: "" },
          )
        ).status,
        409,
      );
      p.status = "FINALIZADA";
      proposta = undefined;
      assert.equal(
        (await call("post", "/partidas/:id/sumula", {}, 3)).status,
        403,
      );
    },
  );
  await t.test(
    "contador inclui apenas pendências dirigidas ao clube e às categorias permitidas",
    async () => {
      papel = "TECNICO";
      assert.equal(
        (await call("get", "/partidas/solicitacoes/resumo", {}, 3)).status,
        200,
      );
      assert.equal(filtroContagem.respondente_id, 3);
      assert.equal(filtroContagem.status, "PENDENTE");
      assert.deepEqual(filtroContagem.OR, [
        { origem_id: 3, categoria_origem_id: { in: [8] } },
        { destino_id: 3, categoria_destino_id: { in: [8] } },
      ]);
      papel = "TORCEDOR";
      assert.equal(
        (await call("get", "/partidas/solicitacoes/resumo", {}, 3)).status,
        403,
      );
    },
  );
});
