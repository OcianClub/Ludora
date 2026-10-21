export type RecursoCache = 'home' | 'scout';
export type EscopoCache = {
  sessao: string;
  clubeId: number;
  validoAte: number;
  geracao: number;
};
export type CopiaLocal<T> = { dados: T; salvoEm: number };
export interface ArmazenamentoCache {
  listar(): Promise<string[]>;
  ler(chave: string): Promise<string>;
  gravar(chave: string, texto: string): Promise<void>;
  remover(chave: string): Promise<void>;
}

const PADRAO_CHAVE =
  /^([a-zA-Z0-9_-]{6,100})\.(\d+)\.(home|scout)\.(\d+)\.json$/;
const VALIDADE_MS = 24 * 60 * 60_000;
const MAX_TEXTO = 333_000;

export function criarCacheConsulta(
  armazenamento: ArmazenamentoCache,
  agora = Date.now
) {
  let geracao = 0;
  const recentes = new Map<string, { texto: string; salvoEm: number }>();
  const chaveMemoria = (escopo: EscopoCache, recurso: RecursoCache) =>
    `${escopo.sessao}.${escopo.clubeId}.${recurso}`;
  const guardarMemoria = (
    escopo: EscopoCache,
    recurso: RecursoCache,
    texto: string,
    salvoEm: number
  ) => {
    if (!escopoValido(escopo)) return;
    const chave = chaveMemoria(escopo, recurso);
    recentes.delete(chave);
    recentes.set(chave, { texto, salvoEm });
    while (recentes.size > 6) recentes.delete(recentes.keys().next().value!);
  };
  let fila: Promise<unknown> = Promise.resolve();
  const serializar = <T>(acao: () => Promise<T>) => {
    const operacao = fila.then(acao, acao);
    fila = operacao.catch(() => undefined);
    return operacao;
  };
  const escopoValido = (escopo: EscopoCache) =>
    escopo.geracao === geracao &&
    /^[a-zA-Z0-9_-]{6,100}$/.test(escopo.sessao) &&
    Number.isSafeInteger(escopo.clubeId) &&
    escopo.clubeId > 0 &&
    escopo.validoAte > agora();
  const corresponde = (
    chave: string,
    escopo: EscopoCache,
    recurso: RecursoCache
  ) => {
    const partes = PADRAO_CHAVE.exec(chave);
    return (
      partes?.[1] === escopo.sessao &&
      Number(partes[2]) === escopo.clubeId &&
      partes[3] === recurso
    );
  };

  return {
    geracao: () => geracao,
    ler<T>(
      escopo: EscopoCache,
      recurso: RecursoCache,
      validar: (dados: unknown) => T | null
    ): Promise<CopiaLocal<T> | null> {
      if (!escopoValido(escopo)) return Promise.resolve(null);
      const chave = chaveMemoria(escopo, recurso);
      const memoria = recentes.get(chave);
      if (memoria) {
        try {
          const dados = validar(JSON.parse(memoria.texto).dados);
          if (
            dados !== null &&
            memoria.salvoEm <= agora() &&
            agora() - memoria.salvoEm < VALIDADE_MS
          ) {
            return Promise.resolve({ dados, salvoEm: memoria.salvoEm });
          }
        } catch {}
        recentes.delete(chave);
      }
      return serializar(async () => {
        if (!escopoValido(escopo)) return null;
        try {
          const chaves = (await armazenamento.listar())
            .filter((chave) => corresponde(chave, escopo, recurso))
            .sort(
              (a, b) =>
                Number(PADRAO_CHAVE.exec(b)![4]) -
                Number(PADRAO_CHAVE.exec(a)![4])
            );
          for (const chave of chaves) {
            try {
              const texto = await armazenamento.ler(chave);
              if (texto.length > MAX_TEXTO) {
                await armazenamento.remover(chave);
                continue;
              }
              const copia = JSON.parse(texto);
              const dados = validar(copia.dados);
              if (!escopoValido(escopo)) return null;
              if (
                copia.versao !== 1 ||
                copia.sessao !== escopo.sessao ||
                copia.clubeId !== escopo.clubeId ||
                copia.recurso !== recurso ||
                !Number.isSafeInteger(copia.salvoEm) ||
                copia.salvoEm > agora() ||
                agora() - copia.salvoEm >= VALIDADE_MS ||
                dados === null
              ) {
                await armazenamento.remover(chave);
                continue;
              }
              guardarMemoria(escopo, recurso, texto, copia.salvoEm);
              return { dados, salvoEm: copia.salvoEm };
            } catch {
              await armazenamento.remover(chave).catch(() => undefined);
            }
          }
        } catch {}
        return null;
      });
    },
    gravar<T>(
      escopo: EscopoCache,
      recurso: RecursoCache,
      dados: T
    ): Promise<boolean> {
      return serializar(async () => {
        if (!escopoValido(escopo)) return false;
        try {
          const salvoEm = agora();
          const texto = JSON.stringify({
            versao: 1,
            sessao: escopo.sessao,
            clubeId: escopo.clubeId,
            recurso,
            salvoEm,
            dados,
          });
          if (texto.length > MAX_TEXTO) return false;
          guardarMemoria(escopo, recurso, texto, salvoEm);
          const chave = `${escopo.sessao}.${escopo.clubeId}.${recurso}.${salvoEm}.json`;
          await armazenamento.gravar(chave, texto);
          const chaves = (await armazenamento.listar())
            .filter((nome) => PADRAO_CHAVE.test(nome))
            .sort(
              (a, b) =>
                Number(PADRAO_CHAVE.exec(b)![4]) -
                Number(PADRAO_CHAVE.exec(a)![4])
            );
          let mantidas = 0;
          for (const nome of chaves) {
            const partes = PADRAO_CHAVE.exec(nome)!;
            if (
              partes[1] !== escopo.sessao ||
              agora() - Number(partes[4]) >= VALIDADE_MS ||
              (nome !== chave && corresponde(nome, escopo, recurso)) ||
              mantidas >= 6
            )
              await armazenamento.remover(nome);
            else mantidas++;
          }
          return escopoValido(escopo);
        } catch {
          return false;
        }
      });
    },
    remover(escopo: EscopoCache, recurso: RecursoCache) {
      recentes.clear();
      if (escopo.geracao === geracao) geracao++;
      return serializar(async () => {
        try {
          for (const chave of await armazenamento.listar())
            if (corresponde(chave, escopo, recurso))
              await armazenamento.remover(chave);
        } catch {}
      });
    },
    limpar() {
      recentes.clear();
      geracao++;
      return serializar(async () => {
        try {
          for (const chave of await armazenamento.listar())
            if (PADRAO_CHAVE.test(chave)) await armazenamento.remover(chave);
        } catch {}
      });
    },
  };
}

