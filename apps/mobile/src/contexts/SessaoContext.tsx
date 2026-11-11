import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';
import { AppState } from 'react-native';
import { usePathname } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

const Context = createContext({ autenticado: false, carregando: true, atualizar: async () => {} });
export function SessaoProvider({ children }: { children: React.ReactNode }) {
  const [autenticado, setAutenticado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const pathname = usePathname();
  const versao = useRef(0);
  const atualizar = useCallback(async () => {
    const pedido = ++versao.current;
    const token = await SecureStore.getItemAsync('userToken').catch(() => null);
    if (pedido !== versao.current) return;
    setAutenticado(!!token);
    setCarregando(false);
  }, []);
  useEffect(() => { void atualizar(); }, [pathname, atualizar]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', state => { if (state === 'active') void atualizar(); });
    return () => sub.remove();
  }, [atualizar]);
  return <Context.Provider value={{ autenticado, carregando, atualizar }}>{children}</Context.Provider>;
}
export const useSessao = () => useContext(Context);
