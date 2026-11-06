import { IconButton } from "@/src/components/ui/Controls";
import { Icon } from "@ludora/icons";
import { Header } from "@/src/components/Header";
import { FiltrosSolicitacoes } from "@/src/components/FiltrosSolicitacoes";
import { io } from "socket.io-client";
import * as SecureStore from "expo-secure-store";
import { BASE_URL, invalidarConsultasRecentes } from "@/src/services/api";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useTheme } from "@/src/contexts/ThemeContext";
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";
import {
  requisicaoPartida,
  type PropostaPartida,
} from "@/src/services/partidasCompartilhadas";

function ClubeSolicitacao({ clube }: { clube: PropostaPartida["origem"] }) {
  const { colors } = useTheme();
  const [falhou, setFalhou] = useState<string | null>(null);
  return (
    <View style={styles.club}>
      <View
        style={[styles.crest, { backgroundColor: colors.cardSecundario }]}
        accessible={false}
      >
        {clube.escudo && falhou !== clube.escudo ? (
          <Image
            source={{ uri: clube.escudo }}
            resizeMode="contain"
            style={styles.crestImage}
            onError={() => setFalhou(clube.escudo!)}
          />
        ) : (
          <Text style={[styles.crestInitial, { color: colors.texto }]}>
            {clube.nome.trim().charAt(0).toUpperCase() || "?"}
          </Text>
        )}
      </View>
      <Text
        numberOfLines={2}
        style={[styles.clubName, { color: colors.texto }]}
      >
        {clube.nome}
      </Text>
    </View>
  );
}
const rotulosStatus: Record<string, string> = {
  PENDENTE: "Pendente",
  ACEITA: "Aceita",
  RECUSADA: "Recusada",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
};

