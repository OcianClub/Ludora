import { useState } from 'react';
import { atualizarPartida, atualizarPlacarPartida, Partida, Time } from '../services/api';
import { Btn, Input, Modal, Select } from './UI';
import { Icon } from './Icon';

type EditorProps = { partida: Partida; onClose: () => void; onSaved: (partida: Partida) => void };

export function MatchEditor({ partida, times, onClose, onSaved }: EditorProps & { times: Time[] }) {
  const [form, setForm] = useState({ mandante_id: String(partida.mandante_id), visitante_id: String(partida.visitante_id), data: partida.data.slice(0, 10), horario: partida.horario || '', local: partida.local || '', emCasa: String(partida.emCasa) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const options = times.filter(t => t.categoria_id === partida.categoria_id || t.id === partida.mandante_id || t.id === partida.visitante_id).map(t => ({ value: t.id, label: t.nome }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (form.mandante_id === form.visitante_id) { setError('Escolha times diferentes para mandante e visitante.'); return; }
    setSaving(true); setError('');
    try {
      const updated = await atualizarPartida(partida.id, { ...form, mandante_id: Number(form.mandante_id), visitante_id: Number(form.visitante_id), emCasa: form.emCasa === 'true', grupo: partida.grupo ?? null });
      onSaved(updated); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a partida.'); }
    finally { setSaving(false); }
  }

  return <Modal open onClose={() => { if (!saving) onClose(); }} title="Editar partida">
    <p className="editor-description">Atualize o confronto, a data e o local. Categoria: {partida.categoria?.nome || 'categoria da partida'}.</p>
    <form onSubmit={save} className="form-grid">
      <Select label="Mandante" options={options} value={form.mandante_id} onChange={e => setForm({ ...form, mandante_id: e.target.value })} required disabled={saving} />
      <Select label="Visitante" options={options} value={form.visitante_id} onChange={e => setForm({ ...form, visitante_id: e.target.value })} required disabled={saving} />
      <Input label="Data" type="date" value={form.data} onChange={e => setForm({ ...form, data: e.target.value })} required disabled={saving} />
      <Input label="Horário" type="time" value={form.horario} onChange={e => setForm({ ...form, horario: e.target.value })} disabled={saving} />
      <Input label="Local" className="full" value={form.local} onChange={e => setForm({ ...form, local: e.target.value })} disabled={saving} />
      <Select className="full" label="Mando do seu clube" options={[{ value: 'true', label: 'Em casa (mandante)' }, { value: 'false', label: 'Fora (visitante)' }]} value={form.emCasa} onChange={e => setForm({ ...form, emCasa: e.target.value })} required disabled={saving} />
      {error && <p className="notice-error full" role="alert">{error}</p>}
      <div className="editor-actions full"><Btn type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancelar</Btn><Btn disabled={saving} type="submit">{saving ? 'Salvando...' : 'Salvar alterações'}</Btn></div>
    </form>
  </Modal>;
}

export function ScoreEditor({ partida, onClose, onSaved }: EditorProps) {
  const [home, setHome] = useState(partida.gols_mandante);
  const [away, setAway] = useState(partida.gols_visitante);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (![home, away].every(n => Number.isInteger(n) && n >= 0 && n <= 99)) { setError('Informe gols entre 0 e 99.'); return; }
    setSaving(true); setError('');
    try { onSaved(await atualizarPlacarPartida(partida.id, home, away)); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar o placar.'); }
    finally { setSaving(false); }
  }
  return <Modal open onClose={() => { if (!saving) onClose(); }} title="Editar placar">
    <p className="editor-description">Ajuste o placar oficial. Os eventos dos jogadores são registrados separadamente.</p>
    <form onSubmit={save}>
      <div className="score-editor">
        {[{ label: partida.mandante?.nome || 'Mandante', side: 'mandante', value: home, set: setHome }, { label: partida.visitante?.nome || 'Visitante', side: 'visitante', value: away, set: setAway }].map(team => <div className="score-editor-team" key={team.side}>
          <strong>{team.label}</strong><Input aria-label={`Gols do ${team.side}`} type="number" min="0" max="99" required value={Number.isNaN(team.value) ? '' : team.value} onChange={e => team.set(e.target.valueAsNumber)} disabled={saving} />
          <div><Btn type="button" variant="ghost" disabled={saving || team.value <= 0} aria-label={`Diminuir gols do ${team.side}`} onClick={() => team.set(value => Math.max(0, (value || 0) - 1))}><Icon name="minus" size={18} /></Btn><Btn type="button" disabled={saving || team.value >= 99} aria-label={`Aumentar gols do ${team.side}`} onClick={() => team.set(value => Math.min(99, (value || 0) + 1))}><Icon name="plus" size={18} /></Btn></div>
        </div>)}
      </div>
      {error && <p className="notice-error" role="alert">{error}</p>}
      <div className="editor-actions"><Btn type="button" variant="ghost" disabled={saving} onClick={onClose}>Cancelar</Btn><Btn type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar placar'}</Btn></div>
    </form>
  </Modal>;
}
