import type { EntradaLog } from '@ludora/shared-types';

export const LIMITE_LOGS = 1000;

// Mensagens desconhecidas e auditorias permanecem intactas, sem inventar campos.
export function interpretarHttp(entrada: EntradaLog) {
  if (entrada.tipo !== 'http') return null;
  const m = /^(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s+(\S+)\s+→\s+([1-5]\d{2})$/.exec(entrada.mensagem);
  return m ? { metodo: m[1], rota: m[2], status: Number(m[3]) } : null;
}

export function classeDuracao(ms: number | undefined, lenta = 1000, muitoLenta = 3000) {
  if (ms === undefined || !Number.isFinite(ms) || ms < 0) return 'normal';
  return ms >= muitoLenta ? 'critica' : ms >= lenta ? 'lenta' : 'normal';
}

export function mesclarLogs(atual: EntradaLog[], novas: EntradaLog[]) {
  const mapa = new Map(atual.map(e => [e.id, e]));
  novas.forEach(e => mapa.set(e.id, e));
  return [...mapa.values()].sort((a, b) => a.id - b.id).slice(-LIMITE_LOGS);
}

// Apenas registros já recebidos pelo processo principal podem ser exportados.
export function selecionarLogs(entradas: EntradaLog[], ids: unknown): EntradaLog[] {
  if (!Array.isArray(ids) || ids.length > LIMITE_LOGS || ids.some(id => !Number.isSafeInteger(id) || id < 0)) {
    throw new Error('Seleção de logs inválida.');
  }
  const selecionados = new Set(ids);
  const historico = new Map(entradas.map(e => [e.id, e]));
  return [...selecionados].flatMap(id => historico.has(id) ? [historico.get(id)!] : []);
}

export function formatarLogs(entradas: EntradaLog[]) {
  return entradas.map(e => `${e.ts}\t${e.tipo === 'audit' ? 'AUDIT' : e.nivel.toUpperCase()}\t${e.mensagem.replace(/[\r\n\t]/g, ' ')}${e.ms === undefined ? '' : `\t${e.ms} ms`}`).join('\n');
}
