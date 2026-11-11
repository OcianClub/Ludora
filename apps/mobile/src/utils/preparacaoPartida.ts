import type {
  GestaoPartida,
  EquipePartida,
} from "../services/partidasCompartilhadas";

export type Convocado = EquipePartida["escalacao"][number];

export function normalizarConvocados(
  convocados: Convocado[],
  titulares = 5,
): Convocado[] {
  return convocados.map((jogador, ordem) => ({
    ...jogador,
    titular: ordem < titulares,
  }));
}

export function trocarConvocados(
  convocados: Convocado[],
  origem: number,
  destino: number,
  titulares = 5,
) {
  const primeiro = convocados.findIndex(
    (jogador) => jogador.jogador_id === origem,
  );
  const segundo = convocados.findIndex(
    (jogador) => jogador.jogador_id === destino,
  );
  if (primeiro < 0 || segundo < 0 || primeiro === segundo) return convocados;
  const resultado = [...convocados];
  [resultado[primeiro], resultado[segundo]] = [
    resultado[segundo],
    resultado[primeiro],
  ];
  return normalizarConvocados(resultado, titulares);
}

export function atualizarCamisas(
  convocados: Convocado[],
  jogadorId: number,
  camisa: number,
  conflito?: { jogador_id: number; camisa_anterior: number | null },
  titulares = 5,
) {
  const resultado = convocados.flatMap((jogador) => {
    if (jogador.jogador_id === jogadorId)
      return [{ ...jogador, numCamisa: camisa }];
    if (jogador.jogador_id !== conflito?.jogador_id) return [jogador];
    return conflito.camisa_anterior
      ? [{ ...jogador, numCamisa: conflito.camisa_anterior }]
      : [];
  });
  return normalizarConvocados(resultado, titulares);
}

export function escalaValida(convocados: Convocado[], titulares = 5) {
  return (
    convocados.filter((jogador) => jogador.titular).length === titulares &&
    convocados.filter((jogador) => jogador.titular && jogador.jogador?.posicao === 'Goleiro').length === 1 &&
    convocados.every(
      (jogador) =>
        Number.isInteger(jogador.numCamisa) &&
        jogador.numCamisa >= 1 &&
        jogador.numCamisa <= 99,
    ) &&
    new Set(convocados.map((jogador) => jogador.jogador_id)).size ===
      convocados.length &&
    new Set(convocados.map((jogador) => jogador.numCamisa)).size ===
      convocados.length
  );
}

export function etapaPreparacao(dados: GestaoPartida, salva: string | null) {
  const equipe = dados.equipes.find((item) => item.id === dados.minhaEquipeId);
  if (
    !dados.podePreparar ||
    !["AGENDADA", "PREPARADA"].includes(dados.partida.status) ||
    !equipe ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(dados.partida.horario || "")
  )
    return 0;
  const valida = escalaValida(
    equipe.escalacao,
    dados.partida.titulares_necessarios,
  );
  if (equipe.pronta && valida) return 2;
  if (salva === "2" && valida) return 2;
  if (salva === "1" || equipe.escalacao.length) return 1;
  return 0;
}

export function numeroCamisa(numero: number) {
  return String(numero).padStart(2, "0");
}

export function conciliarCamisas(
  convocados: Convocado[],
  elenco: { id: number; numCamisa: number | null }[],
  titulares = 5,
) {
  const camisas = new Map(elenco.map((j) => [j.id, j.numCamisa]));
  let mudou = false;
  const atualizados = convocados.flatMap((jogador) => {
    const camisa = camisas.get(jogador.jogador_id);
    if (!camisa) {
      mudou = true;
      return [];
    }
    if (camisa === jogador.numCamisa) return [jogador];
    mudou = true;
    return [{ ...jogador, numCamisa: camisa }];
  });
  return mudou ? normalizarConvocados(atualizados, titulares) : convocados;
}
