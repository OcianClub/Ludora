import { fetchJogadoresPerfis, invalidateApiReads } from './api';

export function loadClubProfiles(force = false, signal?: AbortSignal) {
  if (force) invalidateApiReads('/jogadores/perfis');
  return fetchJogadoresPerfis(undefined, signal);
}
