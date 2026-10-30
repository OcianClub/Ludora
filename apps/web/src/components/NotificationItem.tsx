import { useEffect, useRef, type PointerEvent } from 'react';
import { Icon } from './Icon';
import { NOTICE_LABELS, type Notice } from '../utils/notifications';

export function NotificationItem({ notice, busy, onRead, onDelete }: {
  notice: Notice;
  busy: boolean;
  onRead: () => void;
  onDelete: () => void;
}) {
  const card = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; horizontal: boolean; distance: number } | null>(null);
  const suppressed = useRef(false);
  const frame = useRef<number | null>(null);
  const distance = useRef(0);

  useEffect(() => () => { if (frame.current !== null) cancelAnimationFrame(frame.current); }, []);

  function reset() {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    card.current?.classList.remove('is-dragging');
    if (card.current) card.current.style.transform = 'translate3d(0, 0, 0)';
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const start = drag.current;
    if (!start || start.id !== event.pointerId) return;
    drag.current = null;
    suppressed.current = start.horizontal;
    reset();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancelled && start.horizontal && start.distance <= -100 && !busy) onDelete();
  }

  return (
    <div className="notice-swipe">
      <div className="notice-swipe-action" aria-hidden="true"><Icon name="trash" size={22} /><span>Excluir</span></div>
      <div ref={card} className={`notification-card${notice.lida ? '' : ' unread'}`}
        onDragStart={event => event.preventDefault()}
        onKeyDownCapture={() => { suppressed.current = false; }}
        onPointerDown={event => {
          suppressed.current = false;
          if (busy || !event.isPrimary || event.button !== 0 || (event.target as Element).closest('.notification-delete')) return;
          drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, horizontal: false, distance: 0 };
        }}
        onPointerMove={event => {
          const start = drag.current;
          if (!start || start.id !== event.pointerId) return;
          const dx = event.clientX - start.x;
          const dy = event.clientY - start.y;
          if (!start.horizontal && Math.abs(dy) > 10 && Math.abs(dy) >= Math.abs(dx)) { drag.current = null; return; }
          if (!start.horizontal && dx < -10 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            start.horizontal = true;
            event.currentTarget.setPointerCapture(event.pointerId);
            card.current?.classList.add('is-dragging');
          }
          if (!start.horizontal) return;
          event.preventDefault();
          start.distance = Math.max(-140, Math.min(0, dx));
          distance.current = start.distance;
          if (frame.current === null) frame.current = requestAnimationFrame(() => {
            frame.current = null;
            if (card.current) card.current.style.transform = `translate3d(${distance.current}px, 0, 0)`;
          });
        }}
        onPointerUp={event => finish(event)} onPointerCancel={event => finish(event, true)}
        onLostPointerCapture={event => { if (event.target === event.currentTarget && drag.current) { suppressed.current = drag.current.horizontal; drag.current = null; reset(); } }}
        onClickCapture={event => { if (suppressed.current) { event.preventDefault(); event.stopPropagation(); suppressed.current = false; } }}>
        <button type="button" className={`notification-row${notice.lida ? '' : ' unread'}`} disabled={busy}
          aria-label={`${notice.lida ? 'Lida' : 'Não lida'}. ${notice.titulo}. ${notice.corpo}. ${notice.dados?.solicitacaoId ? 'Ver solicitação' : notice.partida_id ? 'Ver partida' : 'Marcar como lida'}`}
          onClick={onRead}>
          <span className="notification-kind-icon" aria-hidden="true">
            <Icon name={notice.dados?.solicitacaoId ? 'email' : notice.tipo === 'GOL_PARTIDA' ? 'ball' : notice.tipo === 'PARTIDA_AGENDADA' ? 'calendar' : notice.tipo === 'RESULTADO_PARTIDA' ? 'trophy' : 'bell'} size={20} />
          </span>
          <span className="notification-copy">
            <span className="notification-meta">
              {!notice.lida && <i className="notice-unread-dot" aria-hidden="true" />}
              <span>{notice.dados?.solicitacaoId ? 'Solicitação' : notice.tipo ? NOTICE_LABELS[notice.tipo] || 'Atualização' : 'Atualização'}</span>
              <time dateTime={notice.criada_em}>{new Date(notice.criada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time>
            </span>
            <strong>{notice.titulo}</strong><span className="notification-body">{notice.corpo}</span>
          </span>
        </button>
        <button type="button" className="notification-delete" aria-label={`Excluir notificação: ${notice.titulo}`} title="Excluir notificação" disabled={busy} onClick={onDelete}><Icon name="trash" size={19} /></button>
      </div>
    </div>
  );
}