function lerPayloadToken(token: string) {
  try {
    const partes = token.split('.');
    if (partes.length !== 3 || !/^[A-Za-z0-9_-]{1,4096}$/.test(partes[1]))
      return null;
    const alfabeto =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let valor = 0;
    let bits = 0;
    let texto = '';
    for (const caractere of partes[1]) {
      valor = ((valor << 6) | alfabeto.indexOf(caractere)) & 0xffffff;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        texto += String.fromCharCode((valor >> bits) & 255);
      }
    }
    const payload = JSON.parse(texto);
    return payload && typeof payload === 'object' && !Array.isArray(payload)
      ? payload
      : null;
  } catch {
    return null;
  }
}

export function expiracaoTokenCache(token: string): number | null {
  const exp = lerPayloadToken(token)?.exp;
  return Number.isSafeInteger(exp) &&
    exp > 0 &&
    Number.isSafeInteger(exp * 1000)
    ? exp * 1000
    : null;
}

export function identidadeSessaoCache(token: string): string | null {
  const payload = lerPayloadToken(token);
  const versao = payload?.versao_sessao ?? 0;
  if (
    !payload ||
    !Number.isSafeInteger(payload.id) ||
    payload.id <= 0 ||
    !Number.isSafeInteger(payload.iat) ||
    !Number.isSafeInteger(versao) ||
    versao < 0 ||
    !expiracaoTokenCache(token)
  )
    return null;
  return `${payload.id}:${payload.iat}:${versao}:${payload.exp}`;
}
