/** Limita a espera sem repetir operações de escrita automaticamente. */
export async function fetchComTimeout(url: string, options: RequestInit = {}, timeoutMs = 20_000): Promise<Response> {
  const controller = new AbortController();
  const cancelar = () => controller.abort();
  let expirou = false;
  const timer = setTimeout(() => { expirou = true; controller.abort(); }, timeoutMs);
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', cancelar, { once: true });
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (expirou) throw new Error('A conexão demorou demais. Confira sua internet e tente novamente.');
    throw new Error('Não foi possível conectar ao servidor. Confira sua conexão e tente novamente.');
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancelar);
  }
}

/** Cada carregamento invalida os anteriores, inclusive ao sair da tela. */
export function criarControleRequisicoes() {
  let versao = 0;
  return {
    iniciar: () => ++versao,
    atual: (id: number) => id === versao,
    invalidar: () => { versao += 1; },
  };
}
