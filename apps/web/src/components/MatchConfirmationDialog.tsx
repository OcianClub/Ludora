import { useId } from 'react';
import { Btn, Modal } from './UI';
import { formatMatchDate } from './MatchCard';
import { teamName } from '../utils/teamIdentity';
import type { Partida } from '../services/api';
import './MatchConfirmationDialog.css';

export function MatchConfirmationDialog({open,mode,partida,busy,error,reason='',onReason,onClose,onConfirm}:{
  open:boolean;mode:'delete'|'cancel';partida:Partida;busy:boolean;error:string;reason?:string;
  onReason?:(value:string)=>void;onClose:()=>void;onConfirm:()=>void;
}) {
  const id=useId(),remove=mode==='delete';
  return <Modal open={open} title={remove?'Excluir partida':'Cancelar partida'} className="match-confirm-dialog" onClose={()=>{if(!busy)onClose();}}
    footer={<div className="match-confirm-actions"><Btn type="button" variant="ghost" disabled={busy} onClick={onClose}>Voltar</Btn><Btn type="button" variant="danger" loading={busy} disabled={!remove && !reason.trim()} onClick={onConfirm}>{busy ? remove?'Excluindo…':'Cancelando…' : remove?'Excluir definitivamente':'Confirmar cancelamento'}</Btn></div>}>
    <section className="match-confirm-context" aria-label="Partida selecionada"><strong>{teamName(partida.mandante?.nome || 'Mandante')} × {teamName(partida.visitante?.nome || 'Visitante')}</strong><span>{formatMatchDate(partida.data)}{partida.horario && ` · ${partida.horario}`}{partida.categoria?.nome && ` · ${partida.categoria.nome.toUpperCase()}`}</span></section>
    <div className="match-confirm-copy"><p>{remove?'Esta partida será excluída permanentemente.':'A partida será marcada como cancelada. O histórico será preservado e os clubes serão avisados.'}</p>{remove && <small>Somente confrontos locais não iniciados e sem resultados ou registros oficiais podem ser excluídos. Para preservar o histórico, use Cancelar partida.</small>}</div>
    {!remove && <div className="field"><label className="field-label" htmlFor={id}>Motivo do cancelamento <span className="match-confirm-required">· obrigatório</span></label><textarea id={id} className="field-input match-confirm-reason" value={reason} onChange={e=>onReason?.(e.target.value)} placeholder="Explique por que a partida será cancelada" maxLength={500} required disabled={busy} aria-describedby={`${id}-hint`}/><small id={`${id}-hint`} className="match-confirm-hint">Esse motivo ficará registrado no histórico da partida.</small></div>}
    {error && <p className="notice-error" role="alert">{error}</p>}
  </Modal>;
}
