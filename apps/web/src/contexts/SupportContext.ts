import { createContext, useContext } from 'react';

export type SuporteAviso = { id: number; chamadoId: string };

export const SupportContext = createContext<{
  abrirSuporte: (chamadoId?: string) => void;
  marcarVisto: (chamadoId: string, respostaId: number) => void;
  avisos: Readonly<Record<string, number>>;
  pendentes: Readonly<Record<string, number>>;
  naoLidos: number;
}>({
  abrirSuporte: () => {},
  marcarVisto: () => {},
  avisos: {},
  pendentes: {},
  naoLidos: 0,
});

export const useSupport = () => useContext(SupportContext);
