import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Text,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { io } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { useTheme } from "../contexts/ThemeContext";
import { useClubeAtivo } from "../contexts/ClubeAtivoContext";
import { BASE_URL } from "../services/api";
import {
  gestaoPartida,
  requisicaoPartida,
  type GestaoPartida,
} from "../services/partidasCompartilhadas";
import PreparacaoPartida from "./PreparacaoPartida";
import SolicitacoesPartidas from "./SolicitacoesPartidas";
import { IconButton } from "./ui/Controls";
import SumulaPartida from "./SumulaPartida";
import { criarFilaConsulta } from "../utils/filaConsulta";
import { receberPalpite } from '../services/palpitePartida';
import { useSessao } from '../contexts/SessaoContext';

export default function PartidaCompartilhada({
  id,
  onBack,
}: {
  id: number;
  onBack: () => void;
}) {
  const { colors } = useTheme();
  const { autenticado } = useSessao();
  const { clubeAtivo, podeGerenciar } = useClubeAtivo();
  const [solicitacoesAbertas, setSolicitacoesAbertas] = useState(false);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);
  const [partidaConsulta, setPartidaConsulta] = useState<number | null>(null);
  const [data, setData] = useState<GestaoPartida | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const mounted = useRef(true);
  const snapshot = useRef<GestaoPartida | null>(null);
  const [connected, setConnected] = useState(false);
  const clubId = clubeAtivo?.id;
  const consultaGestao = useMemo(
    () =>
      criarFilaConsulta(async () =>
        clubId ? gestaoPartida(id, clubId) : undefined,
      ),
    [id, clubId, autenticado],
  );
  const scope = useRef("");
  scope.current = `${clubId}:${id}:${autenticado}`;
  async function refresh(aposAtual = false) {
    if (!clubId) return;
    const source = `${clubId}:${id}:${autenticado}`;
    const next = await consultaGestao.consultar(aposAtual);
    if (!next || !mounted.current || source !== scope.current) return;
    if (
      snapshot.current &&
      (next.partida.versao < snapshot.current.partida.versao ||
        JSON.stringify(next) === JSON.stringify(snapshot.current))
    )
      return snapshot.current;
    snapshot.current = next;
    setData(next);
    return next;
  }
  async function atualizarSolicitacoes() {
    if (!autenticado || !podeGerenciar || !clubId) return;
    const source = `${clubId}:${id}:${autenticado}`;
    try {
      const resumo = await requisicaoPartida<{ pendentes: number }>(
        "/partidas/solicitacoes/resumo", clubId,
      );
      if (mounted.current && scope.current === source)
        setSolicitacoesPendentes(resumo.pendentes);
    } catch { /* Uma falha no contador não bloqueia a partida nem as solicitações. */ }
  }
  function atualizarAposSolicitacao() {
    void atualizarSolicitacoes();
    void refresh(true).catch((e) => setError(e.message));
  }
  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    setData(null);
    setError("");
    snapshot.current = null;
    setConnected(false);
    setSolicitacoesPendentes(0);
    void atualizarSolicitacoes();
    let active = true,
      socket: ReturnType<typeof io> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (!clubId) return;
        const token = await SecureStore.getItemAsync("userToken");
        if (!active) return;
        socket = io(token ? BASE_URL : `${BASE_URL}/publico`, { auth: token ? { token, clubeId: clubId } : { clubeId: clubId } });
        const sync = () => {
          clearTimeout(timer);
          timer = setTimeout(() => {
            if (active && AppState.currentState === "active")
              void refresh(true).catch((e) => {
                if (active) setError(e.message);
              });
          }, 150);
        };
        socket.on("partida_atualizada", (p: { id: number }) => {
          if (p.id === id) sync();
        });
        socket.on('partidas_alteradas', (p: { partida_id: number }) => { if (p.partida_id === id) sync(); });
        socket.on('palpite_atualizado', receberPalpite);
        socket.on('solicitacao_partida', () => {
          void atualizarSolicitacoes();
          sync();
        });
        let primeiraConexao = true;
        socket.on("connect", () => {
          if (active) setConnected(true);
          if (!primeiraConexao) { sync(); void atualizarSolicitacoes(); }
          primeiraConexao = false;
        });
        socket.on("disconnect", () => {
          if (active) setConnected(false);
        });
        socket.on("connect_error", () => {
          if (active) setConnected(false);
        });
      } catch (e) {
        if (active) setError((e as Error).message);
      }
    }
    void refresh()
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    void load();
    const interval = setInterval(() => {
      if (active && AppState.currentState === "active" && !socket?.connected) {
        void refresh().catch(() => undefined);
        void atualizarSolicitacoes();
      }
    }, 12000);
    const appState = AppState.addEventListener("change", (state) => {
      if (state === "active" && active) {
        void refresh(true).catch(() => undefined);
        void atualizarSolicitacoes();
      }
    });
    return () => {
      active = false;
      mounted.current = false;
      clearTimeout(timer);
      clearInterval(interval);
      socket?.disconnect();
      appState.remove();
    };
  }, [id, clubId, autenticado, podeGerenciar]);
  if (loading)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          backgroundColor: colors.fundo,
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        <ActivityIndicator color={colors.primaria} />
        <Text style={{ color: colors.textoSecundario }}>
          Carregando a partida…
        </Text>
      </SafeAreaView>
    );
  if (!data)
    return (
      <SafeAreaView
        style={{
          flex: 1,
          padding: 20,
          gap: 16,
          backgroundColor: colors.fundo,
          justifyContent: "center",
        }}
      >
        <Text accessibilityRole="alert" style={{ color: colors.texto }}>
          {error || "Partida não encontrada."}
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          onPress={() => {
            setLoading(true);
            void refresh(true)
              .catch((e) => setError(e.message))
              .finally(() => setLoading(false));
          }}
        >
          <Text style={{ color: colors.primaria }}>Tentar novamente</Text>
        </TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={onBack}>
          <Text style={{ color: colors.texto }}>Voltar às partidas</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  const headerAccessory = autenticado && podeGerenciar &&
    ["AGENDADA", "PREPARADA", "AO_VIVO"].includes(data.partida.status) ? (
      <IconButton
        icon="email-outline"
        variant="ghost"
        label={`Solicitações: ${solicitacoesPendentes} aguardando sua resposta`}
        badge={solicitacoesPendentes}
        onPress={() => setSolicitacoesAbertas(true)}
      />
    ) : undefined;
  const emPreparacao = data.podePreparar &&
    ["AGENDADA", "PREPARADA"].includes(data.partida.status) && clubId;
  return (
    <>
      {emPreparacao ? (
        <PreparacaoPartida
          key={`${clubId}:${id}`}
          data={data}
          clubeId={clubId!}
          onBack={onBack}
          onRefresh={() => refresh(true)}
          headerAccessory={headerAccessory}
        />
      ) : (
        <SumulaPartida
          key={`${clubId}:${id}`}
          data={data}
          clubeId={clubId!}
          connected={connected}
          onBack={onBack}
          onRefresh={() => refresh(true)}
          headerAccessory={headerAccessory}
        />
      )}
      <Modal
        visible={solicitacoesAbertas}
        animationType="slide"
        onRequestClose={() => setSolicitacoesAbertas(false)}
      >
        {solicitacoesAbertas && (
          <SolicitacoesPartidas
            onClose={() => setSolicitacoesAbertas(false)}
            onChanged={atualizarAposSolicitacao}
            onOpenMatch={(partidaId) => {
              if (partidaId === id) setSolicitacoesAbertas(false);
              else setPartidaConsulta(partidaId);
            }}
          />
        )}
        <Modal
          visible={partidaConsulta !== null}
          animationType="slide"
          onRequestClose={() => setPartidaConsulta(null)}
        >
          {partidaConsulta !== null && (
            <PartidaCompartilhada
              id={partidaConsulta}
              onBack={() => setPartidaConsulta(null)}
            />
          )}
        </Modal>
      </Modal>
    </>
  );
}
