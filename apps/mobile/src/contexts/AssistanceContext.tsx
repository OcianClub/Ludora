import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, BASE_URL } from '../services/api';
import { useSessao } from './SessaoContext';
import { useClubeAtivo } from './ClubeAtivoContext';
export type Pause = { operacao: string; label: string; motivo: string; escopo: string };
const Context = createContext({ pauses: [] as Pause[], replies: 0, seen: (_id: string) => {}, version: 0, refresh: () => {} });
export function AssistanceProvider({ children }: { children: ReactNode }) {
  const { autenticado } = useSessao(), { clubeAtivo } = useClubeAtivo();
  const scope = `${autenticado}:${clubeAtivo?.id ?? 0}`;
  const [version, setVersion] = useState(0);
  const [data, setData] = useState({ scope: '', pauses: [] as Pause[], replies: 0 });
  const latest = useRef<Record<string, number>>({}), viewed = useRef<Record<string, number>>({}), refreshRef = useRef(() => {});
  useEffect(() => {
    const controller = new AbortController(); let pending = false; let socket: Socket | undefined;
    if (!autenticado) { viewed.current = {}; latest.current = {}; }
    async function refresh() {
      if (pending || controller.signal.aborted || (AppState.currentState === 'background' || AppState.currentState === 'inactive')) return;
      pending = true;
      try {
        const [maintenance, notices] = await Promise.allSettled([
          apiFetch('/manutencao/estado', { signal: controller.signal, revalidar: true }).then(async r => { if (!r.ok) throw Error(); return r.json(); }),
          autenticado ? apiFetch('/suporte/avisos', { signal: controller.signal, revalidar: true }).then(async r => { if (!r.ok) throw Error(); return r.json(); }) : Promise.resolve([]),
        ]);
        if (controller.signal.aborted) return;
        if (notices.status === 'fulfilled' && Array.isArray(notices.value)) {
          const grouped: Record<string, number> = {};
          for (const notice of notices.value) if (Number.isSafeInteger(notice?.id) && typeof notice.chamadoId === 'string') grouped[notice.chamadoId] = Math.max(grouped[notice.chamadoId] || 0, notice.id);
          latest.current = grouped;
        }
        setData(old => {
          const pauses = maintenance.status === 'fulfilled' && Array.isArray(maintenance.value) ? maintenance.value : old.scope === scope ? old.pauses : [];
          const replies = notices.status === 'fulfilled' && Array.isArray(notices.value) ? Object.entries(latest.current).filter(([id, n]) => n > (viewed.current[id] || 0)).length : old.scope === scope ? old.replies : 0;
          return old.scope === scope && old.replies === replies && JSON.stringify(old.pauses) === JSON.stringify(pauses) ? old : { scope, pauses, replies };
        });
      } finally { pending = false; }
    }
    refreshRef.current = refresh; void refresh();
    if (autenticado) void SecureStore.getItemAsync('userToken').then(token => {
      if (!token || controller.signal.aborted) return;
      socket = io(BASE_URL + '/suporte', { auth: { token } }); socket.on('resposta_suporte', () => { setVersion(n => n + 1); void refresh(); }); socket.on('connect', refresh);
    }).catch(() => {});
    const interval = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { controller.abort(); socket?.disconnect(); clearInterval(interval); listener.remove(); refreshRef.current = () => {}; };
  }, [scope, autenticado]);
  const seen = useCallback((id: string) => { viewed.current[id] = latest.current[id] || 0; setData(old => ({ ...old, replies: Object.entries(latest.current).filter(([key, n]) => n > (viewed.current[key] || 0)).length })); }, []);
  const refresh = useCallback(() => refreshRef.current(), []);
  const value = useMemo(() => ({ pauses: data.scope === scope ? data.pauses : [], replies: data.scope === scope ? data.replies : 0, seen, version, refresh }), [data, scope, seen, version, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAssistance = () => useContext(Context);
