export function registrosAtleta(eventos: { tipo: string; gol_contra: boolean }[]) {
  const totais = { gols: 0, assistencias: 0, defesas: 0, faltas: 0, cartoes: 0, golsContra: 0 };
  for (const evento of eventos) {
    if (evento.tipo === 'GOL') evento.gol_contra ? totais.golsContra++ : totais.gols++;
    if (evento.tipo === 'ASSISTENCIA') totais.assistencias++;
    if (evento.tipo === 'DEFESA') totais.defesas++;
    if (evento.tipo === 'FALTA') totais.faltas++;
    if (evento.tipo.startsWith('CARTAO_')) totais.cartoes++;
  }
  return totais;
}

type PartidaPerfil = {
  status: string; mandante_id: number; visitante_id: number; gols_mandante: number; gols_visitante: number;
  emCasa: boolean; categoria: { clube_id: number };
  participantes: { time_id: number }[];
  jogadores_escalonados: { time_id: number; titular_inicial: boolean | null }[];
  eventos: { tipo: string; gol_contra: boolean; time_id: number | null }[];
};

// A equipe e a titularidade vêm da súmula histórica, nunca da camisa ou posição atual.
export function resumirPartidaAtleta<T extends PartidaPerfil>(partida: T, clubeId: number) {
  const { eventos, jogadores_escalonados, participantes, categoria, ...dados } = partida;
  const escalacao = jogadores_escalonados[0];
  const equipeValida = (value: number | null | undefined) => value === partida.mandante_id || value === partida.visitante_id ? value : null;
  const evento = eventos.find(item => equipeValida(item.time_id) != null);
  const timeEvento = evento?.gol_contra
    ? evento.time_id === partida.mandante_id ? partida.visitante_id : partida.mandante_id
    : evento?.time_id;
  const equipeId = equipeValida(escalacao?.time_id) ?? equipeValida(timeEvento) ?? equipeValida(participantes[0]?.time_id)
    ?? (categoria.clube_id === clubeId ? partida.emCasa ? partida.mandante_id : partida.visitante_id : null);
  const mandante = equipeId === partida.mandante_id;
  const gols = mandante ? partida.gols_mandante : partida.gols_visitante;
  const sofridos = mandante ? partida.gols_visitante : partida.gols_mandante;
  const resultado = partida.status !== 'FINALIZADA' || equipeId == null ? null
    : gols === sofridos ? 'EMPATE' : gols > sofridos ? 'VITORIA' : 'DERROTA';
  return { ...dados, equipe_id: equipeId, resultado, convocado: !!escalacao,
    titularInicial: escalacao?.titular_inicial ?? null, registros: registrosAtleta(eventos) };
}
