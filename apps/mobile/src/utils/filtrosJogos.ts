export const MESES_JOGOS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export const STATUS_JOGOS = [
  { label: 'Todos os jogos', value: 'TODOS', icon: 'soccer' },
  { label: 'Ao vivo', value: 'AO_VIVO', icon: 'record-circle-outline' },
  { label: 'Agendadas', value: 'AGENDADA', icon: 'calendar-clock' },
  { label: 'Finalizadas', value: 'FINALIZADA', icon: 'check' },
] as const;

export type FiltrosJogos = {
  mes: number | null;
  ano: number;
  status: (typeof STATUS_JOGOS)[number]['value'];
};

export function filtrosJogosAtuais(agora = new Date()): FiltrosJogos {
  return {
    mes: agora.getMonth() + 1,
    ano: agora.getFullYear(),
    status: 'TODOS',
  };
}

export function periodoJogos(filtros: FiltrosJogos) {
  return filtros.mes === null
    ? `Ano de ${filtros.ano}`
    : `${MESES_JOGOS[filtros.mes - 1]} de ${filtros.ano}`;
}

export function mesmosFiltrosJogos(a: FiltrosJogos, b: FiltrosJogos) {
  return a.ano === b.ano && a.mes === b.mes && a.status === b.status;
}

export function parametrosJogos(filtros: FiltrosJogos) {
  return {
    ano: filtros.ano,
    mes: filtros.mes ?? undefined,
    status: filtros.status === 'TODOS' ? undefined : filtros.status,
    resumo: true,
  };
}