export default function SolicitacoesPartidas() {
  const { colors } = useTheme();
  const { clubeAtivo } = useClubeAtivo();
  const router = useRouter();
  const [items, setItems] = useState<PropostaPartida[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [all, setAll] = useState(false);
  const [direcao, setDirecao] = useState<"todas" | "recebidas" | "enviadas">(
    "todas",
  );
  const [editing, setEditing] = useState<PropostaPartida | null>(null);
  const [date, setDate] = useState(""),
    [time, setTime] = useState(""),
    [local, setLocal] = useState("");
  const text = { color: colors.texto };
  const muted = { color: colors.textoSecundario };
  const clubId = clubeAtivo?.id;
  const visiveis = items.filter(
    (p) =>
      (all || p.status === "PENDENTE") &&
      (direcao === "todas" ||
        (direcao === "recebidas"
          ? p.respondente_id === clubId
          : p.origem_id === clubId)),
  );
  const filtrosAtivos = Number(!all) + Number(direcao !== "todas");
  const resumoFiltros = `${all ? "Todas as situações" : "Pendentes"} · ${direcao === "recebidas" ? "Para responder" : direcao === "enviadas" ? "Enviadas" : "Todas as solicitações"}`;
  const pendentesParaMim = items.filter(
    (p) => p.status === "PENDENTE" && p.respondente_id === clubId,
  ).length;
  async function load() {
    if (!clubId) return;
    const list = await requisicaoPartida<PropostaPartida[]>(
      "/partidas/solicitacoes",
      clubId,
    );
    setItems(list);
  }
  useFocusEffect(
    useCallback(() => {
      let active = true;
      let socket: ReturnType<typeof io> | undefined;
      async function refresh() {
        try {
          if (!clubId) return;
          const list = await requisicaoPartida<PropostaPartida[]>(
            "/partidas/solicitacoes",
            clubId,
          );
          if (active) {
            setItems(list);
            setError("");
          }
        } catch (e) {
          if (active) setError((e as Error).message);
        } finally {
          if (active) setLoading(false);
        }
      }
      void refresh();
      void SecureStore.getItemAsync("userToken")
        .then((token) => {
          if (!active || !clubId || !token) return;
          socket = io(BASE_URL, { auth: { token, clubeId: clubId } });
          socket.on("solicitacao_partida", () => {
            invalidarConsultasRecentes();
            void refresh();
          });
          socket.on("connect", () => {
            void refresh();
          });
        })
        .catch(() => undefined);
      const timer = setInterval(() => {
        if (!socket?.connected) void refresh();
      }, 12000);
      return () => {
        active = false;
        clearInterval(timer);
        socket?.disconnect();
      };
    }, [clubId]),
  );
  async function respond(p: PropostaPartida, acao: string, extra = {}) {
    if (!clubId || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await requisicaoPartida<{ partidaId?: number }>(
        `/partidas/solicitacoes/${p.id}/responder`,
        clubId,
        { versao: p.versao, acao, ...extra },
      );
      setEditing(null);
      await load();
      if (acao === "ACEITAR" && result.partidaId)
        router.push(`/partida-compartilhada/${result.partidaId}` as never);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function button(label: string, onPress: () => void, primary = false) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        disabled={busy}
        onPress={onPress}
        style={[
          styles.button,
          {
            backgroundColor: primary ? colors.primaria : colors.cardSecundario,
            opacity: busy ? 0.5 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.actionText,
            { color: primary ? "#fff" : colors.texto },
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  }
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.fundo }]}>
      <Header
        title="Solicitações"
        btnVoltar="arrow-left"
        semSafeArea
        onBtnVoltar={() =>
          router.canGoBack()
            ? router.back()
            : router.replace("/(tabs)/jogos/jogos")
        }
        rightAccessory={
          <IconButton
            icon="sliders-horizontal"
            variant="ghost"
            label={`Filtrar solicitações, ${filtrosAtivos} filtros ativos`}
            state={{ expanded: filtrosAbertos }}
            onPress={() => setFiltrosAbertos(true)}
            dot={filtrosAtivos > 0}
          />
        }
      />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.listHeading}>
          <Text style={[styles.listCount, text]}>
            {visiveis.length}{" "}
            {visiveis.length === 1 ? "solicitação" : "solicitações"}
          </Text>
          <Text style={[styles.listSummary, muted]}>{resumoFiltros}</Text>
        </View>
        {loading && <ActivityIndicator color={colors.primaria} />}
        {!!error && (
          <Text accessibilityRole="alert" style={{ color: colors.tituloErro }}>
            {error}
          </Text>
        )}
        {!loading && !error && !visiveis.length && (
          <View style={styles.empty} accessibilityLiveRegion="polite">
            <View
              accessible={false}
              importantForAccessibility="no-hide-descendants"
            >
              <Icon name="email" size={32} color={colors.textoSecundario} />
            </View>
            <Text style={[styles.emptyTitle, muted]}>
              {items.length
                ? "Nenhuma solicitação com estes filtros"
                : "Nenhuma solicitação por aqui"}
            </Text>
            <Text style={[styles.emptyDescription, muted]}>
              {items.length
                ? "Altere os filtros para consultar as demais solicitações."
                : "Propostas de partidas e pedidos de troca da súmula aparecerão aqui."}
            </Text>
          </View>
        )}
        {visiveis.map((p) => (
          <View
            key={p.id}
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.borda },
            ]}
          >
            <View style={styles.cardHeading}>
              <View style={styles.kind}>
                <Icon
                  name={
                    p.tipo === "SUMULA"
                      ? "swap-horizontal"
                      : p.tipo === "CORRECAO" || p.tipo === "ALTERACAO"
                        ? "edit"
                        : "email-outline"
                  }
                  size={16}
                  color={colors.textoSecundario}
                />
                <Text style={[styles.kindText, muted]}>
                  {p.tipo === "CORRECAO"
                    ? "Correção da súmula"
                    : p.tipo === "SUMULA"
                      ? "Transferência da súmula"
                      : p.tipo === "ALTERACAO"
                        ? "Alteração da partida"
                        : "Proposta de partida"}
                </Text>
              </View>
              <View
                style={[
                  styles.status,
                  { backgroundColor: colors.cardSecundario },
                ]}
              >
                {p.status === "PENDENTE" && (
                  <View
                    style={[styles.dot, { backgroundColor: colors.primaria }]}
                  />
                )}
                <Text style={[styles.statusText, text]}>
                  {rotulosStatus[p.status] || p.status.toLowerCase()}
                </Text>
              </View>
            </View>
            <View style={styles.match}>
              <ClubeSolicitacao clube={p.origem} />
              <Text style={[styles.versus, muted]}>×</Text>
              <ClubeSolicitacao clube={p.destino} />
            </View>
            <View style={styles.metadata}>
              {!!p.categoria_nome && (
                <Text style={[styles.detailText, muted]}>
                  {p.categoria_nome.toUpperCase()}
                </Text>
              )}
              {!!p.dados.data && (
                <View style={styles.detail}>
                  <Icon
                    name="calendar"
                    size={14}
                    color={colors.textoSecundario}
                  />
                  <Text style={[styles.detailText, text]}>
                    {p.dados.data.split("-").reverse().join("/")}
                  </Text>
                </View>
              )}
              {!!p.dados.horario && (
                <View style={styles.detail}>
                  <Icon name="clock" size={14} color={colors.textoSecundario} />
                  <Text style={[styles.detailText, text]}>
                    {p.dados.horario}
                  </Text>
                </View>
              )}
            </View>
            {p.tipo === "SUMULA" && (
              <Text style={[styles.detailText, muted]}>
                Após o aceite, a súmula será operada pelo{" "}
                {p.dados.novo_responsavel_id === p.origem_id
                  ? p.origem.nome
                  : p.destino.nome}
                .
              </Text>
            )}
            {!!p.dados.local && (
              <View style={styles.detail}>
                <Icon
                  name="map-marker-outline"
                  size={15}
                  color={colors.textoSecundario}
                />
                <Text style={[styles.detailText, styles.shrink, muted]}>
                  {p.dados.local}
                </Text>
              </View>
            )}
            {!!p.dados.motivo && (
              <Text style={[styles.detailText, text]}>{p.dados.motivo}</Text>
            )}
            {p.status === "PENDENTE" && (
              <View style={styles.actions}>
                {p.respondente_id === clubId && (
                  <>
                    {button(
                      "Aceitar",
                      () =>
                        Alert.alert(
                          "Aceitar proposta?",
                          p.tipo === "CORRECAO"
                            ? "Ao aceitar, o clube poderá corrigir esta súmula por 30 minutos, sempre com justificativa. A responsabilidade não será transferida."
                            : p.tipo === "SUMULA"
                              ? "Ao aceitar, o clube indicado passa a controlar o placar e os eventos. Cada equipe mantém sua própria escalação."
                              : "Confirme a data, o horário e a responsabilidade pela súmula.",
                          [
                            { text: "Voltar", style: "cancel" },
                            {
                              text: "Aceitar",
                              onPress: () => {
                                void respond(p, "ACEITAR");
                              },
                            },
                          ],
                        ),
                      true,
                    )}
                    {button("Recusar", () => {
                      void respond(p, "RECUSAR");
                    })}
                    {!["SUMULA", "CORRECAO"].includes(p.tipo) &&
                      button("Sugerir alteração", () => {
                        setEditing(p);
                        setDate(
                          p.dados.data?.split("-").reverse().join("/") || "",
                        );
                        setTime(p.dados.horario || "");
                        setLocal(p.dados.local || "");
                      })}
                  </>
                )}
                {p.origem_id === clubId &&
                  button("Cancelar proposta", () =>
                    Alert.alert(
                      "Cancelar proposta?",
                      "O outro clube será informado.",
                      [
                        { text: "Voltar", style: "cancel" },
                        {
                          text: "Cancelar proposta",
                          onPress: () => {
                            void respond(p, "CANCELAR");
                          },
                        },
                      ],
                    ),
                  )}
                {p.respondente_id !== clubId && (
                  <Text style={[styles.detailText, muted]}>
                    Aguardando a resposta do outro clube.
                  </Text>
                )}
              </View>
            )}
            {!!p.partida_id &&
              button("Abrir partida", () =>
                router.push(`/partida-compartilhada/${p.partida_id}` as never),
              )}
          </View>
        ))}
      </ScrollView>
      {filtrosAbertos && (
        <FiltrosSolicitacoes
          todas={all}
          direcao={direcao}
          pendentes={items.filter((p) => p.status === "PENDENTE").length}
          paraResponder={pendentesParaMim}
          onFechar={() => setFiltrosAbertos(false)}
          onAplicar={(todas, direcao) => {
            setAll(todas);
            setDirecao(direcao);
            setFiltrosAbertos(false);
          }}
        />
      )}
      <Modal
        visible={!!editing}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!busy) setEditing(null);
        }}
      >
        <View style={styles.overlay}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[
              styles.content,
              { backgroundColor: colors.card },
            ]}
          >
            <Text style={[text, styles.title]}>Sugerir outra data</Text>
            {[
              ["Data · DD/MM/AAAA", date, setDate],
              ["Horário · HH:MM", time, setTime],
              ["Local", local, setLocal],
            ].map(([label, value, change]) => (
              <TextInput
                key={String(label)}
                accessibilityLabel={String(label)}
                placeholder={String(label)}
                placeholderTextColor={colors.textoSecundario}
                value={String(value)}
                onChangeText={change as (v: string) => void}
                style={[
                  styles.input,
                  text,
                  { borderColor: colors.borda, backgroundColor: colors.fundo },
                ]}
              />
            ))}
            {!!error && (
              <Text
                accessibilityRole="alert"
                style={{ color: colors.tituloErro }}
              >
                {error}
              </Text>
            )}
            {button(
              "Enviar sugestão",
              () => {
                if (editing)
                  void respond(editing, "SUGERIR", {
                    data: date.split("/").reverse().join("-"),
                    horario: time,
                    local,
                  });
              },
              true,
            )}
            {button("Voltar", () => setEditing(null))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  filterButton: {
    width: 46,
    height: 46,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 17,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { color: "#fff", fontSize: 10, fontWeight: "600" },
  cardHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  kind: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    minWidth: 0,
  },
  kindText: { fontSize: 11, lineHeight: 16, flexShrink: 1 },
  status: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: 5,
  },
  statusText: { fontSize: 10, fontWeight: "600" },
  dot: { width: 5, height: 5, borderRadius: 3 },
  match: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  club: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  crest: {
    width: 34,
    height: 36,
    borderRadius: 7,
    padding: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  crestImage: { width: "100%", height: "100%" },
  crestInitial: { fontSize: 17, fontWeight: "600" },
  clubName: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },
  versus: { fontSize: 14 },
  metadata: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 12,
    rowGap: 7,
  },
  detail: { flexDirection: "row", alignItems: "center", gap: 6 },
  detailText: { fontSize: 12, lineHeight: 18 },
  shrink: { flexShrink: 1 },
  actionText: { fontSize: 12, fontWeight: "600" },
  listHeading: { gap: 6, paddingBottom: 4 },
  listCount: { fontSize: 14, fontWeight: "600" },
  listSummary: { fontSize: 12, lineHeight: 18 },
  title: { fontSize: 17, fontWeight: "600", flexShrink: 1 },
  content: { padding: 16, gap: 14, flexGrow: 1 },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 48,
    gap: 12,
  },
  emptyTitle: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  emptyDescription: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    maxWidth: 300,
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    alignItems: "center",
  },
  button: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
  },
  card: { padding: 16, borderRadius: 9, borderWidth: 1, gap: 12 },
  input: { minHeight: 46, borderWidth: 1, borderRadius: 8, padding: 12 },
  overlay: {
    flex: 1,
    backgroundColor: "#0008",
    justifyContent: "flex-end",
    paddingTop: "35%",
  },
});
