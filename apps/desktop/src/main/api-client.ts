import { caminhoApiPermitido, metodoPermitido, type MetodoHttp } from '../shared/rules';
import type { RespostaApi } from '../shared/bridge';
import { lerApiUrl } from './config';
import { limparSessao, sessaoAtual } from './session';

const TIMEOUT_MS = 20_000;

type Opcoes = { token?: string | null; semToken?: boolean; aoExpirar?: () => void };

/**
 * Requisição HTTP feita pelo processo principal (Node), não pelo navegador.
 * Por isso não existe CORS aqui: não há cabeçalho Origin e nenhuma política de
 * mesma origem. A API continua com a mesma lista de origens de antes, e o
 * webSecurity do renderer permanece ligado.
 */
export async function chamarApi<T = unknown>(
  metodo: MetodoHttp,
  caminho: string,
  corpo?: unknown,
  opcoes: Opcoes = {}
): Promise<RespostaApi<T>> {
  if (!metodoPermitido(metodo) || !caminhoApiPermitido(caminho)) {
    return { ok: false, status: 400, data: { error: 'Requisição não permitida' } as T };
  }

  const token = opcoes.semToken ? null : opcoes.token ?? sessaoAtual()?.token ?? null;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (corpo !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), TIMEOUT_MS);

  try {
    const resposta = await fetch(`${lerApiUrl()}${caminho}`, {
      method: metodo,
      headers,
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      signal: controle.signal,
      redirect: 'error', // nunca seguir redirect: evitaria enviar o token a outro host
    });

    const texto = await resposta.text();
    let data: unknown = {};
    try {
      data = texto ? JSON.parse(texto) : {};
    } catch {
      data = { error: 'Resposta inválida do servidor' };
    }

    if (resposta.status === 401 && token && caminho !== '/auth/login') {
      limparSessao();
      opcoes.aoExpirar?.();
    }
    return { ok: resposta.ok, status: resposta.status, data: data as T };
  } catch (erro) {
    const abortou = (erro as Error)?.name === 'AbortError';
    return {
      ok: false,
      status: 0,
      data: { error: abortou ? 'A API demorou demais para responder' : 'Não foi possível conectar à API' } as T,
    };
  } finally {
    clearTimeout(timer);
  }
}
