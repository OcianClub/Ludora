import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SuperAdminUsuario } from '@ludora/shared-types';
import { limparConsultas } from '../services/api';

type Estado = 'carregando' | 'anonimo' | 'autenticado';

interface Contexto {
  estado: Estado;
  usuario: SuperAdminUsuario | null;
  persistente: boolean;
  entrar: (email: string, senha: string) => Promise<void>;
  sair: () => Promise<void>;
}

const AdminAuth = createContext<Contexto | null>(null);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<Estado>('carregando');
  const [usuario, setUsuario] = useState<SuperAdminUsuario | null>(null);
  const [persistente, setPersistente] = useState(false);

  const anonimo = useCallback(() => {
    limparConsultas();
    setUsuario(null);
    setPersistente(false);
    setEstado('anonimo');
  }, []);

  useEffect(() => {
    let ativo = true;
    window.ludora.auth.restaurar().then(r => {
      if (!ativo) return;
      if (r?.ok) {
        setUsuario(r.usuario);
        setPersistente(r.persistente);
        setEstado('autenticado');
      } else anonimo();
    }).catch(() => { if (ativo) anonimo(); });
    const parar = window.ludora.auth.aoExpirar(anonimo);
    return () => { ativo = false; parar(); };
  }, [anonimo]);

  const entrar = useCallback(async (email: string, senha: string) => {
    limparConsultas();
    const r = await window.ludora.auth.entrar(email, senha);
    if (!r.ok) throw new Error(r.erro);
    setUsuario(r.usuario);
    setPersistente(r.persistente);
    setEstado('autenticado');
  }, []);

  const sair = useCallback(async () => {
    limparConsultas();
    await window.ludora.auth.sair();
    anonimo();
  }, [anonimo]);

  return <AdminAuth.Provider value={{ estado, usuario, persistente, entrar, sair }}>{children}</AdminAuth.Provider>;
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuth);
  if (!ctx) throw new Error('useAdminAuth precisa estar dentro de AdminAuthProvider');
  return ctx;
}
