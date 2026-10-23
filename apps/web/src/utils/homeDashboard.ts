import type { HomePartida } from '../services/api';

export const nomeCategoria = (nome: string) => nome.trim().toUpperCase().replace(/\s+/g, '-');

export function hojeCalendario(agora = new Date()) {
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
}

export function dataHome(data: string, completa = false) {
  return new Date(`${data.slice(0, 10)}T12:00:00Z`).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', ...(completa ? { year: 'numeric' } : {}), timeZone: 'UTC',
  }).replace(/\./g, '');
}

export function resultadoPartida(partida: HomePartida) {
  const favor = partida.emCasa ? partida.gols_mandante : partida.gols_visitante;
  const contra = partida.emCasa ? partida.gols_visitante : partida.gols_mandante;
  return favor > contra ? 'V' : favor < contra ? 'D' : 'E';
}

export function resumoCategoria(partidas: HomePartida[], categoria: string, hoje: string) {
  const selecionadas = partidas.filter(p => nomeCategoria(p.categoria.nome) === nomeCategoria(categoria));
  const ordem = (a: HomePartida, b: HomePartida) =>
    `${a.data.slice(0, 10)} ${a.horario || '23:59'}`.localeCompare(`${b.data.slice(0, 10)} ${b.horario || '23:59'}`) || a.id - b.id;
  const aoVivo = selecionadas.filter(p => p.status === 'AO_VIVO').sort((a, b) =>
    Number(!!a.somente_leitura) - Number(!!b.somente_leitura) || ordem(a, b));
  const agenda = selecionadas.filter(p => ['AGENDADA', 'PREPARADA'].includes(p.status) && p.data.slice(0, 10) >= hoje).sort(ordem);
  const principal = aoVivo[0] || agenda[0];
  const historico = selecionadas.filter(p => p.status === 'FINALIZADA').sort((a, b) => ordem(b, a)).slice(0, 5);
  const totais = historico.reduce((atual, p) => { atual[resultadoPartida(p)]++; return atual; }, { V: 0, E: 0, D: 0 });
  return { principal, aoVivo, historico, totais, seguintes: agenda.filter(p => p.id !== principal?.id).slice(0, 3) };
}
