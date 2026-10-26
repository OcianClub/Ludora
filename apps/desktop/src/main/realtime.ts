import { io, type Socket } from 'socket.io-client';
import type { EntradaLog } from '@ludora/shared-types';
import type { EstadoTempoReal, HistoricoLogs } from '../shared/bridge';
import { lerApiUrl } from './config';

const LIMITE_HISTORICO = 1000;

type Saida = {
  aoEntrada(entrada: EntradaLog): void;
  aoMudarEstado(estado: EstadoTempoReal): void;
};

let socket: Socket | null = null;
let estado: EstadoTempoReal = 'parado';
let historico: EntradaLog[] = [];
let saida: Saida | null = null;

function mudarEstado(novo: EstadoTempoReal) {
  estado = novo;
  saida?.aoMudarEstado(novo);
}

function guardar(entradas: EntradaLog[]) {
  historico = [...historico, ...entradas].slice(-LIMITE_HISTORICO);
}

export function obterHistorico(): HistoricoLogs {
  return { estado, entradas: historico };
}

/**
 * Conecta ao namespace /admin da API, que só aceita Super Admin. O socket vive
 * no processo principal: o token não passa pelo renderer, e o histórico
 * sobrevive à troca de telas.
 */
export function iniciarLogs(token: string, destino: Saida) {
  pararLogs();
  saida = destino;
  historico = [];
  mudarEstado('conectando');

  socket = io(`${lerApiUrl()}/admin`, {
    auth: { token },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10_000,
  });

  socket.on('connect', () => mudarEstado('conectado'));
  socket.on('disconnect', () => mudarEstado('desconectado'));
  socket.on('connect_error', () => mudarEstado('erro'));

  // Ao (re)conectar a API reenvia os últimos registros: substitui, não duplica.
  socket.on('snapshot', (entradas: EntradaLog[]) => {
    historico = [];
    guardar(entradas);
    entradas.forEach(entrada => destino.aoEntrada(entrada));
  });
  socket.on('log', (entrada: EntradaLog) => {
    guardar([entrada]);
    destino.aoEntrada(entrada);
  });
}

export function pararLogs() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  if (estado !== 'parado') {
    estado = 'parado';
    saida?.aoMudarEstado('parado');
  }
  historico = [];
  saida = null;
}
