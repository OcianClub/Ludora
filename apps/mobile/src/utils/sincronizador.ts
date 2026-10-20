export function criarSincronizador<T>(
  carregar: () => Promise<T>,
  aplicar: (dados: T) => void,
  informar: (estado: 'carregando' | 'atualizado' | 'erro') => void
) {
  let ativo = true;
  let pendente = false;
  let tarefa: Promise<boolean> | null = null;

  function atualizar(): Promise<boolean> {
    if (!ativo) return Promise.resolve(false);
    pendente = true;
    if (tarefa) return tarefa;
    tarefa = (async () => {
      let sucesso = false;
      do {
        pendente = false;
        informar('carregando');
        try {
          const dados = await carregar();
          if (!ativo) return false;
          if (!pendente) aplicar(dados);
          sucesso = true;
        } catch {
          sucesso = false;
        }
      } while (ativo && pendente);
      if (ativo) informar(sucesso ? 'atualizado' : 'erro');
      return sucesso;
    })().finally(() => {
      tarefa = null;
    });
    return tarefa;
  }

  return {
    atualizar,
    encerrar: () => {
      ativo = false;
      pendente = false;
    },
  };
}
