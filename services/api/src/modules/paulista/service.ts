import { exigirOperacao } from '../manutencao/service';
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { JogoPaulista, SnapshotPaulista } from '../../../../../packages/shared-types/src/paulista';
import { classificarMudanca, nomeTime, pendenciaDeCalendario, resultadoNumerico, verificarContinuidade } from './rules';
export const ativo = () => process.env.PAULISTA_ENABLED === 'true';
export async function publicacaoPartida(banco: PrismaClient, partidaId: number) {
  if (!ativo()) return null;
  try {
    const j = await banco.fpfsJogo.findUnique({ where: { partidaId } });
    if (!j) return null;
    const anotado = await banco.fpfsAuditoria.findFirst({ where: { eventoId: j.eventoId, acao: 'RETROATIVO', dados: { path: ['jogoId'], equals: j.id } }, select: { id: true } });
    return { eventoId: j.eventoId, jogo: j.oficial as unknown as JogoPaulista, retroativo: !!anotado };
  } catch (e: any) { if (e.code === 'P2021') return null; throw e; }
}
export const json = (v: unknown) => JSON.parse(JSON.stringify(v)) as Prisma.InputJsonValue;
export class FalhaPaulista extends Error { constructor(public status: number, message: string) { super(message); } }
type Tx = Prisma.TransactionClient;
const idade = (s: SnapshotPaulista) => Number(s.categoria.match(/\d+/)?.[0]);
const PROJECAO = 'PROJECAO_LOCAL_PAULISTA';
type Projecao = { id: number; versao: number; status: string; gols_mandante: number; gols_visitante: number };
const projetado = (p: Projecao) => ({ partidaId: p.id, versao: p.versao, status: p.status, placar: [p.gols_mandante, p.gols_visitante] });

function semContribuicao(local: Projecao, anterior: JogoPaulista | undefined, ultimaProjecao: unknown, contribuicoes: Set<number>) {
  if (contribuicoes.has(local.id) || !['AGENDADA', 'FINALIZADA'].includes(local.status)) return false;
  if (isDeepStrictEqual(ultimaProjecao, projetado(local))) return true;
  if (local.versao !== 0) return false;
  if (local.status === 'AGENDADA') return local.gols_mandante === 0 && local.gols_visitante === 0;
  // No importador anterior a partida nascia finalizada com versão zero.
  // A finalização pelo clube passa pela versão de operação e sua auditoria.
  return !!anterior && resultadoNumerico(anterior) && local.gols_mandante === anterior.golsMandante && local.gols_visitante === anterior.golsVisitante;
}
async function audit(tx: Tx, eventoId: number, usuarioId: number | null, acao: string, dados: unknown) {
  return tx.fpfsAuditoria.create({ data: { eventoId, usuarioId, acao, dados: json(dados) } });
}
async function categoria(tx: Tx, clubeId: number, s: SnapshotPaulista) {
  const cat = await tx.categoria.findFirst({ where: { clube_id: clubeId, faixaIdade: idade(s), ativa: true, clube: { ativo: true } } });
  if (!cat) throw new FalhaPaulista(409, `Clube ${clubeId} sem categoria ${s.categoria}; conferir cadastro antes de distribuir.`);
  return cat;
}
async function casca(tx: Tx, s: SnapshotPaulista, equipeId: number, catId: number) {
  const equipe = s.equipes.find(e => e.id === equipeId)!;
  const atual = await tx.fpfsTime.findUnique({ where: { eventoId_equipeId: { eventoId: s.id, equipeId } }, include: { time: true } });
  if (atual?.time) return atual.time;
  const link = await tx.fpfsVinculo.findUnique({ where: { equipeId } });
  let time = (await tx.fpfsTime.findFirst({ where: { equipeId, timeId: { not: null }, evento: { categoria: s.categoria } }, include: { time: true } }))?.time;
  if (!time && link) {
    const cat = await categoria(tx, link.clubeId, s);
    time = await tx.time.findFirst({ where: { categoria_id: cat.id, clube_representado_id: link.clubeId, arquivado: false } });
  }
  if (!time) {
    const nome = `${equipe.nome} ${s.categoria.toLowerCase()}`;
    // Nunca adotar pelo nome: um homônimo preexistente requer revisão.
    if (await tx.time.findUnique({ where: { nome_categoria_id: { nome, categoria_id: catId } } })) throw new FalhaPaulista(409, `Já existe ${nome}; revisar identidade antes de criar a casca.`);
    time = await tx.time.create({ data: { nome, escudo: equipe.escudo, categoria_id: catId, clube_representado_id: link?.clubeId || null } });
  }
  await tx.fpfsTime.update({ where: { eventoId_equipeId: { eventoId: s.id, equipeId } }, data: { timeId: time.id } });
  return time;
}
async function conferirPlacar(tx: Tx, jogo: { id: string; partidaId: number | null }, oficial: JogoPaulista) {
  if (!jogo.partidaId || !resultadoNumerico(oficial)) return;
  const local = await tx.partida.findUniqueOrThrow({ where: { id: jogo.partidaId } });
  const diverge = ['FINALIZADA', 'AO_VIVO'].includes(local.status) && (local.gols_mandante !== oficial.golsMandante || local.gols_visitante !== oficial.golsVisitante);
  if (diverge) await abrirPendencia(tx, jogo.id, 'PLACAR', { oficial: [oficial.golsMandante, oficial.golsVisitante], local: [local.gols_mandante, local.gols_visitante], partidaId: local.id });
  else await tx.fpfsPendencia.updateMany({ where: { jogoId: jogo.id, tipo: 'PLACAR', estado: { in: ['ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'] } }, data: { estado: 'RESOLVIDA' } });
}

