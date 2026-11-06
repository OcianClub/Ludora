import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  atualizarMeuPerfil,
  fetchMeuPerfil,
  invalidateApiReads,
  getToken,
  getClubeId,
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
import { invalidateReadCache } from '../services/readCache';
import { clearSavedSession, reconcileClubAccess } from '../services/authSession';
import { navigationMode, saveNavigationMode, type NavigationMode } from '../services/publicAccess';

interface AuthContextValue {
  usuario: Usuario | null;
  clube: Clube | null;
  token: string | null;
  podeGerenciar: boolean;
  modo: NavigationMode;
  mudarModo: (modo: NavigationMode) => void;
  clubeSelecionado: Clube | null;
  podeEntrarGestao: boolean;
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
    if (chave !== 'ludora_clube' && !getToken()) return null;
    const value = JSON.parse(localStorage.getItem(chave) || 'null');
    return value && Number.isSafeInteger(value.id) && value.id > 0 ? value : null;
  } catch { return null; }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(() => lerSalvo<Usuario>('ludora_usuario'));
  const [clube, setClube] = useState<Clube | null>(() => lerSalvo<Clube>('ludora_clube'));
  const [modo, setModo] = useState<NavigationMode>(navigationMode);
  const mudarModo = useCallback((value: NavigationMode) => { saveNavigationMode(value); invalidateReadCache(); setModo(value); }, []);
  const [token, setTokenState] = useState<string | null>(getToken());
  const [fazendoLogin, setFazendoLogin] = useState(false);
  const sessionVersion = useRef(0);
  const activeToken = useRef(token);
  activeToken.current = token;

  const applyProfile = useCallback((perfil: PerfilUsuario) => {
    const atualizado = {
      id: perfil.id,
      nome: perfil.nome,
      email: perfil.email,
      criadoEm: perfil.criadoEm,
    };
    setUsuario(atualizado);
    localStorage.setItem('ludora_usuario', JSON.stringify(atualizado));
    const selected = lerSalvo<Clube>('ludora_clube');
    if (!selected || selected.id !== getClubeId()) return;
    const nextClub = reconcileClubAccess(selected, perfil.clubes);
    if (JSON.stringify([selected.meuPapel, selected.acessoTodasCategorias, selected.categoriasAcesso]) !== JSON.stringify([nextClub.meuPapel, nextClub.acessoTodasCategorias, nextClub.categoriasAcesso])) {
      invalidateApiReads();
    }
    localStorage.setItem('ludora_clube', JSON.stringify(nextClub));
    setClube(current => current?.id === selected.id ? nextClub : current);
  }, []);

  useEffect(() => {
    let ativo = true;
    const t = token;
    const version = sessionVersion.current;
    const controller = new AbortController();
    if (t) {
      authRequest<PerfilUsuario>(`${BASE_URL}/usuarios/me`, {
        headers: { Authorization: `Bearer ${t}` },
        signal: controller.signal,
      })
        .then(perfil => {
          if (!ativo || getToken() !== t || sessionVersion.current !== version) return;
          applyProfile(perfil);
        })
        .catch(error => {
          if (!ativo || getToken() !== t || sessionVersion.current !== version || !(error instanceof AuthError) || error.status !== 401) return;
          sessionVersion.current++;
          setTokenState(null);
          setUsuario(null);
          setClube(null);
          invalidateReadCache();
          clearSavedSession();
        });
    }
    return () => { ativo = false; controller.abort(); };
  }, [token, applyProfile]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || (event.key && !['ludora_token', 'ludora_usuario', 'ludora_clube', 'ludora_clube_id', 'ludora_navigation_mode'].includes(event.key))) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const nextToken = getToken();
        if (nextToken !== activeToken.current) sessionVersion.current++;
        activeToken.current = nextToken;
        invalidateReadCache();
        setTokenState(nextToken);
        setUsuario(nextToken ? lerSalvo<Usuario>('ludora_usuario') : null);
        setModo(navigationMode());
        const selected = lerSalvo<Clube>('ludora_clube');
        setClube(selected?.id === getClubeId() ? selected : null);
      }, 0);
    };
    window.addEventListener('storage', sync);
    return () => { clearTimeout(timer); window.removeEventListener('storage', sync); };
  }, []);

  const iniciarSessao = useCallback((dados: { token: string; usuario: Usuario }) => {
    sessionVersion.current++;
    try {
      removeToken();
      removeClubeId();
      localStorage.removeItem('ludora_clube');
      localStorage.setItem('ludora_usuario', JSON.stringify(dados.usuario));
      setToken(dados.token);
    } catch {
      invalidateReadCache();
      clearSavedSession();
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
    const version = sessionVersion.current;
    setFazendoLogin(true);
    try {
      const data = await apiLogin(email, senha);
      if (sessionVersion.current !== version) throw new AuthError('O acesso foi alterado em outra janela. Tente entrar novamente.');
      iniciarSessao(data);
    } finally {
      setFazendoLogin(false);
    }
  }, [iniciarSessao]);

  const logout = useCallback(() => {
    sessionVersion.current++;
    invalidateReadCache();
    clearSavedSession();
    setUsuario(null);
    setClube(null);
    setTokenState(null);
    saveNavigationMode('publico');
    window.location.href = '/selecionar-clube';
  }, []);

  const definirClube = useCallback((c: Clube) => {
    setClubeId(c.id);
    setClube(c);
    localStorage.setItem('ludora_clube', JSON.stringify(c));
  }, []);

  const atualizarPerfil = useCallback(async (dados: { nome: string; email: string; senha?: string }) => {
    const currentToken = getToken();
    const version = sessionVersion.current;
    const atualizado = await atualizarMeuPerfil(dados);
    if (!currentToken || getToken() !== currentToken || sessionVersion.current !== version) return;
    setUsuario(atualizado);
    localStorage.setItem('ludora_usuario', JSON.stringify(atualizado));
  }, []);

  const recarregarPerfil = useCallback(async () => {
    const currentToken = getToken();
    const version = sessionVersion.current;
    const perfil = await fetchMeuPerfil();
    if (!currentToken || getToken() !== currentToken || sessionVersion.current !== version) return;
    applyProfile(perfil);
  }, [applyProfile]);

  const podeEntrarGestao = !!token && !!clube?.meuPapel && PAPEIS_GESTORES.includes(clube.meuPapel);
  const podeGerenciar = modo === 'gestao' && podeEntrarGestao;
  const visibleClub = useMemo(() => modo === 'publico' || !token ? clube && { ...clube, meuPapel: null, acessoTodasCategorias: false, categoriasAcesso: [] } : clube, [clube, modo, token]);

  const value = useMemo(() => ({ usuario, clube: visibleClub, clubeSelecionado: clube, token, modo, mudarModo, podeEntrarGestao, podeGerenciar, fazendoLogin, login, iniciarSessao, logout, definirClube, atualizarPerfil, recarregarPerfil }),
    [usuario, clube, visibleClub, token, modo, mudarModo, podeEntrarGestao, podeGerenciar, fazendoLogin, login, iniciarSessao, logout, definirClube, atualizarPerfil, recarregarPerfil]);
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth precisa estar dentro de AuthProvider');
  return ctx;
}
