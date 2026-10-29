export class PreparacaoInvalida extends Error {}

type DadosPreparacao = { data: Date; horario: string | null; categoria_id: number };
type Convocado = { jogador_id: number; numCamisa: number; titular: boolean; jogador: { categoria_id: number } };

export function validarPreparacao(partida: DadosPreparacao, convocados: Convocado[]) {
  if (!partida.data || Number.isNaN(partida.data.getTime()) || !partida.horario || !/^([01]\d|2[0-3]):[0-5]\d$/.test(partida.horario)) {
    throw new PreparacaoInvalida('Confira a data e informe um horário válido antes de preparar a partida.');
  }
  if (convocados.filter(item => item.titular).length !== 5) {
    throw new PreparacaoInvalida('Salve uma escalação com exatamente cinco titulares antes de preparar ou iniciar.');
  }
  if (new Set(convocados.map(item => item.jogador_id)).size !== convocados.length || convocados.some(item =>
    item.jogador.categoria_id !== partida.categoria_id || !Number.isInteger(item.numCamisa) || item.numCamisa < 1 || item.numCamisa > 99)) {
    throw new PreparacaoInvalida('Todos os convocados devem pertencer à categoria da partida e ter uma camisa de 1 a 99.');
  }
}
