import { io, type Socket } from 'socket.io-client';
import type { EntradaLog } from '@ludora/shared-types';
import type { EstadoTempoReal, HistoricoLogs } from '../shared/bridge';
import { lerApiUrl } from './config';

const LIMITE_HISTORICO = 1000;

type Saida = {
  aoEntrada(entradas: EntradaLog[]): void;
  aoMudarEstado(estado: EstadoTempoReal): void;
};

let socket: Socket | null = null;
let estado: EstadoTempoReal = 'parado';
let historico: EntradaLog[] = [];
let saida: Saida | null = null;
let lote: EntradaLog[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;

function mudarEstado(novo: EstadoTempoReal) {
  estado = novo;
  saida?.aoMudarEstado(novo);
}

function guardar(entradas: EntradaLog[]) {
  historico.push(...entradas);
  if (historico.length > LIMITE_HISTORICO) historico.splice(0, historico.length - LIMITE_HISTORICO);
}

function enviarLote() {
  clearTimeout(timer);
  timer = undefined;
  if (!lote.length) return;
  const entradas = lote;
  lote = [];
  saida?.aoEntrada(entradas);
}

export function obterHistorico(): HistoricoLogs {
  return { estado, entradas: [...historico] };
}

/**
 * Conecta ao namespace /admin da API com o escopo de logs do cargo. O socket vive
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
    enviarLote();
    historico = [];
    guardar(entradas);
    destino.aoEntrada(entradas);
  });
  socket.on('log', (entrada: EntradaLog) => {
    guardar([entrada]);
    lote.push(entrada);
    if (lote.length >= 100) enviarLote();
    else timer ??= setTimeout(enviarLote, 50);
  });
}

export function pararLogs() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
  clearTimeout(timer);
  timer = undefined;
  lote = [];
  if (estado !== 'parado') {
    estado = 'parado';
    saida?.aoMudarEstado('parado');
  }
  historico = [];
  saida = null;
}
