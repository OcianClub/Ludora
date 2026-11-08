import { useRef, useState } from 'react';
import { atualizarJogador, ErroJogador, type Jogador, type ConflitoCamisa } from '../services/api';
import { formatShirtNumber, parseShirtNumber } from '../utils/lineupShirts';
import { Icon } from './Icon';
import { createPortal } from 'react-dom';

export function InlinePlayerShirt({ player, editable, onSaved }: { player: Jogador; editable: boolean; onSaved: (updated: Jogador, conflict?: ConflitoCamisa, advance?: boolean) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState<ConflitoCamisa | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const anchor = useRef<HTMLSpanElement>(null);
  function cancel() { if (!saving.current) { setEditing(false); setConflict(null); setError(''); } }
  async function save(confirmation?: ConflitoCamisa) {
    if (saving.current) return;
    const number = parseShirtNumber(value);
    if (number === null) { setError('Use um número de 1 a 99.'); return; }
    saving.current = true; setBusy(true); setError('');
    try {
      const updated = await atualizarJogador(player.id, { numCamisa: number, ...(confirmation ? { confirmar_camisa: { jogador_id: confirmation.jogador_id, camisa_anterior: confirmation.camisa_anterior } } : {}) });
      setEditing(false); setConflict(null); onSaved(updated, confirmation, true);
    } catch (err) {
      if (err instanceof ErroJogador && err.conflito) setConflict(err.conflito);
      else setError(err instanceof Error ? err.message : 'Não foi possível salvar. Tente novamente.');
    } finally { saving.current = false; setBusy(false); }
  }
  if (!editable) return <span className="alunos-inline-number">{formatShirtNumber(player.numCamisa)}</span>;
  const rect = anchor.current?.getBoundingClientRect();
  return <span className="alunos-inline-shirt" ref={anchor}>
    {editing ? <input autoFocus aria-label={`Camisa de ${player.nome}`} aria-invalid={!!error} inputMode="numeric" autoComplete="off" maxLength={2} value={value} disabled={busy}
      data-tooltip="Enter salva e vai para o próximo; Esc cancela" onChange={event => { setValue(event.target.value.replace(/\D/g, '').slice(0, 2)); setError(''); setConflict(null); }}
      onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); if (!conflict) void save(); } if (event.key === 'Escape') { event.preventDefault(); cancel(); } }} />
      : <button type="button" data-shirt-player={player.id} className={`alunos-inline-number${player.numCamisa == null ? ' is-missing' : ''}`} aria-label={`${player.numCamisa == null ? 'Definir' : 'Editar'} camisa de ${player.nome}`}
        data-tooltip="Enter salva e vai para o próximo; Esc cancela" onClick={() => { setValue(player.numCamisa == null ? '' : formatShirtNumber(player.numCamisa)); setEditing(true); }}>{player.numCamisa == null ? <Icon name="plus" size={17}/> : formatShirtNumber(player.numCamisa)}</button>}
    {editing && <span className="alunos-shirt-edit-actions"><button type="button" disabled={busy || !!conflict} aria-label={`Salvar camisa de ${player.nome}`} onClick={() => void save()}><Icon name="checkAll" size={15}/></button><button type="button" disabled={busy} aria-label="Cancelar edição da camisa" onClick={cancel}>×</button></span>}
    {(error || conflict) && createPortal(<span className="alunos-shirt-feedback" role="alert" style={{ position: 'fixed', top: Math.min((rect?.bottom || 0) + 35, window.innerHeight - 210), left: Math.max(12, Math.min(rect?.left || 12, window.innerWidth - 282)) }}>{error || <>A camisa {formatShirtNumber(conflict!.camisa)} pertence a {conflict!.nome}. {conflict!.camisa_anterior == null ? 'Ele ficará sem camisa e será retirado das escalações em preparação.' : `Ele receberá a camisa ${formatShirtNumber(conflict!.camisa_anterior)}.`}<button type="button" disabled={busy} onClick={() => void save(conflict!)}>Confirmar troca</button><button type="button" disabled={busy} onClick={() => setConflict(null)}>Voltar</button></>}</span>, document.body)}
  </span>;
}
