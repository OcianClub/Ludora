import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { BASE_URL } from '../services/config';
import { carregarPropostas, type PropostaPartida } from '../services/sharedMatches';

export function useMatchProposals(clubId: number | undefined, token: string | null) {
  const [items, setItems] = useState<PropostaPartida[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const refresh = useCallback(() => refreshRef.current(), []);

  useEffect(() => {
    let active = true;
    let running: Promise<void> | null = null;
    let queued = false;
    const controller = new AbortController();
    setItems([]); setError(''); setRefreshing(false); setLoading(!!clubId && !!token);
    if (!clubId || !token) return;

    function load(recheck = false): Promise<void> {
      if (!active) return Promise.resolve();
      if (running) {
        // Um aviso recebido durante a consulta exige outra leitura depois dela.
        queued ||= recheck;
        return running;
      }
      setRefreshing(true);
      running = (async () => {
        do {
          queued = false;
          try {
            const data = await carregarPropostas(controller.signal);
            if (active) { setItems(data); setError(''); }
          } catch (cause) {
            if (active) setError((cause as Error).message || 'Não foi possível atualizar as solicitações.');
          }
        } while (active && queued);
      })().finally(() => {
        running = null;
        if (active) { setLoading(false); setRefreshing(false); }
      });
      return running;
    }
    refreshRef.current = () => load(true);
    const socket = io(BASE_URL, { auth: { token, clubeId: clubId } });
    const update = () => { if (!document.hidden) void load(true); };
    let connectedBefore = false;
    socket.on('solicitacao_partida', update);
    socket.on('connect', () => {
      if (connectedBefore) update();
      else { connectedBefore = true; if (!running) void load(); }
    });
    const initial = window.setTimeout(() => void load(), 0);
    // Reconcilia também com socket conectado: um aviso perdido não deixa a lista desatualizada.
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    window.addEventListener('focus', update);
    window.addEventListener('online', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      active = false;
      controller.abort(); clearTimeout(initial);
      refreshRef.current = async () => {};
      socket.removeAllListeners(); socket.disconnect(); clearInterval(timer);
      window.removeEventListener('focus', update);
      window.removeEventListener('online', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, [clubId, token]);
  return { items, loading, refreshing, error, refresh };
}
