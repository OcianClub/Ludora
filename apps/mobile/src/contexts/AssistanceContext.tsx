import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, BASE_URL } from '../services/api';
import { useSessao } from './SessaoContext';
import { useClubeAtivo } from './ClubeAtivoContext';
export type Pause = { operacao: string; label: string; motivo: string; escopo: string };
const Context = createContext({ pauses: [] as Pause[], replies: 0, seen: (_id: string, _responseId: number) => {}, version: 0, refresh: () => {} });
export function AssistanceProvider({ children }: { children: ReactNode }) {
  const { autenticado } = useSessao(), { clubeAtivo } = useClubeAtivo();
  const scope = `${autenticado}:${clubeAtivo?.id ?? 0}`;
  const [version, setVersion] = useState(0);
  const [data, setData] = useState({ scope: '', pauses: [] as Pause[], replies: 0 });
  const pendingReads = useRef<Record<string, number>>({}), confirmedReads = useRef<Record<string, number>>({});
  const flushRef = useRef<() => Promise<void>>(async () => {});
  const latest = useRef<Record<string, number>>({}), viewed = useRef<Record<string, number>>({}), refreshRef = useRef(() => {});
  useEffect(() => {
    const controller = new AbortController(); let pending = false, queued = false; let socket: Socket | undefined;
    if (!autenticado) { viewed.current = {}; latest.current = {}; pendingReads.current = {}; confirmedReads.current = {}; }
    let flushing = false;
    let token: string | null = null;
    async function flushReads() {
      if (flushing || !token || controller.signal.aborted || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
      flushing = true;
      try {
        for (const [id, responseId] of Object.entries(pendingReads.current)) {
          if (controller.signal.aborted) return;
          try {
            const response = await apiFetch(`/suporte/${encodeURIComponent(id)}/lido`, { method: 'PATCH', signal: controller.signal, headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ respostaId: responseId }) });
            if (controller.signal.aborted) return;
            if (response.ok || response.status === 404) {
              confirmedReads.current[id] = Math.max(confirmedReads.current[id] || 0, responseId);
              if (pendingReads.current[id] === responseId) delete pendingReads.current[id];
            }
          } catch { /* Retry while active; never hide a newer unread reply. */ }
        }
      } finally { flushing = false; }
    }
    flushRef.current = flushReads;
    async function refresh() {
      if (controller.signal.aborted || (AppState.currentState === 'background' || AppState.currentState === 'inactive')) return;
      if (pending) { queued = true; return; }
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
        await flushReads();
      } finally { pending = false; if (queued && !controller.signal.aborted) { queued = false; void refresh(); } }
    }
    refreshRef.current = refresh; void refresh();
    if (autenticado) void SecureStore.getItemAsync('userToken').then(savedToken => {
      if (!savedToken || controller.signal.aborted) return;
      token = savedToken;
      void flushReads();
      socket = io(BASE_URL + '/suporte', { auth: { token } }); socket.on('resposta_suporte', () => { setVersion(n => n + 1); void refresh(); }); socket.on('connect', refresh); socket.on('avisos_suporte_atualizados', () => { setVersion(n => n + 1); void refresh(); });
    }).catch(() => {});
    const interval = setInterval(refresh, 30000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') void refresh(); });
    return () => { controller.abort(); socket?.disconnect(); clearInterval(interval); listener.remove(); refreshRef.current = () => {}; flushRef.current = async () => {}; };
  }, [scope, autenticado]);
  const seen = useCallback((id: string, responseId: number) => {
    if (!Number.isSafeInteger(responseId) || responseId <= 0 || AppState.currentState === 'background' || AppState.currentState === 'inactive') return;
    viewed.current[id] = Math.max(viewed.current[id] || 0, responseId);
    if (responseId > (confirmedReads.current[id] || 0)) {
      pendingReads.current[id] = Math.max(pendingReads.current[id] || 0, responseId);
      void flushRef.current();
    }
    setData(old => {
      const replies = Object.entries(latest.current).filter(([key, n]) => n > (viewed.current[key] || 0)).length;
      return replies === old.replies ? old : { ...old, replies };
    });
  }, []);
  const refresh = useCallback(() => refreshRef.current(), []);
  const value = useMemo(() => ({ pauses: data.scope === scope ? data.pauses : [], replies: data.scope === scope ? data.replies : 0, seen, version, refresh }), [data, scope, seen, version, refresh]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export const useAssistance = () => useContext(Context);
