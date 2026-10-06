import React, { createContext, useContext, useMemo, useState } from 'react';
import { darkColors, lightColors } from '@ludora/design-tokens';

type Tema = 'light' | 'dark';

export type ThemeColors = {
  [K in keyof typeof darkColors]: string;
};


type ThemeContextData = {
  tema: Tema;
  colors: ThemeColors;
  alternarTema: () => void;
};

const ThemeContext = createContext<ThemeContextData | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [tema, setTema] = useState<Tema>('light');

  const value = useMemo<ThemeContextData>(
    () => ({
      tema,
      colors: tema === 'dark' ? darkColors : lightColors,
      alternarTema: () =>
        setTema((atual) => (atual === 'light' ? 'dark' : 'light')),
    }),
    [tema],
  );

  return (
    <ThemeContext.Provider value={value}>
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
