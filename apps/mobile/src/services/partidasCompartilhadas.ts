import { apiFetch } from './api';
import { ErroConsulta } from '../utils/request';
export interface EquipePartida {
  id: number; clube_id: number; categoria_id: number; time_id: number; pronta: boolean; publicada_em: string | null;
  clube: { id: number; nome: string }; categoria: { id: number; nome: string };
  escalacao: { jogador_id: number; numCamisa: number; titular: boolean; titular_inicial?: boolean; jogador?: { nome: string; posicao: string } }[];
}
export interface GestaoPartida {
  partida: { id: number; status: string; versao: number; data: string; horario: string; local?: string; periodo_atual: number; titulares_necessarios: number; sumula_clube_id: number; organizador_id: number;
    mandante_id: number; visitante_id: number; gols_mandante: number; gols_visitante: number; categoria: { id: number; nome: string }; competicao?: { nome: string } | null;
    mandante: { id: number; nome: string; escudo?: string }; visitante: { id: number; nome: string; escudo?: string } };
  organizador: { id: number; nome: string }; equipes: EquipePartida[]; minhaEquipeId?: number; podePreparar: boolean; podeSumula: boolean;
  podeCorrigir?: boolean;
  eventos: EventoPartida[];
  auditoria?: { id: number; acao: string; criado_em: string; dados?: Record<string, unknown> | null }[];
}
export interface EventoPartida {
  id: number; tipo: string; time_id?: number | null; jogador_id?: number | null;
  gol_contra?: boolean; periodo: number; minuto?: number | null; jogador?: { nome: string } | null;
}
export interface PropostaPartida {
  id: string; tipo: string; origem_id: number; destino_id: number; respondente_id: number; status: string; versao: number; partida_id?: number;
  categoria_nome?: string;
  origem: { nome: string; escudo?: string | null }; destino: { nome: string; escudo?: string | null }; dados: { data?: string; horario?: string; local?: string; motivo?: string; novo_responsavel_id?: number };
}
export async function requisicaoPartida<T = unknown>(endpoint: string, clubeId: number, dados?: unknown, method = 'POST'): Promise<T> {
  const response = await apiFetch(endpoint, { method: dados === undefined ? 'GET' : method, headers: { 'x-clube-id': String(clubeId), 'Content-Type': 'application/json' }, ...(dados === undefined ? {} : { body: JSON.stringify(dados) }) });
  const body = await response.json();
  if (!response.ok) throw new ErroConsulta(response.status, body.error || 'Não foi possível concluir. Confira sua conexão e tente novamente.');
  return body;
}
export const gestaoPartida = (id: number, clubeId: number) => requisicaoPartida<GestaoPartida>(`/partidas/${id}/gestao`, clubeId);
