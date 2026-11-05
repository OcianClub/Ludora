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
  { label: 'Próximas', value: 'PROXIMAS', icon: 'calendar-clock' },
  { label: 'Finalizadas', value: 'FINALIZADA', icon: 'check' },
  { label: 'Canceladas', value: 'CANCELADA', icon: 'minus' },
] as const;

export const PERIODOS_JOGOS = [
  { id: 'todos', label: 'Todos' },
  { id: 'hoje', label: 'Hoje' },
  { id: 'semana', label: 'Esta semana' },
  { id: 'mes', label: 'Este mês' },
  { id: 'personalizado', label: 'Personalizado' },
] as const;

export type FiltrosJogos = {
  periodo?: (typeof PERIODOS_JOGOS)[number]['id'];
  de?: string;
  ate?: string;
  todosPeriodos?: boolean;
  busca?: string;
  organizadas?: boolean;
  preparacao?: 'AGENDADA' | 'PREPARADA';
  mando?: 'casa' | 'fora';
  ordem?: 'horario' | 'categoria';
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
  if (filtros.periodo === 'personalizado' && filtros.de) {
    const formatar = (data: string) => new Date(data + 'T12:00:00').toLocaleDateString('pt-BR', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
    return filtros.ate && filtros.ate !== filtros.de ? `${formatar(filtros.de)} – ${formatar(filtros.ate)}` : formatar(filtros.de);
  }
  if (filtros.periodo) return filtros.periodo === 'todos' ? 'Todos os períodos' :
    PERIODOS_JOGOS.find(item => item.id === filtros.periodo)!.label;
  if (filtros.todosPeriodos) return 'Todos os períodos';
  return filtros.mes === null
    ? `Ano de ${filtros.ano}`
    : `${MESES_JOGOS[filtros.mes - 1]} de ${filtros.ano}`;
}

export function mesmosFiltrosJogos(a: FiltrosJogos, b: FiltrosJogos) {
  return a.periodo === b.periodo && a.de === b.de && a.ate === b.ate &&
    !!a.todosPeriodos === !!b.todosPeriodos && a.ano === b.ano && a.mes === b.mes && a.status === b.status &&
    a.busca === b.busca && a.organizadas === b.organizadas &&
    a.preparacao === b.preparacao && a.mando === b.mando &&
    (a.ordem ?? 'horario') === (b.ordem ?? 'horario');
}

export function parametrosJogos(filtros: FiltrosJogos) {
  return {
    ano: filtros.ano,
    mes: filtros.mes ?? undefined,
    status: ['TODOS', 'PROXIMAS'].includes(filtros.status) ? undefined : filtros.status,
    ...((filtros.periodo === 'todos' || (!filtros.periodo && filtros.todosPeriodos)) && { todos_periodos: true }),
    ...(filtros.periodo && filtros.periodo !== 'todos' && { periodo: filtros.periodo }),
    ...(filtros.periodo === 'personalizado' && { de: filtros.de, ate: filtros.ate ?? filtros.de }),
    resumo: true,
    ...(filtros.busca?.trim() && { busca: filtros.busca.trim() }),
    ...(filtros.organizadas && { organizadas: true }),
    ...(filtros.preparacao && { preparacao: filtros.preparacao }),
    ...(filtros.mando && { mando: filtros.mando }),
  };
}
