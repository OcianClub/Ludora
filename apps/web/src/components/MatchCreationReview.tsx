import { Btn, Modal } from './UI';
import { ClubBadge } from './Brand';
import { Icon } from './Icon';
import { teamName } from '../utils/teamIdentity';
import type { Time } from '../services/api';
import './MatchCreationReview.css';

export function MatchCreationReview({ open, onClose, onConfirm, home, away, category, phase, date, time, competition, local, atHome, requiresApproval, opponent, busy, error, conflict, maintenance }: {
  open:boolean; onClose:()=>void; onConfirm:()=>void; home?:Time; away?:Time;
  category?:string; phase?:string; date:string; time:string; competition:string; local:string; atHome:boolean;
  requiresApproval:boolean; opponent:string; busy:boolean; error:string; conflict?:string; maintenance?:string;
}) {
  return <Modal open={open} onClose={()=>{if(!busy)onClose();}} title="Revisar partida" className="schedule-review-dialog"
    footer={<div className="match-review-footer">
      {requiresApproval && <p className="match-review-approval" role="note"><Icon name="handshake" size={18}/><span>O {opponent} precisa aceitar a proposta para confirmar a partida.</span></p>}
      <div className="schedule-review-actions"><Btn type="button" variant="ghost" disabled={busy} onClick={onClose}>Voltar e editar</Btn><Btn type="button" onClick={onConfirm} loading={busy} disabled={!!conflict || !!maintenance}>{!busy && <Icon name="checkAll" size={17}/>}<span>{busy ? 'Salvando…' : requiresApproval ? `Enviar proposta ao ${opponent}` : 'Confirmar e criar'}</span></Btn></div>
    </div>}>
    <div className="match-review-summary">
      <section className="match-review-contest" aria-label="Confronto">
        {[home,away].map((team,index)=><div className="match-review-team" key={index}><ClubBadge src={team?.escudo || team?.clubeRepresentado?.escudo} name={team?.nome} size={48}/><strong>{teamName(team?.nome || (index ? 'Visitante' : 'Mandante'))}</strong><small>{index ? 'Visitante' : 'Mandante'}</small></div>)}
        <span className="match-review-versus" aria-hidden="true">×</span>
      </section>
      <div className="match-review-category" aria-label="Categoria da partida"><strong>{category?.toUpperCase() || 'Não informada'}</strong><span>{phase==='BASE' ? 'Base' : 'Iniciação'}</span></div>
      <section className="match-review-schedule" aria-label="Data, horário e mando"><Icon name="calendar" size={20}/><div><span>Data e horário</span><strong>{date.split('-').reverse().join('/')} · {time}</strong><small><Icon name={atHome ? 'home' : 'bus'} size={14}/>{atHome ? 'Em casa' : 'Fora'}</small></div></section>
      <dl className="match-review-details"><div><dt><Icon name="trophy" size={17}/>Competição</dt><dd>{competition}</dd></div><div><dt><Icon name="location" size={17}/>Local</dt><dd>{local.trim() || 'Local não definido'}</dd></div></dl>
      {conflict && <p className="schedule-create-error" role="status">{conflict} Volte para editar a data ou o horário.</p>}
      {error && <p className="schedule-create-error" role="alert">{error}</p>}
      {maintenance && <p className="maintenance-inline" role="status">{maintenance}</p>}
    </div>
  </Modal>;
}
