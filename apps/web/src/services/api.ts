import { BASE_URL } from './config';
import { authRequest } from './authHttp';
import { contextoScoutValido, type ContextoScout } from '../../../mobile/src/utils/contextoScout';
export { BASE_URL } from './config';

export async function requestJson<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const response = await apiFetch(endpoint, options);
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a solicitação');
  return body;
}

// ── Auth token (localStorage para web) ──
export function getToken(): string | null {
  try { return localStorage.getItem('ludora_token'); }
  catch { return null; }
}
export function setToken(t: string) { localStorage.setItem('ludora_token', t); }
export function removeToken() { localStorage.removeItem('ludora_token'); }

export function getClubeId(): number | null {
  const v = localStorage.getItem('ludora_clube_id');
  return v ? Number(v) : null;
}
export function setClubeId(id: number) { localStorage.setItem('ludora_clube_id', String(id)); }
export function removeClubeId() { localStorage.removeItem('ludora_clube_id'); }

// ── Fetch central ──
async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && options.method && !['GET', 'DELETE'].includes(options.method)) {
    headers.set('Content-Type', 'application/json');
  }
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const clubeId = getClubeId();
  if (clubeId) headers.set('x-clube-id', String(clubeId));

  const res = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  if (res.status === 401 && token && !endpoint.startsWith('/auth/')) {
    removeToken();
    removeClubeId();
    window.location.href = '/login';
  }
  return res;
}

// ── Tipos ──
export interface Clube {
  id: number;
  nome: string;
  escudo?: string;
  cidade?: string;
  estado?: string;
  plano?: string;
  meuPapel?: string | null;
  isSeguindo?: boolean;
  seguidores?: number;
}
export interface Usuario { id: number; nome: string; email: string; criadoEm?: string; }
export interface PerfilUsuario extends Usuario { clubes: Clube[]; notificacoes_ativas?: boolean; }
export interface Categoria { id: number; nome: string; tipo: string; clube_id: number; }
export interface Time { id: number; nome: string; escudo?: string; arquivado?: boolean; categoria_id?: number; clube_representado_id?: number | null; clubeRepresentado?: Clube | null; }
export interface Jogador { id: number; nome: string; cpf: string; dtNasc: string; posicao: string; numCamisa?: number; ativo: boolean; perfil_ml?: string; nota_geral?: number; categoria_id: number; }
export interface Partida { somente_leitura?: boolean; clube_origem_id?: number; id: number; mandante_id: number; visitante_id: number; gols_mandante: number; gols_visitante: number; data: string; horario?: string; local?: string; status: string; emCasa: boolean; categoria_id: number; competicao_id?: number; rodada?: number; grupo?: string | null; mandante?: Time; visitante?: Time; categoria?: Categoria; }
export interface Competicao { id: number; nome: string; ano: number; tipo: string; clube_id: number; }
export type HomePartida = Omit<Partida, 'mandante_id' | 'visitante_id' | 'categoria_id' | 'categoria'> & {
  categoria: Categoria;
  competicao?: Competicao | null;
};
export interface Evento { id: number; partida_id: number; tipo: string; periodo: number; minuto?: number; jogador_id?: number; jogador?: {id:number;nome:string} | null; }
export interface EscalacaoItem { jogador_id: number; numCamisa: number; titular: boolean; jogador?: Jogador; }
export interface PerfilJogador extends Jogador { totalGols: number; totalAssistencias: number; totalCartoes: number; totalDefesas: number; totalFaltas: number; totalPartidas: number; idade?: number; scores_ml?: Record<string, number> | null; }
export interface Estatisticas { gols: number; assistencias: number; defesas: number; cartaoAmarelo: number; cartaoVermelho: number; faltas: number; }

// ── AUTH ──
export async function login(email: string, senha: string) {
  const data = await authRequest<{ token: string; usuario?: Usuario; id: number; nome: string; email: string; criadoEm?: string; clubes?: Clube[] }>(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
  });
  if (typeof data.token !== 'string' || !data.token) throw new Error('Não conseguimos confirmar seu acesso. Tente novamente.');
  const usuario: Usuario = data.usuario || {
    id: data.id,
    nome: data.nome,
    email: data.email,
    criadoEm: data.criadoEm,
  };
  return { ...data, usuario } as { token: string; usuario: Usuario; clubes?: Clube[] };
}
export async function fetchMeuPerfil(signal?: AbortSignal): Promise<PerfilUsuario> {
  const res = await apiFetch('/usuarios/me', { signal });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao carregar perfil');
  return res.json();
}

