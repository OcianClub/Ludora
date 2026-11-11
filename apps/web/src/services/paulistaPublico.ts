import { requestJson } from './api';
import { painelPaulistaPublico, type EventoPublicoPaulista, type ClubePaulistaPublico } from '../utils/paulistaPublico';
export type { ClubePaulistaPublico } from '../utils/paulistaPublico';

export function listarPaulistaPublico(clubeId: number, options: RequestInit = {}) {
  return requestJson<EventoPublicoPaulista[]>(`/publico/clubes/${clubeId}/paulista`, options);
}

export async function consultarPaulistaPublico(eventoId: string, clube: ClubePaulistaPublico, options: RequestInit = {}) {
  const eventos = await listarPaulistaPublico(clube.id, options);
  const evento = eventos.find(e => String(e.id) === eventoId);
  if (!evento) throw new Error('Esta participação ainda não está disponível para consulta pública.');
  return painelPaulistaPublico(evento, clube);
}
