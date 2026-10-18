import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { darkColors, lightColors } from '@ludora/design-tokens';
import { preferenciaTemaSalva, resolverTema, type PreferenciaTema, type Tema } from '@/src/utils/tema';

const CHAVE_TEMA = 'ludora_tema';

export type ThemeColors = {
  [K in keyof typeof darkColors]: string;
};


type ThemeContextData = {
  tema: Tema;
  preferenciaTema: PreferenciaTema;
  carregandoTema: boolean;
  definirPreferenciaTema: (preferencia: PreferenciaTema) => Promise<void>;
  colors: ThemeColors;
  alternarTema: () => void;
};

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const sistema = useColorScheme();
  const [preferenciaTema, setPreferenciaTema] = useState<PreferenciaTema>('system');
  const [carregandoTema, setCarregandoTema] = useState(true);
  const tema = resolverTema(preferenciaTema, sistema);

  useEffect(() => {
    let ativo = true;
    const carregarTema = async () => {
      try {
        const temaSalvo = await SecureStore.getItemAsync(CHAVE_TEMA);

        if (ativo) setPreferenciaTema(preferenciaTemaSalva(temaSalvo));
      } catch (error) {
        console.warn('Não foi possível carregar a preferência de tema.', error);
      } finally {
        if (ativo) setCarregandoTema(false);
      }
    };

    void carregarTema();
    return () => { ativo = false; };
  }, []);

  const definirPreferenciaTema = useCallback(async (preferencia: PreferenciaTema) => {
    // Só confirma a seleção depois de persistir, para uma falha não ser silenciosa.
    await SecureStore.setItemAsync(CHAVE_TEMA, preferencia);
    setPreferenciaTema(preferencia);
  }, []);

  const alternarTema = useCallback(() => {
    void definirPreferenciaTema(tema === 'light' ? 'dark' : 'light').catch((error) => {
      console.warn('Não foi possível salvar a preferência de tema.', error);
    });
  }, [tema, definirPreferenciaTema]);

  const value = useMemo<ThemeContextData>(
    () => ({
      tema,
      preferenciaTema,
      carregandoTema,
      definirPreferenciaTema,
      colors: tema === 'dark' ? darkColors : lightColors,
      alternarTema,
    }),
    [tema, preferenciaTema, carregandoTema, definirPreferenciaTema, alternarTema],
  );

  return (
    <ThemeContext.Provider value={value}>
      <StatusBar style={tema === 'dark' ? 'light' : 'dark'} />
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const contexto = useContext(ThemeContext);

  if (!contexto) {
    throw new Error('useTheme deve ser usado dentro de ThemeProvider.');
  }

  return contexto;
}
