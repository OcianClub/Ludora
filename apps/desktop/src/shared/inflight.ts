// Compartilha apenas consultas simultâneas, nunca uma resposta já concluída.
// Não reutiliza uma leitura iniciada antes de uma escrita ou troca de sessão.
export class ConsultasEmAndamento {
  private pendentes = new Map<string, Promise<unknown>>();

  limpar() { this.pendentes.clear(); }

  executar<T>(chave: string, consultar: () => Promise<T>): Promise<T> {
    const atual = this.pendentes.get(chave);
    if (atual) return atual as Promise<T>;
    const promessa = Promise.resolve().then(consultar).finally(() => {
      if (this.pendentes.get(chave) === promessa) this.pendentes.delete(chave);
    });
    this.pendentes.set(chave, promessa);
    return promessa;
  }
}
