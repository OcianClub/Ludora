import {
  Prisma,
  type Partida,
  type Categoria,
  type Competicao,
  type Time,
} from '@prisma/client';

type IdentidadeTime = Pick<Time, 'id' | 'nome' | 'escudo'>;
type PartidaDaHome = Pick<
  Partida,
  | 'id'
  | 'data'
  | 'horario'
  | 'local'
  | 'status'
  | 'emCasa'
  | 'gols_mandante'
  | 'gols_visitante'
  | 'rodada'
  | 'grupo'
  | 'competicao_id'
> & {
  clube_origem_id: number;
  somente_leitura: boolean;
  mandante: IdentidadeTime;
  visitante: IdentidadeTime;
  categoria: Pick<Categoria, 'id' | 'nome' | 'tipo' | 'clube_id'>;
  competicao: Pick<Competicao, 'id' | 'nome' | 'ano' | 'tipo'> | null;
};

export function dataHomeValida(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor))
    return false;
  const data = new Date(`${valor}T00:00:00.000Z`);
  return (
    Number.isFinite(data.getTime()) && data.toISOString().slice(0, 10) === valor
  );
}

export async function consultarHome(
  banco: Pick<Prisma.TransactionClient, '$queryRaw'>,
  clubeId: number,
  hoje: string
) {
  if (!Number.isSafeInteger(clubeId) || clubeId <= 0 || !dataHomeValida(hoje)) {
    throw new Error('Escopo da Home inválido');
  }
  // A janela limita por categoria antes de carregar relações e enviar ao app.
  return banco.$queryRaw<PartidaDaHome[]>(Prisma.sql`
    WITH candidatas AS (
      SELECT p.id, p.data, COALESCE(p.horario, '00:00') AS horario,
        UPPER(REPLACE(c.nome, ' ', '-')) AS categoria,
        CASE WHEN p.status = 'FINALIZADA' THEN 'historico'
             WHEN p.status = 'AO_VIVO' THEN 'ao_vivo'
             ELSE 'agenda' END AS grupo
      FROM "Partida" p
      JOIN "Categoria" c ON c.id = p.categoria_id
      JOIN "Time" m ON m.id = p.mandante_id
      JOIN "Time" v ON v.id = p.visitante_id
      WHERE (c.clube_id = ${clubeId} OR m.clube_representado_id = ${clubeId}
        OR v.clube_representado_id = ${clubeId})
        AND (p.status IN ('FINALIZADA', 'AO_VIVO')
          OR (p.status IN ('AGENDADA', 'PREPARADA') AND p.data >= ${new Date(`${hoje}T00:00:00.000Z`)}))
    ), ordenadas AS (
      SELECT id, grupo, ROW_NUMBER() OVER (
        PARTITION BY categoria, grupo
        ORDER BY CASE WHEN grupo = 'historico' THEN data END DESC,
          CASE WHEN grupo = 'historico' THEN horario END DESC,
          CASE WHEN grupo <> 'historico' THEN data END ASC,
          CASE WHEN grupo = 'agenda' THEN horario END ASC, id ASC
      ) AS posicao FROM candidatas
    ), selecionadas AS (
      SELECT id FROM ordenadas
      WHERE (grupo = 'historico' AND posicao <= 5)
        OR (grupo = 'ao_vivo' AND posicao = 1)
        OR (grupo = 'agenda' AND posicao <= 3)
    )
    SELECT p.id, p.data, p.horario, p.local, p.status,
      p.gols_mandante, p.gols_visitante, p.rodada, p.grupo, p.competicao_id,
      c.clube_id AS clube_origem_id, (c.clube_id <> ${clubeId}) AS somente_leitura,
      CASE WHEN c.clube_id = ${clubeId} THEN p."emCasa"
        ELSE COALESCE(m.clube_representado_id = ${clubeId}, false) END AS "emCasa",
      jsonb_build_object('id', m.id,
        'nome', CASE WHEN cm.id IS NOT NULL THEN cm.nome ELSE m.nome END,
        'escudo', CASE WHEN cm.id IS NOT NULL THEN cm.escudo ELSE m.escudo END) AS mandante,
      jsonb_build_object('id', v.id,
        'nome', CASE WHEN cv.id IS NOT NULL THEN cv.nome ELSE v.nome END,
        'escudo', CASE WHEN cv.id IS NOT NULL THEN cv.escudo ELSE v.escudo END) AS visitante,
      jsonb_build_object('id', c.id, 'nome', c.nome, 'tipo', c.tipo, 'clube_id', c.clube_id) AS categoria,
      CASE WHEN co.id IS NOT NULL THEN jsonb_build_object('id', co.id, 'nome', co.nome,
        'ano', co.ano, 'tipo', co.tipo) ELSE NULL END AS competicao
    FROM selecionadas s
    JOIN "Partida" p ON p.id = s.id
    JOIN "Categoria" c ON c.id = p.categoria_id
    JOIN "Time" m ON m.id = p.mandante_id
    JOIN "Time" v ON v.id = p.visitante_id
    LEFT JOIN "Clube" cm ON cm.id = m.clube_representado_id
    LEFT JOIN "Clube" cv ON cv.id = v.clube_representado_id
    LEFT JOIN "Competicao" co ON co.id = p.competicao_id
    ORDER BY p.data ASC, p.id ASC
  `);
}
