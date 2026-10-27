import { useState } from 'react';
import { atualizarPartida, atualizarPlacarPartida, Partida, Time } from '../services/api';
import { Btn, Input, Modal, Select } from './UI';
import { Icon } from './Icon';
import { useAuth } from '../contexts/AuthContext';
import { selectMatchTeam, matchHasOwnTeam } from '../utils/matchTeams';
import { MatchDateField, MatchTimeField } from './MatchDateTime';
import { LocationInput } from './LocationInput';
import { Choice } from './CollectionControls';
import { validTimeInput } from '../utils/timeInput';

type EditorProps = { partida: Partida; onClose: () => void; onSaved: (partida: Partida) => void };

export function MatchEditor({ partida, times, onClose, onSaved }: EditorProps & { times: Time[] }) {
  const { clube } = useAuth();
  const [form, setForm] = useState({ mandante_id: String(partida.mandante_id), visitante_id: String(partida.visitante_id), data: partida.data.slice(0, 10), horario: partida.horario || '', local: partida.local || '', emCasa: String(partida.emCasa) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const options = times.filter(t => t.categoria_id === partida.categoria_id).map(t => ({ value: String(t.id), label: t.nome }));
  const home = times.find(t => String(t.id) === form.mandante_id);
  const away = times.find(t => String(t.id) === form.visitante_id);
  function choose(side: 'mandante' | 'visitante', value: string) {
    if (!clube) return;
    try { const selection = selectMatchTeam(times, clube.id, partida.categoria_id, side, Number(value), form); setForm(current => ({ ...current, ...selection })); setError(''); }
    catch (err) { setError(err instanceof Error ? err.message : 'Confronto inválido.'); }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (form.horario && !validTimeInput(form.horario)) { setError('Use um horário de 00:00 a 23:59.'); return; }
    if (!clube || !matchHasOwnTeam(home, away, clube.id)) { setError('Selecione um time vinculado ao seu clube e um adversário.'); return; }
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
      <Choice label="Mandante" options={options} value={form.mandante_id} onChange={value => choose('mandante', value)} disabled={saving}/>
      <Choice label="Visitante" options={options} value={form.visitante_id} onChange={value => choose('visitante', value)} disabled={saving}/>
      <MatchDateField value={form.data} onChange={data => setForm(f => ({ ...f, data }))} disabled={saving}/>
      <MatchTimeField value={form.horario} onChange={horario => setForm(f => ({ ...f, horario }))} disabled={saving}/>
      <div className="full"><LocationInput value={form.local} onChange={local => setForm(f => ({ ...f, local }))} disabled={saving}/></div>
      <p className="full" role="status">Mando automático: {home?.clube_representado_id === clube?.id ? 'Em casa (mandante)' : 'Fora (visitante)'}</p>
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
