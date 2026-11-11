import { useCallback, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, BASE_URL } from '../services/api';
import type { EventoPublicoPaulista } from '../utils/paulista';

const EVENTOS_VAZIOS: EventoPublicoPaulista[] = [];
const INTERVALO_CONSULTA = 60_000;
const INTERVALO_RETORNO = 15_000;
const AGRUPAR_ATUALIZACOES = 250;
type Publicacao = { clubeId: number; eventos: EventoPublicoPaulista[]; consultadoEm: number };
type Estado = { clubeId: number; atualizando: boolean; erro: string };

function publicacaoValida(value: unknown): value is EventoPublicoPaulista[] {
  return Array.isArray(value) && value.every(evento =>
    evento && Number.isInteger(evento.id) && Number.isInteger(evento.ano)
    && typeof evento.categoria === 'string' && typeof evento.divisao === 'string'
    && Array.isArray(evento.equipes) && Array.isArray(evento.equipesClube)
    && Array.isArray(evento.jogos) && Array.isArray(evento.classificacao)
  );
}

const primeiroPlano = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

export function usePaulistaPublicacao(clubeId: number | undefined, autenticado: boolean) {
  const [publicacao, setPublicacao] = useState<Publicacao>();
  const ultima = useRef<Publicacao | undefined>(undefined);
  const [estado, setEstado] = useState<Estado>();
  const refreshRef = useRef<() => void>(() => {});
  const atualizar = useCallback(() => refreshRef.current(), []);

  useFocusEffect(useCallback(() => {
    if (clubeId == null) return;
    const id = clubeId;
    const controller = new AbortController();
    let executando = false;
    let pendente = false;
    let socket: Socket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function agendar() {
      if (controller.signal.aborted) return;
      if (executando || !primeiroPlano()) {
        pendente = true;
        return;
      }
      if (!timer) {
        timer = setTimeout(() => {
          timer = undefined;
          void carregar();
        }, AGRUPAR_ATUALIZACOES);
      }
    }

    async function carregar() {
      if (controller.signal.aborted) return;
      if (executando || !primeiroPlano()) {
        pendente = true;
        return;
      }
      executando = true;
      pendente = false;
      setEstado({ clubeId: id, atualizando: true, erro: '' });
      let erro = '';
      try {
        const response = await apiFetch(`/publico/clubes/${id}/paulista`, {
          signal: controller.signal,
          revalidar: true,
          headers: { 'x-clube-id': String(id) },
        });
        if (!response.ok) throw new Error('Consulta indisponível.');
        const eventos: unknown = await response.json();
        if (!publicacaoValida(eventos)) throw new Error('Publicação inválida.');
        if (!controller.signal.aborted) {
          const resultado = { clubeId: id, eventos, consultadoEm: Date.now() };
          ultima.current = resultado;
          setPublicacao(resultado);
        }
      } catch {
        erro = 'Não foi possível atualizar o campeonato. Tente novamente.';
      } finally {
        executando = false;
        if (!controller.signal.aborted) {
          setEstado({ clubeId: id, atualizando: false, erro });
          if (pendente) agendar();
        }
      }
    }

    function revalidarAoVoltar() {
      const resultado = ultima.current;
      if (pendente || resultado?.clubeId !== id || Date.now() - resultado.consultadoEm >= INTERVALO_RETORNO) {
        agendar();
      }
    }

    refreshRef.current = agendar;
    const resultado = ultima.current;
    if (resultado?.clubeId === id && Date.now() - resultado.consultadoEm < INTERVALO_RETORNO) {
      setEstado(anterior => ({ clubeId: id, atualizando: false, erro: anterior?.clubeId === id ? anterior.erro : '' }));
    } else {
      void carregar();
    }

    if (autenticado) {
      void SecureStore.getItemAsync('userToken').then(token => {
        if (controller.signal.aborted || !token) return;
        socket = io(BASE_URL, { auth: { token, clubeId: id } });
        let conectadoAntes = false;
        socket.on('connect', () => {
          if (conectadoAntes) agendar();
          conectadoAntes = true;
        });
        socket.on('paulista_atualizado', agendar);
      }).catch(() => {});
    }

    const poll = setInterval(() => {
      if (primeiroPlano() && !executando) revalidarAoVoltar();
    }, INTERVALO_CONSULTA);
    const listener = AppState.addEventListener('change', valor => {
      if (valor === 'active') revalidarAoVoltar();
    });

    return () => {
      controller.abort();
      clearTimeout(timer);
      clearInterval(poll);
      socket?.disconnect();
      socket?.removeAllListeners();
      listener.remove();
      refreshRef.current = () => {};
    };
  }, [clubeId, autenticado]));

  const recebida = publicacao?.clubeId === clubeId ? publicacao : undefined;
  const estadoClube = estado?.clubeId === clubeId ? estado : undefined;
  return {
    eventos: recebida?.eventos ?? EVENTOS_VAZIOS,
    recebida: !!recebida,
    carregando: clubeId != null && !recebida && !estadoClube?.erro,
    atualizando: estadoClube?.atualizando ?? false,
    erro: estadoClube?.erro ?? '',
    atualizar,
  };
}
