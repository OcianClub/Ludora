import { useEffect, useId, useState } from 'react';
import { requestJson } from '../services/api';
import { Icon } from './Icon';
import './LocationInput.css';

type Suggestion = { id: string; label: string; source: 'clube' | 'local' | 'google'; detail?: string };
export function LocationInput({ value, onChange, disabled = false }: { value: string; onChange: (value: string) => void; disabled?: boolean }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [index, setIndex] = useState(-1);
  const [status, setStatus] = useState('');
  useEffect(() => {
    if (!open || disabled) return;
    const controller = new AbortController();
    setItems([]); setIndex(-1); setStatus('Buscando locais…');
    const timer = setTimeout(async () => {
      try {
        const result = await requestJson<{ items: Suggestion[]; providerEnabled: boolean; unavailable: boolean }>(`/locais/sugestoes?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        setItems(result.items);
        setStatus('');
      } catch {
        if (!controller.signal.aborted) { setItems([]); setStatus(''); }
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [value, open, disabled]);
  const choose = (item: Suggestion) => { onChange(item.label); setOpen(false); };
  return <div className="field location-field" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label className="field-label" htmlFor={id}>Local · opcional</label>
    <div className="location-input-wrap"><Icon name="location" size={18} />
    <input id={id} className="field-input" role="combobox" autoComplete="off" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && index >= 0 ? `${id}-${index}` : undefined} maxLength={160} disabled={disabled} value={value} placeholder="Ginásio ou endereço" onFocus={() => setOpen(true)} onChange={event => { onChange(event.target.value); setOpen(true); }} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); }
      if (['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setOpen(true); setIndex(current => Math.max(0, Math.min(items.length - 1, current + (event.key === 'ArrowDown' ? 1 : -1)))); }
      if (event.key === 'Enter' && open) { event.preventDefault(); if (items[index]) choose(items[index]); }
    }}/></div>
    {open && (items.length > 0 || status) && <div className="location-suggestions"><div role="listbox" id={`${id}-options`} aria-label="Locais sugeridos">
      {items.map((item, i) => <div id={`${id}-${i}`} role="option" aria-selected={index === i} key={item.id} onPointerDown={event => event.preventDefault()} onPointerMove={() => setIndex(i)} onClick={() => choose(item)}><strong>{item.detail || item.label}</strong><small>{item.source === 'clube' ? item.label : item.source === 'local' ? 'Já usado pelo clube' : 'Google Maps'}</small></div>)}
    </div>{status && <p role="status">{status}</p>}{items.some(item => item.source === 'google') && <span className="places-attribution" translate="no">Google Maps</span>}</div>}
  </div>;
}
