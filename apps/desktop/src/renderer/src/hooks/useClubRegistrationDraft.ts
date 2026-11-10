import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { ENDERECO_VAZIO, SUBS } from '../components/ClubeCadastroFields';
import type { Candidato } from '../components/CandidatosClube';
import type { CascaPrevia } from '../components/ReaproveitarTime';

export const novoCadastroClube = () => ({ nome: '', cnpj: '', endereco: { ...ENDERECO_VAZIO }, escudo: null as string | null,
  plano: 'TRIAL', admin_email: '', subs: [...SUBS], casca: null as CascaPrevia | null });
type Draft = { form: ReturnType<typeof novoCadastroClube>; etapa: number; alcancada: number; candidato: Candidato | null };
const empty = (): Draft => ({ form: novoCadastroClube(), etapa: 0, alcancada: 0, candidato: null });
const changed = (draft: Draft) => JSON.stringify(draft) !== JSON.stringify(empty());

// O rascunho pertence à conta e ao servidor selecionados, nunca à sessão de outro gestor.
export function useClubRegistrationDraft(userId: number) {
  const [draft, setDraft] = useState<Draft>(empty);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const key = useRef('');
  const current = useRef(draft); current.current = draft;
  const save = useCallback(() => {
    if (!key.current) return false;
    try {
      if (changed(current.current)) localStorage.setItem(key.current, JSON.stringify({ version: 1, ...current.current }));
      else localStorage.removeItem(key.current);
      setError(''); return true;
    } catch { setError('Não foi possível guardar o rascunho neste dispositivo. Mantenha o cadastro aberto para não perder os dados.'); return false; }
  }, []);
  useEffect(() => {
    let active = true;
    setReady(false);
    void window.ludora.config.obter().then(config => {
      if (!active) return;
      key.current = `ludora:clube:rascunho:v1:${encodeURIComponent(config.apiUrl)}:${userId}`;
      try {
        const stored = localStorage.getItem(key.current);
        if (stored) {
          const data = JSON.parse(stored);
          const form = data.form;
          if (data.version !== 1 || !form || !['nome','cnpj','plano','admin_email'].every(k=>typeof form[k] === 'string')
            || !Object.keys(ENDERECO_VAZIO).every(k=>typeof form.endereco?.[k] === 'string')
            || !['TRIAL','PRO','DEMO','FREE'].includes(form.plano)
            || !(form.escudo === null || typeof form.escudo === 'string') || !Array.isArray(form.subs) || !form.subs.every((n: number)=>SUBS.includes(n))
            || ![0,1,2].includes(data.etapa) || ![0,1,2].includes(data.alcancada) || data.etapa > data.alcancada
            || form.casca && (!Number.isInteger(form.casca.time?.id) || typeof form.casca.time?.nome !== 'string' || !Array.isArray(form.casca.times) || !form.casca.times.every((t: {id:number})=>Number.isInteger(t.id))
              || form.casca.agrupada !== undefined && typeof form.casca.agrupada !== 'boolean'
              || form.casca.subsSelecionados !== undefined && (!Array.isArray(form.casca.subsSelecionados) || !form.casca.subsSelecionados.every((n:number)=>SUBS.includes(n))))
            || data.candidato && (!Number.isInteger(data.candidato.eventoId) || !Number.isInteger(data.candidato.equipeId) || !Number.isInteger(data.candidato.ano)
              || !['nome','categoria','divisao'].every(k=>typeof data.candidato[k] === 'string'))) throw Error('Rascunho inválido');
          const restored = { form: { ...novoCadastroClube(), ...form }, etapa: data.etapa, alcancada: data.alcancada, candidato: data.candidato || null };
          current.current = restored; setDraft(restored);
        }
      } catch { setError('O rascunho anterior não pôde ser recuperado. Inicie um novo cadastro.'); }
      setReady(true);
    }).catch(()=> { if (active) setError('Não foi possível preparar o rascunho. Tente abrir a tela novamente.'); });
    return () => { active = false; };
  }, [userId]);
  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(save, 300);
    return () => clearTimeout(timer);
  }, [draft, ready, save]);
  useEffect(() => {
    const flush = () => { if (key.current) save(); };
    window.addEventListener('beforeunload', flush);
    return () => { window.removeEventListener('beforeunload', flush); flush(); };
  }, [save]);
  const setForm = useCallback((value: SetStateAction<Draft['form']>)=>setDraft(d=>({...d,form:typeof value === 'function' ? value(d.form) : value})), []);
  const setEtapa = useCallback((etapa: number)=>setDraft(d=>({...d,etapa,alcancada:Math.max(d.alcancada,etapa)})), []);
  const setCandidato = useCallback((candidato: Candidato | null)=>setDraft(d=>({...d,candidato})), []);
  function reset() { const fresh = empty(); current.current = fresh; setDraft(fresh); save(); }
  return { ...draft, setForm, setEtapa, setCandidato, ready, error, save, reset, hasDraft: changed(draft) };
}
