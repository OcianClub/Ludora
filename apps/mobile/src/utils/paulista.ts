import type { SnapshotPaulista } from '../../../../packages/shared-types/src/paulista';
import { painelPaulistaPublico, type EventoPublicoPaulista, type ClubePaulistaPublico } from '../../../../packages/shared-types/src/paulistaPresentation/paulistaPublico';
export * from '../../../../packages/shared-types/src/paulistaPresentation/paulistaOverview';
export * from '../../../../packages/shared-types/src/paulistaPresentation/paulistaStandings';
export * from '../../../../packages/shared-types/src/paulistaPresentation/paulistaView';
export type { EventoPublicoPaulista };

export const numeroSub = (nome: string) => Number(nome.match(/\d+/)?.[0]) || 0;
export const categoriaPaulista = (nome: string) => `SUB-${numeroSub(nome)}`;
export function eventoDaSelecao(eventos: EventoPublicoPaulista[], ano: number, sub: string) {
  return eventos.find(e => e.ano === ano && categoriaPaulista(e.categoria) === categoriaPaulista(sub));
}
export function snapshotDoClube(evento: EventoPublicoPaulista, clube: ClubePaulistaPublico): SnapshotPaulista {
  const painel = painelPaulistaPublico(evento, clube);
  return { ...painel.snapshot, equipes: painel.snapshot.equipes.map(e => {
    const vinculo = painel.vinculos.find(v => v.equipeId === e.id);
    return vinculo ? { ...e, nome: vinculo.nome, escudo: vinculo.escudo || e.escudo } : e;
  }) };
}
export function fonteOficialValida(fonte?: string): fonte is string {
  return !!fonte && /^https:\/\/eventos\.admfutsal\.com\.br\/evento\/\d+\/?$/.test(fonte);
}

const calendarioSP = new Intl.DateTimeFormat('pt-BR', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});
export function hojePaulista() {
  const partes = calendarioSP.formatToParts(new Date());
  return ['year', 'month', 'day'].map(tipo => partes.find(parte => parte.type === tipo)?.value).join('-');
}
