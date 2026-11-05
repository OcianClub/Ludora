export function criarFilaConsulta<T>(carregar: () => Promise<T>) {
  let emAndamento: Promise<T> | null = null;
  let seguinte: Promise<T> | null = null;

  function consultar(aposAtual = false): Promise<T> {
    if (!emAndamento) {
      const tarefa = Promise.resolve()
        .then(carregar)
        .finally(() => {
          if (emAndamento === tarefa) emAndamento = null;
        });
      emAndamento = tarefa;
      return tarefa;
    }
    if (!aposAtual) return emAndamento;
    return (seguinte ??= emAndamento
      .catch(() => undefined)
      .then(() => {
        seguinte = null;
        return consultar();
      }));
  }
  return { consultar };
}
