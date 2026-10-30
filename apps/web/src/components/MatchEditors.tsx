import { useState } from 'react';
import { atualizarPartida, atualizarPlacarPartida, Partida, Time } from '../services/api';
import { Btn, Input, Modal, Select } from './UI';
import { Icon } from './Icon';
import { MatchDateField, MatchTimeField } from './MatchDateTime';
import { LocationInput } from './LocationInput';
import { validTimeInput } from '../utils/timeInput';

type EditorProps = { partida: Partida; onClose: () => void; onSaved: (partida: Partida) => void };

export function MatchEditor({ partida, onClose, onSaved }: EditorProps & { times: Time[] }) {
  const [form, setForm] = useState({ mandante_id: String(partida.mandante_id), visitante_id: String(partida.visitante_id), data: partida.data.slice(0, 10), horario: partida.horario || '', local: partida.local || '', emCasa: String(partida.emCasa) });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (saving) return;
    if (form.horario && !validTimeInput(form.horario)) { setError('Use um horário de 00:00 a 23:59.'); return; }
    if (form.mandante_id === form.visitante_id) { setError('Escolha times diferentes para mandante e visitante.'); return; }
    setSaving(true); setError('');
    try {
      const updated = await atualizarPartida(partida.id, { data: form.data, horario: form.horario, local: form.local });
      if (updated.solicitacao) { window.location.assign('/partidas/solicitacoes'); return; }
      onSaved(updated); onClose();
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível salvar a partida.'); }
    finally { setSaving(false); }
  }

  return <Modal open onClose={() => { if (!saving) onClose(); }} title="Editar partida">
    <p className="editor-description">Atualize a data, o horário e o local. Em partidas compartilhadas, o outro clube precisa aceitar a alteração. Categoria: {partida.categoria?.nome || 'categoria da partida'}.</p>
    <form onSubmit={save} className="form-grid">
      <MatchDateField value={form.data} onChange={data => setForm(f => ({ ...f, data }))} disabled={saving}/>
      <MatchTimeField value={form.horario} onChange={horario => setForm(f => ({ ...f, horario }))} disabled={saving}/>
      <div className="full"><LocationInput value={form.local} onChange={local => setForm(f => ({ ...f, local }))} disabled={saving}/></div>
      <p className="full" role="status">Mando automático: {partida.emCasa ? 'Em casa (mandante)' : 'Fora (visitante)'}</p>
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
