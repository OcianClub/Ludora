import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, BASE_URL } from '../services/api';
import type { EventoPublicoPaulista } from '../utils/paulista';
const EVENTOS_VAZIOS: EventoPublicoPaulista[] = [];

/** Consulta somente a publicação oficial. Nunca inicia sincronização ou escreve na federação. */
export function usePaulistaPublicacao(clubeId: number | undefined, autenticado: boolean) {
  const [consulta, setConsulta] = useState<{ clubeId: number; eventos: EventoPublicoPaulista[] } | null>(null);
  const ultimo = useRef(consulta); ultimo.current = consulta;
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState('');
  const refreshRef = useRef<() => void>(() => {});
  const atualizar = useCallback(() => refreshRef.current(), []);
  useFocusEffect(useCallback(() => {
    let ativo = true, executando = false, pendente = false;
    let socket: Socket | undefined, timer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    setErro(''); setCarregando(!!clubeId && ultimo.current?.clubeId !== clubeId);
    async function carregar() {
      if (!ativo || !clubeId) return;
      if (executando || AppState.currentState !== 'active') { pendente = true; return; }
      executando = true; pendente = false; setAtualizando(true);
      try {
        const response = await apiFetch(`/publico/clubes/${clubeId}/paulista`, { signal: controller.signal, revalidar: true, headers: { 'x-clube-id': String(clubeId) } });
        if (!response.ok) throw new Error('Não foi possível consultar a publicação oficial.');
        const eventos: EventoPublicoPaulista[] = await response.json();
        if (!Array.isArray(eventos)) throw new Error('Publicação inválida.');
        if (ativo) { setConsulta({ clubeId, eventos }); setErro(''); }
      } catch {
        if (ativo) setErro('Não foi possível atualizar o campeonato. Tente novamente.');
      } finally {
        executando = false;
        if (ativo) { setCarregando(false); setAtualizando(false); if (pendente) agendar(); }
      }
    }
    function agendar() { if (ativo && !timer) timer = setTimeout(() => { timer = undefined; void carregar(); }, 250); }
    refreshRef.current = agendar;
    void carregar();
    if (clubeId && autenticado) void SecureStore.getItemAsync('userToken').then(token => {
      if (!ativo || !token) return;
      socket = io(BASE_URL, { auth: { token, clubeId } });
      let conectado = false;
      socket.on('connect', () => { if (conectado) agendar(); conectado = true; });
      socket.on('paulista_atualizado', () => agendar());
    }).catch(() => {});
    // A publicação pública não recebe operações privadas; consulta novamente em primeiro plano.
    const poll = setInterval(() => { if (AppState.currentState === 'active') agendar(); }, 60_000);
    const listener = AppState.addEventListener('change', estado => { if (estado === 'active') agendar(); });
    return () => { ativo = false; controller.abort(); clearTimeout(timer); clearInterval(poll); socket?.removeAllListeners(); socket?.disconnect(); listener.remove(); refreshRef.current = () => {}; };
  }, [clubeId, autenticado]));
  return { eventos: consulta && consulta.clubeId === clubeId ? consulta.eventos : EVENTOS_VAZIOS, carregando, atualizando, erro, atualizar };
}
