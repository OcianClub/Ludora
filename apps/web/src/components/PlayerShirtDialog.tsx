import { useEffect, useRef, useState } from 'react';
import { atualizarJogador, ErroJogador, type ConflitoCamisa, type Jogador } from '../services/api';
import { Btn, Input, Modal } from './UI';
import { Icon } from './Icon';
import './PlayerShirtDialog.css';

export function PlayerShirtButton({ player, editable, onClick }: { player: Jogador; editable: boolean; onClick: () => void }) {
  const empty = player.numCamisa == null;
  if (!editable) return <span className={`alunos-shirt${empty ? ' is-empty' : ''}`} aria-label={empty ? 'Sem camisa' : `Camisa ${player.numCamisa}`}>{player.numCamisa ?? '—'}</span>;
  return <button type="button" className={`alunos-shirt alunos-shirt-action${empty ? ' is-empty' : ''}`}
    aria-label={`${empty ? 'Definir camisa de' : 'Editar camisa de'} ${player.nome}`}
    title={empty ? 'Definir número da camisa' : 'Editar número da camisa'} onClick={onClick}>
    {empty ? <Icon name="shirt" size={22} /> : player.numCamisa}
    <span className="shirt-edit-hint"><Icon name="edit" size={10} /></span>
  </button>;
}

export function PlayerShirtDialog({ player, category, onClose, onSaved }: {
  player: Jogador; category?: string; onClose: () => void; onSaved: (updated: Jogador, swapped?: ConflitoCamisa) => void;
}) {
  const [value, setValue] = useState(player.numCamisa?.toString() || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflitoCamisa | null>(null);
  const saving = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    if (conflict) return;
    const frame = requestAnimationFrame(() => document.querySelector<HTMLInputElement>('#player-shirt-form input')?.focus());
    return () => cancelAnimationFrame(frame);
  }, [conflict]);

  async function save(confirmation?: ConflitoCamisa) {
    if (saving.current) return;
    const number = value.trim();
    if (!/^\d{1,2}$/.test(number) || Number(number) < 1 || Number(number) > 99) {
      setError('Informe um número inteiro de 1 a 99.');
      return;
    }
    saving.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await atualizarJogador(player.id, {
        numCamisa: Number(number),
        ...(confirmation ? { confirmar_camisa: { jogador_id: confirmation.jogador_id, camisa_anterior: confirmation.camisa_anterior } } : {}),
      });
      if (active.current) onSaved(updated, confirmation);
    } catch (err) {
      if (!active.current) return;
      if (err instanceof ErroJogador && err.conflito) setConflict(err.conflito);
      else setError(err instanceof Error ? err.message : 'Não foi possível salvar a camisa. Tente novamente.');
    } finally {
      saving.current = false;
      if (active.current) setBusy(false);
    }
  }

  return <Modal open className="player-shirt-dialog" title={conflict ? 'Confirmar troca de camisas' : 'Número da camisa'}
    onClose={() => { if (!saving.current) onClose(); }} footer={<div className="player-shirt-actions">
      <Btn variant="ghost" disabled={busy} onClick={() => {
        if (conflict) { setConflict(null); setError(''); } else onClose();
      }}>{conflict ? 'Voltar e editar' : 'Cancelar'}</Btn>
      <Btn disabled={busy} type={conflict ? 'button' : 'submit'} form={conflict ? undefined : 'player-shirt-form'}
        onClick={conflict ? () => void save(conflict) : undefined}>{busy ? 'Salvando…' : conflict ? 'Confirmar troca' : 'Salvar camisa'}</Btn>
    </div>}>
    <div className="player-shirt-identity"><span><Icon name="shirt" size={25} /></span><div><strong>{player.nome}</strong><small>{category?.toUpperCase() || 'Jogador do clube'}</small></div></div>
    {conflict ? <div className="player-shirt-conflict" role="alert">
      <h3>A camisa {conflict.camisa} já está em uso</h3>
      <p>Ela pertence a <strong>{conflict.nome}</strong> no {conflict.categoria.toUpperCase()}.</p>
      <dl>
        <div><dt>{player.nome}</dt><dd>Camisa {conflict.camisa}</dd></div>
        <div><dt>{conflict.nome}</dt><dd>{conflict.camisa_anterior === null ? 'Sem camisa definida' : `Camisa ${conflict.camisa_anterior}`}</dd></div>
      </dl>
      <p>{conflict.camisa_anterior === null ? 'Ao confirmar, o outro jogador ficará sem número e você poderá definir uma nova camisa para ele depois.' : 'Ao confirmar, os dois jogadores trocarão os números de camisa.'}</p>
    </div> : <form id="player-shirt-form" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      <Input label="Número da camisa" placeholder="De 1 a 99" inputMode="numeric" maxLength={3}
        autoComplete="off" value={value} disabled={busy} error={error || undefined}
        onChange={event => { setValue(event.target.value); setError(''); }} />
      <p className="player-shirt-help">A numeração é exclusiva entre os jogadores ativos da mesma categoria.</p>
    </form>}
    {conflict && error && <p className="notice-error" role="alert">{error}</p>}
  </Modal>;
}
