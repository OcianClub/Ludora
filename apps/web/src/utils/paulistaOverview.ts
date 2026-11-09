import type { SnapshotPaulista, PosicaoPaulista } from '../../../../packages/shared-types/src/paulista';
import { caminhoPublicado, chavePublicada, etapaPublicada, estadoCampanha, resumoClube } from './paulistaView';

export const nomeGrupo = (nome: string) => nome.replace(/CHAVE\s+[UÚ]NICA/gi, 'Chave Única').replace(/GRUPO\s+[UÚ]NICO/gi, 'Grupo Único');
export type EstadoEtapa = 'advanced' | 'ended' | 'published' | 'pending' | 'unreached';

/** Presentation of published facts only: a loss alone never confirms elimination. */
export function campanhaPublicada(snapshot: SnapshotPaulista, minhas: Set<number>, chave?: string) {
  const resumo = resumoClube(snapshot, minhas, '9999-12-31');
  const caminho = chave ? caminhoPublicado(snapshot, chave) : null;
  const jogos = chave ? resumo.jogos.filter(j => chavePublicada(j.fase) === chave) : [];
  const estados = new Map<string, EstadoEtapa>();
  for (const jogo of jogos) {
    const conexao = caminho?.conexoes.find(c => c.de === jogo.id);
    estados.set(jogo.id, conexao ? minhas.has(conexao.equipeId) ? 'advanced' : 'ended' : 'published');
  }
  const caiu = jogos.find(j => estados.get(j.id) === 'ended');
  const etapas = (caminho?.colunas || []).filter(c => c.etapa >= 0).map(c => {
    const destaEtapa = jogos.filter(j => etapaPublicada(j.fase) === c.etapa);
    const estado: EstadoEtapa = destaEtapa.some(j => estados.get(j.id) === 'ended') ? 'ended'
      : destaEtapa.some(j => estados.get(j.id) === 'advanced') ? 'advanced'
      : destaEtapa.length ? 'published' : caiu && c.etapa > etapaPublicada(caiu.fase) ? 'unreached' : 'pending';
    return { etapa: c.etapa, titulo: c.titulo, estado };
  });
  const fim = caiu ? ['nas oitavas de final', 'nas quartas de final', 'na semifinal', 'na final'][etapaPublicada(caiu.fase)] : null;
  return { jogos, estados, etapas, eliminado: !!caiu,
    titulo: fim ? `Eliminado ${fim}` : !resumo.classificacao && !resumo.jogos.length ? 'Participação a confirmar' : estadoCampanha(snapshot, minhas).startsWith('Classificação') ? 'Fase de classificação' : estadoCampanha(snapshot, minhas),
  };
}

/** Keep the official phase/group boundary and source order; never rank by local points. */
export function classificacaoProxima(snapshot: SnapshotPaulista, propria?: PosicaoPaulista) {
  const linhas = propria ? snapshot.classificacao.filter(r => r.faseId === propria.faseId && r.grupo === propria.grupo).slice().sort((a,b) => a.posicao - b.posicao) : [];
  const indice = linhas.findIndex(r => r.equipeId === propria?.equipeId);
  const inicio = Math.max(0, Math.min(indice - 2, linhas.length - 5));
  const completa = linhas.length > 0 && linhas.every((r, i) => r.posicao === i + 1);
  return { linhas: linhas.slice(inicio, inicio + 5), total: completa ? linhas.length : undefined };
}
