import { useCallback, useEffect, useRef, useState } from 'react';
import { MATCH_POLL_CHANGED, MATCH_POLL_REFRESH, readMatchPoll, validPoll, voteMatchPoll, type MatchPollData, type PollChoice } from '../services/matchPoll';

export function useMatchPoll(id: number, token: string | null, ended = false) {
  const [poll, setPoll] = useState<MatchPollData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const active = useRef(false), writing = useRef(false);
  const closed = useRef(ended);
  closed.current = ended || Boolean(poll && !poll.aberta);
  const pendingRead = useRef<AbortController | null>(null), pendingWrite = useRef<AbortController | null>(null);
  const apply = useCallback((next: MatchPollData, includeOwn: boolean) => {
    setPoll(current => {
      if (current && current.revisao > next.revisao) return current;
      return {
        ...next,
        meuVoto: includeOwn ? next.meuVoto : current?.meuVoto ?? null,
        podeVotar: includeOwn ? next.podeVotar : current?.podeVotar,
      };
    });
  }, []);
  const load = useCallback(async (foreground = false) => {
    if (pendingRead.current || writing.current) return;
    const controller = new AbortController(); pendingRead.current = controller;
    if (foreground) { setLoading(true); setError(''); }
    try {
      const value = await readMatchPoll(id, Boolean(token), controller.signal);
      if (active.current && !controller.signal.aborted) { apply(value, true); setError(''); }
    } catch {
      if (active.current && !controller.signal.aborted && foreground) setError('Não foi possível atualizar a votação.');
    } finally {
      if (pendingRead.current === controller) pendingRead.current = null;
      if (active.current && !controller.signal.aborted) setLoading(false);
    }
  }, [id, token, apply]);

  useEffect(() => {
    active.current = true; setPoll(null); setError(''); setNotice(''); setBusy(false); writing.current = false;
    void load(true);
    const refresh = () => { if (!closed.current && document.visibilityState === 'visible') void load(); };
    const update = (event: Event) => {
      const value: unknown = (event as CustomEvent).detail;
      if (validPoll(value, id)) { apply(value, false); setError(''); }
    };
    const reconnect = (event: Event) => { if ((event as CustomEvent).detail === id) refresh(); };
    window.addEventListener(MATCH_POLL_CHANGED, update);
    window.addEventListener(MATCH_POLL_REFRESH, reconnect);
    window.addEventListener('focus', refresh); window.addEventListener('online', refresh);
    document.addEventListener('visibilitychange', refresh);
    // Segurança para reconexões e votos feitos por esta conta em outro dispositivo.
    const timer = window.setInterval(refresh, 30_000);
    return () => {
      active.current = false; clearInterval(timer);
      pendingRead.current?.abort(); pendingRead.current = null;
      pendingWrite.current?.abort(); pendingWrite.current = null;
      window.removeEventListener(MATCH_POLL_CHANGED, update); window.removeEventListener(MATCH_POLL_REFRESH, reconnect);
      window.removeEventListener('focus', refresh); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh);
    };
  }, [id, token, load, apply]);

  const vote = async (choice: PollChoice) => {
    if (!token || writing.current || !poll?.aberta || poll.podeVotar === false) return;
    writing.current = true; setBusy(true); setError(''); setNotice('');
    pendingRead.current?.abort(); pendingRead.current = null;
    const controller = new AbortController(); pendingWrite.current = controller;
    try {
      const result = await voteMatchPoll(id, choice, controller.signal);
      if (active.current && !controller.signal.aborted) { apply(result, true); setNotice('Palpite salvo. Você pode trocar até o encerramento.'); }
    } catch {
      // Uma resposta perdida não significa que o servidor deixou de salvar. Confere antes de permitir repetir.
      if (active.current && !controller.signal.aborted) {
        try {
          const checked = await readMatchPoll(id, true, controller.signal);
          if (active.current && !controller.signal.aborted) {
            apply(checked, true);
            if (checked.meuVoto === choice) setNotice('Seu palpite foi confirmado.');
            else setError(checked.aberta ? 'Não foi possível confirmar a troca. Confira seu palpite antes de tentar novamente.' : 'A votação foi encerrada.');
          }
        } catch { if (active.current && !controller.signal.aborted) setError('Confirmação pendente. Atualize para conferir seu palpite; repetir a mesma escolha não duplica o voto.'); }
      }
    } finally {
      if (pendingWrite.current === controller) pendingWrite.current = null;
      if (active.current && !controller.signal.aborted) { writing.current = false; setBusy(false); }
    }
  };
  return { poll, loading, busy, error, notice, vote, reload: () => void load(true) };
}
