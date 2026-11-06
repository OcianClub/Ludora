import { IconButton } from "@/src/components/ui/Controls";
import { useRouter } from "expo-router";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Modal,
  useWindowDimensions,
  PanResponder,
  Pressable,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon, type IconName } from "@ludora/icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";
import { useNotificacoes } from "@/src/contexts/NotificacoesContext";
import { useTheme } from "@/src/contexts/ThemeContext";
import {
  excluirNotificacao,
  fetchNotificacoes,
  limparNotificacoes,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
  type Notificacao,
} from "@/src/services/api";
import { createStyles } from "@/src/styles/notificacoesStyles";
import { criarEscopoNotificacoes } from "@/src/utils/escopoNotificacoes";

function grupoData(data: string) {
  const dia = new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (dia.toDateString() === hoje.toDateString()) return "Hoje";
  if (dia.toDateString() === ontem.toDateString()) return "Ontem";
  const inicioSemana = new Date(
    hoje.getFullYear(),
    hoje.getMonth(),
    hoje.getDate() - ((hoje.getDay() + 6) % 7),
  );
  const semanaPassada = new Date(inicioSemana);
  semanaPassada.setDate(inicioSemana.getDate() - 7);
  if (dia >= inicioSemana) return "Esta semana";
  if (dia >= semanaPassada) return "Semana passada";
  return "Mais antigas";
}

const tipos: Record<Notificacao["tipo"], { icone: IconName; nome: string }> = {
  PARTIDA_AGENDADA: { icone: "calendar-outline", nome: "Agenda" },
  GOL_PARTIDA: { icone: "soccer", nome: "Gol" },
  RESULTADO_PARTIDA: { icone: "trophy", nome: "Resultado" },
};

const formatarHora = new Intl.DateTimeFormat("pt-BR", {
  hour: "2-digit",
  minute: "2-digit",
});
const formatarDia = new Intl.DateTimeFormat("pt-BR", {
  day: "numeric",
  month: "short",
});

const tipoNotificacao = (item: Notificacao) =>
  item.dados?.solicitacaoId ? "solicitacao" : item.tipo;
const filtrosTipo = [
  { id: "todos", label: "Todos os tipos" },
  ...Object.entries(tipos).map(([id, tipo]) => ({ id, label: tipo.nome })),
  { id: "solicitacao", label: "Solicitação" },
];

