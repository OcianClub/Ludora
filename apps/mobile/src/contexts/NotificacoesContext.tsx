import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';

import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import {
  BASE_URL,
  fetchNotificacoes,
  fetchPreferenciaNotificacoes,
  registrarDispositivoPush,
  atualizarPreferenciaNotificacoes,
} from '@/src/services/api';

type NotificacoesContextData = {
  totalNaoLidas: number;
  notificacoesAtivas: boolean;
  carregandoPreferencia: boolean;
  versaoNotificacoes: number;
  atualizarNaoLidas: () => Promise<void>;
  alterarNotificacoes: (ativa: boolean) => Promise<boolean>;
};

const NotificacoesContext = React.createContext<NotificacoesContextData | null>(null);

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registrarTokenPush(solicitarPermissao = true) {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('partidas', {
      name: 'Partidas e resultados',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 200, 250],
      sound: 'default',
    });
  }

  const permissaoAtual = await Notifications.getPermissionsAsync();
  const permissao = permissaoAtual.granted
    ? permissaoAtual
    : solicitarPermissao
      ? await Notifications.requestPermissionsAsync()
      : permissaoAtual;

  if (!permissao.granted) return false;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return false;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  await registrarDispositivoPush(token, Platform.OS);
  await SecureStore.setItemAsync('expoPushToken', token);
  return true;
}

export function NotificacoesProvider({ children }: { children: React.ReactNode }) {
  const { clubeAtivo, carregandoClubeAtivo } = useClubeAtivo();
  const [contagem, setContagem] = useState<{ clubeId: number | null; total: number }>({ clubeId: null, total: 0 });
  const totalNaoLidas = contagem.clubeId === clubeAtivo?.id ? contagem.total : 0;
  const [notificacoesAtivas, setNotificacoesAtivas] = useState(true);
  const [carregandoPreferencia, setCarregandoPreferencia] = useState(true);
  const [versaoNotificacoes, setVersaoNotificacoes] = useState(0);
  const preferenciaEmAndamento = useRef(false);
  const clubeAtualId = useRef(clubeAtivo?.id);
  clubeAtualId.current = clubeAtivo?.id;
  const contadorPedido = useRef(0);

  const atualizarNaoLidas = useCallback(async () => {
    const pedido = ++contadorPedido.current;
    if (!clubeAtivo?.papel) {
      setContagem({ clubeId: null, total: 0 });
      return;
    }

    const resultado = await fetchNotificacoes(1, clubeAtivo.id);
    if (clubeAtualId.current === clubeAtivo.id && pedido === contadorPedido.current) setContagem({ clubeId: clubeAtivo.id, total: resultado.totalNaoLidas });
  }, [clubeAtivo?.id, clubeAtivo?.papel]);

  useEffect(() => {
    if (carregandoClubeAtivo || !clubeAtivo) {
      setCarregandoPreferencia(false);
      return;
    }
    setCarregandoPreferencia(true);

    let ativo = true;
    const carregarPreferencias = async () => {
      try {
        const ativa = await fetchPreferenciaNotificacoes();
        if (ativo) setNotificacoesAtivas(ativa);

        // Se o usuário já concedeu a permissão antes, atualiza o token sem
        // abrir nenhum prompt. Isso cobre reinstalações e troca de token.
        if (ativa && ativo) {
          void registrarTokenPush(false).catch(() => undefined);
        }
      } catch {
        // A sessão pode ainda não existir durante as telas públicas.
      } finally {
        if (ativo) setCarregandoPreferencia(false);
      }
    };

    void carregarPreferencias();
    return () => {
      ativo = false;
    };
  }, [carregandoClubeAtivo, clubeAtivo?.id]);

  useEffect(() => {
    if (carregandoClubeAtivo) return;
    void atualizarNaoLidas().catch(() => undefined);
  }, [atualizarNaoLidas, carregandoClubeAtivo]);

  useEffect(() => {
    if (!clubeAtivo) return;

    let socket: Socket | null = null;
    let ativo = true;
    let jaConectou = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const atualizar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!ativo) return;
        setVersaoNotificacoes((versao) => versao + 1);
        void atualizarNaoLidas().catch(() => undefined);
      }, 250);
    };
    const appState = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') atualizar();
    });

    const conectar = async () => {
      const token = await SecureStore.getItemAsync('userToken');
      if (!token || !ativo) return;

      socket = io(BASE_URL, {
        transports: ['websocket'],
        auth: { token, clubeId: clubeAtivo.id },
      });

      socket.on('notificacao_criada', atualizar);
      socket.on('connect', () => {
        if (jaConectou) atualizar();
        jaConectou = true;
      });
    };

    void conectar().catch(() => undefined);
    return () => {
      ativo = false;
      clearTimeout(timer);
      appState.remove();
      socket?.disconnect();
    };
  }, [clubeAtivo?.id, atualizarNaoLidas]);

  const alterarNotificacoes = useCallback(async (ativa: boolean) => {
    if (preferenciaEmAndamento.current) return false;
    preferenciaEmAndamento.current = true;
    setCarregandoPreferencia(true);
    try {
      if (ativa && !(await registrarTokenPush())) {
        return false;
      }

      const resposta = await atualizarPreferenciaNotificacoes(ativa);
      setNotificacoesAtivas(resposta.ativa);
      return resposta.ativa === ativa;
    } finally {
      preferenciaEmAndamento.current = false;
      setCarregandoPreferencia(false);
    }
  }, []);

  const value = useMemo<NotificacoesContextData>(() => ({
    totalNaoLidas,
    notificacoesAtivas,
    carregandoPreferencia,
    versaoNotificacoes,
    atualizarNaoLidas,
    alterarNotificacoes,
  }), [
    totalNaoLidas,
    notificacoesAtivas,
    carregandoPreferencia,
    versaoNotificacoes,
    atualizarNaoLidas,
    alterarNotificacoes,
  ]);

  return (
    <NotificacoesContext.Provider value={value}>
      {children}
    </NotificacoesContext.Provider>
  );
}

export function useNotificacoes() {
  const contexto = React.useContext(NotificacoesContext);
  if (!contexto) {
    throw new Error('useNotificacoes deve ser usado dentro de NotificacoesProvider.');
  }
  return contexto;
}
