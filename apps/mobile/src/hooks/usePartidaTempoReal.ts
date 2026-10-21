import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';

import { BASE_URL, fetchDetalhesPartida } from '../services/api';
import { criarSincronizador } from '../utils/sincronizador';

type Estado = 'carregando' | 'atualizado' | 'erro';

export function usePartidaTempoReal<T>(
  partidaId: number,
  clubeId: number | undefined,
  aplicar: (dados: T) => void,
  clubeOrigemId?: number
) {
  const aplicarRef = useRef(aplicar);
  aplicarRef.current = aplicar;
  const atualizarRef = useRef<() => Promise<boolean>>(async () => false);
  const [estado, setEstado] = useState<Estado>('carregando');
  const [conectado, setConectado] = useState(false);

  useEffect(() => {
    if (!clubeId) return;
    let ativo = true;
    let socket: Socket | undefined;
    let debounce: ReturnType<typeof setTimeout> | undefined;
    const sincronizador = criarSincronizador<T>(
      () => fetchDetalhesPartida(partidaId, clubeId),
      (dados) => {
        const origem = (dados as { clube_origem_id?: number }).clube_origem_id;
        if (
          typeof origem === 'number' &&
          Number.isSafeInteger(origem) &&
          origem > 0
        ) {
          void conectarNaOrigem(origem).catch(() => {
            if (ativo) setConectado(false);
          });
        } else {
          void conectarNaOrigem(clubeOrigemId ?? clubeId).catch(() => {
            if (ativo) setConectado(false);
          });
        }
        aplicarRef.current(dados);
      },
      setEstado
    );
    atualizarRef.current = sincronizador.atualizar;
    setConectado(false);
    void sincronizador.atualizar();

    const agendar = (dados: { id?: number; partida_id?: number }) => {
      if ((dados?.partida_id ?? dados?.id) !== partidaId) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        void sincronizador.atualizar();
      }, 150);
    };
    let origemAtual = clubeOrigemId;
    let versaoConexao = 0;
    async function conectarNaOrigem(origem: number) {
      if (!ativo || (socket && origemAtual === origem)) return;
      origemAtual = origem;
      const pedido = ++versaoConexao;
      const token = await SecureStore.getItemAsync('userToken');
      if (!ativo || !token || pedido !== versaoConexao) return;
      socket?.disconnect();
      socket = io(BASE_URL, {
        auth: { token, clubeId: origem },
        transports: ['websocket', 'polling'],
      });
      socket.on('connect', () => {
        if (!ativo) return;
        setConectado(true);
        void sincronizador.atualizar();
      });
      socket.on('disconnect', () => {
        if (ativo) setConectado(false);
      });
      socket.on('connect_error', () => {
        if (ativo) setConectado(false);
      });
      socket.on('placar_atualizado', agendar);
      socket.on('partida_atualizada', agendar);
      socket.on('evento_partida', agendar);
    }
    if (clubeOrigemId) {
      void conectarNaOrigem(clubeOrigemId).catch(() => {
        if (ativo) setConectado(false);
      });
    }

    const appState = AppState.addEventListener('change', (estadoApp) => {
      if (estadoApp === 'active') {
        socket?.connect();
        void sincronizador.atualizar();
      }
    });
    const intervalo = setInterval(() => {
      if (AppState.currentState === 'active') void sincronizador.atualizar();
    }, 30_000);

    return () => {
      ativo = false;
      atualizarRef.current = async () => false;
      sincronizador.encerrar();
      clearTimeout(debounce);
      clearInterval(intervalo);
      appState.remove();
      socket?.disconnect();
    };
  }, [partidaId, clubeId, clubeOrigemId]);

  return {
    estado,
    conectado,
    sincronizar: useCallback(() => atualizarRef.current(), []),
  };
}
