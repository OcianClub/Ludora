import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  atualizarMeuPerfil,
  fetchMeuPerfil,
  getToken,
  setToken,
  removeToken,
  setClubeId,
  removeClubeId,
  login as apiLogin,
  Usuario,
  Clube,
  PerfilUsuario,
} from '../services/api';
import { BASE_URL } from '../services/config';
import { AuthError, authRequest } from '../services/authHttp';

interface AuthContextValue {
  usuario: Usuario | null;
  clube: Clube | null;
  token: string | null;
  podeGerenciar: boolean;
  fazendoLogin: boolean;
  login: (email: string, senha: string) => Promise<void>;
  iniciarSessao: (dados: { token: string; usuario: Usuario }) => void;
  logout: () => void;
  definirClube: (c: Clube) => void;
  atualizarPerfil: (dados: { nome: string; email: string; senha?: string }) => Promise<void>;
  recarregarPerfil: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const PAPEIS_GESTORES = ['ADMIN', 'TECNICO', 'MESARIO'];

function lerSalvo<T extends { id: number }>(chave: string): T | null {
  try {
    if (!getToken()) return null;
    const value = JSON.parse(localStorage.getItem(chave) || 'null');
    return value && Number.isSafeInteger(value.id) && value.id > 0 ? value : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => lerSalvo<Usuario>('ludora_usuario'));
  const [clube, setClube] = useState<Clube | null>(() => lerSalvo<Clube>('ludora_clube'));
  const [token, setTokenState] = useState<string | null>(getToken());
  const [fazendoLogin, setFazendoLogin] = useState(false);

  useEffect(() => {
    let ativo = true;
    const t = getToken();
    if (t) {
      const clubeSalvo = lerSalvo<Clube>('ludora_clube');
      authRequest<PerfilUsuario>(`${BASE_URL}/usuarios/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then(perfil => {
          if (!ativo || getToken() !== t) return;
          const usuarioAtual = {
            id: perfil.id,
            nome: perfil.nome,
            email: perfil.email,
            criadoEm: perfil.criadoEm,
          };
          setUsuario(usuarioAtual);
          localStorage.setItem('ludora_usuario', JSON.stringify(usuarioAtual));

          if (clubeSalvo) {
            const vinculoAtual = perfil.clubes.find(item => item.id === clubeSalvo.id);
            if (vinculoAtual) {
              setClube(vinculoAtual);
              localStorage.setItem('ludora_clube', JSON.stringify(vinculoAtual));
            } else {
              setClube({ ...clubeSalvo, meuPapel: null });
              localStorage.setItem('ludora_clube', JSON.stringify({ ...clubeSalvo, meuPapel: null }));
            }
          }
        })
        .catch(error => {
          if (!ativo || getToken() !== t || !(error instanceof AuthError) || error.status !== 401) return;
          setTokenState(null);
          setUsuario(null);
          setClube(null);
          try {
            removeToken();
            removeClubeId();
            localStorage.removeItem('ludora_usuario');
            localStorage.removeItem('ludora_clube');
          } catch { /* A sessão já foi removida da memória. */ }
        });
    }
    return () => { ativo = false; };
  }, []);

  const iniciarSessao = useCallback((dados: { token: string; usuario: Usuario }) => {
    try {
      removeToken();
      removeClubeId();
      localStorage.removeItem('ludora_clube');
      localStorage.setItem('ludora_usuario', JSON.stringify(dados.usuario));
      setToken(dados.token);
    } catch {
      setTokenState(null);
      setUsuario(null);
      setClube(null);
      throw new Error('Seus dados foram confirmados, mas não conseguimos salvar o acesso. Permita o armazenamento neste navegador e tente entrar novamente.');
    }
    setUsuario(dados.usuario);
    setClube(null);
    setTokenState(dados.token);
  }, []);

  const login = useCallback(async (email: string, senha: string) => {
    setFazendoLogin(true);
    try {
      const data = await apiLogin(email, senha);
      iniciarSessao(data);
    } finally {
      setFazendoLogin(false);
    }
  }, [iniciarSessao]);

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

  const definirClube = useCallback((c: Clube) => {
    setClubeId(c.id);
    setClube(c);
    localStorage.setItem('ludora_clube', JSON.stringify(c));
  }, []);

  const atualizarPerfil = useCallback(async (dados: { nome: string; email: string; senha?: string }) => {
    const atualizado = await atualizarMeuPerfil(dados);
    setUsuario(atualizado);
    localStorage.setItem('ludora_usuario', JSON.stringify(atualizado));
  }, []);

  const recarregarPerfil = useCallback(async () => {
    const perfil = await fetchMeuPerfil();
    const atualizado = {
      id: perfil.id,
      nome: perfil.nome,
      email: perfil.email,
      criadoEm: perfil.criadoEm,
    };
    setUsuario(atualizado);
    localStorage.setItem('ludora_usuario', JSON.stringify(atualizado));
  }, []);

  const podeGerenciar = !!clube?.meuPapel && PAPEIS_GESTORES.includes(clube.meuPapel);

  return (
    <AuthContext.Provider value={{ usuario, clube, token, podeGerenciar, fazendoLogin, login, iniciarSessao, logout, definirClube, atualizarPerfil, recarregarPerfil }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
