type Entrada = { resposta: Response; expiraEm: number };

export function criarCacheConsultasRecentes(
  enviar: (url: string, opcoes?: RequestInit) => Promise<Response>,
  agora = Date.now,
) {
  const entradas = new Map<string, Entrada>();
  let geracao = 0;
  function invalidar() {
    geracao++;
    entradas.clear();
  }
  async function consultar(
    url: string,
    opcoes: RequestInit = {},
    validadeMs = 0,
    revalidar = false,
  ) {
    const metodo = (opcoes.method ?? "GET").toUpperCase();
    if (metodo !== "GET") {
      invalidar();
      try {
        return await enviar(url, opcoes);
      } finally {
        invalidar();
      }
    }
    if (opcoes.signal?.aborted || validadeMs <= 0)
      return enviar(url, opcoes);

    const headers: [string, string][] = [];
    new Headers(opcoes.headers).forEach((valor, nome) =>
      headers.push([nome, valor]),
    );
    headers.sort(([a], [b]) => a.localeCompare(b));
    const chave = JSON.stringify([
      url,
      headers,
      opcoes.credentials,
      opcoes.cache,
    ]);
    const entrada = entradas.get(chave);
    if (!revalidar && entrada && entrada.expiraEm > agora())
      return entrada.resposta.clone();
    entradas.delete(chave);
    const versao = geracao;
    const resposta = await enviar(url, opcoes);
    if ([401, 403].includes(resposta.status)) invalidar();
    if (resposta.ok && versao === geracao && !opcoes.signal?.aborted) {
      entradas.set(chave, {
        resposta: resposta.clone(),
        expiraEm: agora() + validadeMs,
      });
      while (entradas.size > 20) entradas.delete(entradas.keys().next().value!);
    }
    return resposta;
  }
  return { consultar, invalidar, geracao: () => geracao };
}
