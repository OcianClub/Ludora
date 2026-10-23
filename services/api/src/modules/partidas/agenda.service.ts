import { Prisma } from '@prisma/client';
import type { consultarHome } from './home.service';
import { dataHomeValida } from './home.service';
import { FiltroDataInvalido, intervaloDataPartidas } from './filtros-data.utils';

export const LIMITES_AGENDA = { ao_vivo: 10, agenda: 10, pendentes: 5, historico: 5 } as const;
export type GrupoAgenda = keyof typeof LIMITES_AGENDA;
export type PartidaAgenda = Awaited<ReturnType<typeof consultarHome>>[number] & {
  grupo_agenda: GrupoAgenda;
  posicao: number;
  total_grupo: number;
};

export function validarFiltroAgenda(filtros: Record<string, unknown>) {
  const agora = filtros.agora;
  if (typeof agora !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T([01]\d|2[0-3]):[0-5]\d$/.test(agora) ||
      !dataHomeValida(agora.slice(0, 10))) {
    throw new FiltroDataInvalido('Informe uma data e horário válidos para a agenda.');
  }
  const intervalo = intervaloDataPartidas(filtros);
  if (!intervalo) throw new FiltroDataInvalido('Selecione um ano para consultar os jogos.');
  const status = filtros.status;
  if (status !== undefined &&
      (typeof status !== 'string' ||
       !['AO_VIVO', 'AGENDADA', 'PREPARADA', 'FINALIZADA', 'CANCELADA'].includes(status))) {
    throw new FiltroDataInvalido('Status de partida inválido.');
  }
  const grupo = filtros.grupo;
  if (grupo !== undefined && (typeof grupo !== 'string' || !(grupo in LIMITES_AGENDA) || !Object.prototype.hasOwnProperty.call(LIMITES_AGENDA, grupo))) {
    throw new FiltroDataInvalido('Grupo de partidas inválido.');
  }
  const categoria = filtros.categoria_nome;
  if (categoria !== undefined &&
      (typeof categoria !== 'string' || !categoria.trim() || categoria.length > 60)) {
    throw new FiltroDataInvalido('Categoria inválida.');
  }
  const apos = filtros.apos === undefined ? 0 : Number(filtros.apos);
  if (!Number.isSafeInteger(apos) || apos < 0 || apos > 100000 ||
      (filtros.apos !== undefined && !/^\d+$/.test(String(filtros.apos))) ||
      (apos > 0 && (!grupo || !categoria)) || (!!grupo !== !!categoria)) {
    throw new FiltroDataInvalido('Paginação de partidas inválida.');
  }
  return {
    agora: agora.replace('T', ' ') + ':00',
    intervalo,
    status: status ?? null,
    grupo: grupo ?? null,
    categoria: typeof categoria === 'string' ? categoria.trim().toUpperCase().replace(/ /g, '-') : null,
    apos,
  };
}

export async function consultarAgenda(
  banco: Pick<Prisma.TransactionClient, '$queryRaw'>,
  clubeId: number,
  filtros: Record<string, unknown>
) {
  if (!Number.isSafeInteger(clubeId) || clubeId <= 0)
    throw new FiltroDataInvalido('Clube inválido.');
  const { agora, intervalo, status, grupo, categoria, apos } = validarFiltroAgenda(filtros);
  return banco.$queryRaw<PartidaAgenda[]>(Prisma.sql`
    WITH candidatas AS (
      SELECT p.id, p.data, COALESCE(p.horario, '23:59') AS horario,
        UPPER(REPLACE(c.nome, ' ', '-')) AS categoria,
        CASE WHEN p.status = 'AO_VIVO' THEN 'ao_vivo'
             WHEN p.status IN ('FINALIZADA', 'CANCELADA') THEN 'historico'
             WHEN p.data + COALESCE(
               CASE WHEN p.horario ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
                 THEN p.horario::time END, '23:59:59'::time
             ) < ${agora}::timestamp THEN 'pendentes'
             ELSE 'agenda' END AS grupo
      FROM "Partida" p
      JOIN "Categoria" c ON c.id = p.categoria_id
      JOIN "Time" m ON m.id = p.mandante_id
      JOIN "Time" v ON v.id = p.visitante_id
      WHERE (c.clube_id = ${clubeId} OR m.clube_representado_id = ${clubeId}
        OR v.clube_representado_id = ${clubeId})
        AND p.data >= ${intervalo.gte} AND p.data < ${intervalo.lt}
        AND (${status}::text IS NULL OR p.status::text = ${status})
        AND (${categoria}::text IS NULL OR UPPER(REPLACE(c.nome, ' ', '-')) = ${categoria})
    ), ordenadas AS (
      SELECT id, grupo, ROW_NUMBER() OVER (
        PARTITION BY categoria, grupo
        ORDER BY CASE WHEN grupo IN ('historico', 'pendentes') THEN data END DESC,
          CASE WHEN grupo IN ('historico', 'pendentes') THEN horario END DESC,
          CASE WHEN grupo IN ('ao_vivo', 'agenda') THEN data END ASC,
          CASE WHEN grupo IN ('ao_vivo', 'agenda') THEN horario END ASC,
          id ASC
      ) AS posicao, COUNT(*) OVER (PARTITION BY categoria, grupo) AS total
      FROM candidatas
    ), selecionadas AS (
      SELECT * FROM ordenadas
      WHERE (${grupo}::text IS NULL OR grupo = ${grupo})
        AND posicao > ${apos}
        AND posicao <= ${apos} + CASE grupo
          WHEN 'historico' THEN ${LIMITES_AGENDA.historico}
          WHEN 'pendentes' THEN ${LIMITES_AGENDA.pendentes}
          WHEN 'ao_vivo' THEN ${LIMITES_AGENDA.ao_vivo}
          ELSE ${LIMITES_AGENDA.agenda} END
    )
    SELECT s.grupo AS grupo_agenda, s.posicao::int AS posicao,
      s.total::int AS total_grupo, p.id, p.data, p.horario, p.local, p.status,
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
    ORDER BY s.grupo ASC, s.posicao ASC
  `);
}