const CartaoNotificacao = memo(function CartaoNotificacao({
  item,
  ocupado,
  onLer,
  onExcluir,
}: {
  item: Notificacao;
  ocupado: boolean;
  onLer: (item: Notificacao) => void;
  onExcluir: (item: Notificacao) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deslocamento = useRef(new Animated.Value(0)).current;
  const acoes = useRef({ ocupado, onExcluir, item });
  acoes.current = { ocupado, onExcluir, item };
  const voltar = () =>
    Animated.spring(deslocamento, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  const gesto = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !acoes.current.ocupado && dx < -14 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderMove: (_, { dx }) =>
        deslocamento.setValue(Math.max(-140, Math.min(0, dx))),
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -100 && !acoes.current.ocupado)
          acoes.current.onExcluir(acoes.current.item);
        voltar();
      },
      onPanResponderTerminate: voltar,
    }),
  ).current;
  const tipo =
    tipoNotificacao(item) === "solicitacao"
      ? { icone: "email-outline" as const, nome: "Solicitação" }
      : tipos[item.tipo];
  const data = new Date(item.criada_em);
  return (
    <View style={styles.swipeContainer}>
      <View
        style={styles.swipeBackground}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="trash" size={23} color={colors.tituloErro} />
        <Text style={styles.swipeText}>Excluir</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX: deslocamento }] }}
        {...gesto.panHandlers}
      >
        <View
          style={[
            styles.notificationCard,
            !item.lida && styles.notificationCardUnread,
          ]}
        >
          <TouchableOpacity
            style={styles.cardMain}
            onPress={() => onLer(item)}
            disabled={
              ocupado ||
              (item.lida && !item.dados?.solicitacaoId && !item.partida_id)
            }
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${item.lida ? "Lida" : "Não lida"}. ${item.titulo}. ${item.corpo}`}
            accessibilityHint="Toque para marcar como lida"
          >
            <View style={styles.notificationIcon}>
              <Icon name={tipo.icone} size={18} color={colors.texto} />
            </View>
            <View style={styles.notificationContent}>
              <View style={styles.notificationTopLine}>
                {!item.lida && <View style={styles.unreadDot} />}
                <Text style={styles.typeText}>{tipo.nome}</Text>
                <Text style={styles.notificationTime}>
                  {grupoData(item.criada_em) !== "Hoje" &&
                  grupoData(item.criada_em) !== "Ontem"
                    ? formatarDia.format(data).replace(".", "") + " · "
                    : ""}
                  {formatarHora.format(data)}
                </Text>
              </View>
              <Text style={styles.notificationTitle}>{item.titulo}</Text>
              <Text style={styles.notificationBody}>{item.corpo}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onExcluir(item)}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={`Excluir notificação: ${item.titulo}`}
          >
            {ocupado ? (
              <ActivityIndicator size="small" color={colors.textoSecundario} />
            ) : (
              <Icon name="trash" size={19} color={colors.textoSecundario} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
});

export default function Notificacoes() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const seletorTipos = useRef<View>(null);
  const [ancoraTipos, setAncoraTipos] = useState({ x: 16, y: 0, width: 168 });
  function abrirTipos() {
    seletorTipos.current?.measureInWindow((x, y, largura, altura) => {
      setAncoraTipos({ x, y: y + altura + 6, width: Math.max(168, largura) });
      setPainel("tipos");
    });
  }
  useEffect(() => setPainel(null), [width, height]);
  const [tipoAtivo, setTipoAtivo] = useState("todos");
  const [painel, setPainel] = useState<"opcoes" | "tipos" | null>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { clubeAtivo } = useClubeAtivo();
  const { atualizarNaoLidas, versaoNotificacoes } = useNotificacoes();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState<number[]>([]);
  const pendentes = useRef(new Set<number>());
  const requisicao = useRef(0);
  const [filtro, setFiltro] = useState<"todas" | "naoLidas">("todas");
  const [erro, setErro] = useState("");
  const escopo = useRef(criarEscopoNotificacoes()).current;
  escopo.definirClube(clubeAtivo?.papel ? clubeAtivo.id : null);

  const carregar = useCallback(
    async (refresh = false) => {
      const atual = ++requisicao.current;
      if (!clubeAtivo?.papel) {
        setNotificacoes([]);
        setTotalNaoLidas(0);
        setCarregando(false);
        return;
      }
      if (refresh) setAtualizando(true);
      setErro("");
      try {
        const resposta = await fetchNotificacoes(100, clubeAtivo.id);
        if (atual !== requisicao.current) return;
        setNotificacoes(
          resposta.notificacoes.filter(
            (item) => !pendentes.current.has(item.id),
          ),
        );
        setTotalNaoLidas(resposta.totalNaoLidas);
      } catch {
        if (atual === requisicao.current)
          setErro("Não foi possível atualizar os avisos. Tente novamente.");
      } finally {
        if (atual === requisicao.current) {
          setCarregando(false);
          setAtualizando(false);
        }
      }
    },
    [clubeAtivo?.id, clubeAtivo?.papel],
  );

  useEffect(() => {
    setNotificacoes([]);
    setTotalNaoLidas(0);
    setCarregando(true);
    setOcupado(false);
    setExcluindo([]);
    pendentes.current.clear();
    return () => {
      requisicao.current += 1;
    };
  }, [clubeAtivo?.id, clubeAtivo?.papel]);
  useEffect(
    () => () => {
      escopo.definirClube(null);
    },
    [escopo],
  );
  useEffect(() => {
    void carregar();
  }, [carregar, versaoNotificacoes]);

  const atualizar = async () => {
    const contexto = escopo.capturar();
    await carregar();
    if (contexto.atual()) void atualizarNaoLidas().catch(() => undefined);
  };

  const ler = async (item: Notificacao) => {
    if (ocupado || pendentes.current.has(item.id)) return;
    if (item.dados?.solicitacaoId)
      router.push("/solicitacoes-partidas" as never);
    else if (item.partida_id)
      router.push(`/partida-compartilhada/${item.partida_id}` as never);
    if (item.lida) return;
    const operacao = escopo.iniciar();
    if (!operacao) return;
    if (operacao.clubeId !== clubeAtivo?.id) {
      operacao.concluir();
      return;
    }
    setOcupado(true);
    try {
      await marcarNotificacaoComoLida(item.id, operacao.clubeId);
      if (operacao.atual()) await atualizar();
    } catch {
      if (operacao.atual())
        setErro(
          "Não foi possível marcar o aviso como lido. Atualize para conferir o estado salvo.",
        );
    } finally {
      if (operacao.concluir()) setOcupado(false);
    }
  };

  const excluir = async (item: Notificacao) => {
    if (ocupado || pendentes.current.has(item.id)) return;
    const operacao = escopo.iniciar();
    if (!operacao) return;
    if (operacao.clubeId !== clubeAtivo?.id) {
      operacao.concluir();
      return;
    }
    pendentes.current.add(item.id);
    setExcluindo([...pendentes.current]);
    setOcupado(true);
    try {
      await excluirNotificacao(item.id, operacao.clubeId);
      if (!operacao.atual()) return;
      setNotificacoes((atuais) =>
        atuais.filter((aviso) => aviso.id !== item.id),
      );
      await atualizar();
    } catch {
      if (operacao.atual())
        setErro(
          "Não foi possível confirmar a exclusão. Atualize para conferir o estado salvo.",
        );
    } finally {
      if (operacao.concluir()) {
        pendentes.current.delete(item.id);
        setExcluindo([...pendentes.current]);
        setOcupado(false);
      }
    }
  };

  const acaoEmLote = async (
    acao: "ler" | "excluir-lidas" | "excluir-todas",
    clubeEsperado = clubeAtivo?.id,
  ) => {
    if (ocupado || pendentes.current.size) return;
    const operacao = escopo.iniciar();
    if (!operacao) return;
    if (operacao.clubeId !== clubeEsperado) {
      operacao.concluir();
      return;
    }
    setOcupado(true);
    try {
      if (acao === "ler")
        await marcarTodasNotificacoesComoLidas(operacao.clubeId);
      else await limparNotificacoes(operacao.clubeId, acao === "excluir-lidas");
      if (operacao.atual()) await atualizar();
    } catch {
      if (operacao.atual())
        setErro(
          "Não foi possível confirmar a ação. Atualize para conferir o estado salvo.",
        );
    } finally {
      if (operacao.concluir()) setOcupado(false);
    }
  };

  const acoesCartao = useRef({ ler, excluir });
  acoesCartao.current = { ler, excluir };
  const lerCartao = useCallback((item: Notificacao) => {
    void acoesCartao.current.ler(item);
  }, []);
  const excluirCartao = useCallback((item: Notificacao) => {
    void acoesCartao.current.excluir(item);
  }, []);

  const visiveis = useMemo(
    () =>
      notificacoes.filter(
        (item) =>
          (filtro === "todas" || !item.lida) &&
          (tipoAtivo === "todos" || tipoNotificacao(item) === tipoAtivo),
      ),
    [notificacoes, filtro, tipoAtivo],
  );
  const bloqueado = ocupado || excluindo.length > 0;
  const possuiLidas = notificacoes.some((item) => item.lida);
  const confirmarLimpeza = (todas = false) => {
    setPainel(null);
    const contexto = escopo.capturar();
    Alert.alert(
      todas ? "Excluir todas as notificações?" : "Limpar avisos lidos?",
      todas
        ? "Todos os avisos deste clube serão excluídos do seu histórico, incluindo os não lidos."
        : "Os avisos já lidos deste clube serão excluídos do seu histórico. Os não lidos serão mantidos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: todas ? "Excluir todas" : "Limpar lidas",
          style: "destructive",
          onPress: () => {
            if (contexto.atual())
              void acaoEmLote(
                todas ? "excluir-todas" : "excluir-lidas",
                clubeAtivo?.id,
              );
          },
        },
      ],
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <IconButton
          icon="arrow-left"
          label="Voltar"
          variant="filled"
          onPress={() =>
            router.canGoBack() ? router.back() : router.navigate("/")
          }
        />
        <Text style={styles.headerTitle} accessibilityRole="header">
          Notificações
        </Text>
        <TouchableOpacity
          style={styles.headerAction}
          accessibilityRole="button"
          accessibilityLabel="Mais opções"
          accessibilityState={{ expanded: painel === "opcoes" }}
          onPress={() => setPainel(painel === "opcoes" ? null : "opcoes")}
        >
          <Icon
            name="dots-horizontal"
            size={21}
            color={colors.textoSecundario}
          />
        </TouchableOpacity>
      </View>
      {carregando ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primaria} />
        </View>
      ) : (
        <FlatList
          data={visiveis}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={6}
          windowSize={5}
          onScrollBeginDrag={() => setPainel(null)}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void carregar(true)}
              tintColor={colors.primaria}
              colors={[colors.primaria]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.clubName}>
                {clubeAtivo?.nome
                  ? `Avisos do ${clubeAtivo.nome}`
                  : "Avisos do clube"}
              </Text>
              <View style={styles.filterRow}>
                <View style={styles.filters}>
                  {(["todas", "naoLidas"] as const).map((valor) => (
                    <TouchableOpacity
                      key={valor}
                      style={[
                        styles.filterButton,
                        filtro === valor && styles.filterActive,
                      ]}
                      onPress={() => setFiltro(valor)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: filtro === valor }}
                    >
                      <Text
                        style={[
                          styles.filterText,
                          filtro === valor && styles.filterTextActive,
                        ]}
                      >
                        {valor === "todas" ? "Todas" : "Não lidas"}
                      </Text>
                      {valor === "naoLidas" && totalNaoLidas > 0 && (
                        <Text style={styles.count}>{totalNaoLidas}</Text>
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  ref={seletorTipos}
                  collapsable={false}
                  style={styles.typeAnchor}
                >
                  <TouchableOpacity
                    style={styles.typeTrigger}
                    accessibilityRole="button"
                    accessibilityLabel={`Tipo de notificação: ${filtrosTipo.find((tipo) => tipo.id === tipoAtivo)?.label}`}
                    accessibilityState={{ expanded: painel === "tipos" }}
                    onPress={abrirTipos}
                  >
                    <Text style={styles.typeTriggerText} numberOfLines={1}>
                      {filtrosTipo.find((tipo) => tipo.id === tipoAtivo)?.label}
                    </Text>
                    <View style={styles.chevron}>
                      <Icon
                        name="chevron-down"
                        size={15}
                        color={colors.textoSecundario}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              </View>
              {notificacoes.length > 0 && (
                <>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      disabled={bloqueado || !totalNaoLidas}
                      onPress={() => void acaoEmLote("ler")}
                      accessibilityRole="button"
                    >
                      <Icon
                        name="check-all"
                        size={18}
                        color={
                          totalNaoLidas && !bloqueado
                            ? colors.primaria
                            : colors.textoSecundario
                        }
                      />
                      <Text
                        style={[
                          styles.actionText,
                          (!totalNaoLidas || bloqueado) && styles.disabledText,
                        ]}
                      >
                        Ler todas
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        (!possuiLidas || bloqueado) && styles.disabledAction,
                      ]}
                      disabled={bloqueado || !possuiLidas}
                      onPress={() => confirmarLimpeza()}
                      accessibilityRole="button"
                    >
                      <Icon
                        name="trash"
                        size={17}
                        color={colors.textoSecundario}
                      />
                      <Text style={styles.secondaryActionText}>
                        Limpar lidas
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {!!erro && (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Text style={styles.errorText}>{erro}</Text>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => void carregar(true)}
                  >
                    <Text style={styles.actionText}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="bell-outline" size={30} color={colors.primaria} />
              </View>
              <Text style={styles.emptyTitle}>
                {erro
                  ? "Não conseguimos carregar"
                  : tipoAtivo !== "todos"
                    ? "Nenhum aviso com este filtro"
                    : filtro === "naoLidas"
                      ? "Tudo lido por aqui"
                      : "Nenhum aviso por enquanto"}
              </Text>
              <Text style={styles.emptyText}>
                {erro
                  ? "Confira sua conexão e tente novamente."
                  : tipoAtivo !== "todos"
                    ? "Selecione outro tipo para ver mais avisos."
                    : filtro === "naoLidas"
                      ? "Seus avisos anteriores continuam na aba Todas."
                      : "Novas partidas, gols e resultados do clube aparecerão aqui."}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <>
              {(index === 0 ||
                grupoData(item.criada_em) !==
                  grupoData(visiveis[index - 1].criada_em)) && (
                <Text style={styles.dateTitle}>
                  {grupoData(item.criada_em)}
                </Text>
              )}
              <CartaoNotificacao
                item={item}
                ocupado={ocupado || excluindo.includes(item.id)}
                onLer={lerCartao}
                onExcluir={excluirCartao}
              />
            </>
          )}
          ListFooterComponent={
            notificacoes.length >= 100 ? (
              <Text style={styles.hint}>
                Exibindo os 100 avisos mais recentes.
              </Text>
            ) : null
          }
        />
      )}
      <Modal
        visible={painel === "tipos"}
        transparent
        statusBarTranslucent
        animationType="fade"
        onRequestClose={() => setPainel(null)}
      >
        <View style={styles.menuOverlay}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setPainel(null)}
            accessibilityRole="button"
            accessibilityLabel="Fechar tipos de notificação"
          />
          <View
            style={[
              styles.typeOptions,
              {
                width: Math.min(ancoraTipos.width, width - 32),
                left: Math.max(
                  16,
                  Math.min(ancoraTipos.x, width - ancoraTipos.width - 16),
                ),
                top: Math.max(
                  insets.top + 8,
                  Math.min(
                    ancoraTipos.y,
                    height - insets.bottom - filtrosTipo.length * 42 - 18,
                  ),
                ),
              },
            ]}
            accessibilityViewIsModal
            accessibilityRole="radiogroup"
            accessibilityLabel="Tipos de notificação"
          >
            {filtrosTipo.map((tipo) => (
              <TouchableOpacity
                key={tipo.id}
                style={[
                  styles.typeOption,
                  tipoAtivo === tipo.id && styles.typeOptionSelected,
                ]}
                accessibilityRole="radio"
                accessibilityLabel={tipo.label}
                accessibilityState={{ checked: tipoAtivo === tipo.id }}
                aria-checked={tipoAtivo === tipo.id}
                onPress={() => {
                  setTipoAtivo(tipo.id);
                  setPainel(null);
                }}
              >
                <Text style={styles.menuActionText}>{tipo.label}</Text>
                {tipoAtivo === tipo.id && (
                  <Icon name="check" size={16} color={colors.primaria} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>
      {painel === "opcoes" && (
        <View style={styles.menuOverlay}>
          <Pressable
            style={styles.menuBackdrop}
            onPress={() => setPainel(null)}
            accessible={false}
            importantForAccessibility="no"
          />
          <View
            style={[
              styles.options,
              styles.floatingOptions,
              { top: insets.top + 62 },
            ]}
            accessibilityViewIsModal
          >
            <TouchableOpacity
              style={[
                styles.actionButton,
                !possuiLidas && styles.disabledAction,
              ]}
              accessibilityRole="button"
              disabled={bloqueado || !possuiLidas}
              onPress={() => confirmarLimpeza()}
            >
              <Icon
                name="clipboard-text-outline"
                size={17}
                color={colors.texto}
              />
              <Text style={styles.menuActionText}>Excluir avisos lidos</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionButton,
                notificacoes.length === 0 && styles.disabledAction,
              ]}
              accessibilityRole="button"
              disabled={bloqueado || notificacoes.length === 0}
              onPress={() => confirmarLimpeza(true)}
            >
              <Icon name="trash" size={17} color={colors.tituloErro} />
              <Text style={[styles.menuActionText, styles.menuDangerText]}>
                Excluir todas as notificações
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}
