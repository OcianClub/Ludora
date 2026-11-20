type EstadoSumula = {
  partida: { id: number; status: string; versao: number; gols_mandante: number; gols_visitante: number };
  eventos: { id: number }[];
  auditoria?: { id: number }[];
};

export type EventoConfirmado<T extends EstadoSumula> = T['eventos'][number] & {
  sincronizacao?: {
    partidaId: number;
    anterior: number;
    versao: number;
    gols_mandante: number;
    gols_visitante: number;
    auditoria: NonNullable<T['auditoria']>[number];
  };
};

export function aplicarEventoConfirmado<T extends EstadoSumula>(atual: T, retorno: EventoConfirmado<T>): T | undefined {
  const { sincronizacao, ...evento } = retorno;
  if (!sincronizacao || sincronizacao.partidaId !== atual.partida.id) return;
  const { anterior, versao, auditoria, gols_mandante, gols_visitante } = sincronizacao;
  if (atual.partida.versao >= versao) return atual;
  if (atual.partida.status !== 'AO_VIVO' || atual.partida.versao !== anterior || versao !== anterior + 1
    || !auditoria || atual.eventos.some(item => item.id === evento.id)) return;
  return {
    ...atual,
    partida: { ...atual.partida, versao, gols_mandante, gols_visitante },
    eventos: [evento, ...atual.eventos],
    auditoria: [auditoria, ...(atual.auditoria ?? [])].slice(0, 40),
  };
}
