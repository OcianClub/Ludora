import { useEffect, useRef, useState } from 'react';
import { carregarGestao, comandoPartida } from '../services/sharedMatches';
import { requestJson } from '../services/api';
import type { MatchEvent } from '../utils/matchEvents';

export const EVENT_REVIEW_MS = 5000;
type QueuedEvent = {
  id: string;
  payload: Record<string, unknown>;
  operation?: 'remove';
  label: string;
  due: number;
  status: 'waiting' | 'sending' | 'failed';
  attempted?: boolean;
  error?: string;
};

export function useDelayedMatchEvents(matchId: number, scope: string, onSent: (event: MatchEvent | null) => Promise<void>, enabled = true) {
  const key = `ludora:event-review:${scope}:${matchId}`;
  const [queue, setQueue] = useState<QueuedEvent[]>(() => {
    if (!enabled) return [];
    try {
      const saved = JSON.parse(sessionStorage.getItem(key) || '[]') as QueuedEvent[];
      return saved.map(item => ({ ...item, status: 'failed', error: 'Envio interrompido. Confira e tente novamente.' }));
    } catch { return []; }
  });
  const [now, setNow] = useState(Date.now());
  const current = useRef(queue);
  const sending = useRef(false);
  const sent = useRef(onSent);
  sent.current = onSent;
  function change(update: (items: QueuedEvent[]) => QueuedEvent[]) {
    current.current = update(current.current);
    sessionStorage.setItem(key, JSON.stringify(current.current));
    setQueue(current.current);
  }
  useEffect(() => {
    if (!enabled || !queue.length) return;
    let mounted = true;
    const tick = async () => {
      if (!mounted) return;
      const timestamp = Date.now();
      setNow(previous => Math.floor(previous / 1000) === Math.floor(timestamp / 1000) ? previous : timestamp);
      const first = current.current[0];
      if (sending.current || !first || first.status !== 'waiting' || first.due > Date.now()) return;
      sending.current = true;
      change(items => items.map(item => item.id === first.id ? { ...item, status: 'sending', attempted: true } : item));
      try {
        const latest = await carregarGestao(matchId);
        const payload = { ...first.payload, request_id: first.id, versao: latest.partida.versao, partida_id: matchId };
        let event: MatchEvent | null = null;
        if (first.operation === 'remove') {
          await requestJson(`/eventos/${first.payload.evento_id}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        } else {
          event = await comandoPartida<MatchEvent>(matchId, 'eventos', payload);
        }
        change(items => items.filter(item => item.id !== first.id));
        if (mounted) await sent.current(event);
      } catch (error) {
        change(items => items.map(item => item.id === first.id ? {
          ...item, status: 'failed', error: error instanceof Error ? error.message : 'Não foi possível confirmar o envio.',
        } : item));
      } finally { sending.current = false; }
    };
    const timer = window.setInterval(() => void tick(), 200);
    const warn = (event: BeforeUnloadEvent) => {
      if (current.current.length) { event.preventDefault(); event.returnValue = ''; }
    };
    window.addEventListener('beforeunload', warn);
    return () => { mounted = false; clearInterval(timer); window.removeEventListener('beforeunload', warn); };
  }, [key, matchId, queue.length > 0, enabled]);
  return {
    queue, now,
    enqueue(payload: Record<string, unknown>, label: string, requestId = crypto.randomUUID()) {
      if (!enabled) return;
      change(items => [...items, { id: requestId, payload, label, due: Date.now() + EVENT_REVIEW_MS, status: 'waiting' }]);
    },
    remove(eventId: number, motivo: string, label: string) {
      if (!enabled) return;
      if (current.current.some(item => item.operation === 'remove' && item.payload.evento_id === eventId)) return;
      change(items => [...items, { id: crypto.randomUUID(), operation: 'remove', payload: { evento_id: eventId, motivo }, label, due: Date.now() + EVENT_REVIEW_MS, status: 'waiting' }]);
    },
    cancel(id: string) { change(items => items.filter(item => item.id !== id || item.status !== 'waiting' || item.attempted)); },
    retry(id: string) {
      change(items => items.map(item => item.id === id ? { ...item, status: 'waiting', due: item.attempted ? Date.now() : Date.now() + EVENT_REVIEW_MS, error: undefined } : item));
    },
  };
}