export async function registrarPlacarAtual(banco: PrismaClient, eventoId: number, jogoId: string) {
  return banco.$transaction(async tx => {
    const jogo = await tx.fpfsJogo.findUniqueOrThrow({ where: { id: jogoId } });
    if (jogo.eventoId !== eventoId) throw new FalhaPaulista(404, 'Jogo de outro evento.');
    const oficial = jogo.oficial as unknown as JogoPaulista;
    if (oficial.ocorrencia || oficial.golsMandante === null || oficial.golsVisitante === null) throw new FalhaPaulista(409, 'Não há placar oficial numérico para esta revisão.');
    await conferirPlacar(tx, jogo, jogo.oficial as unknown as JogoPaulista);
    const p = await tx.fpfsPendencia.findUnique({ where: { jogoId_tipo: { jogoId, tipo: 'PLACAR' } } });
    if (!p || p.estado === 'RESOLVIDA') throw new FalhaPaulista(409, 'Placar não apresenta divergência atual. Atualize a consulta.');
    return p;
  }, { isolationLevel: 'Serializable' });
}

async function abrirPendencia(tx: Tx, jogoId: string, tipo: string, data: unknown) {
  const dados = json(data), where = { jogoId_tipo: { jogoId, tipo } };
  const atual = await tx.fpfsPendencia.findUnique({ where });
  if (atual && isDeepStrictEqual(atual.dados, dados)) return atual;
  return tx.fpfsPendencia.upsert({ where, create: { jogoId, tipo, dados }, update: { estado: 'ABERTA', dados } });
}

