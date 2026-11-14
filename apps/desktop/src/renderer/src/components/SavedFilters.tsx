import { useState } from 'react';
import { Btn, Input } from './AdminUI';
import { DesktopSelect } from './DesktopSelect';
import { readLocal, writeLocal } from '@web/services/localState';

type Preset<T> = { name: string; value: T };

export function SavedFilters<T>({ storageKey, value, onApply }: {
  storageKey: string; value: T; onApply: (value: T) => void;
}) {
  const [presets, setPresets] = useState(() => readLocal<Preset<T>[]>(storageKey) ?? []);
  const [name, setName] = useState('');
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState('');
  const normalized = name.trim();

  function persist(next: Preset<T>[]) {
    if (!writeLocal(storageKey, next)) { setFeedback('Não foi possível salvar os filtros neste dispositivo.'); return false; }
    setPresets(next);
    setFeedback('');
    return true;
  }

  return <section className="saved-filters" aria-label="Filtros salvos">
    {presets.length > 0 && <div className="saved-filters-line">
      <DesktopSelect fullWidth expandInDialog label="Filtros salvos" placeholder="Escolher filtros salvos" value={selected}
        options={presets.map(item => ({ value: item.name, label: item.name }))} onChange={setSelected} />
      <Btn type="button" variant="ghost" disabled={!selected} onClick={() => {
        const preset = presets.find(item => item.name === selected);
        if (preset) onApply(preset.value);
      }}>Usar</Btn>
      <Btn type="button" variant="ghost" disabled={!selected} onClick={() => {
        if (persist(presets.filter(item => item.name !== selected))) setSelected('');
      }}>Remover</Btn>
    </div>}
    <div className="saved-filters-line">
      <Input label="Salvar esta combinação" placeholder="Nome do filtro" value={name} maxLength={40} onChange={event => setName(event.target.value)} />
      <Btn type="button" variant="ghost" disabled={!normalized || presets.length >= 8 || presets.some(item => item.name.toLowerCase() === normalized.toLowerCase())}
        onClick={() => { if (persist([...presets, { name: normalized, value }])) { setName(''); setSelected(normalized); setFeedback('Filtros salvos.'); } }}>Salvar filtros</Btn>
    </div>
    {feedback && <small role="status">{feedback}</small>}
  </section>;
}
