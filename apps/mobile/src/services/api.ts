import * as SecureStore from 'expo-secure-store';

export const BASE_URL = 'http://192.168.7.2:3000';
// export const BASE_URL =
//   process.env.EXPO_PUBLIC_API_URL ??
//   'http://192.168.7.2:3000';

export interface ClassificacaoItem {
  grupo: string;
  posicao: number;
  clube: string;
  pontos: number;
  jogos: number;
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  saldo: number;
  average: number;
  mediaGolsMarcados: number;
  mediaGolsSofridos: number;
  indiceTecnico: number;
  destaque: boolean;
  tipoTabela: string;
}

export interface FiltrosCampeonato {
  temporada: string;
  titulo: string;
  divisao: string;
  categoria: string;
}

// ==========================================
// CENTRAL DE REQUISIÇÕES (API FETCH)
// ==========================================

async function getToken() {
  return await SecureStore.getItemAsync('userToken');
}

/**
 * Função unificada que substitui o `fetch` padrão.
 * Ela automaticamente injeta o Token de Autenticação e o `x-clube-id`
 * em TODAS as requisições que saem do aplicativo.
 */
export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});

  // Adiciona Content-Type padrão se tiver 'body'
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData && !headers.has('Content-Type') && options.method && options.method !== 'GET' && options.method !== 'DELETE') {
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

  return fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
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
  papel: 'ADMIN' | 'MESARIO' | 'TECNICO' | 'TORCEDOR' | null;
}

export async function fetchClubes(busca?: string): Promise<ClubeListado[]> {
  const query = busca ? `?busca=${encodeURIComponent(busca)}` : '';
  const res = await apiFetch(`/clubes${query}`);
  if (!res.ok) throw new Error('Erro ao buscar clubes');
  return res.json();
}