export async function importar(banco: PrismaClient, s: SnapshotPaulista, usuarioId: number | null) {
  const hash = createHash('sha256').update(JSON.stringify(s)).digest('hex');
  return banco.$transaction(async tx => {
    await exigirOperacao(['SINCRONIZAR_PAULISTA', 'AGENDA_OFICIAL'], { eventoId: s.id }, tx);
    const anterior = await tx.fpfsEvento.findUnique({ where: { id: s.id } });
    verificarContinuidade(anterior?.payload as unknown as SnapshotPaulista || null, s);
    const evento = await tx.fpfsEvento.upsert({ where: { id: s.id }, create: { id: s.id, ano: s.ano, titulo: s.titulo, divisao: s.divisao, categoria: s.categoria, payload: json(s), hash },
      update: { payload: json(s), hash, consultadoEm: new Date(), ...(anterior?.hash !== hash ? { versao: { increment: 1 } } : {}) } });
    const equipesAnteriores = new Map((await tx.fpfsEquipe.findMany({ where: { id: { in: s.equipes.map(e => e.id) } } })).map(e => [e.id, e]));
    await tx.fpfsEquipe.createMany({ data: s.equipes.filter(e => !equipesAnteriores.has(e.id)), skipDuplicates: true });
    for (const e of s.equipes) {
      const old = equipesAnteriores.get(e.id);
      if (old && (old.nome !== e.nome || old.escudo !== e.escudo)) await tx.fpfsEquipe.update({ where: { id: e.id }, data: { nome: e.nome, escudo: e.escudo } });
    }
    await tx.fpfsTime.createMany({ data: s.equipes.map(e => ({ eventoId: s.id, equipeId: e.id })), skipDuplicates: true });
    const anteriores = new Map((await tx.fpfsJogo.findMany({ where: { eventoId: s.id } })).map(j => [j.id, j]));
    await tx.fpfsJogo.createMany({ data: s.jogos.filter(j => !anteriores.has(j.id)).map(j => ({ id: j.id, eventoId: s.id, faseId: j.faseId, sumulaId: j.sumulaId, oficial: json(j) })) });
    const atuais = new Map((await tx.fpfsJogo.findMany({ where: { eventoId: s.id } })).map(j => [j.id, j]));
    const links = await tx.fpfsVinculo.findMany({ where: { equipeId: { in: s.equipes.map(e => e.id) }, clube: { ativo: true, categorias: { some: { faixaIdade: idade(s), ativa: true } } } }, orderBy: { confirmadoEm: 'asc' } });
    const categorias = new Map<number, Awaited<ReturnType<typeof categoria>>>();
    for (const link of links) categorias.set(link.clubeId, await categoria(tx, link.clubeId, s));
    const times = new Map((await tx.fpfsTime.findMany({ where: { eventoId: s.id, timeId: { not: null } }, include: { time: true } })).filter(t => t.time).map(t => [t.equipeId, t.time!]));
    const partidaIds = [...atuais.values()].flatMap(j => j.partidaId ? [j.partidaId] : []);
    const [partidas, participantes, eventosLocais, escalacoes, decisoesLocais, projecoes, placares] = await Promise.all([
      tx.partida.findMany({ where: { id: { in: partidaIds } } }),
      tx.participantePartida.findMany({ where: { partida_id: { in: partidaIds } } }),
      tx.evento.findMany({ where: { partida_id: { in: partidaIds } }, distinct: ['partida_id'], select: { partida_id: true } }),
      tx.escalacaoPartida.findMany({ where: { partida_id: { in: partidaIds } }, distinct: ['partida_id'], select: { partida_id: true } }),
      tx.auditoriaPartida.findMany({ where: { partida_id: { in: partidaIds } }, distinct: ['partida_id'], select: { partida_id: true } }),
      tx.fpfsAuditoria.findMany({ where: { eventoId: s.id, acao: PROJECAO }, orderBy: { id: 'asc' }, select: { dados: true } }),
      tx.fpfsPendencia.findMany({ where: { jogoId: { in: [...atuais.keys()] }, OR: [{ tipo: 'IDENTIDADE' }, { tipo: 'PLACAR', estado: { in: ['ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'] } }] }, select: { jogoId: true, tipo: true } }),
    ]);
    const partidasAntes = new Map(partidas.map(p => [p.id, p]));
    const participacoesAntes = new Set(participantes.map(e => `${e.partida_id}:${e.clube_id}`));
    const contribuicoes = new Set([...eventosLocais, ...escalacoes, ...decisoesLocais, ...participantes.filter(p => p.pronta || p.publicada_em)].map(p => p.partida_id));
    const ultimaProjecao = new Map(projecoes.map(a => {
      const d = a.dados as { jogoId: string; depois: unknown };
      return [d.jogoId, d.depois];
    }));
    const placaresAbertos = new Set(placares.filter(p => p.tipo === 'PLACAR').map(p => p.jogoId));
    const identidades = new Set(placares.filter(p => p.tipo === 'IDENTIDADE').map(p => p.jogoId));
    const equipeLocal = async (id: number, catId: number) => {
      if (!times.has(id)) times.set(id, await casca(tx, s, id, catId));
      return times.get(id)!;
    };
    let compId = evento.competicaoId;
    if (links.length && !compId) {
      const owner = links[0];
      const comp = await tx.competicao.create({ data: { nome: `Paulista ${s.ano} · ${s.divisao} · ${s.categoria}`, ano: s.ano, tipo: idade(s) <= 10 ? 'INICIACAO' : 'BASE', clube_id: owner.clubeId } });
      compId = comp.id;
      await tx.fpfsEvento.update({ where: { id: s.id }, data: { competicaoId: compId } });
    }
    let criadas = 0, atualizadas = 0;
    for (const j of s.jogos) {
      const old = anteriores.get(j.id);
      const publicado = old?.oficial as unknown as JogoPaulista | undefined;
      const mudanca = publicado && classificarMudanca(publicado, j);
      let row = atuais.get(j.id)!;
      const envolvidos = links.filter(v => [j.mandanteId, j.visitanteId].includes(v.equipeId));
      const localAnterior = row.partidaId ? partidasAntes.get(row.partidaId) : undefined;
      const segura = !!localAnterior && semContribuicao(localAnterior, publicado, ultimaProjecao.get(j.id), contribuicoes);
      if (old && !isDeepStrictEqual(old.oficial, json(j))) row = await tx.fpfsJogo.update({ where: { id: j.id }, data: { oficial: json(j), sumulaId: j.sumulaId } });
      if (mudanca && (mudanca.agenda.length || mudanca.resultado.length || mudanca.ocorrencia || mudanca.identidade)) {
        await audit(tx, s.id, usuarioId, 'DADOS_OFICIAIS_ALTERADOS', { jogoId: j.id, ...mudanca, antes: publicado, depois: j }); atualizadas++;
        if (mudanca.identidade && (envolvidos.length || localAnterior)) {
          await abrirPendencia(tx, j.id, 'IDENTIDADE', { antes: [publicado!.mandanteId, publicado!.visitanteId], depois: [j.mandanteId, j.visitanteId], partidaId: row.partidaId });
        }
        if (mudanca.agenda.length && localAnterior && !segura) {
          await abrirPendencia(tx, j.id, 'ALTERACAO_OFICIAL', { changes: mudanca.agenda, partidaId: row.partidaId });
        }
        if (mudanca.ocorrencia && localAnterior && !segura) {
          await abrirPendencia(tx, j.id, 'OCORRENCIA_OFICIAL', { antes: publicado!.ocorrencia, depois: j.ocorrencia, partidaId: row.partidaId });
        }
      }
      if (mudanca?.identidade || identidades.has(j.id)) continue;
      if (!envolvidos.length || j.ocorrencia || (!row.partidaId && (!j.data || !j.horario))) continue;
      const cat = categorias.get(envolvidos[0].clubeId)!;
      const home = await equipeLocal(j.mandanteId, cat.id), away = await equipeLocal(j.visitanteId, cat.id);
      if (!row.partidaId) {
        // Mesmo dia não significa mesmo confronto. Homônimo do adversário é
        // sinal para revisão, nunca autorização para fundir registros.
        const antigas = await tx.partida.findMany({ where: { categoria_id: cat.id, data: new Date(j.data!), fpfsJogo: null }, include: { mandante: true, visitante: true } });
        const adversarioId = envolvidos[0].equipeId === j.mandanteId ? j.visitanteId : j.mandanteId;
        const adversario = s.equipes.find(e => e.id === adversarioId)!;
        const ambigua = antigas.find(p => p.mandante_id === home.id && p.visitante_id === away.id || p.mandante_id === away.id && p.visitante_id === home.id || [p.mandante, p.visitante].some(t => nomeTime(t.nome) === nomeTime(adversario.nome)));
        if (ambigua) throw new FalhaPaulista(409, `Partida local #${ambigua.id} com possível mesmo confronto no SUB/data: revisar legado antes de distribuir.`);
        const p = await tx.partida.create({ data: { categoria_id: cat.id, competicao_id: compId, mandante_id: home.id, visitante_id: away.id,
          data: new Date(j.data!), horario: j.horario!, local: j.local, grupo: j.fase, sumula_clube_id: envolvidos[0].clubeId,
          emCasa: envolvidos[0].equipeId === j.mandanteId,
          ...(resultadoNumerico(j) ? { status: 'FINALIZADA', gols_mandante: j.golsMandante!, gols_visitante: j.golsVisitante! } : {}) } });
        row = await tx.fpfsJogo.update({ where: { id: row.id }, data: { partidaId: p.id } }); criadas++;
        await audit(tx, s.id, usuarioId, PROJECAO, { jogoId: j.id, origem: 'FEDERACAO', antes: null, depois: projetado(p) });
      } else if (localAnterior && segura) {
        const agenda = !!mudanca?.agenda.length && !!j.data && !!j.horario;
        const placar = resultadoNumerico(j) && (localAnterior.status !== 'FINALIZADA' || localAnterior.gols_mandante !== j.golsMandante || localAnterior.gols_visitante !== j.golsVisitante);
        if (agenda || placar) {
          const p = await tx.partida.update({ where: { id: row.partidaId }, data: {
            ...(agenda ? { data: new Date(j.data!), horario: j.horario!, local: j.local } : {}),
            ...(placar ? { status: 'FINALIZADA', gols_mandante: j.golsMandante!, gols_visitante: j.golsVisitante! } : {}),
            versao: { increment: 1 },
          } });
          await audit(tx, s.id, usuarioId, PROJECAO, { jogoId: j.id, origem: 'FEDERACAO', antes: projetado(localAnterior), depois: projetado(p),
            ...(agenda ? { agenda: mudanca?.agenda } : {}) });
        }
      }
      for (const v of envolvidos) {
        const category = categorias.get(v.clubeId)!, teamId = v.equipeId === j.mandanteId ? home.id : away.id;
        if (!participacoesAntes.has(`${row.partidaId}:${v.clubeId}`)) await tx.participantePartida.create({ data: { partida_id: row.partidaId!, clube_id: v.clubeId, categoria_id: category.id, time_id: teamId } });
      }
      if (placaresAbertos.has(j.id) || localAnterior && !segura) await conferirPlacar(tx, row, j);
    }
    if (anterior?.hash !== hash || criadas || atualizadas) await audit(tx, s.id, usuarioId, 'SINCRONIZACAO', { hash, versao: evento.versao, fonte: s.fonte, criadas, atualizadas, snapshot: s });
    return { criadas, atualizadas, total: s.jogos.length, versao: evento.versao };
  }, { isolationLevel: 'Serializable', timeout: 90_000 });
}

