import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext';
import { BASE_URL } from '../services/config';
import { carregarPropostas } from '../services/sharedMatches';

export function useMatchRequests() {
  const { clube, token, podeGerenciar } = useAuth();
  const [count, setCount] = useState(0);
  useEffect(() => {
    setCount(0);
    if (!clube || !token || !podeGerenciar) return;
    let active = true;
    let running = false;
    const refresh = async () => {
      if (running || document.hidden) return;
      running = true;
      try {
        const items = await carregarPropostas();
        if (active)
          setCount(
            items.filter((item) => item.status === 'PENDENTE' && item.respondente_id === clube.id)
              .length,
          );
      } catch {
        /* Uma falha de contagem não bloqueia a agenda. */
      } finally {
        running = false;
      }
    };
    const socket = io(BASE_URL, { auth: { token, clubeId: clube.id } });
    socket.on('connect', refresh);
    socket.on('solicitacao_partida', refresh);
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      active = false;
      socket.disconnect();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [clube?.id, token, podeGerenciar]);
  return count;
}
