import type { Prisma, PrismaClient } from '@prisma/client';
import { escopoPartidas } from '../partidas/visibilidade';

export const clubePublicoSelect = { id: true, nome: true, escudo: true, cidade: true, estado: true } as const;
const categoriaSelect = { id: true, nome: true, tipo: true, clube_id: true } as const;
const timeSelect = { id: true, nome: true, escudo: true, clube_representado_id: true,
  clubeRepresentado: { select: clubePublicoSelect } } as const;
export const competicaoPublicaSelect = { id: true, nome: true, ano: true, tipo: true, clube_id: true,
  titulares_necessarios: true, exigir_inscricao: true, clube: { select: { id: true, nome: true } } } as const;
export const partidaPublicaSelect = {
  id: true, mandante_id: true, visitante_id: true, gols_mandante: true, gols_visitante: true,
  data: true, horario: true, local: true, status: true, emCasa: true, categoria_id: true,
  competicao_id: true, rodada: true, grupo: true, organizador_id: true, sumula_clube_id: true,
  titulares_necessarios: true, periodo_atual: true, versao: true,
  categoria: { select: categoriaSelect }, competicao: { select: competicaoPublicaSelect },
  mandante: { select: timeSelect }, visitante: { select: timeSelect },
  participantes: { select: { id: true, clube_id: true, categoria_id: true, time_id: true,
    pronta: true, publicada_em: true, clube: { select: clubePublicoSelect }, categoria: { select: categoriaSelect } } },
} satisfies Prisma.PartidaSelect;
type PublicMatch = Prisma.PartidaGetPayload<{ select: typeof partidaPublicaSelect }>;

function timePublico(time: PublicMatch['mandante']) {
  return { id: time.id, nome: time.clubeRepresentado?.nome || time.nome,
    escudo: time.clubeRepresentado?.escudo || time.escudo, clube_representado_id: time.clube_representado_id };
}
// Lista explícita: nunca propagar objetos Prisma completos para o visitante.
export function publicarPartida(p: PublicMatch, clubeId: number) {
  const equipe = p.participantes.find(team => team.clube_id === clubeId);
  const categoria = equipe?.categoria || p.categoria;
  return { id: p.id, mandante_id: p.mandante_id, visitante_id: p.visitante_id,
    gols_mandante: p.gols_mandante, gols_visitante: p.gols_visitante, data: p.data,
    horario: p.horario, local: p.local, status: p.status, emCasa: equipe ? equipe.time_id === p.mandante_id : p.categoria.clube_id === clubeId ? p.emCasa : p.mandante.clube_representado_id === clubeId,
    categoria_id: categoria.id, categoria, competicao_id: p.competicao_id,
    competicao: p.competicao ? { id: p.competicao.id, nome: p.competicao.nome, ano: p.competicao.ano, tipo: p.competicao.tipo } : null,
    rodada: p.rodada, grupo: p.grupo, organizador_id: p.organizador_id, sumula_clube_id: p.sumula_clube_id,
    titulares_necessarios: p.titulares_necessarios, periodo_atual: p.periodo_atual, versao: p.versao,
    mandante: timePublico(p.mandante), visitante: timePublico(p.visitante), somente_leitura: true, clube_origem_id: p.categoria.clube_id };
}

export function escopoCompeticoesPublicas(clubeId: number): Prisma.CompeticaoWhereInput {
  return { arquivada: false, OR: [{ clube_id: clubeId }, { partidas: { some: escopoPartidas(clubeId) } }] };
}