export async function vincular(banco: PrismaClient, eventoId: number, equipeId: number, clubeId: number, usuarioId: number, motivo: string) {
  return banco.$transaction(async tx => {
    const evento = await tx.fpfsEvento.findUniqueOrThrow({ where: { id: eventoId } });
    const s = evento.payload as unknown as SnapshotPaulista;
    if (!s.equipes.some(e => e.id === equipeId)) throw new FalhaPaulista(400, 'Equipe não pertence a este evento.');
    const cat = await categoria(tx, clubeId, s);
    const existente = await tx.fpfsVinculo.findUnique({ where: { equipeId } });
    if (existente?.clubeId === clubeId) return existente;
    if (existente) throw new FalhaPaulista(409, 'Desfaça/revise o vínculo anterior antes de associar outro clube.');
    if (await tx.fpfsVinculo.findFirst({ where: { clubeId, equipe: { times: { some: { eventoId } } } } })) throw new FalhaPaulista(409, 'Este clube já representa outra equipe no mesmo evento.');
    const aliases = await tx.fpfsTime.findMany({ where: { equipeId, timeId: { not: null } }, include: { time: true, evento: true } });
    for (const id of new Set([eventoId, ...aliases.map(a => a.eventoId)])) await exigirOperacao(['AGENDA_OFICIAL'], { eventoId: id }, tx);
    for (const alias of aliases) {
      const c = await categoria(tx, clubeId, alias.evento.payload as unknown as SnapshotPaulista);
      const outro = await tx.time.findFirst({ where: { clube_representado_id: clubeId, categoria_id: c.id, id: { not: alias.timeId! } } });
      if (outro) throw new FalhaPaulista(409, `O clube já tem time #${outro.id} nesse SUB. Revisar antes de vincular, sem duplicar ou apagar históricos.`);
      if (alias.time?.clube_representado_id && alias.time.clube_representado_id !== clubeId) throw new FalhaPaulista(409, 'Casca vinculada a outro clube.');
    }
    const link = await tx.fpfsVinculo.create({ data: { equipeId, clubeId, usuarioId, motivo } });
    for (const alias of aliases) await tx.time.update({ where: { id: alias.timeId! }, data: { clube_representado_id: clubeId } });
    await tx.fpfsEvento.update({ where: { id: eventoId }, data: { verificadoEm: new Date() } });
    await audit(tx, eventoId, usuarioId, 'VINCULO_CONFIRMADO', { equipeId, clubeId, categoriaId: cat.id, motivo, times: aliases.map(t => t.timeId) });
    return link;
  }, { isolationLevel: 'Serializable' });
}
export async function desfazerVinculo(banco: PrismaClient, eventoId: number, equipeId: number, usuarioId: number, motivo: string) {
  return banco.$transaction(async tx => {
    const link = await tx.fpfsVinculo.findUnique({ where: { equipeId } });
    if (!link) throw new FalhaPaulista(404, 'Vínculo não encontrado.');
    const times = await tx.fpfsTime.findMany({ where: { equipeId }, select: { timeId: true, eventoId: true } });
    for (const id of new Set([eventoId, ...times.map(t => t.eventoId)])) await exigirOperacao(['AGENDA_OFICIAL'], { eventoId: id }, tx);
    const ids = [...new Set(times.flatMap(t => t.timeId === null ? [] : [t.timeId]))];
    const participacoes = await tx.participantePartida.findMany({ where: { clube_id: link.clubeId, time_id: { in: ids } } });
    const jogos = participacoes.map(p => p.partida_id);
    const [linhas, eventos] = await Promise.all([
      tx.escalacaoPartida.count({ where: { partida_id: { in: jogos }, time_id: { in: ids }, jogador: { categoria: { clube_id: link.clubeId } } } }),
      tx.evento.count({ where: { partida_id: { in: jogos }, time_id: { in: ids }, jogador: { categoria: { clube_id: link.clubeId } } } }),
    ]);
    if (linhas || eventos) throw new FalhaPaulista(409, 'Há dados próprios do cliente na casca. Reversão bloqueada: revisar e preservar esses registros antes de desvincular.');
    // A equipe que sustentou a criação das partidas exige transferência de operação,
    // não pode deixar sua própria agenda órfã por uma reversão simples.
    if (await tx.partida.count({ where: { id: { in: jogos }, categoria: { clube_id: link.clubeId } } })) throw new FalhaPaulista(409, 'É o clube âncora da agenda: exige revisão/transferência antes de desfazer.');
    await tx.participantePartida.deleteMany({ where: { id: { in: participacoes.map(p => p.id) } } });
    await tx.time.updateMany({ where: { id: { in: ids }, clube_representado_id: link.clubeId }, data: { clube_representado_id: null } });
    await tx.fpfsVinculo.delete({ where: { equipeId } });
    await tx.fpfsEvento.updateMany({ where: { times: { some: { equipeId } } }, data: { diario: false } });
    await audit(tx, eventoId, usuarioId, 'VINCULO_DESFEITO', { antes: link, timeIdsPreservados: ids, motivo });
  }, { isolationLevel: 'Serializable' });
}
export function divergenciaPlacar(j: {
  id: string; oficial: unknown;
  partida: { id: number; status: string; gols_mandante: number; gols_visitante: number } | null;
  pendencias: { id: number; tipo: string; estado: string; dados: unknown }[];
}) {
  const o = j.oficial as JogoPaulista, p = j.partida;
  if (j.pendencias.some(v => v.tipo === 'IDENTIDADE') || !p || !['FINALIZADA', 'AO_VIVO'].includes(p.status) || !resultadoNumerico(o) ||
    (p.gols_mandante === o.golsMandante && p.gols_visitante === o.golsVisitante)) return null;
  const dados = { oficial: [o.golsMandante, o.golsVisitante], local: [p.gols_mandante, p.gols_visitante], partidaId: p.id };
  const saved = j.pendencias.find(v => v.tipo === 'PLACAR');
  return { id: saved?.id || 0, jogoId: j.id, tipo: 'PLACAR', estado: saved && isDeepStrictEqual(saved.dados, dados) ? saved.estado : 'ABERTA', dados };
}

