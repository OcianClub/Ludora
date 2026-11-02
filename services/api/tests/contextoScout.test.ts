import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Prisma } from '@prisma/client';
import { consultarContextoScout, type FiltroScout } from '../src/modules/jogadores/contexto-scout.service';

function fixture(filtro: FiltroScout = {}, total = 25) {
  const queries: Record<string, any[]> = { jogador: [], count: [], partida: [], evento: [], escalacao: [] };
  const tx = {
    jogador: { async findFirst(q: any) { queries.jogador.push(q); return { id: 12, categoria_id: 7, posicao: 'Alas', scores_ml: null }; } },
    partida: {
      async groupBy(q: any) { queries.partida.push(q); return [
        { data: new Date('2026-10-19Z') },
        { data: new Date('2026-01-12Z') },
        { data: new Date('2024-11-01Z') },
      ]; },
      async count(q: any) { queries.count.push(q); return total; },
      async findMany(q: any) { queries.partida.push(q);
        if (q.distinct) return [{ competicao: { id: 4, nome: 'Copa', ano: 2026 } }];
        if (!q.select.eventos) return [{ id: 5, data: new Date('2026-10-19Z'), status: 'FINALIZADA', mandante: { nome: 'Ludora' }, visitante: { nome: 'Visitante' } }];
        return [{ id: 5, data: new Date('2026-10-19Z'), horario: '19:00', status: filtro.partidaId ? 'AO_VIVO' : 'FINALIZADA',
          emCasa: false, mandante_id: 1, gols_mandante: 2, gols_visitante: 3,
          participantes: [{ time_id: 1 }], mandante: { nome: 'Ludora' }, visitante: { nome: 'Visitante' },
          competicao: { id: 4, nome: 'Copa', ano: 2026 }, jogadores_escalonados: [{ titular_inicial: null, numCamisa: 9 }],
          eventos: [{ id: 1, tipo: 'GOL', periodo: 1, minuto: null, gol_contra: false }, { id: 2, tipo: 'GOL', periodo: 1, minuto: null, gol_contra: true }],
        }];
      },
    },
    evento: { async groupBy(q: any) { queries.evento.push(q); return [
      { tipo: 'GOL', periodo: 1, gol_contra: false, _count: { _all: 7 } },
      { tipo: 'GOL', periodo: 1, gol_contra: true, _count: { _all: 1 } },
      { tipo: 'CARTAO_AZUL', periodo: 2, gol_contra: false, _count: { _all: 2 } },
    ]; } },
    escalacaoPartida: { async groupBy(q: any) { queries.escalacao.push(q); return [
      { titular_inicial: true, _count: { _all: 5 } }, { titular_inicial: false, _count: { _all: 2 } }, { titular_inicial: null, _count: { _all: 1 } },
    ]; } },
  } as unknown as Prisma.TransactionClient;
  return { tx, queries };
}

test('contexto agrega o recorte inteiro, limita histórico e opções, preserva escopo e separa gols contra', async () => {
  const { tx, queries } = fixture();
  const result = await consultarContextoScout(tx, 12, 3, [7]);
  assert.equal(queries.jogador[0].where.categoria.clube_id, 3);
  assert.deepEqual(queries.jogador[0].where.categoria_id, { in: [7] });
  const where = queries.count[0].where;
  assert.equal(where.status, 'FINALIZADA');
  assert.deepEqual(where.AND[0].OR[1], { participantes: { some: { clube_id: 3, categoria_id: { in: [7] } } } });
  assert.deepEqual(queries.evento[0].where, { jogador_id: 12, partida: { is: where } });
  assert.equal(queries.partida[0].take, 10);
  assert.equal(queries.partida[1].take, 100);
  assert.equal(result?.total_partidas, 25);
  assert.equal(result?.totais.gols, 7, 'Totais não são limitados aos dez jogos exibidos');
  assert.equal(result?.totais.gols_contra, 1);
  assert.equal(result?.totais.azuis, 2);
  assert.equal(result?.totais.convocacoes, 8);
  assert.equal(result?.totais.titularidades, 5);
  assert.equal(result?.totais.titularidades_desconhecidas, 1);
  assert.equal(result?.partidas[0].adversario, 'Visitante', 'Compartilhadas usam o lado do participante, não emCasa do organizador');
  assert.equal(result?.partidas[0].gols, 1);
  assert.equal(result?.partidas[0].eventos.length, 2);
  assert.deepEqual(result?.opcoes.temporadas, [2026, 2024], 'Temporadas vêm de todo o histórico finalizado, sem duplicar anos');
  assert.equal(queries.partida.at(-1).where.status, 'FINALIZADA');
  assert.deepEqual(queries.partida.at(-1).where.AND, where.AND, 'Anos disponíveis mantêm o escopo do clube e atleta');
});

test('campeonato e temporada filtram histórico e todos os agregados sem usar partida ao vivo', async () => {
  const filtro = { competicaoId: 4, ano: 2026 };
  const { tx, queries } = fixture(filtro);
  const result = await consultarContextoScout(tx, 12, 3, null, filtro);
  const where = queries.count[0].where;
  assert.equal(where.competicao_id, 4);
  assert.equal(where.data.gte.toISOString(), '2026-01-01T00:00:00.000Z');
  assert.equal(where.data.lt.toISOString(), '2027-01-01T00:00:00.000Z');
  assert.equal(where.status, 'FINALIZADA');
  assert.deepEqual(queries.escalacao[0].where.partida.is, where);
  assert.equal(result?.recorte.tipo, 'competicao');
  assert.deepEqual(result?.semelhantes, [], 'Não mistura modelo geral com recorte de campeonato');
});

test('partida ao vivo fica explicitamente provisória, sem permitir consultar outra partida sem vínculo', async () => {
  const { tx, queries } = fixture({ partidaId: 5 });
  const result = await consultarContextoScout(tx, 12, 3, [7], { partidaId: 5 });
  assert.equal(queries.count[0].where.id, 5);
  assert.deepEqual(queries.count[0].where.status, { in: ['AO_VIVO', 'FINALIZADA'] });
  assert.equal(result?.recorte.provisorio, true);
  const missing = fixture({ partidaId: 999 }, 0);
  assert.equal(await consultarContextoScout(missing.tx, 12, 3, [7], { partidaId: 999 }), null);
  assert.equal(missing.queries.partida.length, 0);
});

test('categorias vazias não viram acesso total; atleta fora do escopo não consulta histórico', async () => {
  let consulta: any;
  const tx = { jogador: { async findFirst(q: any) { consulta = q; return null; } } } as unknown as Prisma.TransactionClient;
  assert.equal(await consultarContextoScout(tx, 10, 8, []), null);
  assert.deepEqual(consulta.where.categoria_id, { in: [] });
  assert.equal(await consultarContextoScout(tx, 10, 8, null), null);
  assert.equal(consulta.where.categoria_id, undefined);
});
