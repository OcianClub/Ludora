import * as SecureStore from 'expo-secure-store';
import {
  criarCacheConsulta,
  expiracaoTokenCache,
  identidadeSessaoCache,
  type ArmazenamentoCache,
  type EscopoCache,
  type RecursoCache,
} from '../utils/cacheConsulta';
import {
  executarConsultaComCache,
  type ResultadoConsulta,
} from '../utils/consultaComCache';
export type { ResultadoConsulta } from '../utils/consultaComCache';

const CHAVE_SESSAO = 'cacheConsultasSessao';
const memoria = new Map<string, string>();
const armazenamentoMemoria: ArmazenamentoCache = {
  listar: async () => [...memoria.keys()],
  ler: async (chave) => memoria.get(chave) ?? '',
  gravar: async (chave, texto) => {
    memoria.set(chave, texto);
  },
  remover: async (chave) => {
    memoria.delete(chave);
  },
};

let armazenamento: Promise<ArmazenamentoCache> | null = null;
function obterArmazenamento() {
  return (armazenamento ??= (async () => {
    try {
      const fs = await import('expo-file-system/legacy');
      if (!fs.cacheDirectory) return armazenamentoMemoria;
      const pasta = `${fs.cacheDirectory}ludora-consultas-v1/`;
      await fs.makeDirectoryAsync(pasta, { intermediates: true });
      return {
        listar: () => fs.readDirectoryAsync(pasta),
        ler: (chave) => fs.readAsStringAsync(`${pasta}${chave}`),
        gravar: async (chave, texto) => {
          const temporario = `${pasta}${chave}.tmp`;
          try {
            await fs.writeAsStringAsync(temporario, texto);
            await fs.moveAsync({ from: temporario, to: `${pasta}${chave}` });
          } finally {
            await fs
              .deleteAsync(temporario, { idempotent: true })
              .catch(() => undefined);
          }
        },
        remover: (chave) =>
          fs.deleteAsync(`${pasta}${chave}`, { idempotent: true }),
      } satisfies ArmazenamentoCache;
    } catch {
      return armazenamentoMemoria;
    }
  })());
}

const cache = criarCacheConsulta({
  listar: async () => (await obterArmazenamento()).listar(),
  ler: async (chave) => (await obterArmazenamento()).ler(chave),
  gravar: async (chave, texto) =>
    (await obterArmazenamento()).gravar(chave, texto),
  remover: async (chave) => (await obterArmazenamento()).remover(chave),
});
let iniciandoSessao: Promise<string | null> | null = null;
let limpandoSessao: Promise<void> | null = null;
let iniciandoIdentidade: string | null = null;
const identidadesRecusadas = new Set<string>();

async function identificarSessao(identidade: string) {
  if (limpandoSessao) await limpandoSessao;
  if (identidadesRecusadas.has(identidade)) return null;
  if (!iniciandoSessao || iniciandoIdentidade !== identidade) {
    iniciandoIdentidade = identidade;
    iniciandoSessao = (async () => {
      const textoAnterior = await SecureStore.getItemAsync(CHAVE_SESSAO);
      let registro: {
        identidade?: string;
        sessao?: string;
        recusada?: boolean;
      } | null = null;
      try {
        registro = textoAnterior ? JSON.parse(textoAnterior) : null;
      } catch {}
      if (registro?.identidade === identidade && registro.recusada === true) {
        identidadesRecusadas.add(identidade);
        return null;
      }
      const anterior =
        registro?.identidade === identidade ? registro.sessao : null;
      if (anterior && /^[a-zA-Z0-9_-]{6,100}$/.test(anterior)) return anterior;
      const identificador = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
      await SecureStore.setItemAsync(
        CHAVE_SESSAO,
        JSON.stringify({ identidade, sessao: identificador })
      );
      return identificador;
    })().catch(() => null);
  }
  return iniciandoSessao;
}

export function limparCacheConsultas() {
  if (limpandoSessao) return limpandoSessao;
  const limpeza = cache.limpar();
  const inicializacaoAnterior = iniciandoSessao;
  limpandoSessao = (async () => {
    await inicializacaoAnterior?.catch(() => undefined);
    await Promise.all([
      limpeza,
      SecureStore.deleteItemAsync(CHAVE_SESSAO).catch(() => undefined),
    ]);
    iniciandoSessao = null;
    iniciandoIdentidade = null;
    identidadesRecusadas.clear();
  })().finally(() => {
    limpandoSessao = null;
  });
  return limpandoSessao;
}

export async function consultarComCopiaLocal<T>({
  clubeId,
  recurso,
  carregar,
  selecionar,
  onLocal,
}: {
  clubeId: number;
  recurso: RecursoCache;
  carregar: () => Promise<T>;
  selecionar: (dados: unknown) => T | null;
  onLocal?: (resultado: ResultadoConsulta<T>) => void;
}): Promise<ResultadoConsulta<T>> {
  const geracao = cache.geracao();
  const token = await SecureStore.getItemAsync('userToken').catch(() => null);
  const validoAte = token ? expiracaoTokenCache(token) : null;
  const identidade = token ? identidadeSessaoCache(token) : null;
  const sessao =
    identidade && validoAte && validoAte > Date.now()
      ? await identificarSessao(identidade)
      : null;
  const escopo: EscopoCache | null =
    sessao && validoAte ? { sessao, clubeId, validoAte, geracao } : null;
  const contextoAtual = async () =>
    geracao === cache.geracao() &&
    token !== null &&
    identidade !== null &&
    !identidadesRecusadas.has(identidade) &&
    validoAte !== null &&
    validoAte > Date.now() &&
    token === (await SecureStore.getItemAsync('userToken').catch(() => null));
  return executarConsultaComCache({
    carregar,
    lerLocal: () =>
      escopo ? cache.ler(escopo, recurso, selecionar) : Promise.resolve(null),
    contextoAtual,
    salvar: async (dados) => {
      const selecionados = selecionar(dados);
      if (escopo && selecionados !== null)
        await cache.gravar(escopo, recurso, selecionados);
    },
    descartar: async (status) => {
      if (
        status === 401 &&
        identidade &&
        token ===
          (await SecureStore.getItemAsync('userToken').catch(() => null))
      ) {
        identidadesRecusadas.add(identidade);
        const limpeza = cache.limpar();
        await iniciandoSessao?.catch(() => undefined);
        iniciandoSessao = null;
        iniciandoIdentidade = null;
        await limpeza;
        if (
          token ===
          (await SecureStore.getItemAsync('userToken').catch(() => null))
        )
          await SecureStore.setItemAsync(
            CHAVE_SESSAO,
            JSON.stringify({ identidade, recusada: true })
          ).catch(() => undefined);
      } else if (escopo) await cache.remover(escopo, recurso);
    },
    onLocal,
  });
}
