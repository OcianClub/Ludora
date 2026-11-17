/** Public match facts, separate from private audit records and statistical events. */
export interface SubstituicaoPartida {
  id: number;
  time_id: number;
  periodo: number;
  criado_em: string;
  reposicao_expulsao: boolean;
  sai: { nome: string; numCamisa: number | null };
  entra: { nome: string; numCamisa: number | null };
}
type EventoCronologico = { id: number; periodo: number; criado_em?: string | null };
type ItemCronologico<E> = { key: string; periodo: number; instante: number; ordem: number } & (
  { tipo: 'evento'; evento: E } | { tipo: 'substituicao'; substituicao: SubstituicaoPartida }
);
export function acontecimentosPartida<E extends EventoCronologico>(eventos: readonly E[], substituicoes: readonly SubstituicaoPartida[] = []): ItemCronologico<E>[] {
  const instante = (data?: string | null) => Date.parse(data || '') || 0;
  const itens: ItemCronologico<E>[] = [
    ...eventos.map(evento => ({ key: `evento:${evento.id}`, periodo: evento.periodo, instante: instante(evento.criado_em), ordem: evento.id, tipo: 'evento' as const, evento })),
    ...substituicoes.map(substituicao => ({ key: `substituicao:${substituicao.id}`, periodo: substituicao.periodo, instante: instante(substituicao.criado_em), ordem: substituicao.id, tipo: 'substituicao' as const, substituicao })),
  ];
  return itens.sort((a, b) => b.periodo - a.periodo || b.instante - a.instante || b.ordem - a.ordem || a.key.localeCompare(b.key));
}
export function nomeNaSubstituicao(jogador: SubstituicaoPartida['sai']) {
  return `${jogador.numCamisa ? `#${String(jogador.numCamisa).padStart(2, '0')} · ` : ''}${jogador.nome}`;
}
