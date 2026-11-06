export function iniciarMedicaoCarregamento(etapa: string) {
  const inicio = Date.now();
  return (detalhes?: Record<string, string | number>) => {
    const duracaoMs = Date.now() - inicio;
    const desenvolvimento =
      (globalThis as { __DEV__?: boolean }).__DEV__ === true;
    if (
      desenvolvimento &&
      (duracaoMs >= 1_000 || process.env.EXPO_PUBLIC_DEBUG_PERF === "1")
    ) {
      console.info(
        "[desempenho]",
        JSON.stringify({ etapa, duracaoMs, ...detalhes }),
      );
    }
    return duracaoMs;
  };
}

/** Durações públicas do servidor; nunca registra URL, corpo ou credenciais. */
export function temposServidor(cabecalho: string | null) {
  const tempos: Record<string, number> = {};
  for (const item of (cabecalho || "").split(",").slice(0, 12)) {
    const nome = item.trim().match(/^([\w-]+)/)?.[1];
    const duracao = item.match(/;\s*dur=([\d.]+)/i)?.[1];
    const valor = Number(duracao);
    if (nome && duracao && Number.isFinite(valor) && valor >= 0)
      tempos[`servidor:${nome}`] = valor;
  }
  return tempos;
}

export async function lerJsonMedido<T>(
  resposta: Response,
  etapa: string,
): Promise<T> {
  const finalizar = iniciarMedicaoCarregamento(`json:${etapa}`);
  try {
    return (await resposta.json()) as T;
  } finally {
    finalizar();
  }
}

/** Destino público, sem usuário/senha, caminho, query ou token. */
export function destinoApi(url: string) {
  try {
    const destino = new URL(url);
    const host = destino.hostname.toLowerCase();
    const local = /^(localhost|127\.\d+\.\d+\.\d+|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|\[::1\])$/.test(host);
    return {
      origem: destino.origin,
      ambiente: local ? 'local' : host.endsWith('.onrender.com') ? 'render' : 'remoto',
    };
  } catch {
    return { origem: 'inválida', ambiente: 'invalido' };
  }
}