export async function painel(banco: PrismaClient, id: number) {
  const e = await banco.fpfsEvento.findUnique({ where: { id }, include: { jogos: { include: { pendencias: true, partida: true } } } });
  if (!e) throw new FalhaPaulista(404, 'Evento não importado.');
  const snapshot = e.payload as unknown as SnapshotPaulista;
  const links = await banco.fpfsVinculo.findMany({ where: { equipeId: { in: snapshot.equipes.map(t => t.id) } }, include: { clube: { select: { nome: true, escudo: true } } } });
  // Consulta não escreve no banco. Divergências novas já aparecem; a sincronização
  // persiste a pendência com o histórico da consulta externa.
  const pendencias = e.jogos.flatMap(j => {
    const divergencia = divergenciaPlacar(j);
    return divergencia ? [divergencia] : [];
  });
  pendencias.push(...e.jogos.flatMap(j => j.pendencias.filter(p => p.tipo !== 'PLACAR' && (p.tipo !== 'ALTERACAO_OFICIAL' || pendenciaDeCalendario(p.dados))) as any[]));
  // Resumo permanente por jogo/clube: o marcador não some quando houver mais
  // de 30 complementações, sem enviar motivos livres ou IDs de usuários.
  const retroativos = await banco.$queryRaw<{ id: number; acao: string; criadoEm: Date; dados: any }[]>(Prisma.sql`
    SELECT MIN(id) AS id, 'RETROATIVO' AS acao, MAX("criadoEm") AS "criadoEm",
      jsonb_build_object('jogoId', dados->>'jogoId', 'clubeId', (dados->>'clubeId')::int,
        'quantidade', COUNT(*), 'origem', 'CLUBE_RETROATIVO') AS dados
    FROM "FpfsAuditoria" WHERE "eventoId" = ${id} AND acao = 'RETROATIVO'
    GROUP BY dados->>'jogoId', dados->>'clubeId' ORDER BY MAX("criadoEm") DESC
  `);
  return { evento: { id, versao: e.versao, consultadoEm: e.consultadoEm, verificadoEm: e.verificadoEm, diario: e.diario }, snapshot,
    vinculos: links.map(v => ({ equipeId: v.equipeId, clubeId: v.clubeId, nome: v.clube.nome, escudo: v.clube.escudo })), jogosLocais: e.jogos.map(j => ({ id: j.id, partidaId: j.partidaId, status: j.partida?.status })), pendencias,
    retroativos };
}

