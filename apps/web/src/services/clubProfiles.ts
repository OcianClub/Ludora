import { fetchJogadoresPerfis, getClubeId, getToken, type PerfilJogador } from './api';

let cached: { key: string; expires: number; request: Promise<PerfilJogador[]> } | null = null;

export function loadClubProfiles(force = false) {
  const key = `${getClubeId()}:${getToken()}`;
  if (!force && cached?.key === key && cached.expires > Date.now()) return cached.request;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15_000);
  const entry = { key, expires: Date.now() + 30_000, request: fetchJogadoresPerfis(undefined, controller.signal).finally(() => clearTimeout(timer)) };
  cached = entry;
  entry.request.catch(() => { if (cached === entry) cached = null; });
  return entry.request;
}
