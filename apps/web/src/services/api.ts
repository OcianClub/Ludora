export const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Auth token (localStorage para web) ──
export function getToken(): string | null {
  return localStorage.getItem('ludora_token');
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
export interface PerfilUsuario extends Usuario { clubes: Clube[]; }
export interface Categoria { id: number; nome: string; tipo: string; clube_id: number; }
export interface Time { id: number; nome: string; escudo?: string; categoria_id?: number; }
export interface Jogador { id: number; nome: string; cpf: string; dtNasc: string; posicao: string; numCamisa?: number; ativo: boolean; perfil_ml?: string; nota_geral?: number; categoria_id: number; }
export interface Partida { id: number; mandante_id: number; visitante_id: number; gols_mandante: number; gols_visitante: number; data: string; horario?: string; local?: string; status: string; emCasa: boolean; categoria_id: number; competicao_id?: number; rodada?: number; grupo?: string | null; mandante?: Time; visitante?: Time; categoria?: Categoria; }
export interface Competicao { id: number; nome: string; ano: number; tipo: string; clube_id: number; }
export interface Evento { id: number; partida_id: number; tipo: string; periodo: number; minuto?: number; jogador_id?: number; }
export interface EscalacaoItem { jogador_id: number; numCamisa: number; titular: boolean; jogador?: Jogador; }
export interface PerfilJogador extends Jogador { totalGols: number; totalAssistencias: number; totalCartoes: number; totalDefesas: number; totalFaltas: number; totalPartidas: number; }
export interface Estatisticas { gols: number; assistencias: number; defesas: number; cartaoAmarelo: number; cartaoVermelho: number; faltas: number; }

// ── AUTH ──
export async function login(email: string, senha: string) {
  const res = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, senha }) });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao fazer login');
  const data = await res.json();
  const usuario: Usuario = data.usuario || {
    id: data.id,
    nome: data.nome,
    email: data.email,
    criadoEm: data.criadoEm,
  };
  return { ...data, usuario } as { token: string; usuario: Usuario; clubes?: Clube[] };
}
export async function registrar(nome: string, email: string, senha: string) {
  const res = await apiFetch('/auth/registrar', { method: 'POST', body: JSON.stringify({ nome, email, senha }) });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao registrar');
  return res.json();
}

export async function fetchMeuPerfil(): Promise<PerfilUsuario> {
  const res = await apiFetch('/usuarios/me');
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao carregar perfil');
  return res.json();
}

export async function atualizarMeuPerfil(dados: { nome: string; email: string; senha?: string }): Promise<Usuario> {
  const res = await apiFetch('/usuarios/me', { method: 'PATCH', body: JSON.stringify(dados) });
  if (!res.ok) throw new Error((await res.json()).error || 'Erro ao atualizar perfil');
  return res.json();
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
export async function fetchCategorias(): Promise<Categoria[]> {
  const res = await apiFetch('/categorias');
  if (!res.ok) throw new Error('Erro ao buscar categorias');
  return res.json();
}

// ── TIMES ──
export async function fetchTimes(): Promise<Time[]> {
  const res = await apiFetch('/times');
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
  if (!res.ok) throw new Error('Erro ao criar time');
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
  if (!res.ok) throw new Error('Erro ao atualizar time');
  return res.json();
}
export async function deletarTime(id: number) {
  const res = await apiFetch(`/times/${id}`, { method: 'DELETE' });
  if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Erro ao deletar time'); }
  return res.json();
}

// ── JOGADORES ──
export async function fetchJogadores(): Promise<Jogador[]> {
  const res = await apiFetch('/jogadores');
  if (!res.ok) throw new Error('Erro ao buscar jogadores');
  return res.json();
}
export async function fetchJogadoresPerfis(categoria_id?: number): Promise<PerfilJogador[]> {
  const q = categoria_id ? `?categoria_id=${categoria_id}` : '';
  const res = await apiFetch(`/jogadores/perfis${q}`);
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
    totalGols: j.totalGols ?? j.gols ?? 0,
    totalAssistencias: j.totalAssistencias ?? j.assistencias ?? 0,
    totalCartoes: j.totalCartoes ?? ((j.cartoes_amarelos ?? 0) + (j.cartoes_vermelhos ?? 0)),
    totalDefesas: j.totalDefesas ?? j.defesas ?? 0,
    totalFaltas: j.totalFaltas ?? j.faltas_cometidas ?? 0,
    totalPartidas: j.totalPartidas ?? j.jogos_disputados ?? 0,
  }));
}
export async function criarJogador(dados: { nome: string; cpf: string; dtNasc: string; posicao: string; numCamisa?: number; categoria_id?: number }) {
  const res = await apiFetch('/jogadores', { method: 'POST', body: JSON.stringify(dados) });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro ao criar jogador');
  return json;
}
export async function atualizarJogador(id: number, dados: Partial<Jogador>) {
  const res = await apiFetch(`/jogadores/${id}`, { method: 'PATCH', body: JSON.stringify(dados) });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao atualizar jogador'); }
  return res.json();
}
export async function deletarJogador(id: number) {
  const res = await apiFetch(`/jogadores/${id}`, { method: 'DELETE' });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error || 'Erro ao deletar jogador'); }
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
  const res = await apiFetch('/partidas', { method: 'POST', body: JSON.stringify(dados) });
  if (!res.ok) throw new Error('Erro ao criar partida');
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
