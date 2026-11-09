import { OperacaoPausada } from '../manutencao/service';
import type { PrismaClient } from '@prisma/client';
import { isDeepStrictEqual } from 'node:util';
import type { SnapshotPaulista, EquipePaulista, JogoPaulista } from '../../../../../packages/shared-types/src/paulista';
import { descobrirFonte, guardarDescoberta } from './discovery';
import { pendenciaDeCalendario, sugestoes } from './rules';
import { divergenciaPlacar, FalhaPaulista, importar, json, painel, vincular } from './service';
import { baixarEvento } from './provider';

const hora = 60 * 60 * 1000;
export async function resumoAdministrativo(banco: PrismaClient) {
  const partida = { id: true, status: true, gols_mandante: true, gols_visitante: true, participantes: { select: { clube_id: true } } } as const;
  const abertas = ['ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'];
  const [catalogo, eventos, clubes, vinculos, rotina, pendencias, partidas, rejeitadas] = await Promise.all([
    banco.fpfsCatalogo.findMany({ orderBy: [{ ano: 'desc' }, { id: 'asc' }] }),
    banco.fpfsEvento.findMany({ select: { id: true, consultadoEm: true, versao: true, _count: { select: { jogos: true } } } }),
    banco.clube.findMany({ select: { id: true, nome: true, cidade: true, escudo: true, categorias: { select: { faixaIdade: true } } }, orderBy: { nome: 'asc' } }),
    banco.fpfsVinculo.findMany({ include: { clube: { select: { nome: true, escudo: true } } } }), banco.fpfsRotina.findUnique({ where: { id: 1 } }),
    banco.fpfsPendencia.findMany({ where: { tipo: { not: 'PLACAR' }, estado: { in: abertas } }, include: { jogo: { select: { eventoId: true, oficial: true, partida: { select: partida } } } }, orderBy: { atualizadoEm: 'desc' } }),
    banco.fpfsJogo.findMany({ where: { partida: { status: { in: ['FINALIZADA', 'AO_VIVO'] } } }, select: { id: true, eventoId: true, oficial: true, partida: { select: partida }, pendencias: { where: { tipo: { in: ['PLACAR', 'IDENTIDADE'] } } } } }),
    banco.fpfsAuditoria.findMany({ where: { acao: 'SUGESTAO_REJEITADA' }, select: { eventoId: true, dados: true } }),
  ]);
  const porEquipe = new Map(vinculos.map(v => [v.equipeId, v.clubeId]));
  const placares = partidas.flatMap(j => {
    const divergencia = divergenciaPlacar(j);
    return divergencia && abertas.includes(divergencia.estado) ? [{ ...divergencia, atualizadoEm: j.pendencias.find(p => p.tipo === 'PLACAR')?.atualizadoEm ?? null, jogo: j }] : [];
  });
  const equipeNome = new Map(catalogo.flatMap(c => (c.equipes as unknown as EquipePaulista[]).map(e => [e.id, e.nome] as const)));
  const clubeNome = new Map(clubes.map(c => [c.id, c.nome]));
  const nome = (id: number) => clubeNome.get(porEquipe.get(id) || 0) || equipeNome.get(id) || 'Equipe a confirmar';
  const fila = [...pendencias.filter(p => p.tipo !== 'ALTERACAO_OFICIAL' || pendenciaDeCalendario(p.dados)), ...placares].map(({ id, jogoId, tipo, estado, jogo, atualizadoEm }) => {
    const oficial = jogo.oficial as unknown as JogoPaulista;
    const clubesDoJogo = [porEquipe.get(oficial.mandanteId), porEquipe.get(oficial.visitanteId), ...(jogo.partida?.participantes.map(p => p.clube_id) || [])];
    return { id, jogoId, tipo, estado, atualizadoEm, clubeIds: [...new Set(clubesDoJogo.filter((clube): clube is number => !!clube))],
      jogo: { eventoId: jogo.eventoId, data: oficial.data, horario: oficial.horario, mandante: nome(oficial.mandanteId), visitante: nome(oficial.visitanteId) } };
  });
  return { fila, rotina, clubes: clubes.map(({ id, nome, escudo }) => ({ id, nome, escudo })), tarefas: { divergencias: fila.length }, catalogo: catalogo.map(c => {
    const e = eventos.find(e => e.id === c.id);
    const candidatas = (c.equipes as unknown as EquipePaulista[]).map(t => ({ ...t, vinculo: vinculos.find(v => v.equipeId === t.id) || null,
      sugestoes: sugestoes(t.nome, clubes.map(({ id, nome }) => ({ id, nome }))).filter(cl => !rejeitadas.some(r => r.eventoId === c.id && (r.dados as any).equipeId === t.id && (r.dados as any).clubeId === cl.id)).filter(cl => clubes.find(v => v.id === cl.id)?.categorias.some(cat => cat.faixaIdade === Number(c.categoria.match(/\d+/)?.[0]))) }));
    return { ...c, equipes: candidatas, jogos: e?._count.jogos || 0, versao: e?.versao || 0,
      estado: c.erro ? 'ERRO' : c.acompanhado ? 'ACOMPANHADO' : candidatas.some(t => t.sugestoes.length && !t.vinculo) ? 'REVISAR_IDENTIDADE' : 'DESCOBERTO' };
  }) };
}

