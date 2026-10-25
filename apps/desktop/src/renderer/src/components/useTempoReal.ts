import { useEffect, useState } from 'react';
import type { EstadoTempoReal } from '../../../shared/bridge';

export const ROTULO_ESTADO: Record<EstadoTempoReal, string> = {
  parado: 'Parado',
  conectando: 'Conectando…',
  conectado: 'Ao vivo',
  desconectado: 'Desconectado',
  erro: 'Sem conexão',
};

// Estado do socket /admin, que vive no processo principal.
export function useEstadoTempoReal(): EstadoTempoReal {
  const [estado, setEstado] = useState<EstadoTempoReal>('parado');
  useEffect(() => {
    let ativo = true;
    window.ludora.logs.historico().then(h => ativo && setEstado(h.estado));
    const parar = window.ludora.logs.aoMudarEstado(setEstado);
    return () => { ativo = false; parar(); };
  }, []);
  return estado;
}
