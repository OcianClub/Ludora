import { apiFetch } from './api';
export interface EquipePartida {
  id: number; clube_id: number; categoria_id: number; time_id: number; pronta: boolean; publicada_em: string | null;
  clube: { id: number; nome: string }; categoria: { id: number; nome: string };
  escalacao: { jogador_id: number; numCamisa: number; titular: boolean; titular_inicial?: boolean; jogador?: { nome: string; posicao: string } }[];
}
export interface GestaoPartida {
  partida: { id: number; status: string; versao: number; data: string; horario: string; local?: string; periodo_atual: number; titulares_necessarios: number; sumula_clube_id: number; organizador_id: number;
    mandante_id: number; visitante_id: number; gols_mandante: number; gols_visitante: number; categoria: { id: number; nome: string };
    mandante: { id: number; nome: string; escudo?: string }; visitante: { id: number; nome: string; escudo?: string } };
  organizador: { id: number; nome: string }; equipes: EquipePartida[]; minhaEquipeId?: number; podePreparar: boolean; podeSumula: boolean;
  eventos: { id: number; tipo: string; gol_contra?: boolean; periodo: number; jogador?: { nome: string } }[];
}
export interface PropostaPartida {
  id: string; tipo: string; origem_id: number; destino_id: number; respondente_id: number; status: string; versao: number; partida_id?: number;
  categoria_nome?: string;
  origem: { nome: string }; destino: { nome: string }; dados: { data?: string; horario?: string; local?: string };
}
export async function requisicaoPartida<T = unknown>(endpoint: string, clubeId: number, dados?: unknown, method = 'POST'): Promise<T> {
  const response = await apiFetch(endpoint, { method: dados === undefined ? 'GET' : method, headers: { 'x-clube-id': String(clubeId), 'Content-Type': 'application/json' }, ...(dados === undefined ? {} : { body: JSON.stringify(dados) }) });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir. Confira sua conexão e tente novamente.');
  return body;
}
export const gestaoPartida = (id: number, clubeId: number) => requisicaoPartida<GestaoPartida>(`/partidas/${id}/gestao`, clubeId);
