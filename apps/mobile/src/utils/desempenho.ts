export function iniciarMedicaoCarregamento(etapa: string) {
  const inicio = Date.now();
  return (detalhes?: Record<string, string | number>) => {
    const duracaoMs = Date.now() - inicio;
    const desenvolvimento =
      (globalThis as { __DEV__?: boolean }).__DEV__ === true;
    if (
      desenvolvimento &&
      (duracaoMs >= 1_000 || process.env.EXPO_PUBLIC_DEBUG_PERF === '1')
    ) {
      console.info(
        '[desempenho]',
        JSON.stringify({ etapa, duracaoMs, ...detalhes })
      );
    }
    return duracaoMs;
  };
}
