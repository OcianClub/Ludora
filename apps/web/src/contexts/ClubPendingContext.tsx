import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { fetchResumoCamisas } from '../services/api';
import { loadClubProfiles } from '../services/clubProfiles';
import { hasAssessment } from '../utils/scoutPlayers';

type Pending = { clubId: number; missing: Map<number, number> | null; unassessed: Map<number, number> | null };
const Context = createContext<Pending | null>(null);

export function ClubPendingProvider({ children }: { children: ReactNode }) {
  const { clube, podeGerenciar } = useAuth();
  const [data, setData] = useState<Pending | null>(null);
  useEffect(() => {
    if (!clube || !podeGerenciar) { setData(null); return; }
    const clubId = clube.id;
    let active = true;
    let running = false;
    let queued = false;
    let controller: AbortController | null = null;
    async function refresh(event?: Event) {
      if (running) { queued ||= Boolean(event); return; }
      running = true;
      const current = new AbortController();
      controller = current;
      const timer = window.setTimeout(() => current.abort(), 15_000);
      const [shirts, profiles] = await Promise.allSettled([
        fetchResumoCamisas(current.signal),
        loadClubProfiles(Boolean(event), current.signal),
      ]);
      clearTimeout(timer);
      if (active) {
        const unassessed = profiles.status === 'fulfilled' ? new Map<number, number>() : null;
        if (profiles.status === 'fulfilled') profiles.value.forEach(player => {
          if (!hasAssessment(player)) unassessed!.set(player.categoria_id, (unassessed!.get(player.categoria_id) || 0) + 1);
        });
        setData(previous => ({ clubId,
          missing: shirts.status === 'fulfilled' ? new Map(shirts.value.map(row => [row.categoria_id, row.semCamisa])) : previous?.clubId === clubId ? previous.missing : null,
          unassessed: unassessed || (previous?.clubId === clubId ? previous.unassessed : null) }));
      }
      running = false;
      if (active && queued) { queued = false; void refresh(new Event('ludora:players-changed')); }
    }
    void refresh();
    window.addEventListener('ludora:players-changed', refresh);
    return () => { active = false; controller?.abort(); window.removeEventListener('ludora:players-changed', refresh); };
  }, [clube?.id, podeGerenciar]);
  return <Context.Provider value={data?.clubId === clube?.id ? data : null}>{children}</Context.Provider>;
}

export function useClubPending() { return useContext(Context); }
