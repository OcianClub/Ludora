import type { Prisma, PrismaClient } from '@prisma/client';

export function andamentoCompeticao(total: number, finalizadas: number, aoVivo: number) {
  return !total ? 'SEM_PARTIDAS' : finalizadas === total ? 'FINALIZADA' : aoVivo || finalizadas ? 'EM_ANDAMENTO' : 'AGENDADA';
}

// Consultas em lote: a listagem não precisa baixar as súmulas de cada competição.
export async function resumirCompeticoes(banco: PrismaClient, ids: number[], escopo: Prisma.PartidaWhereInput = {}) {
  if (!ids.length) return new Map();
  const where: Prisma.PartidaWhereInput = { AND: [escopo, { competicao_id: { in: ids }, status: { not: 'CANCELADA' } }] };
  const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
  const [grupos, proximas] = await Promise.all([
    banco.partida.groupBy({ by: ['competicao_id', 'status', 'categoria_id'], where, _count: { _all: true } }),
    banco.partida.findMany({ where: { AND: [where, { status: { in: ['AGENDADA', 'PREPARADA'] }, data: { gte: new Date(`${hoje}T00:00:00Z`) } }] },
      orderBy: [{ data: 'asc' }, { horario: 'asc' }, { id: 'asc' }], distinct: ['competicao_id'],
      select: { id: true, competicao_id: true, data: true, horario: true, mandante: { select: { nome: true } }, visitante: { select: { nome: true } } } }),
  ]);
  const categorias = await banco.categoria.findMany({ where: { id: { in: [...new Set(grupos.map(g => g.categoria_id))] } }, select: { id: true, nome: true } });
  return new Map(ids.map(id => {
    const rows = grupos.filter(g => g.competicao_id === id);
    const total = rows.reduce((n, g) => n + g._count._all, 0);
    const finalizadas = rows.filter(g => g.status === 'FINALIZADA').reduce((n, g) => n + g._count._all, 0);
    const aoVivo = rows.filter(g => g.status === 'AO_VIVO').reduce((n, g) => n + g._count._all, 0);
    const categoriaIds = new Set(rows.map(g => g.categoria_id));
    return [id, { total, finalizadas, ao_vivo: aoVivo, situacao: andamentoCompeticao(total, finalizadas, aoVivo),
      categorias: [...new Set(categorias.filter(c => categoriaIds.has(c.id)).map(c => c.nome.toUpperCase()))].sort((a,b) => a.localeCompare(b, 'pt-BR', { numeric: true })),
      proxima_partida: proximas.find(p => p.competicao_id === id) || null }];
  }));
}
