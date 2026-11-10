import type { PrismaClient } from '@prisma/client';
import { divergenciaPlacar } from '../paulista/service';
import { pendenciaDeCalendario } from '../paulista/rules';
import { inicioAoVivo, inicioSelect, passou24h } from './partidas-revisao';


// Somente leitura: usa os mesmos critérios da fila Paulista, sem sincronizar a fonte.
export async function resumoOperacional(banco: PrismaClient, agora = new Date()) {
  const abertas = ['ABERTA', 'EM_REVISAO', 'AGUARDANDO_CLUBE'];
  const [chamados, manutencao, federacao, antigas] = await Promise.allSettled([
    Promise.all([
      banco.suporteChamado.count({ where: { status: { not: 'RESOLVIDO' } } }),
      banco.suporteChamado.count({ where: { status: { not: 'RESOLVIDO' }, revisarEm: { lt: agora } } }),
    ]).then(([abertos, atrasados]) => ({ abertos, atrasados })),
    banco.manutencao.count({ where: { ativa: true } }),
    Promise.all([
      banco.fpfsPendencia.findMany({ where: { tipo: { not: 'PLACAR' }, estado: { in: abertas } }, select: { tipo: true, dados: true } }),
      banco.fpfsJogo.findMany({ where: { partida: { status: { in: ['FINALIZADA', 'AO_VIVO'] } } }, select: {
        id: true, oficial: true, partida: { select: { id: true, status: true, gols_mandante: true, gols_visitante: true } },
        pendencias: { where: { tipo: { in: ['PLACAR', 'IDENTIDADE'] } }, select: { id: true, tipo: true, estado: true, dados: true } },
      } }),
      banco.fpfsRotina.findUnique({ where: { id: 1 }, select: { erro: true } }),
      banco.fpfsCatalogo.count({ where: { erro: { not: null } } }),
    ]).then(([pendencias, jogos, rotina, falhas]) => ({
      pendencias: pendencias.filter(p => p.tipo !== 'ALTERACAO_OFICIAL' || pendenciaDeCalendario(p.dados)).length +
        jogos.filter(j => { const d = divergenciaPlacar(j); return d && abertas.includes(d.estado); }).length,
      falhas, erroRotina: !!rotina?.erro,
    })),
    banco.partida.findMany({ where: { status: 'AO_VIVO' },
      orderBy: [{ data: 'asc' }, { id: 'asc' }], select: { id: true, data: true, horario: true,
        mandante: { select: { nome: true, escudo: true, clubeRepresentado: { select: { escudo: true } } } },
        visitante: { select: { nome: true, escudo: true, clubeRepresentado: { select: { escudo: true } } } },
        organizador_id: true, auditoria: inicioSelect,
        categoria: { select: { nome: true, clube_id: true } } } }),
  ]);
  const partidas = antigas.status === 'fulfilled' ? antigas.value.map(({ auditoria, ...p }) => ({
    ...p,
    mandante: { nome: p.mandante.nome, escudo: p.mandante.escudo ?? p.mandante.clubeRepresentado?.escudo ?? null },
    visitante: { nome: p.visitante.nome, escudo: p.visitante.escudo ?? p.visitante.clubeRepresentado?.escudo ?? null },
    inicioAoVivo: inicioAoVivo(auditoria, agora)?.toISOString() ?? null,
  })) : null;
  return { consultadoEm: agora.toISOString(),
    chamados: chamados.status === 'fulfilled' ? chamados.value : null,
    manutencao: manutencao.status === 'fulfilled' ? manutencao.value : null,
    federacao: federacao.status === 'fulfilled' ? federacao.value : null,
    antigas: partidas?.filter(p => passou24h(p.inicioAoVivo ? new Date(p.inicioAoVivo) : null, agora)) ?? null,
    semInicio: partidas?.filter(p => !p.inicioAoVivo) ?? null,
  };
}
