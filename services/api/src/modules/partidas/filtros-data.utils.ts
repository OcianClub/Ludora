export class FiltroDataInvalido extends Error {}

export function intervaloDataPartidas(
  filtros: Record<string, unknown>,
  anoAtual = new Date().getFullYear()
) {
  const informado = (valor: unknown) => valor !== undefined && valor !== null;
  const inteiro = (valor: unknown, minimo: number, maximo: number) => {
    if (
      (typeof valor !== 'string' && typeof valor !== 'number') ||
      !/^\d+$/.test(String(valor))
    ) {
      throw new FiltroDataInvalido('Informe um mês e um ano válidos');
    }
    const numero = Number(valor);
    if (!Number.isSafeInteger(numero) || numero < minimo || numero > maximo) {
      throw new FiltroDataInvalido('Informe um mês e um ano válidos');
    }
    return numero;
  };
  if (!informado(filtros.mes) && !informado(filtros.ano)) return undefined;
  const ano = informado(filtros.ano)
    ? inteiro(filtros.ano, 1900, 9998)
    : anoAtual;
  const mes = informado(filtros.mes) ? inteiro(filtros.mes, 1, 12) : null;
  return {
    gte: new Date(Date.UTC(ano, mes === null ? 0 : mes - 1, 1)),
    lt: new Date(
      Date.UTC(mes === null ? ano + 1 : ano, mes === null ? 0 : mes, 1)
    ),
  };
}
