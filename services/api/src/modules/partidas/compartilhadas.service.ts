import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

export class FluxoInvalido extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
export type Contexto = { usuarioId: number; clubeId: number };
type Banco = Prisma.TransactionClient;
export const incluirPartida = {
  categoria: true, competicao: true,
  mandante: { include: { clubeRepresentado: { select: { id: true, nome: true, escudo: true } } } },
  visitante: { include: { clubeRepresentado: { select: { id: true, nome: true, escudo: true } } } },
  participantes: { include: { clube: { select: { id: true, nome: true } }, categoria: true } },
} satisfies Prisma.PartidaInclude;
export type PartidaCompleta = Prisma.PartidaGetPayload<{ include: typeof incluirPartida }>;
export function exigir(condicao: unknown, mensagem: string, status = 400): asserts condicao {
  if (!condicao) throw new FluxoInvalido(mensagem, status);
}
export function inteiro(value: unknown, min = 1, max = 2147483647) {
  const n = Number(value);
  exigir(Number.isSafeInteger(n) && n >= min && n <= max, 'Informe um número válido.');
  return n;
}
export function validarDataHorario(data: unknown, horario: unknown) {
  exigir(typeof data === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data), 'Informe uma data válida.');
  const date = new Date(`${data}T00:00:00Z`);
  exigir(Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === data, 'Esta data não existe no calendário.');
  exigir(typeof horario === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(horario), 'Informe o horário entre 00:00 e 23:59.');
  return { data: date, horario };
}
export async function acesso(tx: Banco, ctx: Contexto, categoriaId: number) {
  const vinculo = await tx.usuarioClube.findUnique({
    where: { usuario_id_clube_id: { usuario_id: ctx.usuarioId, clube_id: ctx.clubeId } },
    include: { categorias: true },
  });
  return !!vinculo && ['ADMIN', 'TECNICO', 'MESARIO'].includes(vinculo.papel) &&
    (vinculo.papel === 'ADMIN' || vinculo.acesso_todas_categorias || vinculo.categorias.some(c => c.categoria_id === categoriaId));
}
export async function partida(tx: Banco, id: number, ctx: Contexto, editar = false) {
  const p = await tx.partida.findUnique({ where: { id }, include: incluirPartida });
  exigir(p && (p.participantes.some(e => e.clube_id === ctx.clubeId) || p.categoria.clube_id === ctx.clubeId || p.mandante.clube_representado_id === ctx.clubeId || p.visitante.clube_representado_id === ctx.clubeId), 'Partida não encontrada neste clube.', 404);
  const equipe = p.participantes.find(e => e.clube_id === ctx.clubeId);
  const pode = !!equipe && await acesso(tx, ctx, equipe.categoria_id);
  if (editar) exigir(pode, 'Você não administra a equipe desta partida.', 403);
  return { p, equipe, pode };
}
export async function auditar(tx: Banco, ctx: Contexto, id: number, acao: string, dados: Prisma.InputJsonValue = {}) {
  await tx.auditoriaPartida.create({ data: { partida_id: id, usuario_id: ctx.usuarioId, clube_id: ctx.clubeId, acao, dados } });
}
export async function tocar(tx: Banco, p: { id: number; versao: number }, versao?: unknown) {
  if (versao != null) exigir(inteiro(versao, 0) === p.versao, 'A partida mudou em outro dispositivo. Atualize antes de continuar.', 409);
  const updated = await tx.partida.updateMany({ where: { id: p.id, versao: p.versao }, data: { versao: { increment: 1 } } });
  exigir(updated.count, 'A partida mudou. Atualize antes de continuar.', 409);
}
export async function transacao<T>(callback: (tx: Banco) => Promise<T>) {
  try { return await prisma.$transaction(callback, { isolationLevel: 'Serializable', timeout: 15000 }); }
  catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2034', 'P2002'].includes(error.code))
      throw new FluxoInvalido('Outro usuário alterou este registro ou o confronto já existe. Atualize e tente novamente.', 409);
    throw error;
  }
}
export async function validarDados(tx: Banco, ctx: Contexto, body: any, aceitarRegistrada = false) {
  const catId = inteiro(body.categoria_id);
  const cat = await tx.categoria.findUnique({ where: { id: catId } });
  exigir(cat && cat.clube_id === ctx.clubeId && (aceitarRegistrada || await acesso(tx, ctx, catId)), 'Você não administra esta categoria.', 403);
  const mandanteId = inteiro(body.mandante_id), visitanteId = inteiro(body.visitante_id);
  exigir(mandanteId !== visitanteId, 'Escolha dois times diferentes.');
  const times = await tx.time.findMany({ where: { id: { in: [mandanteId, visitanteId] }, categoria_id: catId, arquivado: false } });
  exigir(times.length === 2, 'Os times devem estar ativos e pertencer à categoria escolhida.');
  const propria = times.filter(t => t.clube_representado_id === ctx.clubeId);
  exigir(propria.length === 1, 'O confronto deve incluir uma equipe do clube atual e um adversário.');
  const adversario = times.find(t => t.id !== propria[0].id)!;
  let destino = null;
  if (adversario.clube_representado_id) {
    const candidatas = await tx.categoria.findMany({ where: { clube_id: adversario.clube_representado_id, tipo: cat.tipo, OR: [{ nome: { equals: cat.nome, mode: 'insensitive' } }, ...(cat.faixaIdade > 0 ? [{ faixaIdade: cat.faixaIdade }] : [])] } });
    destino = candidatas.find(c => c.nome.toLowerCase() === cat.nome.toLowerCase()) || (candidatas.length === 1 ? candidatas[0] : null);
    exigir(destino, 'O adversário ainda não possui uma categoria correspondente. Peça ao clube que a cadastre.');
  }
  const compId = body.competicao_id ? inteiro(body.competicao_id) : null;
  const competicao = compId ? await tx.competicao.findUnique({ where: { id: compId } }) : null;
  exigir(!compId || (competicao && !competicao.arquivada && competicao.clube_id === ctx.clubeId && competicao.tipo === cat.tipo), 'Escolha uma competição ativa e compatível do clube.');
  const { data, horario } = validarDataHorario(body.data, body.horario);
  const local = typeof body.local === 'string' ? body.local.trim().slice(0, 300) : null;
  return { cat, destino, adversario, propria: propria[0], competicao, dados: {
    categoria_id: catId, mandante_id: mandanteId, visitante_id: visitanteId, data: data.toISOString().slice(0, 10), horario,
    local, competicao_id: compId, rodada: body.rodada ? inteiro(body.rodada) : null, grupo: typeof body.grupo === 'string' ? body.grupo.slice(0, 60) : null,
    emCasa: propria[0].id === mandanteId,
  } };
}
export async function bloquearDuplicidade(tx: Banco, origem: number, destino: number | null, categoria: { nome: string; faixaIdade: number; tipo?: string }, dados: any, ignorarPartida?: number, ignorarProposta?: string) {
  const par = [origem, destino || -dados.visitante_id - dados.mandante_id].sort((a, b) => a - b);
  const faixa = categoria.faixaIdade || Number(categoria.nome.match(/\d+/)?.[0]) || categoria.nome.toLowerCase();
  const chave = `${par.join(':')}:${categoria.tipo || 'categoria'}:${faixa}:${dados.data}:${dados.horario}`;
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${chave}))::text`;
  const data = new Date(`${dados.data}T00:00:00Z`);
  const conflito = await tx.partida.findFirst({ where: {
    id: ignorarPartida ? { not: ignorarPartida } : undefined, status: { not: 'CANCELADA' }, data, horario: dados.horario,
    OR: [{ participantes: { some: { clube_id: origem, categoria: { faixaIdade: categoria.faixaIdade, nome: categoria.nome } } } },
      ...(destino ? [{ participantes: { some: { clube_id: destino, categoria: { faixaIdade: categoria.faixaIdade, nome: categoria.nome } } } }] : [])],
  } });
  exigir(!conflito, `Já existe uma partida ou conflito de agenda neste horário${conflito ? ` (#${conflito.id})` : ''}.`, 409);
  const proposta = await tx.propostaPartida.findFirst({ where: { chave, status: 'PENDENTE', id: ignorarProposta ? { not: ignorarProposta } : undefined } });
  exigir(!proposta, 'Já existe uma proposta para este confronto. Consulte as solicitações recebidas e enviadas.', 409);
  return chave;
}
export async function criarOficial(tx: Banco, ctx: Contexto, dados: any, destinoId: number | null, categoriaDestino: number | null) {
  const comp = dados.competicao_id ? await tx.competicao.findUnique({ where: { id: dados.competicao_id } }) : null;
  const nova = await tx.partida.create({ data: { ...dados, data: new Date(`${dados.data}T00:00:00Z`),
    organizador_id: ctx.clubeId, sumula_clube_id: ctx.clubeId, titulares_necessarios: comp?.titulares_necessarios || 5,
    participantes: { create: [{ clube_id: ctx.clubeId, categoria_id: dados.categoria_id, time_id: dados.emCasa ? dados.mandante_id : dados.visitante_id },
      ...(destinoId && categoriaDestino ? [{ clube_id: destinoId, categoria_id: categoriaDestino, time_id: dados.emCasa ? dados.visitante_id : dados.mandante_id }] : [])] },
  }, include: incluirPartida });
  await auditar(tx, ctx, nova.id, 'PARTIDA_CRIADA');
  return nova;
}
export async function validarEquipe(tx: Banco, p: PartidaCompleta, equipe: PartidaCompleta['participantes'][number]) {
  const rows = await tx.escalacaoPartida.findMany({ where: { partida_id: p.id, time_id: equipe.time_id }, include: { jogador: true } });
  exigir(rows.filter(r => r.titular).length === p.titulares_necessarios, `Defina exatamente ${p.titulares_necessarios} titulares.`);
  exigir(rows.every(r => r.numCamisa >= 1 && r.numCamisa <= 99 && r.jogador.numCamisa != null && r.jogador.ativo && r.jogador.categoria_id === equipe.categoria_id), 'Todos os convocados devem estar ativos, na categoria correta e com camisa definida.');
  if (p.competicao?.exigir_inscricao) {
    const inscritos = await tx.competicaoJogador.count({ where: { competicao_id: p.competicao_id!, jogador_id: { in: rows.map(r => r.jogador_id) } } });
    exigir(inscritos === rows.length, 'Há convocados sem inscrição nesta competição.');
  }
  return rows;
}