export async function retroativo(banco: PrismaClient, jogoId: string, clubeId: number, usuarioId: number, body: any) {
  if (typeof body.requestId !== 'string' || !/^[a-zA-Z\d-]{16,80}$/.test(body.requestId)) throw new FalhaPaulista(400, 'Envio sem identificador único.');
  if (!Number.isSafeInteger(body.jogadorId) || !['GOL', 'ASSISTENCIA', 'DEFESA', 'FALTA', 'CARTAO_AMARELO', 'CARTAO_VERMELHO', 'CARTAO_AZUL'].includes(body.tipo) || typeof body.motivo !== 'string' || body.motivo.trim().length < 5 || body.motivo.length > 500) throw new FalhaPaulista(400, 'Informe jogador, evento e motivo (mínimo 5 caracteres).');
  const periodo = body.periodo ?? 1, minuto = body.minuto ?? null;
  if (!Number.isInteger(periodo) || periodo < 1 || periodo > 4 || minuto !== null && (!Number.isInteger(minuto) || minuto < 0 || minuto > 99)) throw new FalhaPaulista(400, 'Período ou minuto inválido.');
  return banco.$transaction(async tx => {
    const jogo = await tx.fpfsJogo.findUniqueOrThrow({ where: { id: jogoId } }), oficial = jogo.oficial as unknown as JogoPaulista;
    const anterior = await tx.fpfsAuditoria.findFirst({ where: { eventoId: jogo.eventoId, usuarioId, acao: 'RETROATIVO', dados: { path: ['requestId'], equals: body.requestId } } });
    if (anterior) {
      const d = anterior.dados as any;
      if (d.jogoId !== jogoId || d.jogadorId !== body.jogadorId || d.tipo !== body.tipo || d.clubeId !== clubeId || (d.periodo ?? 1) !== periodo || (d.minuto ?? null) !== minuto) throw new FalhaPaulista(409, 'Identificador já usado para outra operação.');
      return tx.evento.findUniqueOrThrow({ where: { id: d.eventoId } });
    }
    if (!jogo.partidaId || oficial.golsMandante === null || oficial.golsVisitante === null || oficial.ocorrencia) throw new FalhaPaulista(409, 'Complementação disponível após resultado oficial numérico.');
    const equipe = await tx.participantePartida.findUnique({ where: { partida_id_clube_id: { partida_id: jogo.partidaId, clube_id: clubeId } } });
    if (!equipe) throw new FalhaPaulista(403, 'Seu clube não é participante deste jogo.');
    const papel = await tx.usuarioClube.findUnique({ where: { usuario_id_clube_id: { usuario_id: usuarioId, clube_id: clubeId } }, include: { categorias: true } });
    if (!papel || !['ADMIN', 'TECNICO', 'MESARIO'].includes(papel.papel) || !(papel.papel === 'ADMIN' || papel.acesso_todas_categorias || papel.categorias.some(c => c.categoria_id === equipe.categoria_id))) throw new FalhaPaulista(403, 'Você não administra esta categoria.');
    const player = await tx.jogador.findFirst({ where: { id: body.jogadorId, categoria_id: equipe.categoria_id, ativo: true } });
    if (!player || player.numCamisa === null) throw new FalhaPaulista(400, 'Jogador precisa estar ativo no seu SUB e com camisa.');
    await tx.escalacaoPartida.upsert({ where: { partida_id_jogador_id: { partida_id: jogo.partidaId, jogador_id: player.id } },
      create: { partida_id: jogo.partidaId, jogador_id: player.id, time_id: equipe.time_id, numCamisa: player.numCamisa, titular: body.titular === true }, update: {} });
    const event = await tx.evento.create({ data: { partida_id: jogo.partidaId, jogador_id: player.id, time_id: equipe.time_id, tipo: body.tipo, periodo, minuto, criado_por_id: usuarioId } });
    await audit(tx, jogo.eventoId, usuarioId, 'RETROATIVO', { jogoId, eventoId: event.id, jogadorId: player.id, clubeId, tipo: body.tipo, periodo, minuto, motivo: body.motivo.trim(), origem: 'CLUBE_RETROATIVO', requestId: body.requestId });
    // Não soma no placar local/oficial: é anotação histórica explicitamente identificada.
    return event;
  }, { isolationLevel: 'Serializable' });
}

