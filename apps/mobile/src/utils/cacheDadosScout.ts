/** Resultados já interpretados; a chave deve incluir sessão, clube e revisão da API. */
export function criarCacheDadosScout<T>(
  agora = Date.now,
  validade = 15_000,
  limite = 24,
) {
  const dados = new Map<string, { valor: T; expira: number }>();
  const pendentes = new Map<string, Promise<T>>();
  const abortado = () =>
    Object.assign(new Error("Consulta cancelada"), { name: "AbortError" });
  function ler(chave: string) {
    const entrada = dados.get(chave);
    if (!entrada) return null;
    if (entrada.expira <= agora()) {
      dados.delete(chave);
      return null;
    }
    return entrada.valor;
  }
  function aguardar(tarefa: Promise<T>, signal?: AbortSignal): Promise<T> {
    if (!signal) return tarefa;
    if (signal.aborted) return Promise.reject(abortado());
    return new Promise((resolve, reject) => {
      const cancelar = () => reject(abortado());
      signal.addEventListener("abort", cancelar, { once: true });
      tarefa
        .then((v) => {
          if (!signal.aborted) resolve(v);
        }, reject)
        .finally(() => signal.removeEventListener("abort", cancelar));
    });
  }
  function consultar(
    chave: string,
    carregar: () => Promise<T>,
    signal?: AbortSignal,
    forcar = false,
  ): Promise<T> {
    if (signal?.aborted) return Promise.reject(abortado());
    const salvo = !forcar ? ler(chave) : null;
    if (salvo !== null) return Promise.resolve(salvo);
    let tarefa = pendentes.get(chave);
    if (!tarefa) {
      tarefa = Promise.resolve()
        .then(carregar)
        .then((valor) => {
          dados.delete(chave);
          dados.set(chave, { valor, expira: agora() + validade });
          while (dados.size > limite) dados.delete(dados.keys().next().value!);
          return valor;
        });
      pendentes.set(chave, tarefa);
      const limpar = () => {
        if (pendentes.get(chave) === tarefa) pendentes.delete(chave);
      };
      tarefa.then(limpar, limpar);
    }
    return aguardar(tarefa, signal);
  }
  return { ler, consultar };
}
