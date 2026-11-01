export type ClubePersistido = {
  id: number;
  nome: string;
  escudo: string | null;
  papel: 'ADMIN' | 'MESARIO' | 'TECNICO' | 'TORCEDOR' | 'OLHEIRO' | null;
};

type Armazenamento = {
  getItemAsync(chave: string): Promise<string | null>;
  setItemAsync(chave: string, valor: string): Promise<void>;
  deleteItemAsync(chave: string): Promise<void>;
};

const CHAVES = ['clubeAtivoId', 'clubeAtivoNome', 'clubeAtivoEscudo', 'clubeAtivoPapel'] as const;
const PAPEIS = ['ADMIN', 'MESARIO', 'TECNICO', 'TORCEDOR', 'OLHEIRO'] as const;

export function criarPersistenciaClube(
  armazenamento: Armazenamento,
  aplicar: (clube: ClubePersistido | null) => void
) {
  let versao = 0;
  let fila = Promise.resolve();

  const aguardarEscritas = async (operacoes: Promise<void>[]) => {
    const resultados = await Promise.allSettled(operacoes);
    const falha = resultados.find((resultado) => resultado.status === 'rejected');
    if (falha?.status === 'rejected') throw falha.reason;
  };

  const serializar = (acao: () => Promise<void>) => {
    const operacao = fila.then(acao, acao);
    fila = operacao.catch(() => undefined);
    return operacao;
  };

  return {
    async restaurar() {
      const pedido = versao;
      try {
        await fila;
        const [id, nome, escudo, papel] = await Promise.all(
          CHAVES.map((chave) => armazenamento.getItemAsync(chave))
        );
        if (pedido !== versao) return;
        if (!id || !Number.isSafeInteger(Number(id)) || Number(id) <= 0) {
          aplicar(null);
          return;
        }
        aplicar({
          id: Number(id),
          nome: nome || 'MEU CLUBE',
          escudo: escudo || null,
          papel: PAPEIS.includes(papel as (typeof PAPEIS)[number])
            ? papel as ClubePersistido['papel']
            : null,
        });
      } catch {
        if (pedido === versao) aplicar(null);
      }
    },
    definir(clube: ClubePersistido) {
      const pedido = ++versao;
      return serializar(async () => {
        await aguardarEscritas([
          armazenamento.setItemAsync(CHAVES[1], clube.nome),
          armazenamento.setItemAsync(CHAVES[2], clube.escudo || ''),
          armazenamento.setItemAsync(CHAVES[3], clube.papel || ''),
        ]);
        await armazenamento.setItemAsync(CHAVES[0], String(clube.id));
        if (pedido === versao) aplicar(clube);
      });
    },
    limpar() {
      ++versao;
      aplicar(null);
      return serializar(async () => {
        await aguardarEscritas(CHAVES.map((chave) => armazenamento.deleteItemAsync(chave)));
      });
    },
    invalidar() {
      ++versao;
    },
  };
}