export async function consultarPartidaPublica(banco: PrismaClient, id: number, preferido?: number) {
  const p = await banco.partida.findUnique({ where: { id }, select: partidaPublicaSelect });
  if (!p) return null;
  const clubes = new Set([p.categoria.clube_id, p.mandante.clube_representado_id, p.visitante.clube_representado_id,
    ...p.participantes.map(team => team.clube_id)]);
  const clubeId = preferido && clubes.has(preferido) ? preferido : p.categoria.clube_id;
  const published = p.participantes.filter(team => team.publicada_em !== null);
  const legacy = !p.participantes.length && ['AO_VIVO', 'FINALIZADA'].includes(p.status);
  const timesPublicados = legacy ? [p.emCasa ? p.mandante_id : p.visitante_id] : published.map(team => team.time_id);
  const [clubesVisiveis, escalacao, eventos] = await Promise.all([
    banco.clube.findMany({ where: { id: { in: [...clubes].filter((value): value is number => value !== null) } }, select: clubePublicoSelect }),
    timesPublicados.length ? banco.escalacaoPartida.findMany({ where: { partida_id: p.id, time_id: { in: timesPublicados } },
      select: { jogador_id: true, numCamisa: true, titular: true, titular_inicial: true, time_id: true, ordem: true,
        jogador: { select: { id: true, nome: true, posicao: true } } }, orderBy: [{ ordem: 'asc' }, { id: 'asc' }] }) : Promise.resolve([]),
    ['AO_VIVO', 'FINALIZADA'].includes(p.status) ? banco.evento.findMany({ where: { partida_id: p.id },
      select: { id: true, partida_id: true, tipo: true, periodo: true, minuto: true, jogador_id: true, time_id: true, gol_contra: true,
        jogador: { select: { id: true, nome: true } } }, orderBy: { id: 'asc' } }) : Promise.resolve([]),
  ]);
  const clube = clubesVisiveis.find(c => c.id === clubeId);
  const organizador = clubesVisiveis.find(c => c.id === (p.organizador_id || p.categoria.clube_id)) || clube!;
  const equipes = p.participantes.map(team => ({ id: team.id, clube_id: team.clube_id, categoria_id: team.categoria_id,
    time_id: team.time_id, pronta: team.pronta, publicada_em: team.publicada_em, clube: team.clube, categoria: team.categoria,
    escalacao: team.publicada_em ? escalacao.filter(row => row.time_id === team.time_id) : [] }));
  if (legacy && clube) equipes.push({ id: 0, clube_id: p.categoria.clube_id, categoria_id: p.categoria.id,
    time_id: timesPublicados[0], pronta: true, publicada_em: p.data, clube, categoria: p.categoria, escalacao });
  return { clube, partida: publicarPartida(p, clubeId), organizador, equipes,
    minhaEquipeId: equipes.find(team => team.clube_id === clubeId)?.id,
    podePreparar: false, podeSumula: false, eventos, auditoria: [] };
}

export function classificarPartidas(partidas: PublicMatch[]) {
  const grupos = new Map<string, Map<string, { key: string; nome: string; pontos: number; jogos: number; vitorias: number; empates: number; derrotas: number; golsPro: number; golsContra: number; saldo: number }>>();
  for (const p of partidas) {
    const grupo = `${p.categoria.nome} · ${p.grupo || 'Geral'}`;
    if (!grupos.has(grupo)) grupos.set(grupo, new Map());
    const tabela = grupos.get(grupo)!;
    for (const [time, pro, contra] of [[p.mandante, p.gols_mandante, p.gols_visitante], [p.visitante, p.gols_visitante, p.gols_mandante]] as const) {
      const key = time.clube_representado_id ? `clube:${time.clube_representado_id}` : `time:${time.id}`;
      const row = tabela.get(key) || { key, nome: timePublico(time).nome, pontos: 0, jogos: 0, vitorias: 0, empates: 0, derrotas: 0, golsPro: 0, golsContra: 0, saldo: 0 };
      row.jogos++; row.golsPro += pro; row.golsContra += contra; row.saldo = row.golsPro - row.golsContra;
      if (pro > contra) { row.vitorias++; row.pontos += 3; } else if (pro === contra) { row.empates++; row.pontos++; } else row.derrotas++;
      tabela.set(key, row);
    }
  }
  return [...grupos].map(([grupo, times]) => ({ grupo, times: [...times.values()].sort((a, b) => b.pontos - a.pontos || b.vitorias - a.vitorias || b.saldo - a.saldo || b.golsPro - a.golsPro || a.nome.localeCompare(b.nome)) }));
}
