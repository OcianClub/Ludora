import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Modal } from './UI';

export function LogoutDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { logout } = useAuth();
  return <Modal open={open} onClose={onClose} title="Sair da conta?" className="logout-dialog">
    <p>Você precisará entrar novamente para acessar sua conta. Seus dados e clubes continuarão salvos.</p>
    <div className="collection-dialog-actions">
      <Btn variant="ghost" onClick={onClose}>Continuar na conta</Btn>
      <Btn variant="danger" onClick={logout}>Confirmar saída</Btn>
    </div>
  </Modal>;
}

export function LogoutButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn variant="ghost" onClick={() => setOpen(true)}>Sair da conta</Btn>
      <LogoutDialog open={open} onClose={() => setOpen(false)} />
    </>
  );
}
