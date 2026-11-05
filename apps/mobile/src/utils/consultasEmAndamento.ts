export function criarAgrupadorConsultas(
  enviar: (url: string, opcoes?: RequestInit) => Promise<Response>
) {
  const pendentes = new Map<string, Promise<Response>>();
  let revisao = 0;

  const consultar = async (url: string, opcoes: RequestInit = {}): Promise<Response> => {
    const metodo = (opcoes.method ?? 'GET').toUpperCase();
    if (metodo !== 'GET') {
      revisao += 1;
      try {
        return await enviar(url, opcoes);
      } finally {
        revisao += 1;
      }
    }
    if (opcoes.signal || opcoes.body) return enviar(url, opcoes);

    const headers: [string, string][] = [];
    new Headers(opcoes.headers).forEach((valor, nome) =>
      headers.push([nome, valor])
    );
    headers.sort(([a], [b]) => a.localeCompare(b));
    const chave = JSON.stringify([
      revisao,
      url,
      headers,
      opcoes.credentials,
      opcoes.mode,
      opcoes.cache,
      opcoes.redirect,
      opcoes.integrity,
      opcoes.referrer,
      opcoes.referrerPolicy,
    ]);
    let tarefa = pendentes.get(chave);
    if (!tarefa) {
      tarefa = enviar(url, opcoes);
      pendentes.set(chave, tarefa);
    }
    try {
      return (await tarefa).clone();
    } finally {
      if (pendentes.get(chave) === tarefa) pendentes.delete(chave);
    }
  };
  return Object.assign(consultar, { invalidar: () => { revisao++; } });
}
