import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { requestJson } from '../services/api';

type Pause = { operacao: string; label: string; motivo: string; escopo: 'GLOBAL' | 'CLUBE' };
type Maintenance = { pauses: Pause[]; checking: boolean; refresh: () => void };

const empty: Pause[] = [];
const MaintenanceContext = createContext<Maintenance>({ pauses: empty, checking: false, refresh: () => {} });

export function MaintenanceProvider({ children }: { children: ReactNode }) {
  const { clube, podeGerenciar, usuario } = useAuth();
  const scope = podeGerenciar && clube ? `${usuario?.id}:${clube.id}` : 'public';
  const [checkedScope, setCheckedScope] = useState('');
  const [snapshot, setSnapshot] = useState<{ scope: string; pauses: Pause[] }>();
  const refreshRef = useRef(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending || document.hidden || controller.signal.aborted) return;
      pending = true;
      try {
        const pauses = await requestJson<Pause[]>('/manutencao/estado', {
          semClube: scope === 'public', signal: controller.signal, cache: 'no-store',
        });
        if (!controller.signal.aborted && Array.isArray(pauses)) setSnapshot(current => {
          if (current?.scope === scope && current.pauses.length === pauses.length && current.pauses.every((pause, index) => {
            const next = pauses[index];
            return pause.operacao === next.operacao && pause.escopo === next.escopo && pause.label === next.label && pause.motivo === next.motivo;
          })) return current;
          return { scope, pauses };
        });
      } catch {
        // A validação da operação continua no servidor.
      } finally {
        if (!controller.signal.aborted) setCheckedScope(scope);
        pending = false;
      }
    }
    refreshRef.current = load;
    void load();
    const timer = window.setInterval(load, 30_000);
    window.addEventListener('focus', load);
    window.addEventListener('online', load);
    document.addEventListener('visibilitychange', load);
    return () => {
      controller.abort();
      refreshRef.current = () => {};
      window.clearInterval(timer);
      window.removeEventListener('focus', load);
      window.removeEventListener('online', load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [scope]);

  const pauses = snapshot?.scope === scope ? snapshot.pauses : empty;
  const checking = checkedScope !== scope;
  const value = useMemo(() => ({ pauses, checking, refresh }), [pauses, checking, refresh]);
  return <MaintenanceContext.Provider value={value}>{children}</MaintenanceContext.Provider>;
}

export function useMaintenance() {
  const { pauses, checking, refresh } = useContext(MaintenanceContext);
  return { pauses, checking, refresh, pauseFor: (operation: string) => pauses.find(pause => pause.operacao === operation) };
}