export async function executarCiclo(banco: PrismaClient, sync: (id: number) => Promise<unknown>, agora = new Date()) {
  await banco.fpfsRotina.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} });
  const lock = await banco.fpfsRotina.updateMany({ where: { id: 1, OR: [{ leaseAte: null }, { leaseAte: { lt: agora } }] }, data: { leaseAte: new Date(agora.getTime() + 15 * 60_000) } });
  if (!lock.count) return { ocupado: true };
  try {
    const rotina = await banco.fpfsRotina.findUniqueOrThrow({ where: { id: 1 } });
    if (!rotina.proximaEm || rotina.proximaEm <= agora) {
      try {
        const rows = await descobrirFonte(); await guardarDescoberta(banco, rows);
        await banco.fpfsRotina.update({ where: { id: 1 }, data: { descobertaEm: agora, proximaEm: new Date(agora.getTime() + 24 * hora), erro: null } });
      } catch {
        await banco.fpfsRotina.update({ where: { id: 1 }, data: { proximaEm: new Date(agora.getTime() + hora), erro: 'Falha na descoberta; catálogo anterior preservado.' } });
      }
    }
    for (const c of await banco.fpfsCatalogo.findMany({ where: { acompanhado: true, OR: [{ proximaEm: null }, { proximaEm: { lte: agora } }] } })) {
      await banco.fpfsCatalogo.update({ where: { id: c.id }, data: { tentativaEm: agora } });
      try {
        await sync(c.id);
        await banco.fpfsCatalogo.update({ where: { id: c.id }, data: { sucessoEm: new Date(), proximaEm: new Date(agora.getTime() + 24 * hora), erro: null } });
      } catch (e) {
        if (e instanceof OperacaoPausada) continue;
        await banco.fpfsCatalogo.update({ where: { id: c.id }, data: { proximaEm: new Date(agora.getTime() + hora), erro: e instanceof FalhaPaulista ? e.message : 'Sincronização falhou; versão válida preservada. Consulte pendências e auditoria.' } });
      }
    }
    return { ocupado: false };
  } finally { await banco.fpfsRotina.update({ where: { id: 1 }, data: { leaseAte: null } }); }
}

