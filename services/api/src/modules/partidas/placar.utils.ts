import type { Prisma } from '@prisma/client';

export type Placar = { gols_mandante: number; gols_visitante: number };
export type MudancaPlacar = { anterior: Placar; novo: Placar };

export class ConflitoPartida extends Error {}

export function placarValido(valor: unknown): valor is Placar {
  if (!valor || typeof valor !== 'object') return false;
  const placar = valor as Placar;
  return [placar.gols_mandante, placar.gols_visitante].every(
    (gols) => Number.isSafeInteger(gols) && gols >= 0 && gols <= 99
  );
}

export function mudancaGolValida(
  valor: unknown,
  delta: 1 | -1
): valor is MudancaPlacar {
  if (!valor || typeof valor !== 'object') return false;
  const mudanca = valor as MudancaPlacar;
  if (!placarValido(mudanca.anterior) || !placarValido(mudanca.novo))
    return false;
  const mandante = mudanca.novo.gols_mandante - mudanca.anterior.gols_mandante;
  const visitante =
    mudanca.novo.gols_visitante - mudanca.anterior.gols_visitante;
  return (
    (mandante === delta && visitante === 0) ||
    (visitante === delta && mandante === 0)
  );
}

export async function aplicarMudancaPlacar(
  tx: Prisma.TransactionClient,
  partidaId: number,
  mudanca: MudancaPlacar
) {
  const atualizacao = await tx.partida.updateMany({
    where: {
      id: partidaId,
      gols_mandante: mudanca.anterior.gols_mandante,
      gols_visitante: mudanca.anterior.gols_visitante,
    },
    data: {
      gols_mandante: mudanca.novo.gols_mandante,
      gols_visitante: mudanca.novo.gols_visitante,
    },
  });
  if (!atualizacao.count)
    throw new ConflitoPartida(
      'A partida foi atualizada em outro dispositivo. Confira os dados antes de continuar.'
    );
}

export async function gravarEventoComPlacar(
  tx: Prisma.TransactionClient,
  dados: Prisma.EventoUncheckedCreateInput,
  mudanca?: MudancaPlacar
) {
  if (mudanca) await aplicarMudancaPlacar(tx, dados.partida_id, mudanca);
  const evento = await tx.evento.create({
    data: dados,
    include: { jogador: { select: { id: true, nome: true } } },
  });
  const partida = mudanca
    ? await tx.partida.findUniqueOrThrow({
        where: { id: dados.partida_id },
        include: { mandante: true, visitante: true },
      })
    : null;
  return { evento, partida };
}

export async function removerEventoComPlacar(
  tx: Prisma.TransactionClient,
  eventoId: number,
  partidaId: number,
  mudanca?: MudancaPlacar
) {
  if (mudanca) await aplicarMudancaPlacar(tx, partidaId, mudanca);
  await tx.evento.delete({ where: { id: eventoId } });
  return mudanca
    ? tx.partida.findUniqueOrThrow({
        where: { id: partidaId },
        include: { mandante: true, visitante: true },
      })
    : null;
}