export async function seguirClube(id: number): Promise<{ clube_id: number; nome: string; escudo: string | null; papel: string }> {
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

export async function atualizarUsuario(dados: { nome: string; email: string; senha?: string }) {
  const res = await apiFetch('/usuarios/me', {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao atualizar dados');
  return res.json();
}

export async function excluirConta() {
  const res = await apiFetch('/usuarios/me', { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao excluir conta');
  return res.json();
}

// ==========================================
// ROTAS DE TIMES E CATEGORIAS
// ==========================================

export async function fetchCategorias() {
  const res = await apiFetch('/categorias');
  if (!res.ok) throw new Error('Erro ao buscar categorias');
  return res.json();
}

export async function fetchTimes() {
  const res = await apiFetch('/times');
  if (!res.ok) throw new Error('Erro ao buscar times');
  return res.json();
}

export async function criarTime(dados: { nome: string; escudo?: string; categorias_ids?: number[] }) {
  const res = await apiFetch('/times', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao criar time');
  return res.json();
}

export async function atualizarTime(id: number, dados: { nome: string; escudo?: string; categorias_ids?: number[] }) {
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

export async function fetchJogadoresPerfis(categoria_id?: number): Promise<any[]> {
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
  nome: string; cpf: string; dtNasc: string; posicao: string; numCamisa?: number;
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

export async function atualizarIdadesJogadores(): Promise<{ atualizados: number; desativados: number }> {
  const res = await apiFetch('/admin/atualizar-idades', { method: 'PATCH' });
  if (!res.ok) throw new Error('Erro ao atualizar idades');
  return res.json();
}

// ==========================================
// ROTAS DE COMPETIÇÕES
// ==========================================

export async function fetchCompeticoes() {
  const res = await apiFetch('/competicoes');
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

export async function atualizarCompeticao(id: number, dados: { nome: string; ano: number }) {
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

export async function fetchJogadoresPorCompeticao(comp_id: number): Promise<any[]> {
  const res = await apiFetch(`/competicoes/${comp_id}/jogadores`);
  if (!res.ok) throw new Error('Erro ao buscar elenco do campeonato');
  return res.json();
}

export async function salvarElencoCompeticao(comp_id: number, jogador_ids: number[]): Promise<void> {
  const res = await apiFetch(`/competicoes/${comp_id}/jogadores`, {
    method: 'PUT',
    body: JSON.stringify({ jogador_ids }),
  });
  if (!res.ok) throw new Error('Erro ao salvar elenco da competição');
}

export async function fetchClassificacaoCampeonato(
  filtros: FiltrosCampeonato,
): Promise<ClassificacaoItem[]> {
  const params = new URLSearchParams({
    temporada: filtros.temporada,
    titulo:    filtros.titulo,
    divisao:   filtros.divisao,
    categoria: filtros.categoria,
  });

  const res = await apiFetch(`/campeonato/classificacao?${params}`);
  
  if (!res.ok) {
    const body = await res.text().catch(() => '(sem body)');
    throw new Error(`[${res.status}] ${body}`);
  }

  const json = await res.json();
  return Array.isArray(json) ? json : json.data ?? [];
}

// ==========================================
// ROTAS DE PARTIDAS
// ==========================================

export async function fetchPartidas(params?: {
  categoria_id?: number;
  mes?: number;
  status?: string;
}, clubeId?: number) {
  const query = new URLSearchParams();
  if (params?.categoria_id != null) query.append('categoria_id', String(params.categoria_id));
  if (params?.mes          != null) query.append('mes',          String(params.mes));
  if (params?.status)               query.append('status',       params.status);

  const endpoint = `/partidas?${query.toString()}`;
  const res = await apiFetch(endpoint, clubeId
    ? { headers: { 'x-clube-id': String(clubeId) } }
    : undefined);

  if (!res.ok) {
    const corpo = await res.text().catch(() => '');
    console.error(`[fetchPartidas] ${res.status} ${res.statusText} — ${BASE_URL}${endpoint}\n`, corpo);
    throw new Error(`Erro ao buscar partidas (${res.status}): ${corpo || res.statusText}`);
  }

  return res.json();
}

export async function fetchPartidasPorCompeticao(competicao_id: number, categoria_id?: number) {
  const query = new URLSearchParams({ competicao_id: String(competicao_id) });
  if (categoria_id) query.append('categoria_id', String(categoria_id));
  const res = await apiFetch(`/partidas?${query}`);
  if (!res.ok) throw new Error('Erro ao buscar partidas da competição');
  return res.json();
}

export async function criarPartida(dados: {
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
}) {
  const res = await apiFetch('/partidas', {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao criar partida');
  return res.json();
}

export async function atualizarPartida(id: number, dados: {
  mandante_id?: number; visitante_id?: number; data?: string;
  horario?: string; local?: string; emCasa?: boolean;
  rodada?: number; grupo?: string; categoria_id?: number;
}) {
  const res = await apiFetch(`/partidas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dados),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao atualizar partida'); }
  return res.json();
}

export async function atualizarStatusPartida(id: number, status: string) {
  const res = await apiFetch(`/partidas/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar status');
  return res.json();
}

export async function atualizarPlacarPartida(id: number, gols_mandante: number, gols_visitante: number) {
  const res = await apiFetch(`/partidas/${id}/placar`, {
    method: 'PATCH',
    body: JSON.stringify({ gols_mandante, gols_visitante }),
  });
  if (!res.ok) throw new Error('Erro ao atualizar placar');
  return res.json();
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

export async function criarEvento(partida_id: number, dados: {
  tipo: string;
  minuto?: number | null;
  periodo?: number | null;
  jogador_id?: number | null;
  doOcian?: boolean;
}) {
  const res = await apiFetch(`/partidas/${partida_id}/eventos`, {
    method: 'POST',
    body: JSON.stringify(dados),
  });
  if (!res.ok) throw new Error('Erro ao criar evento');
  return res.json();
}

export async function deletarEvento(eventoId: number) {
  const response = await apiFetch(`/eventos/${eventoId}`, { method: 'DELETE' });
  if (!response.ok) throw new Error('Falha ao deletar evento');
  return await response.json();
}

export async function fetchEscalacaoPartida(partida_id: number): Promise<any[]> {
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
  competicao_id?: number | null,
): Promise<{ id_jogador: number; nome: string; posicao: string; numCamisa: number | null }[]> {
  if (competicao_id) {
    const res = await apiFetch(`/competicoes/${competicao_id}/jogadores?categoria_id=${categoria_id}`);
    if (!res.ok) throw new Error('Erro ao buscar elenco da competição');
    const data: any[] = await res.json();

    return data
      .map(j => ({
        id_jogador: j.id_jogador ?? j.id,
        nome:       j.nome,
        posicao:    j.posicao,
        numCamisa:  j.numCamisa ?? null,
      }))
      .filter(j => j.id_jogador != null);
  }

  const res = await apiFetch(`/jogadores/perfis?categoria_id=${categoria_id}`);
  if (!res.ok) throw new Error('Erro ao buscar jogadores da categoria');
  const todos: any[] = await res.json();
  return todos
    .map(j => ({
      id_jogador: j.id_jogador,
      nome:       j.nome,
      posicao:    j.posicao,
      numCamisa:  j.numCamisa ?? null,
    }))
    .filter(j => j.id_jogador != null);
}

export async function fetchJogadoresPorCategoria(categoria_id: number): Promise<any[]> {
  return fetchJogadoresParaEscalacao(categoria_id);
}