export async function referenciasCompeticoes(banco: PrismaClient, ids: number[]) {
  if (!ativo() || !ids.length) return new Map<number, number>();
  try { return new Map((await banco.fpfsEvento.findMany({ where: { competicaoId: { in: ids } }, select: { id: true, competicaoId: true } })).map(e => [e.competicaoId!, e.id])); }
  catch (e: any) { if (e.code === 'P2021') return new Map<number, number>(); throw e; }
}
export async function timesVinculados(banco: PrismaClient, clubeId: number, locais: any[], permitidas?: number[]) {
  if (!ativo()) return locais;
  try {
    const cats = await banco.categoria.findMany({ where: { clube_id: clubeId, ...(permitidas ? { id: { in: permitidas } } : {}) } });
    const extras = await banco.time.findMany({ where: { clube_representado_id: clubeId, id: { notIn: locais.map(t => t.id) }, fpfsTime: { some: {} } }, include: { categoria: true, clubeRepresentado: { select: { id: true, nome: true, escudo: true } } } });
    return [...locais, ...extras.flatMap(t => { const c = cats.find(c => c.faixaIdade === t.categoria?.faixaIdade); return c ? [{ ...t, categoria: c, categoria_id: c.id }] : []; })];
  } catch (e: any) { if (e.code === 'P2021') return locais; throw e; }
}
