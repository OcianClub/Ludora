import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getToken, setToken, removeToken, getClubeId, setClubeId, removeClubeId, login as apiLogin, Usuario, Clube } from '../services/api';

interface AuthContextValue {
  usuario: Usuario | null;
  clube: (Clube & { meuPapel?: string }) | null;
  token: string | null;
  podeGerenciar: boolean;
  fazendoLogin: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
  definirClube: (c: Clube & { meuPapel?: string }) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PAPEIS_GESTORES = ['ADMIN', 'TECNICO', 'MESARIO'];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [clube, setClube] = useState<(Clube & { meuPapel?: string }) | null>(null);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [fazendoLogin, setFazendoLogin] = useState(false);

  useEffect(() => {
    // Recupera dados do localStorage ao iniciar
    const t = getToken();
    if (t) {
      const u = localStorage.getItem('ludora_usuario');
      const c = localStorage.getItem('ludora_clube');
      if (u) setUsuario(JSON.parse(u));
      if (c) setClube(JSON.parse(c));
      setTokenState(t);
    }
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    setFazendoLogin(true);
    try {
      const data = await apiLogin(email, senha);
      setToken(data.token);
      setTokenState(data.token);
      setUsuario(data.usuario);
      localStorage.setItem('ludora_usuario', JSON.stringify(data.usuario));
    } finally {
      setFazendoLogin(false);
    }
  }, []);

  const logout = useCallback(() => {
    removeToken();
    removeClubeId();
    localStorage.removeItem('ludora_usuario');
    localStorage.removeItem('ludora_clube');
    setUsuario(null);
    setClube(null);
    setTokenState(null);
    window.location.href = '/login';
  }, []);

  const definirClube = useCallback((c: Clube & { meuPapel?: string }) => {
    setClubeId(c.id);
    setClube(c);
    localStorage.setItem('ludora_clube', JSON.stringify(c));
  }, []);

  const podeGerenciar = !!clube?.meuPapel && PAPEIS_GESTORES.includes(clube.meuPapel);

  return (
    <AuthContext.Provider value={{ usuario, clube, token, podeGerenciar, fazendoLogin, login, logout, definirClube }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
