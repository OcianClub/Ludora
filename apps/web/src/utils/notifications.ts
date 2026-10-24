export type NoticeType = 'PARTIDA_AGENDADA' | 'GOL_PARTIDA' | 'RESULTADO_PARTIDA';
export type Notice = {
  id: number;
  tipo?: NoticeType;
  titulo: string;
  corpo: string;
  lida: boolean;
  partida_id: number | null;
  criada_em: string;
};

export const NOTICE_LABELS: Record<NoticeType, string> = {
  PARTIDA_AGENDADA: 'Agenda', GOL_PARTIDA: 'Gol', RESULTADO_PARTIDA: 'Resultado',
};

export function groupNotices(notices: Notice[], now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const groups = new Map<string, { label: string; notices: Notice[] }>();
  const sorted = [...notices].sort((a, b) => Date.parse(b.criada_em) - Date.parse(a.criada_em) || b.id - a.id);
  for (const notice of sorted) {
    const date = new Date(notice.criada_em);
    const key = date.toDateString();
    const label = key === now.toDateString() ? 'Hoje' : key === yesterday.toDateString() ? 'Ontem'
      : date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups.has(key)) groups.set(key, { label, notices: [] });
    groups.get(key)!.notices.push(notice);
  }
  return [...groups.values()];
}
