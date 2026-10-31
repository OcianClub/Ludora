import type { Categoria, Clube, HomePartida, PerfilJogador } from '../services/api';

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
  const historico = selecionadas.filter(p => p.status === 'FINALIZADA').sort((a, b) => ordem(b, a)).slice(0, 5);
  const principal = aoVivo[0] || agenda[0] || historico[0];
  const totais = historico.reduce((atual, p) => { atual[resultadoPartida(p)]++; return atual; }, { V: 0, E: 0, D: 0 });
  const outrasCategoriasComAgenda = [...new Set(partidas.filter(p =>
    ['AGENDADA', 'PREPARADA'].includes(p.status) && p.data.slice(0, 10) >= hoje
    && nomeCategoria(p.categoria.nome) !== nomeCategoria(categoria),
  ).map(p => nomeCategoria(p.categoria.nome)))].sort((a, b) => a.localeCompare(b, 'pt-BR', { numeric: true }));
  return { principal, aoVivo, historico, totais, outrasCategoriasComAgenda, seguintes: agenda.filter(p => p.id !== principal?.id).slice(0, 3) };
}

export function gerenciaCategoria(clube: Clube | null, categoria: Categoria) {
  if (clube?.meuPapel === 'ADMIN') return true;
  return Boolean(clube && ['TECNICO', 'MESARIO'].includes(clube.meuPapel || '')
    && (clube.acessoTodasCategorias || clube.categoriasAcesso?.some(item => item.id === categoria.id)));
}

export function podePrepararHome(partida: HomePartida) {
  return ['AGENDADA', 'PREPARADA'].includes(partida.status)
    && (partida.minha_equipe_pronta != null || !partida.somente_leitura);
}

export function acaoHome(partida: HomePartida, gestor: boolean, clubeId?: number) {
  if (partida.status === 'FINALIZADA') return 'Ver resumo da partida';
  if (partida.status === 'AO_VIVO') {
    const responsavel = partida.sumula_clube_id ?? partida.clube_origem_id ?? partida.categoria.clube_id;
    return gestor && responsavel === clubeId ? 'Operar súmula' : 'Acompanhar ao vivo';
  }
  if (!gestor || !podePrepararHome(partida)) return 'Ver detalhes da partida';
  return partida.minha_equipe_pronta ? 'Consultar preparação'
    : (partida.titulares_definidos ?? 0) > 0 ? 'Continuar preparação' : 'Preparar partida';
}

export function destaquesCategoria(jogadores: PerfilJogador[]) {
  return (['totalGols', 'totalAssistencias'] as const).flatMap(campo => {
    const elegiveis = jogadores.filter(jogador => jogador.totalPartidas > 0 && jogador[campo] > 0);
    const maior = Math.max(0, ...elegiveis.map(jogador => jogador[campo]));
    const lideres = elegiveis.filter(jogador => jogador[campo] === maior)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR') || a.id - b.id);
    return lideres.length ? [{ campo, valor: maior, jogador: lideres[0], empatados: lideres.length - 1 }] : [];
  });
}
