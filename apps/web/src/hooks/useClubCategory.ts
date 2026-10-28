import { useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import type { FilterCategory } from '../components/CategoryFilter';

export function useClubCategory<T extends FilterCategory>(categories: T[], requestedId?: string | null, requestedPhase?: string | null) {
  const { clube } = useAuth();
  const key = `ludora_category_${clube?.id}`;
  const saved = useMemo(() => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '{}');
      return value && typeof value === 'object' ? value as { id?: number; phase?: string } : {};
    }
    catch { return {}; }
  }, [key]);
  const requested = categories.find(category => String(category.id) === requestedId);
  const phase = requested?.tipo || (['BASE', 'INICIACAO'].includes(requestedPhase || '') ? requestedPhase! : null)
    || (saved.phase === 'BASE' ? 'BASE' : 'INICIACAO');
  const selected = requested || (!requestedPhase ? categories.find(category => category.id === saved.id && category.tipo === phase) : undefined)
    || [...categories].filter(category => category.tipo === phase).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR', { numeric: true }))[0];
  useEffect(() => {
    if (!selected || !clube?.id) return;
    try { localStorage.setItem(key, JSON.stringify({ id: selected.id, phase: selected.tipo })); } catch {}
  }, [key, selected?.id, selected?.tipo, clube?.id]);
  return { phase, selected };
}
