export type NoticeType = 'PARTIDA_AGENDADA' | 'GOL_PARTIDA' | 'RESULTADO_PARTIDA' | 'CADASTRO_CLUBE';
export type Notice = {
  id: number;
  tipo?: NoticeType;
  titulo: string;
  corpo: string;
  lida: boolean;
  partida_id: number | null;
  dados?: { solicitacaoId?: string; clubeId?: number };
  criada_em: string;
};

export const NOTICE_LABELS: Record<NoticeType, string> = {
  PARTIDA_AGENDADA: 'Agenda', GOL_PARTIDA: 'Gol', RESULTADO_PARTIDA: 'Resultado', CADASTRO_CLUBE: 'Cadastro',
};

export function noticePresentation(notice: Notice): { label: string; icon: 'email' | 'edit' | 'broadcast' | 'cancel' | 'ball' | 'trophy' | 'calendar' | 'bell' } {
  if (notice.dados?.solicitacaoId) return { label: 'Solicitação', icon: 'email' };
  if (/súmula corrigida/i.test(notice.titulo)) return { label: 'Correção de súmula', icon: 'edit' };
  if (/partida iniciada/i.test(notice.titulo)) return { label: 'Partida iniciada', icon: 'broadcast' };
  if (/cancelad/i.test(notice.titulo)) return { label: 'Cancelamento', icon: 'cancel' };
  if (notice.tipo === 'GOL_PARTIDA') return { label: 'Gol', icon: 'ball' };
  if (notice.tipo === 'RESULTADO_PARTIDA') return { label: 'Resultado', icon: 'trophy' };
  if (notice.tipo === 'CADASTRO_CLUBE') return { label: 'Cadastro', icon: 'bell' };
  if (notice.tipo === 'PARTIDA_AGENDADA') return { label: 'Agenda', icon: 'calendar' };
  return { label: 'Atualização', icon: 'bell' };
}

export function formatNoticeBody(body: string) {
  return body.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (original, year, month, day) => {
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return original;
    return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '');
  });
}

export function bundleCorrections(notices: Notice[]) {
  const bundles: Notice[][] = [];
  for (const notice of notices) {
    const previous = bundles[bundles.length - 1];
    const latest = previous?.[0];
    const canBundle = latest && notice.partida_id != null && latest.partida_id === notice.partida_id
      && /súmula corrigida/i.test(latest.titulo) && /súmula corrigida/i.test(notice.titulo)
      && Date.parse(latest.criada_em) - Date.parse(notice.criada_em) <= 10 * 60_000
      && latest.lida === notice.lida;
    if (canBundle) previous.push(notice);
    else bundles.push([notice]);
  }
  return bundles;
}

export function groupNotices(notices: Notice[], now = new Date()) {
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  weekStart.setDate(weekStart.getDate() - (weekStart.getDay() + 6) % 7);
  const lastWeekStart = new Date(weekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const groups = new Map<string, { label: string; notices: Notice[] }>();
  const sorted = [...notices].sort((a, b) => Date.parse(b.criada_em) - Date.parse(a.criada_em) || b.id - a.id);
  for (const notice of sorted) {
    const date = new Date(notice.criada_em);
    const day = date.toDateString();
    const label = day === now.toDateString() ? 'Hoje' : day === yesterday.toDateString() ? 'Ontem'
      : date >= weekStart && date <= now ? 'Esta semana'
      : date >= lastWeekStart && date < weekStart ? 'Semana passada'
      : date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
    if (!groups.has(label)) groups.set(label, { label, notices: [] });
    groups.get(label)!.notices.push(notice);
  }
  return [...groups.values()];
}

export function formatNoticeTime(value: string, now = new Date()) {
  const date = new Date(value);
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  if ([now.toDateString(), yesterday.toDateString()].includes(date.toDateString())) return time;
  return `${date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' }).replace('.', '')} · ${time}`;
}