export async function atualizarMeuPerfil(dados: { nome: string; email: string; senha?: string }): Promise<Usuario> {
  const res = await apiFetch('/usuarios/me', { method: 'PATCH', body: JSON.stringify(dados) });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao atualizar perfil');
  return res.json();
}

export async function atualizarPreferenciaNotificacoes(ativa: boolean): Promise<{ ativa: boolean }> {
  return requestJson('/usuarios/me/notificacoes', {
    method: 'PATCH',
    body: JSON.stringify({ ativa }),
  });
}

// ── CLUBES ──
export async function fetchClubes(): Promise<Clube[]> {
  const res = await apiFetch('/clubes');
  if (!res.ok) throw new Error('Erro ao buscar clubes');
  return res.json();
}
export async function seguirClube(id: number) {
  const res = await apiFetch(`/clubes/${id}/seguir`, { method: 'POST' });
  if (!res.ok) throw new Error('Erro ao seguir clube');
  return res.json();
}

// ── CATEGORIAS ──
export async function fetchCategorias(signal?: AbortSignal): Promise<Categoria[]> {
  const res = await apiFetch('/categorias', { signal });
  if (!res.ok) throw new Error('Erro ao buscar categorias');
  return res.json();
}

// ── TIMES ──
export async function fetchTimes(incluirArquivados = false): Promise<Time[]> {
  const res = await apiFetch(`/times${incluirArquivados ? '?incluir_arquivados=true' : ''}`);
  if (!res.ok) throw new Error('Erro ao buscar times');
  return res.json();
}
export async function criarTime(dados: { nome: string; escudo?: string; categorias_ids?: number[] }) {
  const res = await apiFetch('/times', {
    method: 'POST',
    body: JSON.stringify({
      nome: dados.nome,
      escudo: dados.escudo,
      categoria_id: dados.categorias_ids?.[0],
    }),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao criar time'); }
  return res.json();
}
export async function atualizarTime(id: number, dados: { nome: string; escudo?: string; categorias_ids?: number[] }) {
  const res = await apiFetch(`/times/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      nome: dados.nome,
      escudo: dados.escudo,
      categoria_id: dados.categorias_ids?.[0],
    }),
  });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao atualizar time'); }
  return res.json();
}
export async function deletarTime(id: number) {
  const res = await apiFetch(`/times/${id}`, { method: 'DELETE' });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao deletar time'); }
  return res.json();
}

export async function atualizarEscudoTime(id: number, escudo: string): Promise<{ ids: number[]; clubeId?: number | null; escudo: string | null }> {
  const res = await apiFetch(`/times/${id}/escudo`, { method: 'PATCH', body: JSON.stringify({ escudo }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível salvar o escudo.');
  return data;
}

export async function adicionarCategoriaTime(id: number, categoria_id: number): Promise<Time> {
  const res = await apiFetch(`/times/${id}/categorias`, { method: 'POST', body: JSON.stringify({ categoria_id }) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível adicionar a categoria.');
  return data;
}

export async function fetchImpactoTime(id: number): Promise<{ partidas: number; competicoes: number }> {
  const res = await apiFetch(`/times/${id}/impacto`);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Não foi possível consultar os vínculos.');
  return data;
}

export interface ResumoConfronto {
  vitorias: number;
  empates: number;
  derrotas: number;
  golsPro: number;
  golsContra: number;
  proxima: { data: string; categoria_id: number } | null;
}
export interface ResumoAdversario extends ResumoConfronto {
  key: string;
  categorias: (ResumoConfronto & { categoria_id: number })[];
}
export interface ConfrontoTime {
  id: number;
  data: string;
  horario?: string | null;
  status: string;
  local?: string | null;
  gols_mandante: number;
  gols_visitante: number;
  mandante: Time;
  visitante: Time;
  categoria: { id: number; nome: string };
}
export function fetchResumoAdversarios(): Promise<ResumoAdversario[]> {
  return requestJson('/times/contexto');
}
export function fetchConfrontosTime(id: number, categoriaId?: number): Promise<{ ultimas: ConfrontoTime[]; proximas: ConfrontoTime[] }> {
  return requestJson(`/times/${id}/contexto${categoriaId ? `?categoria_id=${categoriaId}` : ''}`);
}
export function arquivarTime(id: number, arquivado: boolean): Promise<{ ids: number[]; arquivado: boolean }> {
  return requestJson(`/times/${id}/arquivo`, { method: 'PATCH', body: JSON.stringify({ arquivado }) });
}
export function renomearTime(id: number, nome: string): Promise<{ items: Time[]; clubeId: number | null; nome: string }> {
  return requestJson(`/times/${id}/nome`, { method: 'PATCH', body: JSON.stringify({ nome }) });
}

// ── JOGADORES ──
export async function fetchJogadores(): Promise<Jogador[]> {
  const res = await apiFetch('/jogadores');
  if (!res.ok) throw new Error('Erro ao buscar jogadores');
  return res.json();
}
export async function fetchJogadoresPerfis(categoria_id?: number, signal?: AbortSignal): Promise<PerfilJogador[]> {
  const q = categoria_id ? `?categoria_id=${categoria_id}` : '';
  const res = await apiFetch(`/jogadores/perfis${q}`, { signal });
  if (!res.ok) throw new Error('Erro ao buscar perfis');
  const dados = await res.json();
  return dados.map((j: any) => ({
    id: j.id ?? j.id_jogador,
    nome: j.nome,
    cpf: '',
    dtNasc: '',
    posicao: j.posicao,
    numCamisa: j.numCamisa,
    ativo: true,
    perfil_ml: j.perfil_ml,
    nota_geral: j.nota_geral,
    categoria_id: j.categoria_id,
    idade: j.idade,
    scores_ml: j.scores_ml ?? null,
    totalGols: j.totalGols ?? j.gols ?? 0,
    totalAssistencias: j.totalAssistencias ?? j.assistencias ?? 0,
    totalCartoes: j.totalCartoes ?? ((j.cartoes_amarelos ?? 0) + (j.cartoes_vermelhos ?? 0)),
    totalDefesas: j.totalDefesas ?? j.defesas ?? 0,
    totalFaltas: j.totalFaltas ?? j.faltas_cometidas ?? 0,
    totalPartidas: j.totalPartidas ?? j.jogos_disputados ?? 0,
  }));
}
export async function fetchContextoScout(id: number, signal?: AbortSignal): Promise<ContextoScout> {
  const res = await apiFetch(`/jogadores/${id}/scout-contexto`, { signal });
  if (!res.ok) throw new Error('Não foi possível carregar o histórico do atleta. Tente novamente.');
  const data: unknown = await res.json();
  if (!contextoScoutValido(data, id)) throw new Error('Não foi possível confirmar os dados do histórico.');
  return data;
}
export interface ConflitoCamisa {
  jogador_id: number; nome: string; camisa: number; categoria: string; camisa_anterior: number | null;
}
export class ErroJogador extends Error {
  constructor(mensagem: string, public conflito?: ConflitoCamisa) { super(mensagem); }
}
export type DadosJogador = {
  foto?: string | null;
  nome?: string; cpf?: string; dtNasc?: string; posicao?: string; numCamisa?: number | null;
  confirmar_camisa?: { jogador_id: number; camisa_anterior: number | null };
};
export async function preverCategoria(nascimento: string): Promise<{ categoria: Categoria; temporada: number }> {
  const res = await apiFetch(`/jogadores/categoria?nascimento=${encodeURIComponent(nascimento)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Não foi possível calcular a categoria');
  return json;
}
async function salvarDadosJogador(endpoint: string, method: string, dados: DadosJogador) {
  const res = await apiFetch(endpoint, { method, body: JSON.stringify(dados) });
  const json = await res.json();
  if (!res.ok) throw new ErroJogador(json.error || 'Não foi possível salvar o jogador', json.conflito_camisa);
  window.dispatchEvent(new Event('ludora:players-changed'));
  return json;
}
export async function criarJogador(dados: DadosJogador) {
  return salvarDadosJogador('/jogadores', 'POST', dados);
}
export async function atualizarJogador(id: number, dados: DadosJogador) {
  return salvarDadosJogador(`/jogadores/${id}`, 'PATCH', dados);
}
export async function deletarJogador(id: number) {
  const res = await apiFetch(`/jogadores/${id}`, { method: 'DELETE' });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao deletar jogador'); }
  window.dispatchEvent(new Event('ludora:players-changed'));
  return res.json();
}
export async function fetchEstatisticasJogador(id: number): Promise<Estatisticas> {
  const res = await apiFetch(`/jogadores/${id}/estatisticas`);
  if (!res.ok) throw new Error('Erro ao buscar estatísticas');
  return res.json();
}

// ── COMPETIÇÕES ──
export async function fetchCompeticoes(): Promise<Competicao[]> {
  const res = await apiFetch('/competicoes');
  if (!res.ok) throw new Error('Erro ao buscar competições');
  return res.json();
}
export async function criarCompeticao(dados: { nome: string; ano: number; tipo: string }) {
  const res = await apiFetch('/competicoes', { method: 'POST', body: JSON.stringify(dados) });
  if (!res.ok) throw new Error('Erro ao criar competição');
  return res.json();
}
export async function atualizarCompeticao(id: number, dados: { nome: string; ano: number }) {
  const res = await apiFetch(`/competicoes/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
  if (!res.ok) throw new Error('Erro ao atualizar competição');
  return res.json();
}
export async function deletarCompeticao(id: number) {
  const res = await apiFetch(`/competicoes/${id}`, { method: 'DELETE' });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao deletar competição'); }
  return res.json();
}

// ── PARTIDAS ──
export async function fetchHomePartidas(hoje: string, signal?: AbortSignal): Promise<HomePartida[]> {
  const res = await apiFetch(`/partidas/home?hoje=${encodeURIComponent(hoje)}`, { signal });
  if (!res.ok) throw new Error('Não foi possível atualizar os jogos do clube. Tente novamente.');
  const dados = await res.json();
  if (!Array.isArray(dados)) throw new Error('Não conseguimos confirmar os dados dos jogos. Tente novamente.');
  return dados;
}

export async function fetchPartidas(params?: { categoria_id?: number; mes?: number; status?: string; competicao_id?: number }): Promise<Partida[]> {
  const q = new URLSearchParams();
  if (params?.categoria_id) q.append('categoria_id', String(params.categoria_id));
  if (params?.mes) q.append('mes', String(params.mes));
  if (params?.status) q.append('status', params.status);
  if (params?.competicao_id) q.append('competicao_id', String(params.competicao_id));
  const res = await apiFetch(`/partidas?${q}`);
  if (!res.ok) throw new Error('Erro ao buscar partidas');
  return res.json();
}
export async function criarPartida(dados: Partial<Partida> & { mandante_id: number; visitante_id: number; data: string; categoria_id: number }) {
  let res: Response;
  try {
    res = await apiFetch('/partidas', { method: 'POST', body: JSON.stringify(dados) });
  } catch {
    throw new Error('A conexão foi interrompida. Confira a agenda antes de tentar novamente para evitar criar a mesma partida duas vezes.');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const fallback = res.status === 403 ? 'Você não tem permissão para criar partidas neste clube.'
      : res.status === 409 ? 'Já existe uma partida com estes dados. Confira a agenda do clube.'
      : res.status === 400 || res.status === 422 ? 'Confira os dados da partida antes de confirmar novamente.'
      : 'Não foi possível criar a partida agora. Seus dados foram mantidos para você tentar novamente.';
    throw new Error(res.status < 500 && typeof body?.error === 'string' ? body.error : fallback);
  }
  return res.json();
}
export async function atualizarPartida(id: number, dados: Partial<Partida>) {
  const res = await apiFetch(`/partidas/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao atualizar partida'); }
  return res.json();
}
export async function atualizarStatusPartida(id: number, status: string) {
  const res = await apiFetch(`/partidas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao atualizar status'); }
  return res.json();
}
export async function atualizarPlacarPartida(id: number, gols_mandante: number, gols_visitante: number): Promise<Partida> {
  const res = await apiFetch(`/partidas/${id}/placar`, { method: 'PATCH', body: JSON.stringify({ gols_mandante, gols_visitante }) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao atualizar placar'); }
  return res.json();
}
export async function deletarPartida(id: number) {
  const res = await apiFetch(`/partidas/${id}`, { method: 'DELETE' });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao deletar partida'); }
  return res.json();
}
export async function fetchEventosPartida(id: number): Promise<Evento[]> {
  const res = await apiFetch(`/partidas/${id}/eventos`);
  if (!res.ok) throw new Error('Erro ao buscar eventos');
  return res.json();
}
export async function registrarEvento(partidaId: number, dados: { tipo: string; periodo: number; minuto?: number; jogador_id?: number }) {
  const res = await apiFetch(`/partidas/${partidaId}/eventos`, { method: 'POST', body: JSON.stringify(dados) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao registrar evento'); }
  return res.json();
}
export async function deletarEvento(id: number) {
  const res = await apiFetch(`/eventos/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Erro ao deletar evento');
  return res.json();
}
export async function fetchEscalacao(partidaId: number): Promise<EscalacaoItem[]> {
  const res = await apiFetch(`/partidas/${partidaId}/escalacao`);
  if (!res.ok) throw new Error('Erro ao buscar escalação');
  return res.json();
}
export async function salvarEscalacao(partidaId: number, jogadores: { jogador_id: number; numCamisa: number; titular: boolean }[]) {
  const res = await apiFetch(`/partidas/${partidaId}/escalacao`, { method: 'PUT', body: JSON.stringify({ jogadores }) });
  if (!res.ok) throw new Error('Erro ao salvar escalação');
  return res.json();
}
