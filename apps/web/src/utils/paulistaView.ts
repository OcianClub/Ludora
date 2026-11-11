import type { JogoPaulista, SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import type { Partida } from '../services/api';
import { nomeOficial, situacaoPublicacao } from '../../../../packages/shared-types/src/paulistaPresentation/paulistaView';
export { painelDaSelecao, nomeOficial, ordemData, temResultado, estadoJogo, resumoClube, situacaoPublicacao, estadoCampanha, chavePublicada, etapaPublicada, caminhoPublicado } from '../../../../packages/shared-types/src/paulistaPresentation/paulistaView';

export function partidaOficial(s: SnapshotPaulista, j: JogoPaulista, minhas: Set<number>, localId?: number | null, localStatus?: Partida['status']): Partida {
  const time = (id: number) => { const t = s.equipes.find(t => t.id === id); return { id, nome: nomeOficial(t?.nome || 'Equipe a confirmar'), escudo: t?.escudo || undefined }; };
  return { id: localId || 0, mandante_id: j.mandanteId, visitante_id: j.visitanteId, mandante: time(j.mandanteId), visitante: time(j.visitanteId),
    data: j.data || '', horario: j.horario || undefined, local: j.local || undefined,
    gols_mandante: j.golsMandante ?? 0, gols_visitante: j.golsVisitante ?? 0,
    status: situacaoPublicacao(j, localStatus), categoria_id: s.id, categoria: { id: s.id, nome: s.categoria, tipo: Number(s.categoria.match(/\d+/)?.[0]) <= 10 ? 'INICIACAO' : 'BASE', clube_id: 0 },
    emCasa: minhas.has(j.mandanteId), semPerspectiva: !minhas.has(j.mandanteId) && !minhas.has(j.visitanteId), paulista_evento_id: s.id, oficialPaulista: j,
  };
}
