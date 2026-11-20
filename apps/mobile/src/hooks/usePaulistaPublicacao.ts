import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
import { apiFetch, BASE_URL } from '../services/api';
import type { CatalogoPaulistaPublico, EventoPaulistaCatalogo, PublicacaoPaulistaDetalhe } from '../../../../packages/shared-types/src/paulista';

const EVENTOS_VAZIOS: EventoPaulistaCatalogo[] = [];
const INTERVALO_CONSULTA = 60_000;
const INTERVALO_RETORNO = 15_000;
const AGRUPAR_ATUALIZACOES = 250;
const LIMITE_PUBLICACOES = 3;
const ERRO_PUBLICACAO = 'Não foi possível atualizar o campeonato. Tente novamente.';
type Catalogo = CatalogoPaulistaPublico & { clubeId: number; consultadoEm: number };
type Estado = { clubeId: number; atualizando: boolean; erro: string };

function catalogoValido(value: unknown): value is EventoPaulistaCatalogo[] {
  return Array.isArray(value) && value.every(item =>
    item && Number.isSafeInteger(item.id) && Number.isInteger(item.ano)
    && typeof item.categoria === 'string' && typeof item.divisao === 'string'
    && typeof item.revisao === 'string' && !!item.revisao);
}

function detalheValido(value: unknown, id: number): value is PublicacaoPaulistaDetalhe {
  if (!value || typeof value !== 'object') return false;
  const { evento, revisao } = value as Partial<PublicacaoPaulistaDetalhe>;
  return !!evento && evento.id === id && typeof revisao === 'string' && !!revisao
    && Number.isInteger(evento.ano) && typeof evento.categoria === 'string' && typeof evento.divisao === 'string'
    && Array.isArray(evento.equipes) && Array.isArray(evento.equipesClube)
    && Array.isArray(evento.jogos) && Array.isArray(evento.classificacao);
}

const primeiroPlano = () => AppState.currentState !== 'background' && AppState.currentState !== 'inactive';

export function usePaulistaCatalogo(clubeId: number | undefined, autenticado: boolean) {
  const [catalogo, setCatalogo] = useState<Catalogo>();
  const ultima = useRef<Catalogo | undefined>(undefined);
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
        const abertura = ultima.current?.clubeId !== id ? '?incluirInicial=1' : '';
        const response = await apiFetch(`/publico/clubes/${id}/paulista/catalogo${abertura}`, {
          signal: controller.signal,
          revalidar: true,
          headers: { 'x-clube-id': String(id) },
        });
        if (controller.signal.aborted) return;
        if ([401, 403, 404, 423].includes(response.status)) {
          ultima.current = undefined;
          setCatalogo(undefined);
        }
        if (!response.ok) throw new Error('Consulta indisponível.');
        const dados: Partial<CatalogoPaulistaPublico> | null = await response.json();
        const eventos: unknown = dados?.eventos;
        if (!catalogoValido(eventos)) throw new Error('Catálogo inválido.');
        const inicial = dados?.inicial;
        const itemInicial = inicial && eventos.find(item => item.id === inicial.evento?.id);
        if (!controller.signal.aborted) {
          const resultado: Catalogo = { clubeId: id, eventos, consultadoEm: Date.now(),
            inicial: itemInicial && detalheValido(inicial, itemInicial.id) ? inicial : undefined };
          ultima.current = resultado;
          setCatalogo(resultado);
        }
      } catch {
        erro = ERRO_PUBLICACAO;
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

  const recebida = catalogo?.clubeId === clubeId ? catalogo : undefined;
  const estadoClube = estado?.clubeId === clubeId ? estado : undefined;
  return {
    eventos: recebida?.eventos ?? EVENTOS_VAZIOS,
    inicial: recebida?.inicial,
    consultadoEm: recebida?.consultadoEm,
    recebida: !!recebida,
    carregando: clubeId != null && !recebida && !estadoClube?.erro,
    atualizando: estadoClube?.atualizando ?? false,
    erro: estadoClube?.erro ?? '',
    atualizar,
  };
}

export function usePaulistaPublicacao(
  clubeId: number | undefined,
  item: EventoPaulistaCatalogo | undefined,
  consultadoEm: number | undefined,
  inicial: PublicacaoPaulistaDetalhe | undefined,
) {
  // Cada clube tem sua própria coleção, limitada às últimas publicações abertas.
  const cache = useMemo(() => new Map<number, PublicacaoPaulistaDetalhe>(), [clubeId]);
  const id = item?.id;
  const revisao = item?.revisao;
  const antecipada = inicial && inicial.evento.id === id && inicial.revisao === revisao ? inicial : undefined;
  const selecao = useMemo(() => ({ cache, id, revisao }), [cache, id, revisao]);
  const [estado, setEstado] = useState<{ selecao: typeof selecao; atualizando: boolean; erro: string }>();

  useFocusEffect(useCallback(() => {
    if (clubeId == null || id == null) return;
    const existente = cache.get(id) ?? antecipada;
    const guardar = (detalhe: PublicacaoPaulistaDetalhe) => {
      cache.delete(id);
      cache.set(id, detalhe);
      if (cache.size > LIMITE_PUBLICACOES) {
        const maisAntiga = cache.keys().next().value;
        if (maisAntiga !== undefined) cache.delete(maisAntiga);
      }
    };
    if (existente) guardar(existente);
    if (existente?.revisao === revisao) {
      setEstado({ selecao, atualizando: false, erro: '' });
      return;
    }

    const controller = new AbortController();
    setEstado({ selecao, atualizando: true, erro: '' });
    void (async () => {
      try {
        const resposta = await apiFetch(`/publico/clubes/${clubeId}/paulista/eventos/${id}`, {
          signal: controller.signal,
          headers: { 'x-clube-id': String(clubeId) },
        });
        if (controller.signal.aborted) return;
        if ([401, 403, 404, 423].includes(resposta.status)) cache.delete(id);
        if (!resposta.ok) throw new Error('Publicação indisponível.');
        const detalhe: unknown = await resposta.json();
        if (!detalheValido(detalhe, id)) throw new Error('Publicação inválida.');
        if (controller.signal.aborted) return;
        guardar(detalhe);
        setEstado({ selecao, atualizando: false, erro: '' });
      } catch {
        if (!controller.signal.aborted) setEstado({ selecao, atualizando: false, erro: ERRO_PUBLICACAO });
      }
    })();
    return () => controller.abort();
  }, [cache, clubeId, id, revisao, selecao, consultadoEm, antecipada]));

  const evento = id == null ? undefined : (cache.get(id) ?? antecipada)?.evento;
  const estadoAtual = estado?.selecao === selecao ? estado : undefined;
  return {
    evento,
    carregando: id != null && !evento && !estadoAtual?.erro,
    atualizando: estadoAtual?.atualizando ?? false,
    erro: estadoAtual?.erro ?? '',
  };
}
