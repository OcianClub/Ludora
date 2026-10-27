import { useEffect, useRef, useState } from 'react';
import { atualizarJogador, preverCategoria, ErroJogador, type ConflitoCamisa, type DadosJogador } from '../services/api';
import { Btn, Input, Modal } from './UI';
import { BirthDateField } from './BirthDateField';
import { POSITIONS, PositionBadge, normalizePosition } from './CollectionControls';
import { cleanName, digitsOnly, formatCpf } from '../utils/playerForm';
import { Icon } from './Icon';

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
export function PlayerEditDialog({ player, onClose, onSaved }: { player: EditablePlayer; onClose: () => void; onSaved: () => void }) {
  const photoInput = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ nome: player.nome, dtNasc: player.dtNasc.slice(0,10), posicao: normalizePosition(player.posicao), numCamisa: player.numCamisa?.toString() || '', foto: player.foto || null });
  const [category, setCategory] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [conflict, setConflict] = useState<ConflitoCamisa | null>(null);
  useEffect(() => {
    let active = true; setCategory('');
    const timer = setTimeout(() => preverCategoria(form.dtNasc).then(result => { if (active) setCategory(result.categoria.nome); }).catch(err => { if (active) setError(err.message); }), 200);
    return () => { active = false; clearTimeout(timer); };
  }, [form.dtNasc]);
  async function save(confirmation?: ConflitoCamisa) {
    if (busy || photoBusy || !category) return;
    setBusy(true); setError('');
    const data: DadosJogador = { ...form, numCamisa: form.numCamisa ? Number(form.numCamisa) : null,
      ...(confirmation ? { confirmar_camisa: { jogador_id: confirmation.jogador_id, camisa_anterior: confirmation.camisa_anterior } } : {}) };
    try { await atualizarJogador(player.id, data); onSaved(); }
    catch (err) { if (err instanceof ErroJogador && err.conflito) setConflict(err.conflito); else setError(err instanceof Error ? err.message : 'Não foi possível salvar.'); }
    finally { setBusy(false); }
  }
  return <Modal open title="Editar jogador" onClose={() => { if (!busy && !photoBusy) onClose(); }}>
    <form noValidate onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset className="form-grid alunos-fields" disabled={busy || photoBusy || !!conflict}>
        <div className="full player-photo-editor">
          <button type="button" className={`player-photo-trigger${form.foto ? ' has-photo' : ''}`} aria-label="Alterar foto do jogador" onClick={() => photoInput.current?.click()}>
            {form.foto ? <img src={form.foto} alt="Prévia da foto"/> : <Icon name="user" size={30}/>}
            <span className="player-photo-copy"><Icon name="edit" size={15}/><span>Alterar foto</span></span>
          </button>
          <small>JPEG, PNG ou WebP · até 8 MB</small>
          <input ref={photoInput} type="file" hidden tabIndex={-1} aria-label="Selecionar foto do jogador" accept="image/jpeg,image/png,image/webp" onChange={async event => {
          const file = event.target.files?.[0]; if (!file) return;
          event.target.value = '';
          setPhotoBusy(true); setError(''); try { const foto = await readPhoto(file); setForm(current => ({ ...current, foto })); } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível ler a foto.'); } finally { setPhotoBusy(false); }
          }}/>
          {form.foto && <Btn variant="ghost" size="sm" type="button" onClick={() => setForm(f => ({ ...f, foto: null }))}>Remover foto</Btn>}
        </div>
        <Input label="Nome completo" className="full" value={form.nome} onChange={e => setForm(f => ({ ...f, nome: cleanName(e.target.value) }))}/>
        {player.cpf !== undefined && <Input label="CPF · não editável" value={formatCpf(player.cpf)} readOnly className="full"/>}
        <BirthDateField value={form.dtNasc} onChange={dtNasc => { setConflict(null); setError(''); setForm(f => ({ ...f, dtNasc })); }}/>
        <Input label="Camisa" inputMode="numeric" value={form.numCamisa} onChange={e => { setConflict(null); setForm(f => ({ ...f, numCamisa: digitsOnly(e.target.value).slice(0,2) })); }}/>
        <p className="full" role="status">{category ? `Categoria: ${category.toUpperCase()}` : 'Verificando categoria…'}</p>
        <div className="position-options full" role="group" aria-label="Posição">{POSITIONS.map(value => <button type="button" key={value} data-tooltip={value} aria-pressed={form.posicao === value} onClick={() => setForm(f => ({ ...f, posicao: value }))}><PositionBadge position={value} showLabel/></button>)}</div>
      </fieldset>
      {photoBusy && <p role="status">Preparando foto…</p>}
      {conflict && <div className="alunos-conflict" role="alert"><p>A camisa {conflict.camisa} já pertence a {conflict.nome}. {conflict.camisa_anterior === null ? 'O outro jogador ficará sem camisa.' : `O outro jogador receberá a camisa ${conflict.camisa_anterior}.`}</p><Btn variant="ghost" type="button" disabled={busy} onClick={() => setConflict(null)}>Cancelar troca</Btn><Btn type="button" disabled={busy} onClick={() => void save(conflict)}>Confirmar troca</Btn></div>}
      {error && <p role="alert" className="notice-error">{error}</p>}
      <div className="collection-dialog-actions"><Btn variant="ghost" type="button" disabled={busy || photoBusy} onClick={onClose}>Cancelar</Btn>{!conflict && <Btn type="submit" disabled={busy || photoBusy || !category}>{busy ? 'Salvando…' : 'Salvar jogador'}</Btn>}</div>
    </form>
  </Modal>;
}
