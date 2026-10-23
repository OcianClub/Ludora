export type GrupoAgenda = 'ao_vivo' | 'agenda' | 'pendentes' | 'historico';

export type PartidaAgendaBase = {
  id: number;
  data: string;
  horario: string | null;
  status: string;
  categoria: { nome: string } | null;
  grupo_agenda: GrupoAgenda;
  posicao: number;
  total_grupo: number;
};

export type SecaoAgenda<T> = {
  key: string;
  titulo: string;
  descricao: string;
  data: T[];
  mais?: { grupo: GrupoAgenda; apos: number };
};

export function categoriaAgenda(nome: string) {
  return nome.trim().toUpperCase().replace(/ /g, '-');
}

export function agoraAgenda(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}T${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}`;
}

export function secoesAgenda<T extends PartidaAgendaBase>(partidas: T[]): SecaoAgenda<T>[] {
  const grupos: Record<GrupoAgenda, T[]> = {
    ao_vivo: [], agenda: [], pendentes: [], historico: [],
  };
  for (const partida of partidas) grupos[partida.grupo_agenda].push(partida);
  for (const lista of Object.values(grupos)) lista.sort((a, b) => a.posicao - b.posicao || a.id - b.id);
  const secoes: SecaoAgenda<T>[] = [];
  const adicionar = (grupo: GrupoAgenda, titulo: string, descricao: string) => {
    const data = grupos[grupo];
    if (!data.length) return;
    const apos = Math.max(...data.map((partida) => partida.posicao));
    const mais = apos < data[0].total_grupo ? { grupo, apos } : undefined;
    secoes.push({ key: grupo, titulo, descricao, data, mais });
  };
  adicionar('ao_vivo', 'Ao vivo', 'Partidas em andamento');
  if (grupos.agenda.length) {
    secoes.push({ key: 'a_seguir', titulo: 'A seguir', descricao: 'Próxima partida agendada', data: [grupos.agenda[0]] });
    const restantes = grupos.agenda.slice(1);
    const apos = grupos.agenda[grupos.agenda.length - 1].posicao;
    const mais = apos < grupos.agenda[0].total_grupo ? { grupo: 'agenda' as const, apos } : undefined;
    if (restantes.length) {
      secoes.push({ key: 'agenda', titulo: 'Próximos jogos', descricao: 'Agenda por data e horário', data: restantes, mais });
    } else secoes[secoes.length - 1].mais = mais;
  }
  adicionar('pendentes', 'Aguardando atualização', 'A data passou, mas o resultado ainda não foi registrado');
  adicionar('historico', 'Partidas anteriores', 'Mais recentes primeiro');
  return secoes;
}

export function unirPaginasAgenda<T extends { id: number }>(atuais: T[], novas: T[]) {
  const mapa = new Map(atuais.map((partida) => [partida.id, partida]));
  for (const partida of novas) mapa.set(partida.id, partida);
  return [...mapa.values()];
}

export function rotuloAgenda(partida: PartidaAgendaBase, agora: Date, gestor: boolean) {
  const data = partida.data.slice(0, 10);
  const hoje = agoraAgenda(agora).slice(0, 10);
  const curta = data.split('-').reverse().slice(0, 2).join('/');
  if (partida.status === 'AO_VIVO') {
    return gestor && data < hoje ? `Iniciada em ${curta} · confira se já terminou` : null;
  }
  if (partida.status === 'FINALIZADA') return 'Finalizada';
  if (partida.status === 'CANCELADA') return 'Cancelada';
  const horarioValido = /^([01]\d|2[0-3]):[0-5]\d$/.test(partida.horario ?? '');
  const inicio = new Date(`${data}T${horarioValido ? partida.horario : '23:59'}:00`);
  const falta = inicio.getTime() - agora.getTime();
  if (falta < 0) return 'Aguardando atualização';
  if (horarioValido && falta <= 60 * 60 * 1000) return `Em breve · às ${partida.horario}`;
  const amanha = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + 1);
  const prefixo = data === hoje ? 'Hoje' : data === agoraAgenda(amanha).slice(0, 10) ? 'Amanhã' : curta;
  return horarioValido ? `${prefixo} às ${partida.horario}` : `${prefixo} · horário a definir`;
}
