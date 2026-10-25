import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Btn, Modal } from './UI';

export function LogoutButton() {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
      <Btn variant="ghost" onClick={() => setOpen(true)}>Sair da conta</Btn>
      <Modal open={open} onClose={() => setOpen(false)} title="Sair da conta?" className="logout-dialog">
        <p>Você precisará entrar novamente para acessar sua conta. Seus dados e clubes continuarão salvos.</p>
        <div className="collection-dialog-actions">
          <Btn variant="ghost" onClick={() => setOpen(false)}>Continuar na conta</Btn>
          <Btn variant="danger" onClick={logout}>Confirmar saída</Btn>
        </div>
      </Modal>
    </>
  );
}
