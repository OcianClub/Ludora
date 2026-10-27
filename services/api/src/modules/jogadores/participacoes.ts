import { Prisma, type PrismaClient } from '@prisma/client';
export async function contarParticipacoes(db: PrismaClient, ids: number[], clubeId: number) {
  if (!ids.length) return new Map<number, number>();
  const rows = await db.$queryRaw<{ jogador_id: number; total: bigint }[]>(Prisma.sql`
    SELECT x.jogador_id, COUNT(DISTINCT x.partida_id) AS total
    FROM (
      SELECT jogador_id, partida_id FROM "EscalacaoPartida" WHERE jogador_id IN (${Prisma.join(ids)})
      UNION
      SELECT jogador_id, partida_id FROM "Evento" WHERE jogador_id IN (${Prisma.join(ids)})
    ) x
    JOIN "Partida" p ON p.id = x.partida_id
    JOIN "Categoria" c ON c.id = p.categoria_id
    WHERE c.clube_id = ${clubeId}
    GROUP BY x.jogador_id
  `);
  return new Map(rows.map(row => [row.jogador_id, Number(row.total)]));
}
