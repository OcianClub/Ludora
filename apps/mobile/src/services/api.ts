import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { ErroConsulta, fetchComTimeout } from '../utils/request';
import type { Placar, MudancaPlacar } from '../utils/placarPartida';
import { headersClubeNotificacoes } from '../utils/escopoNotificacoes';
import { criarAgrupadorConsultas } from '../utils/consultasEmAndamento';
import { iniciarMedicaoCarregamento } from '../utils/desempenho';

// No celular físico, configure o IP da sua máquina em apps/mobile/.env.
export const BASE_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:3000' : 'http://localhost:3000')
).replace(/\/+$/, '');

// ==========================================
// CENTRAL DE REQUISIÇÕES (API FETCH)
// ==========================================

async function getToken() {
  return await SecureStore.getItemAsync('userToken');
}

const enviarConsulta = criarAgrupadorConsultas(fetchComTimeout);

/**
 * Função unificada que substitui o `fetch` padrão.
 * Ela automaticamente injeta o Token de Autenticação e o `x-clube-id`
 * em TODAS as requisições que saem do aplicativo.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const caminho = endpoint.split('?')[0];
  const recurso =
    ['/partidas', '/jogadores', '/clubes', '/notificacoes', '/usuarios'].find(
      (prefixo) => caminho.startsWith(prefixo)
    ) ?? 'api';
  const finalizar = iniciarMedicaoCarregamento(`http:${recurso}`);
  const headers = new Headers(options.headers || {});

  // Adiciona Content-Type padrão se tiver 'body'
  const isFormData =
    typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (
    !isFormData &&
    !headers.has('Content-Type') &&
    options.method &&
    options.method !== 'GET' &&
    options.method !== 'DELETE'
  ) {
    headers.set('Content-Type', 'application/json');
  }

  // Injeta o Token JWT
  // SecureStore cruza a ponte nativa. Ler as duas chaves em paralelo reduz
  // a latência adicionada a toda chamada da API.
  const [token, clubeId] = await Promise.all([
    getToken(),
    SecureStore.getItemAsync('clubeAtivoId'),
  ]);
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // INJETA O CLUBE ATIVO (Multi-tenant)
  if (clubeId && !headers.has('x-clube-id')) {
    headers.set('x-clube-id', clubeId);
  }

  try {
    const resposta = await enviarConsulta(`${BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });
    finalizar({ status: resposta.status });
    return resposta;
  } catch (erro) {
    finalizar({ status: 'falha' });
    throw erro;
  }
}

// ==========================================
// ROTAS DE CLUBES (descoberta + seguir)
// ==========================================

export interface ClubeListado {
  id: number;
  nome: string;
  escudo: string | null;
  cidade: string | null;
  estado: string | null;
  seguidores: number;
  isSeguindo: boolean;
  papel: 'ADMIN' | 'MESARIO' | 'TECNICO' | 'TORCEDOR' | 'OLHEIRO' | null;
}

export async function fetchClubes(busca?: string): Promise<ClubeListado[]> {
  const query = busca ? `?busca=${encodeURIComponent(busca)}` : '';
  const res = await apiFetch(`/clubes${query}`);
  if (!res.ok) throw new Error('Erro ao buscar clubes');
  return res.json();
}

export async function seguirClube(id: number): Promise<{
  clube_id: number;
  nome: string;
  escudo: string | null;
  papel: string;
}> {
  const res = await apiFetch(`/clubes/${id}/seguir`, { method: 'POST' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Erro ao seguir clube');
  }
  return res.json();
}

export async function deixarDeSeguirClube(id: number): Promise<void> {
  const res = await apiFetch(`/clubes/${id}/seguir`, { method: 'DELETE' });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Erro ao deixar de seguir clube');
  }
}

// ==========================================
// ROTAS DO USUÁRIO
// ==========================================

export async function atualizarUsuario(dados: {
  nome: string;
  email: string;
  senha?: string;
}) {
  const res = await apiFetch('/usuarios/me', {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const dados = await res.json().catch(() => null);
    throw new Error(
      dados?.error || 'Não foi possível salvar seus dados. Tente novamente.'
    );
  }
  return res.json();
}

export async function excluirConta() {
  const res = await apiFetch('/usuarios/me', { method: 'DELETE' });
  if (!res.ok) {
    const dados = await res.json().catch(() => null);
    throw new Error(
      dados?.error || 'Não foi possível excluir a conta. Tente novamente.'
    );
  }
  return res.json();
}

// ==========================================
// NOTIFICAÇÕES
// ==========================================

export type TipoNotificacao =
  | 'PARTIDA_AGENDADA'
  | 'GOL_PARTIDA'
  | 'RESULTADO_PARTIDA';

export interface PreferenciaNotificacoesClube {
  clube_id: number;
  clube: { nome: string };
  push_gols: boolean;
  push_agendamentos: boolean;
  push_resultados: boolean;
}

export type CampoPreferenciaPush =
  | 'push_gols'
  | 'push_agendamentos'
  | 'push_resultados';

export async function fetchPreferenciasPorClube(
  signal?: AbortSignal
): Promise<PreferenciaNotificacoesClube[]> {
  const res = await apiFetch('/notificacoes/preferencias', { signal });
  if (!res.ok)
    throw new Error(
      'Não foi possível carregar suas preferências. Tente novamente.'
    );
  const dados = await res.json();
  return dados.preferencias;
}

export async function salvarPreferenciaPorClube(
  clubeId: number,
  campo: CampoPreferenciaPush,
  ativa: boolean
): Promise<PreferenciaNotificacoesClube> {
  const res = await apiFetch(`/notificacoes/preferencias/${clubeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ [campo]: ativa }),
  });
  if (!res.ok) {
    const dados = await res.json().catch(() => null);
    throw new Error(dados?.error || 'Não foi possível salvar sua preferência.');
  }
  return res.json();
}

export interface Notificacao {
  id: number;
  partida_id: number | null;
  tipo: TipoNotificacao;
  titulo: string;
  corpo: string;
  dados: Record<string, string | number | boolean | null> | null;
  lida: boolean;
  criada_em: string;
}

export async function fetchNotificacoes(
  limite: number,
  clubeId: number
): Promise<{
  notificacoes: Notificacao[];
  totalNaoLidas: number;
}> {
  const res = await apiFetch(`/notificacoes?limite=${limite}`, {
    headers: headersClubeNotificacoes(clubeId),
  });
  if (!res.ok) throw new Error('Erro ao buscar notificações');
  return res.json();
}

export async function marcarNotificacaoComoLida(id: number, clubeId: number) {
  const res = await apiFetch(`/notificacoes/${id}/lida`, {
    method: 'PATCH',
    headers: headersClubeNotificacoes(clubeId),
  });
  if (!res.ok) throw new Error('Erro ao atualizar notificação');
  return res.json();
}

export async function marcarTodasNotificacoesComoLidas(clubeId: number) {
  const res = await apiFetch('/notificacoes/lidas', {
    method: 'PATCH',
    headers: headersClubeNotificacoes(clubeId),
  });
  if (!res.ok) throw new Error('Erro ao atualizar notificações');
  return res.json() as Promise<{ atualizadas: number }>;
}

export async function excluirNotificacao(id: number, clubeId: number) {
  const res = await apiFetch(`/notificacoes/${id}`, {
    method: 'DELETE',
    headers: headersClubeNotificacoes(clubeId),
  });
  if (!res.ok) throw new Error('Erro ao excluir notificação');
}

export async function limparNotificacoesLidas(clubeId: number) {
  const res = await apiFetch('/notificacoes/lidas', {
    method: 'DELETE',
    headers: headersClubeNotificacoes(clubeId),
  });
  if (!res.ok) throw new Error('Erro ao limpar notificações');
}

export async function atualizarPreferenciaNotificacoes(ativa: boolean) {
  const res = await apiFetch('/usuarios/me/notificacoes', {
    method: 'PATCH',
    body: JSON.stringify({ ativa }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar preferência de notificações');
  return res.json() as Promise<{ ativa: boolean }>;
}

export async function registrarDispositivoPush(
  token: string,
  plataforma: string
) {
  const res = await apiFetch('/notificacoes/dispositivos', {
    method: 'POST',
    body: JSON.stringify({ token, plataforma }),
  });
  if (!res.ok)
    throw new Error('Erro ao registrar dispositivo para notificações');
  return res.json();
}

export async function fetchPreferenciaNotificacoes(): Promise<boolean> {
  const res = await apiFetch('/usuarios/me');
  if (!res.ok) throw new Error('Erro ao buscar preferências do usuário');
  const dados = await res.json();
  return Boolean(dados.notificacoes_ativas);
}

export async function desvincularDispositivoPush() {
  const token = await SecureStore.getItemAsync('expoPushToken');
  if (!token) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await apiFetch('/notificacoes/dispositivos', {
      method: 'DELETE',
      body: JSON.stringify({ token }),
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok)
      throw new Error(
        'Não foi possível desvincular as notificações do dispositivo.'
      );
  } finally {
    clearTimeout(timer);
  }
}

// ==========================================
// ROTAS DE TIMES E CATEGORIAS
// ==========================================

export async function fetchCategorias(clubeId?: number) {
  const res = await apiFetch(
    '/categorias',
    clubeId ? { headers: { 'x-clube-id': String(clubeId) } } : undefined
  );
  if (!res.ok) throw new Error('Erro ao buscar categorias');
  return res.json();
}

export async function fetchTimes(clubeId?: number) {
  const res = await apiFetch(
    '/times',
    clubeId ? { headers: { 'x-clube-id': String(clubeId) } } : undefined
  );
  if (!res.ok) throw new Error('Erro ao buscar times');
  return res.json();
}

export async function criarTime(dados: {
  nome: string;
  escudo?: string;
  categorias_ids?: number[];
}) {
  const res = await apiFetch('/times', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao criar time');
  return res.json();
}

export async function atualizarTime(
  id: number,
  dados: { nome: string; escudo?: string; categorias_ids?: number[] }
) {
  const res = await apiFetch(`/times/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao atualizar time');
  return res.json();
}

export async function deletarTime(id: number) {
  const res = await apiFetch(`/times/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const dados = await res.json();
    throw new Error(dados.error ?? 'Erro ao excluir time');
  }
  return res.json();
}

// ==========================================
// ROTAS DE JOGADORES
// ==========================================

export async function fetchJogadores() {
  const res = await apiFetch('/jogadores');
  if (!res.ok) throw new Error('Erro ao buscar jogadores');
  return res.json();
}

export async function fetchJogadoresPerfis(
  categoria_id?: number
): Promise<any[]> {
  const query = categoria_id ? `?categoria_id=${categoria_id}` : '';
  const res = await apiFetch(`/jogadores/perfis${query}`);
  if (!res.ok) throw new Error('Erro ao buscar perfis');
  return res.json();
}

export async function fetchPerfilJogador(id: number): Promise<any> {
  const res = await apiFetch('/jogadores/perfis?categoria_id=0');
  if (!res.ok) throw new Error('Erro ao buscar perfil');
  const todos = await res.json();
  return todos.find((j: any) => j.id_jogador === id) ?? null;
}

export async function criarJogador(dados: {
  nome: string;
  cpf: string;
  dtNasc: string;
  posicao: string;
  numCamisa?: number;
}): Promise<any> {
  const res = await apiFetch('/jogadores', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao criar jogador');
  return json;
}

export async function atualizarJogador(id: number, dados: any) {
  const res = await apiFetch(`/jogadores/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao atualizar jogador');
  }
  return res.json();
}

export async function deletarJogador(id: number) {
  const res = await apiFetch(`/jogadores/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'Erro ao deletar jogador');
  }
  return res.json();
}

export async function atualizarIdadesJogadores(): Promise<{
  atualizados: number;
  desativados: number;
}> {
  const res = await apiFetch('/admin/atualizar-idades', { method: 'PATCH' });
  if (!res.ok) throw new Error('Erro ao atualizar idades');
  return res.json();
}

// ==========================================
// ROTAS DE COMPETIÇÕES
// ==========================================

export async function fetchCompeticoes(clubeId?: number) {
  const res = await apiFetch(
    '/competicoes',
    clubeId ? { headers: { 'x-clube-id': String(clubeId) } } : undefined
  );
  if (!res.ok) throw new Error('Erro ao buscar competicoes');
  return res.json();
}

export async function criarCompeticao(dados: { nome: string; ano: number }) {
  const res = await apiFetch('/competicoes', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao criar competição');
  return res.json();
}

export async function atualizarCompeticao(
  id: number,
  dados: { nome: string; ano: number }
) {
  const res = await apiFetch(`/competicoes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao atualizar competição');
  return res.json();
}

export async function deletarCompeticao(id: number) {
  const res = await apiFetch(`/competicoes/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const dados = await res.json();
    throw new Error(dados.error ?? 'Erro ao excluir competição');
  }
  return res.json();
}

export async function fetchJogadoresPorCompeticao(
  comp_id: number
): Promise<any[]> {
  const res = await apiFetch(`/competicoes/${comp_id}/jogadores`);
  if (!res.ok) throw new Error('Erro ao buscar elenco do campeonato');
  return res.json();
}

export async function salvarElencoCompeticao(
  comp_id: number,
  jogador_ids: number[]
): Promise<void> {
  const res = await apiFetch(`/competicoes/${comp_id}/jogadores`, {
    method: 'PUT',
    body: JSON.stringify({ jogador_ids }),
  });
  if (!res.ok) throw new Error('Erro ao salvar elenco da competição');
}

// ==========================================
// ROTAS DE PARTIDAS
// ==========================================

export async function fetchHome(clubeId: number) {
  const agora = new Date();
  const hoje = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`;
  const res = await apiFetch(`/partidas/home?hoje=${hoje}`, {
    headers: { 'x-clube-id': String(clubeId) },
  });
  if (!res.ok)
    throw new ErroConsulta(
      res.status,
      'Não foi possível carregar o resumo do clube.'
    );
  const dados = await res.json().catch(() => null);
  if (!Array.isArray(dados))
    throw new ErroConsulta(
      502,
      'Não foi possível confirmar os dados do clube.'
    );
  return dados;
}

export async function fetchPartidas(
  params?: {
    categoria_id?: number;
    mes?: number;
    ano?: number;
    status?: string;
    resumo?: boolean;
  },
  clubeId?: number
) {
  const query = new URLSearchParams();
  if (params?.categoria_id != null)
    query.append('categoria_id', String(params.categoria_id));
  if (params?.mes != null) query.append('mes', String(params.mes));
  if (params?.ano != null) query.append('ano', String(params.ano));
  if (params?.status) query.append('status', params.status);
  if (params?.resumo) query.append('resumo', '1');

  const endpoint = `/partidas?${query.toString()}`;
  const res = await apiFetch(
    endpoint,
    clubeId ? { headers: { 'x-clube-id': String(clubeId) } } : undefined
  );

  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    console.error(
      `[fetchPartidas] ${res.status} ${res.statusText} — ${BASE_URL}${endpoint}\n`,
      corpo
    );
    throw new ErroConsulta(
      res.status,
      'Não foi possível carregar as partidas.'
    );
  }

  const dados = await res.json().catch(() => null);
  if (!Array.isArray(dados))
    throw new ErroConsulta(
      502,
      'Não foi possível confirmar os dados das partidas.'
    );
  return dados;
}

export async function fetchPartidasPorCompeticao(
  competicao_id: number,
  categoria_id?: number
) {
  const query = new URLSearchParams({ competicao_id: String(competicao_id) });
  if (categoria_id) query.append('categoria_id', String(categoria_id));
  const res = await apiFetch(`/partidas?${query}`);
  if (!res.ok) throw new Error('Erro ao buscar partidas da competição');
  return res.json();
}

export async function criarPartida(
  dados: {
    mandante_id: number;
    visitante_id: number;
    data: string;
    horario: string;
    local: string;
    emCasa: boolean;
    categoria_id: number;
    competicao_id?: number;
    rodada?: number;
    grupo?: string;
  },
  clubeId?: number
) {
  const res = await apiFetch('/partidas', {
    method: 'POST',
    ...(clubeId ? { headers: { 'x-clube-id': String(clubeId) } } : {}),
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const erro = await res.json().catch(() => null);
    throw new Error(
      erro?.error || 'Não foi possível criar a partida. Tente novamente.'
    );
  }
  return res.json();
}

export async function atualizarPartida(
  id: number,
  dados: {
    mandante_id?: number;
    visitante_id?: number;
    data?: string;
    horario?: string;
    local?: string;
    emCasa?: boolean;
    rodada?: number;
    grupo?: string;
    categoria_id?: number;
  }
) {
  const res = await apiFetch(`/partidas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) {
    const e = await res.json();
    throw new Error(e.error || 'Erro ao atualizar partida');
  }
  return res.json();
}

async function lerOperacaoPartida(resposta: Response) {
  if (resposta.status === 409)
    throw new Error(
      'A partida mudou em outro dispositivo. Confira os dados atuais antes de tentar novamente.'
    );
  if (resposta.status === 401)
    throw new Error('Sua sessão expirou. Entre novamente para continuar.');
  if (resposta.status === 403)
    throw new Error('Você não tem permissão para alterar esta partida.');
  if (!resposta.ok)
    throw new Error(
      'Não foi possível concluir a operação. Confira os dados atualizados antes de tentar novamente.'
    );
  return resposta.json();
}

export async function fetchDetalhesPartida(id: number, clubeId: number) {
  const resposta = await apiFetch(`/partidas/${id}`, {
    headers: { 'x-clube-id': String(clubeId) },
  });
  if (!resposta.ok) throw new Error('Não foi possível atualizar a partida.');
  const dados = await resposta.json();
  if (
    dados?.id !== id ||
    !dados.mandante ||
    !dados.visitante ||
    !Array.isArray(dados.eventos) ||
    !Number.isSafeInteger(dados.gols_mandante) ||
    !Number.isSafeInteger(dados.gols_visitante)
  ) {
    throw new Error('Não foi possível confirmar os dados da partida.');
  }
  return dados;
}

export async function atualizarStatusPartida(
  id: number,
  status: string,
  anterior?: string
) {
  const res = await apiFetch(`/partidas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, status_anterior: anterior }),
  });
  return lerOperacaoPartida(res);
}

export async function atualizarPlacarPartida(
  id: number,
  gols_mandante: number,
  gols_visitante: number,
  anterior?: Placar
) {
  const res = await apiFetch(`/partidas/${id}/placar`, {
    method: 'PATCH',
    body: JSON.stringify({ gols_mandante, gols_visitante, anterior }),
  });
  return lerOperacaoPartida(res);
}

export async function deletarPartida(id: number) {
  const res = await apiFetch(`/partidas/${id}`, { method: 'DELETE' });
  if (!res.ok) {
    const dados = await res.json().catch(() => ({}));
    throw new Error(dados.error ?? 'Erro ao excluir partida');
  }
  return res.json();
}

// ==========================================
// EVENTOS E ESCALAÇÃO
// ==========================================

export async function fetchEventosDaPartida(partidaId: number) {
  const response = await apiFetch(`/partidas/${partidaId}/eventos`);
  if (!response.ok) throw new Error('Falha ao buscar eventos');
  return await response.json();
}

export async function criarEvento(
  partida_id: number,
  dados: {
    tipo: string;
    minuto?: number | null;
    periodo?: number | null;
    jogador_id?: number | null;
    doOcian?: boolean;
    placar?: MudancaPlacar;
  }
) {
  const res = await apiFetch(`/partidas/${partida_id}/eventos`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  return lerOperacaoPartida(res);
}

export async function deletarEvento(eventoId: number, placar?: MudancaPlacar) {
  const response = await apiFetch(`/eventos/${eventoId}`, {
    method: 'DELETE',
    ...(placar
      ? {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ placar }),
        }
      : {}),
  });
  return lerOperacaoPartida(response);
}

export async function fetchEscalacaoPartida(
  partida_id: number
): Promise<any[]> {
  const res = await apiFetch(`/partidas/${partida_id}/escalacao`);
  if (!res.ok) throw new Error('Erro ao buscar escalação');
  return res.json();
}

export async function salvarEscalacaoPartida(
  partida_id: number,
  jogadores: { jogador_id: number; numCamisa: number; titular: boolean }[]
): Promise<void> {
  const res = await apiFetch(`/partidas/${partida_id}/escalacao`, {
    method: 'PUT',
    body: JSON.stringify({ jogadores }),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error(e.error || 'Erro ao salvar escalação');
  }
}

export async function fetchJogadoresParaEscalacao(
  categoria_id: number,
  competicao_id?: number | null
): Promise<
  {
    id_jogador: number;
    nome: string;
    posicao: string;
    numCamisa: number | null;
  }[]
> {
  if (competicao_id) {
    const res = await apiFetch(
      `/competicoes/${competicao_id}/jogadores?categoria_id=${categoria_id}`
    );
    if (!res.ok) throw new Error('Erro ao buscar elenco da competição');
    const data: any[] = await res.json();

    return data
      .map((j) => ({
        id_jogador: j.id_jogador ?? j.id,
        nome: j.nome,
        posicao: j.posicao,
        numCamisa: j.numCamisa ?? null,
      }))
      .filter((j) => j.id_jogador != null);
  }

  const res = await apiFetch(`/jogadores/perfis?categoria_id=${categoria_id}`);
  if (!res.ok) throw new Error('Erro ao buscar jogadores da categoria');
  const todos: any[] = await res.json();
  return todos
    .map((j) => ({
      id_jogador: j.id_jogador,
      nome: j.nome,
      posicao: j.posicao,
      numCamisa: j.numCamisa ?? null,
    }))
    .filter((j) => j.id_jogador != null);
}

export async function fetchJogadoresPorCategoria(
  categoria_id: number
): Promise<any[]> {
  return fetchJogadoresParaEscalacao(categoria_id);
}
