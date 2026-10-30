import { requestJson, type Partida, type Categoria, type Clube, type EscalacaoItem, type Evento } from './api';
export interface EquipePartida {
  id: number; clube_id: number; categoria_id: number; time_id: number; pronta: boolean; publicada_em: string | null;
  categoria: Categoria; clube: Pick<Clube, 'id' | 'nome'>; escalacao: (EscalacaoItem & { titular_inicial?: boolean; time_id: number; ordem: number })[];
}
export interface GestaoPartida {
  partida: Partida & { versao: number; periodo_atual: number; sumula_clube_id: number; organizador_id: number; titulares_necessarios: number };
  organizador: Pick<Clube, 'id' | 'nome'>; equipes: EquipePartida[]; minhaEquipeId?: number; podePreparar: boolean; podeSumula: boolean;
  eventos: (Evento & { time_id?: number; gol_contra?: boolean })[];
  auditoria: { id: number; acao: string; usuario_id: number; criado_em: string; dados: unknown }[];
}
export interface PropostaPartida {
  id: string; tipo: string; origem_id: number; destino_id: number; respondente_id: number; status: string; versao: number; partida_id?: number;
  categoria_nome?: string;
  origem: Clube; destino: Clube; criado_em: string; motivo?: string;
  dados: { data: string; horario: string; local?: string; emCasa?: boolean; categoria_id?: number; sugestao?: { clube_id: number; motivo?: string; criada_em: string } };
}
export const carregarGestao = (id: number) => requestJson<GestaoPartida>(`/partidas/${id}/gestao`);
export const carregarPropostas = () => requestJson<PropostaPartida[]>('/partidas/solicitacoes');
export const comandoPartida = <T = unknown>(id: number, endpoint: string, dados: unknown, method = 'POST') => requestJson<T>(`/partidas/${id}/${endpoint}`, { method, body: JSON.stringify(dados) });
export const responderProposta = (proposta: PropostaPartida, acao: string, dados: object = {}) => requestJson<{ partidaId?: number }>(`/partidas/solicitacoes/${proposta.id}/responder`, { method: 'POST', body: JSON.stringify({ versao: proposta.versao, acao, ...dados }) });
