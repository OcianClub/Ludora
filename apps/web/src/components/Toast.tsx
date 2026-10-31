import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import './Toast.css';

export function Toast({ message, onClose, action }: { message: string; onClose: () => void; action?: { label: string; onClick: () => void } }) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => close.current(), 6500);
    return () => clearTimeout(timer);
  }, [message]);
  if (!message) return null;
  return createPortal(
    <div className="ludora-toast" role="status">
      <Icon name="checkAll" size={19} />
      <span>{message}</span>
      {action && <button className="ludora-toast-action" type="button" onClick={action.onClick}>{action.label}</button>}
      <button type="button" aria-label="Fechar aviso" onClick={onClose}>
        ×
      </button>
    </div>,
    document.body,
  );
}
