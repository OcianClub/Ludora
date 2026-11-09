import { useCallback, useEffect, useRef, useState } from 'react';
import type { PainelPaulista } from '../../../../packages/shared-types/src/paulista';
import { BASE_URL, invalidateApiReads, requestJson } from '../services/api';
import { subscribePaulistaUpdates } from '../services/paulistaRealtime';
import { painelDaSelecao } from '../utils/paulistaView';

export function usePaulistaUpdates(evento: string, clubeId: number | undefined, token: string | null, enabled: boolean, apply: (painel: PainelPaulista) => void, esperado?: { id: number; ano: number; categoria: string; divisao: string }) {
  const [erro, setErro] = useState('');
  const [updating, setUpdating] = useState(false);
  const applyRef = useRef(apply); applyRef.current = apply;
  const refreshRef = useRef(() => {});
  const refresh = useCallback(() => refreshRef.current(), []);
  useEffect(() => {
    setErro(''); setUpdating(false);
    if (!enabled || !clubeId || !token) return;
    const controller = new AbortController();
    let running = false, queued = false, active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      timer = undefined;
      if (document.hidden || running) { queued = true; return; }
      running = true; queued = false; setUpdating(true);
      try {
        invalidateApiReads(`/paulista/eventos/${evento}`);
        const next = await requestJson<PainelPaulista>(`/paulista/eventos/${evento}`, { cache: 'no-store', signal: controller.signal });
        if (String(next.snapshot.id) !== evento || esperado && !painelDaSelecao(next, esperado, clubeId)) throw new Error('Resposta de outro clube ou evento.');
        if (active) { applyRef.current(next); setErro(''); }
      } catch {
        if (active) setErro('Não foi possível atualizar agora. Os últimos dados continuam visíveis.');
      } finally {
        running = false;
        if (active) { setUpdating(false); if (queued) schedule(); }
      }
    };
    const schedule = () => {
      if (!active) return;
      if (running || document.hidden) { queued = true; return; }
      if (!timer) timer = setTimeout(() => void load(), 250);
    };
    const visible = () => { if (!document.hidden) schedule(); };
    const stop = subscribePaulistaUpdates(BASE_URL, token, clubeId, evento, schedule);
    refreshRef.current = schedule;
    window.addEventListener('focus', visible);
    document.addEventListener('visibilitychange', visible);
    return () => {
      active = false; controller.abort(); clearTimeout(timer); stop(); refreshRef.current = () => {};
      window.removeEventListener('focus', visible); document.removeEventListener('visibilitychange', visible);
    };
  }, [evento, clubeId, token, enabled, esperado]);
  return { refresh, updating, erro };
}
