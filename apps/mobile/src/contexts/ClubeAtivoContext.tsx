import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';

// ── Fonte única de verdade pro "clube ativo" ──
//
// Antes, cada tela (jogos.tsx, ClubesExplorer.tsx) guardava sua PRÓPRIA
// cópia local de nome/escudo/papel do clube ativo, e relia o SecureStore
// de forma assíncrona toda vez que ganhava foco. Como o tab navigator não
// desmonta as telas ao trocar de aba, a tela ficava, por um instante, com
// o valor antigo (do clube anterior) na memória até a leitura assíncrona
// terminar — esse instante é o "pisca" / nome ou escudo errado.
//
// Com o Context, a troca de clube atualiza o estado de forma SÍNCRONA (no
// mesmo render), e toda tela que usa useClubeAtivo() recebe o valor novo
// imediatamente — sem releitura, sem corrida, sem flicker.

export type PapelClube = 'ADMIN' | 'MESARIO' | 'TECNICO' | 'TORCEDOR' | null;

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

export function ClubeAtivoProvider({ children }: { children: React.ReactNode }) {
  const [clubeAtivo, setClubeAtivo] = useState<ClubeAtivo | null>(null);
  const [carregandoClubeAtivo, setCarregandoClubeAtivo] = useState(true);

  // Única leitura do SecureStore, uma vez, no boot do app (ex: depois do
  // login, quando o _layout raiz monta o Provider). Nunca mais precisa
  // reler durante a navegação — só quando o próprio clube ativo muda.
  useEffect(() => {
    (async () => {
      const [id, nome, escudo, papel] = await Promise.all([
        SecureStore.getItemAsync('clubeAtivoId'),
        SecureStore.getItemAsync('clubeAtivoNome'),
        SecureStore.getItemAsync('clubeAtivoEscudo'),
        SecureStore.getItemAsync('clubeAtivoPapel'),
      ]);
      if (id) {
        setClubeAtivo({
          id: Number(id),
          nome: nome || 'MEU CLUBE',
          escudo: escudo || null,
          papel: (papel as PapelClube) || null,
        });
      }
      setCarregandoClubeAtivo(false);
    })();
  }, []);

  const definirClubeAtivo = useCallback(async (clube: ClubeAtivo) => {
    // Atualiza a memória (síncrono, dispara re-render em quem usa o hook)
    // e o SecureStore (persistência entre sessões) ao mesmo tempo.
    setClubeAtivo(clube);
    await Promise.all([
      SecureStore.setItemAsync('clubeAtivoId', String(clube.id)),
      SecureStore.setItemAsync('clubeAtivoNome', clube.nome),
      SecureStore.setItemAsync('clubeAtivoEscudo', clube.escudo || ''),
      SecureStore.setItemAsync('clubeAtivoPapel', clube.papel || ''),
    ]);
  }, []);

  const limparClubeAtivo = useCallback(async () => {
    setClubeAtivo(null);
    await Promise.all([
      SecureStore.deleteItemAsync('clubeAtivoId'),
      SecureStore.deleteItemAsync('clubeAtivoNome'),
      SecureStore.deleteItemAsync('clubeAtivoEscudo'),
      SecureStore.deleteItemAsync('clubeAtivoPapel'),
    ]);
  }, []);

  const podeGerenciar = !!clubeAtivo?.papel && PAPEIS_GESTORES.includes(clubeAtivo.papel);

  return (
    <ClubeAtivoContext.Provider
      value={{ clubeAtivo, carregandoClubeAtivo, podeGerenciar, definirClubeAtivo, limparClubeAtivo }}
    >
      {children}
    </ClubeAtivoContext.Provider>
  );
}

export function useClubeAtivo() {
  const ctx = useContext(ClubeAtivoContext);
  if (!ctx) {
    throw new Error('useClubeAtivo precisa ser usado dentro de <ClubeAtivoProvider>');
  }
  return ctx;
}