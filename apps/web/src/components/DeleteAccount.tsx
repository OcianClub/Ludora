import { useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { excluirMinhaConta } from '../services/api';
import { Icon } from './Icon';
import { Btn, Modal } from './UI';

export function DeleteAccount() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const trigger = useRef<HTMLButtonElement>(null);

  function close() {
    if (submitting.current) return;
    setOpen(false);
    setError('');
    trigger.current?.focus({ preventScroll: true });
  }

  async function remove() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError('');
    try {
      await excluirMinhaConta();
      logout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir a conta. Tente novamente.');
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <>
    <details className="perfil-exclusao">
      <summary><Icon name="alert" size={18} /><span className="perfil-exclusao-label">Exclusão permanente da conta</span><Icon name="chevronRight" size={16} /></summary>
      <div className="perfil-exclusao-content">
        <p>A exclusão é permanente. Para apenas encerrar a sessão neste dispositivo, use <strong>Sair da conta</strong> acima.</p>
        <button ref={trigger} type="button" className="btn btn-danger btn-md" onClick={() => { setError(''); setOpen(true); }}>
          <Icon name="trash" size={16} />Excluir minha conta
        </button>
      </div>
    </details>
    <Modal open={open} onClose={close} title="Excluir sua conta?" className="account-confirm-dialog delete-account-dialog" footer={
      <div className="account-confirm-actions">
        <Btn variant="ghost" disabled={pending} onClick={close}>Manter minha conta</Btn>
        <Btn variant="danger" disabled={pending} onClick={() => void remove()}>{pending ? 'Excluindo conta…' : 'Excluir minha conta'}</Btn>
      </div>
    }>
      <p>Sua conta será excluída permanentemente e você perderá o acesso a ela. Essa ação não pode ser desfeita.</p>
      <p>Confirme apenas se deseja excluir sua conta do Ludora.</p>
      {error && <div className="notice-error" role="alert">{error}</div>}
      {pending && <span className="sr-only" role="status">Excluindo sua conta. Aguarde.</span>}
    </Modal>
  </>;
}
