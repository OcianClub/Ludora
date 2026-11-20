import type {
  DefinirPapel, MembrosDoClube, NovoClube, PlanoClube, StatusBanco, StatusSistema,
  UsuarioGlobal, VisaoGlobal, ClubeResumo, EntradaLog,
} from '@ludora/shared-types';
import type { MetodoHttp } from '../../../shared/rules';
import { ConsultasEmAndamento } from '../../../shared/inflight';

const consultas = new ConsultasEmAndamento();
let sessaoAtual = 0;
let revisao = 0;
let visaoRecente: { dados: VisaoGlobal; ate: number } | undefined;
const invalidar = () => { revisao++; consultas.limpar(); visaoRecente = undefined; };
export const limparConsultas = () => { sessaoAtual++; invalidar(); };
export const obterVisaoRecente = () => visaoRecente && visaoRecente.ate > Date.now() ? visaoRecente.dados : undefined;
export class ErroApiDesktop extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

// Mesma ideia do requestJson de apps/web/src/services/api.ts, mas a requisição
// sai pelo processo principal (IPC). Aqui não há BASE_URL, token nem CORS.
export async function requestJson<T>(
  endpoint: string,
  options: { method?: MetodoHttp; body?: unknown } = {}
): Promise<T> {
  const sessaoPedido = sessaoAtual;
  const metodo = options.method ?? 'GET';
  if (metodo !== 'GET') invalidar();
  const consultar = () => window.ludora.api.requisicao<T & { error?: string }>(metodo, endpoint, options.body);
  const resposta = await (metodo === 'GET' && options.body === undefined
    ? consultas.executar(endpoint, consultar) : consultar());
  if (metodo !== 'GET') invalidar();
  if (sessaoPedido !== sessaoAtual) throw new Error('A sessão mudou. Consulte os dados novamente.');
  if (!resposta.ok) {
    if ([401, 403].includes(resposta.status)) invalidar();
    throw new ErroApiDesktop(resposta.data?.error || 'Não foi possível concluir a solicitação', resposta.status);
  }
  return resposta.data;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const texto = q.toString();
  return texto ? `?${texto}` : '';
};

export async function fetchVisaoGlobal() {
  const pedido = revisao;
  const dados = await requestJson<VisaoGlobal>('/admin/overview');
  if (pedido === revisao) visaoRecente = { dados, ate: Date.now() + 20_000 };
  return dados;
}
export type OpcaoClube = Pick<ClubeResumo, 'id' | 'nome' | 'escudo' | 'cidade' | 'estado'>;
export async function fetchOpcoesClubes(): Promise<OpcaoClube[]> {
  try {
    return await requestJson('/admin/clubes/opcoes');
  } catch (erro) {
    if (erro instanceof ErroApiDesktop && erro.status === 404) return (await fetchVisaoGlobal()).clubes;
    throw erro;
  }
}

export const criarClube = (dados: NovoClube) =>
  requestJson<ClubeResumo>('/admin/clubes', { method: 'POST', body: dados });

// null limpa o campo no servidor; undefined deixa como está.
export interface EdicaoClube {
  cnpj?: string;
  endereco?: NovoClube['endereco'];
  escudo_arquivo?: string | null;
  nome?: string;
  cidade?: string | null;
  estado?: string | null;
  plano?: PlanoClube;
  escudo?: string | null;
}

export const atualizarClube = (id: number, dados: EdicaoClube) =>
  requestJson<ClubeResumo>(`/admin/clubes/${id}`, { method: 'PATCH', body: dados });

export const fetchMembros = (clubeId: number) =>
  requestJson<MembrosDoClube>(`/admin/clubes/${clubeId}/membros`);

export const criarCategoriasPadrao = (clubeId: number) =>
  requestJson<{ adicionadas: number }>(`/admin/clubes/${clubeId}/categorias-padrao`, { method: 'POST' });

export const definirPapel = (clubeId: number, usuarioId: number, dados: DefinirPapel) =>
  requestJson<{ ok: true }>(`/admin/clubes/${clubeId}/membros/${usuarioId}`, { method: 'PUT', body: dados });

export const removerVinculo = (clubeId: number, usuarioId: number) =>
  requestJson<{ ok: true }>(`/admin/clubes/${clubeId}/membros/${usuarioId}`, { method: 'DELETE' });

export const fetchUsuarios = (busca?: string) =>
  requestJson<UsuarioGlobal[]>(`/admin/usuarios${qs({ busca })}`);

export const revogarSessoes = (usuarioId: number) =>
  requestJson<{ ok: true }>(`/admin/usuarios/${usuarioId}/revogar-sessoes`, { method: 'POST', body: {} });

export const fetchStatusBanco = () => requestJson<StatusBanco>('/admin/db/status');
export const fetchStatusSistema = () => requestJson<StatusSistema>('/admin/sistema');
export const fetchLogs = (limite = 200) => requestJson<EntradaLog[]>(`/admin/logs${qs({ limite })}`);
