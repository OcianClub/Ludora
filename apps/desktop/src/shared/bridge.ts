import type { EntradaLog, SuperAdminUsuario } from '@ludora/shared-types';
import type { MetodoHttp } from './rules';

// Nomes dos canais IPC, em um só lugar para main, preload e renderer.
export const CANAIS = {
  authRestaurar: 'auth:restaurar',
  authEntrar: 'auth:entrar',
  authSair: 'auth:sair',
  api: 'api:requisicao',
  configObter: 'config:obter',
  configDefinirApi: 'config:definir-api',
  logsHistorico: 'logs:historico',
  logsEntrada: 'logs:entrada',
  logsEstado: 'logs:estado',
  sessaoExpirada: 'sessao:expirada',
} as const;

export type EstadoTempoReal = 'parado' | 'conectando' | 'conectado' | 'desconectado' | 'erro';

export interface RespostaApi<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export type ResultadoLogin =
  | { ok: true; usuario: SuperAdminUsuario; persistente: boolean }
  | { ok: false; erro: string };

export interface ConfigApp {
  apiUrl: string;
  apiUrlPadrao: string;
  versao: string;
  plataforma: string;
  armazenamentoSeguro: boolean;
}

export interface HistoricoLogs {
  estado: EstadoTempoReal;
  entradas: EntradaLog[];
}

// Contrato exposto em window.ludora pelo preload (contextBridge).
export interface LudoraBridge {
  auth: {
    restaurar(): Promise<ResultadoLogin | null>;
    entrar(email: string, senha: string): Promise<ResultadoLogin>;
    sair(): Promise<void>;
    aoExpirar(ouvinte: () => void): () => void;
  };
  api: {
    requisicao<T = unknown>(metodo: MetodoHttp, caminho: string, corpo?: unknown): Promise<RespostaApi<T>>;
  };
  config: {
    obter(): Promise<ConfigApp>;
    definirApiUrl(url: string): Promise<{ ok: true; apiUrl: string } | { ok: false; erro: string }>;
  };
  logs: {
    historico(): Promise<HistoricoLogs>;
    aoReceber(ouvinte: (entrada: EntradaLog) => void): () => void;
    aoMudarEstado(ouvinte: (estado: EstadoTempoReal) => void): () => void;
  };
}
