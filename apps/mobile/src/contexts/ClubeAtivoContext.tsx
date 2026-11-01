import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { iniciarMedicaoCarregamento } from '@/src/utils/desempenho';
import { criarPersistenciaClube } from '@/src/utils/persistenciaClube';

export type PapelClube =
  | 'ADMIN'
  | 'MESARIO'
  | 'TECNICO'
  | 'TORCEDOR'
  | 'OLHEIRO'
  | null;

export interface ClubeAtivo {
  id: number;
  nome: string;
  escudo: string | null;
  papel: PapelClube;
}

interface ClubeAtivoContextValue {
  clubeAtivo: ClubeAtivo | null;
  carregandoClubeAtivo: boolean;
  podeGerenciar: boolean;
  definirClubeAtivo: (clube: ClubeAtivo) => Promise<void>;
  limparClubeAtivo: () => Promise<void>;
}

const PAPEIS_GESTORES: PapelClube[] = ['ADMIN', 'TECNICO', 'MESARIO'];

const ClubeAtivoContext = createContext<ClubeAtivoContextValue | null>(null);

export function ClubeAtivoProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [clubeAtivo, setClubeAtivo] = useState<ClubeAtivo | null>(null);
  const [carregandoClubeAtivo, setCarregandoClubeAtivo] = useState(true);
  const montado = useRef(true);
  const persistencia = useRef<ReturnType<typeof criarPersistenciaClube> | null>(null);
  if (!persistencia.current) {
    persistencia.current = criarPersistenciaClube(SecureStore, (clube) => {
      if (montado.current) setClubeAtivo(clube);
    });
  }

  useEffect(() => {
    montado.current = true;
    let ativo = true;
    void persistencia.current!.restaurar().finally(() => {
      if (ativo) setCarregandoClubeAtivo(false);
    });
    return () => {
      ativo = false;
      montado.current = false;
      persistencia.current!.invalidar();
    };
  }, []);

  const definirClubeAtivo = useCallback(async (clube: ClubeAtivo) => {
    const finalizar = iniciarMedicaoCarregamento('clube:persistencia');
    // A API lê o clube no SecureStore: persiste antes de disparar os efeitos
    // das telas para evitar requisições com o identificador do clube anterior.
    try {
      await persistencia.current!.definir(clube);
    } finally {
      finalizar();
    }
  }, []);

  const limparClubeAtivo = useCallback(async () => {
    await persistencia.current!.limpar();
  }, []);

  const podeGerenciar =
    !!clubeAtivo?.papel && PAPEIS_GESTORES.includes(clubeAtivo.papel);

  return (
    <ClubeAtivoContext.Provider
      value={{
        clubeAtivo,
        carregandoClubeAtivo,
        podeGerenciar,
        definirClubeAtivo,
        limparClubeAtivo,
      }}
    >
      {children}
    </ClubeAtivoContext.Provider>
  );
}

export function useClubeAtivo() {
  const ctx = useContext(ClubeAtivoContext);
  if (!ctx) {
    throw new Error(
      'useClubeAtivo precisa ser usado dentro de <ClubeAtivoProvider>'
    );
  }
  return ctx;
}
