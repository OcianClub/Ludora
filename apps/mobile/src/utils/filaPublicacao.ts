export const ATRASO_PUBLICACAO = 5_000;
export type ItemPublicacao<T> = {
  id: string;
  dados: T;
  enviarEm: number;
  status: "aguardando" | "enviando" | "erro" | "pausado";
  erro?: string;
};

export function criarFilaPublicacao<T>(opcoes: {
  executar: (item: ItemPublicacao<T>) => Promise<void>;
  atualizar: (itens: ItemPublicacao<T>[]) => void;
  agora?: () => number;
  agendar?: (acao: () => void, ms: number) => ReturnType<typeof setTimeout>;
  cancelarTimer?: (id: ReturnType<typeof setTimeout>) => void;
}) {
  const agora = opcoes.agora ?? Date.now;
  const agendar =
    opcoes.agendar ?? ((acao: () => void, ms: number) => setTimeout(acao, ms));
  const cancelarTimer = opcoes.cancelarTimer ?? clearTimeout;
  let itens: ItemPublicacao<T>[] = [],
    ocupado = false,
    encerrada = false, pausada = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let sequencia = 0;
  const esperando = new Set<() => void>();
  const avisar = () => {
    if (!encerrada) opcoes.atualizar([...itens]);
  };
  function programar() {
    if (timer !== undefined) cancelarTimer(timer);
    timer = undefined;
    if (encerrada || pausada || ocupado || itens.some((i) => i.status === "erro")) return;
    const proximo = itens.find((i) => i.status === "aguardando");
    if (proximo)
      timer = agendar(
        () => {
          void publicar(proximo);
        },
        Math.max(0, proximo.enviarEm - agora()),
      );
  }
  async function publicar(item: ItemPublicacao<T>) {
    if (encerrada || pausada || ocupado || !itens.includes(item)) return;
    ocupado = true;
    item.status = "enviando";
    avisar();
    try {
      await opcoes.executar(item);
      itens = itens.filter((i) => i !== item);
    } catch (erro) {
      item.status = "erro";
      item.erro =
        erro instanceof Error
          ? erro.message
          : "Não foi possível publicar. Confira a súmula antes de tentar novamente.";
    } finally {
      ocupado = false;
      avisar();
      programar();
      for (const resolve of esperando) resolve();
      esperando.clear();
    }
  }
  return {
    adicionar(dados: T) {
      const id = `mobile-${agora().toString(36)}-${++sequencia}-${Math.random().toString(36).slice(2, 12)}`;
      itens.push({
        id,
        dados,
        enviarEm: agora() + ATRASO_PUBLICACAO,
        status: pausada ? "pausado" : "aguardando",
      });
      avisar();
      programar();
      return id;
    },
    cancelar(id: string) {
      const item = itens.find((i) => i.id === id);
      if (!item || item.status === "enviando") return;
      itens = itens.filter((i) => i !== item);
      avisar();
      programar();
    },
    tentar(id: string) {
      const item = itens.find((i) => i.id === id && i.status === "erro");
      if (!item) return;
      // Explicit retry also resumes this action after a background failure.
      // Other paused actions remain paused until the user resumes them.
      pausada = false;
      item.status = "aguardando";
      item.enviarEm = agora() + ATRASO_PUBLICACAO;
      avisar();
      programar();
    },
    pendentes: () => [...itens],
    aguardarOciosa: () => ocupado ? new Promise<void>(resolve => esperando.add(resolve)) : Promise.resolve(),
    pausar() {
      pausada = true;
      if (timer !== undefined) cancelarTimer(timer);
      timer = undefined;
      for (const item of itens) if (item.status === 'aguardando') item.status = 'pausado';
      avisar();
    },
    retomar() {
      pausada = false;
      for (const item of itens) if (item.status === 'pausado') {
        item.status = 'aguardando'; item.enviarEm = agora() + ATRASO_PUBLICACAO;
      }
      avisar(); programar();
    },
    restaurar(salvos: ItemPublicacao<T>[]) {
      if (itens.length || ocupado) return;
      pausada = true;
      itens = salvos.map(item => ({ ...item, status: 'pausado' }));
      avisar();
    },
    encerrar() {
      encerrada = true;
      if (timer !== undefined) cancelarTimer(timer);
      itens = [];
    },
  };
}
