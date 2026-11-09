import { useEffect, useRef, useState } from 'react';
import { atualizarJogador, preverCategoria, ErroJogador, type ConflitoCamisa, type DadosJogador } from '../services/api';
import { Btn, Input, Modal } from './UI';
import { BirthDateField } from './BirthDateField';
import { POSITIONS, PositionBadge, normalizePosition } from './CollectionControls';
import { cleanName, digitsOnly, formatCpf } from '../utils/playerForm';
import { Icon } from './Icon';
import { formatShirtNumber, parseShirtNumber } from '../utils/lineupShirts';

export type EditablePlayer = { id: number; nome: string; dtNasc: string; foto?: string | null; posicao: string; numCamisa?: number | null; cpf?: string };
async function readPhoto(file: File): Promise<string> {
  if (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) throw new Error('Escolha JPEG, PNG ou WebP de até 8 MB.');
  const bitmap = await createImageBitmap(file);
  try {
    const canvas = document.createElement('canvas'), ratio = Math.min(1, 384 / Math.max(bitmap.width, bitmap.height));
    canvas.width = Math.max(1, Math.round(bitmap.width * ratio)); canvas.height = Math.max(1, Math.round(bitmap.height * ratio));
    const context = canvas.getContext('2d'); if (!context) throw new Error('Não foi possível preparar a foto.');
    context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL('image/jpeg', .8);
    if (result.length > 180000) throw new Error('A foto ficou muito grande. Escolha outra imagem.');
    return result;
  } finally { bitmap.close(); }
}
export function PlayerEditDialog({ player, categoryName, onClose, onSaved, previewCategory = preverCategoria, savePlayer = atualizarJogador }: {
  player: EditablePlayer; categoryName?: string; onClose: () => void; onSaved: () => void;
  previewCategory?: (date: string) => Promise<{ categoria: { nome: string } }>;
  savePlayer?: (id: number, data: DadosJogador) => Promise<unknown>;
}) {
  const photoInput = useRef<HTMLInputElement>(null);
  const saving = useRef(false);
  const [form, setForm] = useState({ nome: player.nome, dtNasc: player.dtNasc.slice(0,10), posicao: normalizePosition(player.posicao), numCamisa: player.numCamisa?.toString() || '', foto: player.foto || null });
  const [category, setCategory] = useState(categoryName || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflitoCamisa | null>(null);
  useEffect(() => {
    if (form.dtNasc === player.dtNasc.slice(0,10) && categoryName) { setCategory(categoryName); return; }
    let active = true; setCategory('');
    if (!form.dtNasc) return;
    const timer = setTimeout(() => previewCategory(form.dtNasc).then(result => { if (active) setCategory(result.categoria.nome); }).catch(err => { if (active) setError(err.message); }), 200);
    return () => { active = false; clearTimeout(timer); };
  }, [form.dtNasc, player.dtNasc, categoryName, previewCategory]);
  const shirt = form.numCamisa ? Number(form.numCamisa) : null;
  const changes: DadosJogador = {
    ...(form.nome !== player.nome ? { nome: form.nome } : {}),
    ...(form.dtNasc !== player.dtNasc.slice(0, 10) ? { dtNasc: form.dtNasc } : {}),
    ...(form.posicao !== normalizePosition(player.posicao) ? { posicao: form.posicao } : {}),
    ...(shirt !== (player.numCamisa ?? null) ? { numCamisa: shirt } : {}),
    ...(form.foto !== (player.foto || null) ? { foto: form.foto } : {}),
  };
  const changed = Object.keys(changes).length > 0;
  async function save(confirmation?: ConflitoCamisa) {
    if (saving.current || photoBusy || !category || !changed) return;
    if (changes.nome !== undefined && !changes.nome.trim()) { setError('Informe o nome do jogador.'); return; }
    if (changes.numCamisa != null && parseShirtNumber(form.numCamisa) === null) { setError('A camisa deve ser um número de 1 a 99.'); return; }
    saving.current = true; setBusy(true); setError('');
    const data: DadosJogador = { ...changes,
      ...(confirmation ? { confirmar_camisa: { jogador_id: confirmation.jogador_id, camisa_anterior: confirmation.camisa_anterior } } : {}) };
    try { await savePlayer(player.id, data); onSaved(); }
    catch (err) { if (err instanceof ErroJogador && err.conflito) setConflict(err.conflito); else setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Modal open className="player-edit-dialog" title="Editar jogador" onClose={() => { if (!busy && !photoBusy) onClose(); }} footer={<div className="player-edit-footer"><Btn variant="ghost" type="button" disabled={busy || photoBusy} onClick={onClose}>Cancelar</Btn>{!conflict && <Btn type="submit" form="player-edit-form" disabled={busy || photoBusy || !category || !changed}>{busy ? 'Salvando…' : 'Salvar alterações'}</Btn>}</div>}>
    <form id="player-edit-form" noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset className="form-grid alunos-fields" disabled={busy || photoBusy || !!conflict}>
        <div className="full player-photo-editor">
          <button type="button" className={`player-photo-trigger${form.foto ? ' has-photo' : ''}`} aria-label="Alterar foto do jogador" onClick={() => photoInput.current?.click()}>
            {form.foto ? <img src={form.foto} alt="Prévia da foto"/> : <Icon name="user" size={30}/>}
            <span className="player-photo-copy"><Icon name="edit" size={13}/></span>
          </button>
          <div className="player-photo-description"><strong>Foto do jogador</strong><small>Opcional · JPEG, PNG ou WebP até 8 MB</small><Btn variant="ghost" size="sm" type="button" onClick={() => photoInput.current?.click()}>Escolher foto</Btn>{form.foto && <Btn variant="ghost" size="sm" type="button" onClick={() => setForm(f => ({ ...f, foto: null }))}>Remover foto</Btn>}</div>
          <input ref={photoInput} type="file" hidden tabIndex={-1} aria-label="Selecionar foto do jogador" accept="image/jpeg,image/png,image/webp" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return;
          event.target.value = '';
          setPhotoBusy(true); setError(''); try { const foto = await readPhoto(file); setForm(current => ({ ...current, foto })); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível ler a foto.'); } finally { setPhotoBusy(false); }
          }}/>
        </div>
        <Input label="Nome completo" className="full" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: cleanName(e.target.value) }))}/>
        {player.cpf !== undefined && <Input label="CPF · não editável" value={formatCpf(player.cpf)} readOnly className="full"/>}
        <BirthDateField value={form.dtNasc} onChange={dtNasc => { if (dtNasc !== form.dtNasc) setCategory(''); setConflict(null); setError(''); setForm(f => ({ ...f, dtNasc })); }}/>
        <Input label="Camisa (opcional)" inputMode="numeric" maxLength={2} placeholder="01 a 99" value={form.numCamisa} onBlur={() => { const number = parseShirtNumber(form.numCamisa); if (number !== null) setForm(f => ({ ...f, numCamisa: formatShirtNumber(number) })); }} onChange={e => { setConflict(null); setError(''); setForm(f => ({ ...f, numCamisa: digitsOnly(e.target.value).slice(0,2) })); }}/>
        <p className="full player-edit-category" role="status"><Icon name="team" size={16}/>{category ? <>Categoria <strong>{category.toUpperCase()}</strong></> : 'Verificando categoria…'}</p>
        <div className="full"><span className="field-label">Posição</span><div className="position-options" role="group" aria-label="Posição">{POSITIONS.map(value => <button type="button" key={value} aria-pressed={form.posicao === value} onClick={() => setForm(f => ({ ...f, posicao: value }))}><PositionBadge position={value} showLabel/></button>)}</div></div>
      </fieldset>
      {photoBusy && <p role="status">Preparando foto…</p>}
      {conflict && <div className="alunos-conflict" role="alert"><p>A camisa {conflict.camisa} já pertence a {conflict.nome}. {conflict.camisa_anterior === null ? 'O outro jogador ficará sem camisa.' : `O outro jogador receberá a camisa ${conflict.camisa_anterior}.`}</p><Btn variant="ghost" type="button" disabled={busy} onClick={() => setConflict(null)}>Cancelar troca</Btn><Btn type="button" disabled={busy} onClick={() => void save(conflict)}>Confirmar troca</Btn></div>}
      {error && <p role="alert" className="notice-error">{error}</p>}
    </form>
  </Modal>;
}