export async function confirmarCandidato(banco: PrismaClient, eventoId: number, equipeId: number, clubeId: number, usuarioId: number, motivo: string) {
  const c = await banco.fpfsCatalogo.findUniqueOrThrow({ where: { id: eventoId } });
  if (!(c.equipes as unknown as EquipePaulista[]).some(e => e.id === equipeId)) throw new FalhaPaulista(409, 'Candidato não pertence ao evento descoberto.');
  await importar(banco, await baixarEvento(eventoId), usuarioId);
  await vincular(banco, eventoId, equipeId, clubeId, usuarioId, motivo);
  // O vínculo fica salvo mesmo se o legado precisar de revisão na distribuição.
  await banco.fpfsCatalogo.update({ where: { id: eventoId }, data: { acompanhado: true, proximaEm: new Date() } });
}

export async function revisarPendencia(banco: PrismaClient, eventoId: number, pendenciaId: number, usuarioId: number, motivo: string, acao: string, esperado?: unknown) {
  if (!['MANTER_OFICIAL', 'ENCAMINHAR_REVISAO', 'REGISTRAR_RESOLUCAO', 'SOLICITAR_CORRECAO_CLUBE'].includes(acao)) throw new FalhaPaulista(400, 'Decisão inválida.');
  return banco.$transaction(async tx => {
    const p = await tx.fpfsPendencia.findUniqueOrThrow({ where: { id: pendenciaId }, include: {
      jogo: { include: { partida: true, pendencias: { where: { tipo: 'IDENTIDADE' } } } },
    } });
    if (p.jogo.eventoId !== eventoId) throw new FalhaPaulista(404, 'Pendência de outro evento.');
    if (esperado !== undefined && !isDeepStrictEqual(p.dados, esperado)) throw new FalhaPaulista(409, 'Os dados mudaram durante a revisão. Atualize e confira novamente.');
    if (p.tipo === 'PLACAR' && !isDeepStrictEqual(divergenciaPlacar(p.jogo)?.dados, p.dados)) throw new FalhaPaulista(409, 'O placar ou o vínculo mudou durante a revisão. Atualize e confira novamente.');
    if (p.tipo === 'IDENTIDADE' && acao !== 'ENCAMINHAR_REVISAO') throw new FalhaPaulista(409, 'Mudança de identidade exige revisão do histórico; não pode ser aplicada automaticamente.');
    if (acao === 'SOLICITAR_CORRECAO_CLUBE' && (p.tipo !== 'PLACAR' || !p.jogo.partidaId)) throw new FalhaPaulista(409, 'A solicitação exige uma partida de clube com placar divergente.');
    const estado = acao === 'SOLICITAR_CORRECAO_CLUBE' ? 'AGUARDANDO_CLUBE' : acao === 'ENCAMINHAR_REVISAO' ? 'EM_REVISAO' : 'CONFERIDA';
    await tx.fpfsPendencia.update({ where: { id: p.id }, data: { estado } });
    await tx.fpfsAuditoria.create({ data: { eventoId, usuarioId, acao: 'DECISAO_PENDENCIA', dados: json({ pendenciaId, jogoId: p.jogoId, tipo: p.tipo, antes: p.dados, estado, acao, motivo, preservouEventosLocais: true }) } });
    return { estado };
  }, { isolationLevel: 'Serializable' });
}

export async function candidatosCascas(banco: PrismaClient, nome: string) {
  const catalogo = await resumoAdministrativo(banco);
  const links = await banco.fpfsTime.findMany({ where: { timeId: { not: null } }, include: { time: { include: { _count: { select: { partidas_mandante: true, partidas_visitante: true } } } } } });
  return catalogo.catalogo.flatMap(c => c.equipes.filter(e => !e.vinculo && sugestoes(e.nome, [{ id: 1, nome }]).length).map(e => {
    const time = links.find(l => l.eventoId === c.id && l.equipeId === e.id)?.time;
    return { eventoId: c.id, ano: c.ano, categoria: c.categoria, divisao: c.divisao, equipeId: e.id, nome: e.nome, escudo: e.escudo, timeId: time?.id || null,
      partidas: time ? time._count.partidas_mandante + time._count.partidas_visitante : 0 };
  }));
}
