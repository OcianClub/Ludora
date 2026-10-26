import type {
  DefinirPapel, MembrosDoClube, NovoClube, PlanoClube, StatusBanco, StatusSistema,
  UsuarioGlobal, VisaoGlobal, ClubeResumo, EntradaLog,
} from '@ludora/shared-types';
import type { MetodoHttp } from '../../../shared/rules';

// Mesma ideia do requestJson de apps/web/src/services/api.ts, mas a requisição
// sai pelo processo principal (IPC). Aqui não há BASE_URL, token nem CORS.
export async function requestJson<T>(
  endpoint: string,
  options: { method?: MetodoHttp; body?: unknown } = {}
): Promise<T> {
  const resposta = await window.ludora.api.requisicao<T & { error?: string }>(
    options.method ?? 'GET',
    endpoint,
    options.body
  );
  if (!resposta.ok) throw new Error(resposta.data?.error || 'Não foi possível concluir a solicitação');
  return resposta.data;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') q.set(k, String(v));
  const texto = q.toString();
  return texto ? `?${texto}` : '';
};

export const fetchVisaoGlobal = () => requestJson<VisaoGlobal>('/admin/overview');

export const criarClube = (dados: NovoClube) =>
  requestJson<ClubeResumo>('/admin/clubes', { method: 'POST', body: dados });

// null limpa o campo no servidor; undefined deixa como está.
export interface EdicaoClube {
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
