import { useEffect, useRef, useState } from 'react';

export function useAccessForm() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const formRef = useRef<HTMLFormElement>(null);
  const locked = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; };
  }, []);

  function validate(errors: Record<string, string>) {
    setAttempted(true);
    const first = Object.keys(errors).find(key => errors[key]);
    if (!first) return true;
    formRef.current?.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
    return false;
  }

  async function run(action: () => Promise<void>) {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (failure) {
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Não foi possível concluir. Tente novamente.');
    } finally {
      locked.current = false;
      if (alive.current) setBusy(false);
    }
  }

  return {
    busy, error, setError, run, formRef, validate,
    feedback: (field: string, error: string) => attempted || touched[field] ? error : '',
    blur: (field: string) => setTouched(current => ({ ...current, [field]: true })),
    reset: () => { setAttempted(false); setTouched({}); setError(''); },
  };
}

export function useResendCountdown() {
  const [until, setUntil] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const update = () => setSeconds(Math.max(0, Math.ceil((until - Date.now()) / 1000)));
    update();
    if (!until) return;
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [until]);
  return { seconds, start: (delay = 60) => setUntil(Date.now() + delay * 1000) };
}
