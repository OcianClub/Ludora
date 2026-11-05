import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Icon, type IconName } from "@ludora/icons";
import { useTheme } from "../contexts/ThemeContext";
import {
  requisicaoPartida,
  type EquipePartida,
  type EventoPartida,
  type GestaoPartida,
} from "../services/partidasCompartilhadas";
import {
  criarFilaPublicacao,
  ATRASO_PUBLICACAO,
  type ItemPublicacao,
} from "../utils/filaPublicacao";
import {
  descreverAlteracao,
  disciplinaTempo,
  estatisticasJogador,
  eventosSemJogador,
  mensagemResultado,
  NOMES_EVENTOS,
  placaresEventos,
  timeAutor,
  type TipoEvento,
} from "../utils/sumulaPartida";
import { createStyles } from "../styles/sumulaPartidaStyles";
import { PositionLabel } from "./PositionIcon";
import SubstituicaoPartida from "./SubstituicaoPartida";

type Styles = ReturnType<typeof createStyles>;
type Acao = {
  endpoint: string;
  payload: Record<string, unknown>;
  method: string;
  titulo: string;
  tipo: string;
};
type Form = {
  tipo: TipoEvento;
  timeId: number;
  jogadorId?: number;
  contra: boolean;
  existente?: EventoPartida;
};
type Dialogo =
  | "evento"
  | "remover"
  | "encerrar"
  | "substituir"
  | "responsavel"
  | "compartilhar"
  | "placar"
  | "solicitar"
  | "tempo"
  | null;
type Props = {
  data: GestaoPartida;
  clubeId: number;
  connected: boolean;
  onBack: () => void;
  onRefresh: () => Promise<GestaoPartida | undefined>;
};

function Escudo({
  time,
  styles,
}: {
  time: { nome: string; escudo?: string | null };
  styles: Styles;
}) {
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [time.escudo]);
  return (
    <View style={styles.crest}>
      {time.escudo && !falhou ? (
        <Image
          accessibilityLabel={`Escudo do ${time.nome}`}
          source={{ uri: time.escudo }}
          style={styles.crestImage}
          resizeMode="contain"
          onError={() => setFalhou(true)}
        />
      ) : (
        <Text style={styles.crestInitial}>
          {time.nome.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}
function EventoIcon({ tipo, size = 20 }: { tipo: string; size?: number }) {
  const { colors } = useTheme();
  const cor =
    tipo === "CARTAO_AMARELO"
      ? colors.amarelo
      : tipo === "CARTAO_VERMELHO"
        ? colors.vermelho
        : colors.primaria;
  if (tipo.startsWith("CARTAO_"))
    return (
      <View
        accessibilityLabel={NOMES_EVENTOS[tipo]}
        style={{
          width: size * 0.6,
          height: size,
          borderRadius: 3,
          backgroundColor: cor,
        }}
      />
    );
  const icon: IconName =
    tipo === "GOL"
      ? "ball"
      : tipo === "FALTA"
        ? "whistle"
        : tipo === "DEFESA"
          ? "shield-check"
          : tipo === "ASSISTENCIA"
            ? "cleat"
            : "swap-horizontal";
  return <Icon name={icon} size={size} color={colors.texto} />;
}
function Publicacao({
  item,
  cancelar,
  tentar,
  styles,
}: {
  item: ItemPublicacao<Acao>;
  cancelar: () => void;
  tentar: () => void;
  styles: Styles;
}) {
  const { colors } = useTheme();
  const progresso = useRef(
    new Animated.Value(
      Math.max(0, (item.enviarEm - Date.now()) / ATRASO_PUBLICACAO),
    ),
  ).current;
  const [segundos, setSegundos] = useState(
    Math.max(0, Math.ceil((item.enviarEm - Date.now()) / 1000)),
  );
  useEffect(() => {
    const restante = Math.max(0, item.enviarEm - Date.now());
    progresso.setValue(restante / ATRASO_PUBLICACAO);
    const animacao = Animated.timing(progresso, {
      toValue: 0,
      duration: restante,
      useNativeDriver: true,
    });
    if (item.status === "aguardando") animacao.start();
    const timer = setInterval(
      () =>
        setSegundos(
          Math.max(0, Math.ceil((item.enviarEm - Date.now()) / 1000)),
        ),
      200,
    );
    return () => {
      animacao.stop();
      clearInterval(timer);
    };
  }, [item.enviarEm, item.status, progresso]);
  return (
    <View style={styles.toast} accessibilityLiveRegion="polite">
      <EventoIcon tipo={item.dados.tipo} size={19} />
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {item.dados.titulo}
        </Text>
        <Text
          style={[
            styles.tiny,
            {
              color:
                item.status === "erro"
                  ? colors.tituloErro
                  : colors.textoSecundario,
            },
          ]}
        >
          {item.status === "enviando"
            ? "Publicando…"
            : item.status === "erro"
              ? item.erro
              : `Aguardando publicação · ${segundos}s`}
        </Text>
        {item.status === "aguardando" && (
          <View style={styles.progressTrack}>
            <Animated.View
              style={[
                styles.progress,
                { transformOrigin: "left", transform: [{ scaleX: progresso }] },
              ]}
            />
          </View>
        )}
      </View>
      {item.status === "erro" && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Tentar publicar ${item.dados.titulo}`}
          onPress={tentar}
        >
          <Text style={styles.link}>Tentar</Text>
        </TouchableOpacity>
      )}
      {item.status !== "enviando" && (
        <TouchableOpacity
          style={{ paddingVertical: 9, paddingHorizontal: 5 }}
          accessibilityRole="button"
          accessibilityLabel={`Cancelar ${item.dados.titulo}`}
          onPress={cancelar}
        >
          <Text style={styles.text}>Cancelar</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SumulaPartida({
  data,
  clubeId,
  connected,
  onBack,
  onRefresh,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const p = data.partida,
    aoVivo = p.status === "AO_VIVO",
    finalizada = p.status === "FINALIZADA";
  const minha = data.equipes.find((e) => e.id === data.minhaEquipeId);
  const podeOperar = aoVivo
    ? data.podeSumula
    : finalizada && (data.podeSumula || data.podeCorrigir === true);
  const responsavel =
    data.equipes.find((e) => e.clube_id === p.sumula_clube_id)?.clube.nome ||
    data.organizador.nome;
  const times = [
    { ...p.mandante, id: p.mandante_id },
    { ...p.visitante, id: p.visitante_id },
  ];
  const [dialogo, setDialogo] = useState<Dialogo>(null),
    [form, setForm] = useState<Form | null>(null);
  const [remover, setRemover] = useState<EventoPartida | null>(null),
    [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState(""),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const [feedback, setFeedback] = useState(""),
    [pendentes, setPendentes] = useState<ItemPublicacao<Acao>[]>([]);
  const [menu, setMenu] = useState<{
    top: number;
    evento?: EventoPartida;
  } | null>(null);
  const [auditoriaAberta, setAuditoriaAberta] = useState(true);
  const [equipeAtiva, setEquipeAtiva] = useState<number | null>(null);
  const [tempoSelecionado, setTempoSelecionado] = useState(0);
  const [sai, setSai] = useState<number>(),
    [entra, setEntra] = useState<number>();
  const [placarCasa, setPlacarCasa] = useState(""),
    [placarFora, setPlacarFora] = useState("");
  const [incluirNomes, setIncluirNomes] = useState(false),
    [verMensagem, setVerMensagem] = useState(false);
  const ultimo = useRef(data),
    refreshAtual = useRef(onRefresh),
    montado = useRef(true),
    operando = useRef(false);
  if (data.partida.versao >= ultimo.current.partida.versao)
    ultimo.current = data;
  refreshAtual.current = onRefresh;
  const fila = useMemo(
    () =>
      criarFilaPublicacao<Acao>({
        atualizar: setPendentes,
        executar: async (item) => {
          const atual = ultimo.current;
          if (!["AO_VIVO", "FINALIZADA"].includes(atual.partida.status))
            throw new Error("A situação da partida mudou. Atualize a súmula.");
          if (
            atual.partida.status === "FINALIZADA" &&
            !String(item.dados.payload.motivo || "").trim()
          )
            throw new Error(
              "A partida foi encerrada. Cancele este envio e registre a correção com justificativa.",
            );
          try {
            await requisicaoPartida(
              item.dados.endpoint,
              clubeId,
              {
                ...item.dados.payload,
                versao: atual.partida.versao,
                request_id: item.id,
              },
              item.dados.method,
            );
          } catch (e) {
            const recente = await refreshAtual.current().catch(() => undefined);
            if (recente) ultimo.current = recente;
            throw e;
          }
          try {
            const recente = await refreshAtual.current();
            if (recente) ultimo.current = recente;
          } catch {
            if (montado.current)
              setFeedback(
                "Registro salvo. Atualize a tela para consultar a súmula mais recente.",
              );
          }
        },
      }),
    [clubeId, p.id],
  );
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      fila.encerrar();
    };
  }, [fila]);
  useEffect(() => {
    if (!feedback) return;
    const timer = setTimeout(() => setFeedback(""), 5000);
    return () => clearTimeout(timer);
  }, [feedback]);
  const sairAtual = useRef(() => {});
  sairAtual.current = () => {
    if (fila.pendentes().length) {
      Alert.alert(
        "Lançamentos aguardando publicação",
        "Aguarde o envio ou cancele os lançamentos antes de sair.",
        [
          { text: "Continuar aqui", style: "cancel" },
          ...(fila.pendentes().some((i) => i.status === "enviando")
            ? []
            : [
                {
                  text: "Cancelar e sair",
                  style: "destructive" as const,
                  onPress: () => {
                    fila.encerrar();
                    onBack();
                  },
                },
              ]),
        ],
      );
    } else onBack();
  };
  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      sairAtual.current();
      return true;
    });
    return () => listener.remove();
  }, []);

  const alterando = ocupado || pendentes.length > 0;
  const tempo = aoVivo
    ? data.podeSumula
      ? p.periodo_atual
      : Math.min(tempoSelecionado || p.periodo_atual, p.periodo_atual)
    : tempoSelecionado;
  const consultandoTempo =
    aoVivo && !data.podeSumula && tempo !== p.periodo_atual;
  const scrollDialogo = useRef<ScrollView>(null);
  const [arrastandoSubstituicao, setArrastandoSubstituicao] = useState(false);
  const totalTempos = Math.max(
    /(?:16|18)/.test(p.categoria.nome) ? 2 : 4,
    p.periodo_atual,
    ...data.eventos.map((e) => e.periodo),
  );
  const eventos = useMemo(
    () =>
      data.eventos
        .filter((e) => !tempo || e.periodo === tempo)
        .sort((a, b) => b.id - a.id),
    [data.eventos, tempo],
  );
  const placares = useMemo(
    () => placaresEventos(data),
    [data.eventos, p.gols_mandante, p.gols_visitante],
  );
  const semJogador = eventosSemJogador(data);
  const equipeVisivel =
    data.equipes.find((e) => e.time_id === equipeAtiva) ||
    minha ||
    data.equipes[0];
  const atorTime = form
    ? timeAutor(data, { time_id: form.timeId, gol_contra: form.contra })
    : undefined;
  const equipeAutor = data.equipes.find((e) => e.time_id === atorTime);
  const nomeTime = (id?: number | null) =>
    times.find((t) => t.id === id)?.nome || "Equipe";
  const roster = [...(equipeAutor?.escalacao || [])]
    .sort(
      (a, b) =>
        Number(b.titular) - Number(a.titular) || a.numCamisa - b.numCamisa,
    )
    .filter(
      (j) =>
        (finalizada || form?.existente || j.titular) &&
        `${j.numCamisa} ${j.jogador?.nome}`
          .toLocaleLowerCase("pt-BR")
          .includes(busca.trim().toLocaleLowerCase("pt-BR")),
    );
  const vencedor =
    p.gols_mandante === p.gols_visitante
      ? null
      : p.gols_mandante > p.gols_visitante
        ? p.mandante_id
        : p.visitante_id;
  const link = `${(process.env.EXPO_PUBLIC_WEB_URL || "https://ludora-nine.vercel.app").replace(/\/$/, "")}/partidas/${p.id}`;
  const mensagem = mensagemResultado(data, incluirNomes, link);

  async function executar(
    endpoint: string,
    payload: object,
    method = "POST",
    sucesso?: () => void,
  ) {
    if (operando.current || fila.pendentes().length) return;
    operando.current = true;
    setOcupado(true);
    setErro("");
    try {
      await requisicaoPartida(
        `/partidas/${p.id}/${endpoint}`,
        clubeId,
        { ...payload, versao: ultimo.current.partida.versao },
        method,
      );
      try {
        const recente = await onRefresh();
        if (recente) ultimo.current = recente;
      } catch {
        setFeedback(
          "Alteração salva. Atualize a súmula para consultar os dados mais recentes.",
        );
      }
      sucesso?.();
    } catch (e) {
      setErro((e as Error).message);
      await onRefresh().catch(() => undefined);
    } finally {
      operando.current = false;
      if (montado.current) setOcupado(false);
    }
  }
  function abrir(dialog: Dialogo) {
    setErro("");
    setMotivo("");
    setMenu(null);
    setDialogo(dialog);
  }
  function abrirEvento(
    tipo: TipoEvento,
    timeId = minha?.time_id || p.mandante_id,
    existente?: EventoPartida,
  ) {
    setBusca("");
    setForm({
      tipo,
      timeId,
      jogadorId: existente?.jogador_id || undefined,
      contra: existente?.gol_contra || false,
      existente,
    });
    abrir("evento");
    if (
      !existente &&
      tipo === "GOL" &&
      !data.equipes.some((e) => e.time_id === timeId) &&
      aoVivo
    ) {
      setDialogo(null);
      enfileirar(
        "eventos",
        { tipo, time_id: timeId, periodo: p.periodo_atual },
        `${NOMES_EVENTOS[tipo]} · ${nomeTime(timeId)}`,
        tipo,
      );
    }
  }
  function enfileirar(
    endpoint: string,
    payload: Record<string, unknown>,
    titulo: string,
    tipo: string,
    method = "POST",
  ) {
    const caminho = endpoint.startsWith("/")
      ? endpoint
      : `/partidas/${p.id}/${endpoint}`;
    fila.adicionar({ endpoint: caminho, payload, method, titulo, tipo });
    setDialogo(null);
    setErro("");
  }
  function registrar(identificarDepois = false) {
    if (!form) return;
    if (finalizada && !motivo.trim()) {
      setErro("Explique o motivo da correção após o encerramento.");
      return;
    }
    if (form.existente) {
      if (!form.jogadorId) {
        setErro("Escolha o jogador que realizou o lance.");
        return;
      }
      enfileirar(
        `eventos/${form.existente.id}`,
        { jogador_id: form.jogadorId, motivo: motivo.trim() },
        `Corrigir ${NOMES_EVENTOS[form.tipo].toLowerCase()} · ${nomeTime(form.timeId)}`,
        form.tipo,
        "PATCH",
      );
    } else {
      if (
        equipeAutor &&
        !form.jogadorId &&
        !identificarDepois &&
        !form.contra
      ) {
        setErro("Selecione um jogador ou escolha identificar depois.");
        return;
      }
      enfileirar(
        "eventos",
        {
          tipo: form.tipo,
          time_id: form.timeId,
          jogador_id: identificarDepois ? undefined : form.jogadorId,
          gol_contra: form.contra,
          autor_pendente: identificarDepois,
          periodo: finalizada
            ? tempoSelecionado || p.periodo_atual
            : p.periodo_atual,
          motivo: motivo.trim(),
        },
        `${NOMES_EVENTOS[form.tipo]}${form.contra ? " contra" : ""} · ${nomeTime(form.timeId)}`,
        form.tipo,
      );
    }
  }
  function pedirRemocao(e: EventoPartida) {
    setRemover(e);
    abrir("remover");
  }
  function subtrair(timeId: number) {
    const aguardando = [...pendentes]
      .reverse()
      .find(
        (i) =>
          i.status === "aguardando" &&
          i.dados.payload.tipo === "GOL" &&
          i.dados.payload.time_id === timeId,
      );
    if (aguardando) {
      fila.cancelar(aguardando.id);
      return;
    }
    const gol = [...data.eventos]
      .sort((a, b) => b.id - a.id)
      .find((e) => e.tipo === "GOL" && e.time_id === timeId);
    if (gol) pedirRemocao(gol);
    else {
      setPlacarCasa(String(p.gols_mandante));
      setPlacarFora(String(p.gols_visitante));
      abrir("placar");
    }
  }
  function mudarTempo(n: number) {
    if (!aoVivo) {
      setTempoSelecionado(n);
      return;
    }
    if (!data.podeSumula) {
      setTempoSelecionado(n >= p.periodo_atual ? 0 : Math.max(1, n));
      return;
    }
    if (alterando) return;
    if (n < p.periodo_atual) {
      setTempoSelecionado(n);
      abrir("tempo");
    } else void executar("periodo", { periodo: n }, "PATCH");
  }
  function button(
    label: string,
    press: () => void,
    primary = false,
    disabled = false,
    icon?: IconName,
  ) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || ocupado }}
        disabled={disabled || ocupado}
        onPress={press}
        style={[
          styles.button,
          primary && styles.primary,
          (disabled || ocupado) && styles.disabled,
        ]}
      >
        {icon && (
          <Icon
            name={icon}
            size={16}
            color={primary ? "#fff" : colors.textoSecundario}
          />
        )}
        <Text style={[styles.buttonText, primary && { color: "#fff" }]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }
  function jogadorLinha(j: EquipePartida["escalacao"][number]) {
    const stats = estatisticasJogador(
      data.eventos,
      j.jogador_id,
      (finalizada || consultandoTempo) && tempo ? tempo : undefined,
    );
    const extras = stats.vermelhos + stats.azuis + stats.defesas;
    return (
      <View
        key={j.jogador_id}
        style={styles.player}
        accessibilityLabel={`${j.jogador?.nome}. Camisa ${j.numCamisa}. ${stats.gols} gols, ${stats.assistencias} assistências, ${stats.faltas} faltas, ${stats.amarelos} amarelos, ${stats.vermelhos} vermelhos, ${stats.azuis} azuis, ${stats.defesas} defesas.`}
      >
        <View style={styles.shirt}>
          <Text style={styles.name}>
            {String(j.numCamisa).padStart(2, "0")}
          </Text>
        </View>
        <View style={styles.nameBlock}>
          <Text numberOfLines={1} ellipsizeMode="tail" style={styles.name}>
            {j.jogador?.nome || "Jogador"}
          </Text>
          <PositionLabel
            position={j.jogador?.posicao || ""}
            textStyle={styles.tiny}
          />
          <LinearGradient
            pointerEvents="none"
            colors={[colors.card + "00", colors.card]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{
              position: "absolute",
              right: 0,
              top: 0,
              width: 10,
              height: 16,
            }}
          />
        </View>
        <View style={{ gap: 5 }}>
          <View style={styles.stats}>
            {[
              [stats.gols, "GOL"],
              [stats.assistencias, "AST"],
              [stats.faltas, "FAL"],
              [stats.amarelos, "AMA"],
            ].map(([valor, label]) => (
              <View key={String(label)} style={styles.stat}>
                <Text style={styles.statValue}>{valor}</Text>
                <Text style={styles.statLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {!!extras && (
            <Text style={[styles.tiny, { textAlign: "right" }]}>
              {stats.defesas ? `${stats.defesas} DEF ` : ""}
              {stats.vermelhos ? `${stats.vermelhos} VERM ` : ""}
              {stats.azuis ? `${stats.azuis} AZUL` : ""}
            </Text>
          )}
        </View>
      </View>
    );
  }
  function totais(tipo: string, id: number) {
    return eventos.filter(
      (e) =>
        e.time_id === id &&
        (tipo === "CARTAO" ? e.tipo.startsWith("CARTAO_") : e.tipo === tipo),
    ).length;
  }
  const nomesDialogo: Record<Exclude<Dialogo, null>, string> = {
    evento: form?.existente
      ? "Corrigir jogador do lance"
      : form?.tipo === "GOL"
        ? `Quem marcou pelo ${nomeTime(form.timeId)}?`
        : `Registrar ${NOMES_EVENTOS[form?.tipo || "FALTA"].toLowerCase()}`,
    remover: "Remover evento?",
    encerrar: "Encerrar a partida?",
    substituir: "Fazer substituição",
    responsavel: "Responsável pela súmula",
    compartilhar: "Compartilhar resultado",
    placar: "Corrigir placar",
    solicitar: "Solicitar edição da súmula",
    tempo: "Voltar o tempo?",
  };

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.header}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Voltar às partidas"
          onPress={() => sairAtual.current()}
          style={[styles.iconButton, styles.close]}
        >
          <Icon name="close" size={19} color={colors.textoSecundario} />
        </TouchableOpacity>
        <Text numberOfLines={1} style={styles.headerTitle}>
          {p.mandante.nome} × {p.visitante.nome}
        </Text>
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          pendentes.length > 0 && { paddingBottom: 140 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.between}>
          <View style={styles.row}>
            <Icon name="cleat" size={18} color={colors.textoSecundario} />
            <View>
              <Text style={styles.muted}>
                Súmula: <Text style={styles.name}>{responsavel}</Text>
              </Text>
              <Text style={styles.tiny}>
                {finalizada
                  ? "Registros da partida encerrada"
                  : data.podeSumula
                    ? "Seu clube está operando"
                    : "Acompanhe os registros em tempo real"}
              </Text>
            </View>
          </View>
          {data.podePreparar && (
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Opções da súmula"
              style={styles.iconButton}
              onPress={(e) => setMenu({ top: e.nativeEvent.pageY + 8 })}
            >
              <Icon
                name="dots-horizontal"
                size={21}
                color={colors.textoSecundario}
              />
            </TouchableOpacity>
          )}
        </View>
        {!connected && aoVivo && (
          <Text accessibilityLiveRegion="polite" style={styles.muted}>
            Reconectando. Buscando atualizações do servidor.
          </Text>
        )}
        <View style={[styles.panel, aoVivo && styles.match]}>
          <View style={styles.between}>
            {finalizada ? (
              <Text style={styles.heading}>Resultado da partida</Text>
            ) : (
              <View style={styles.row}>
                <Icon
                  name="calendar"
                  size={14}
                  color={colors.textoSecundario}
                />
                <Text style={styles.tiny}>
                  {p.data.slice(0, 10).split("-").reverse().join("/")} ·{" "}
                  {p.categoria.nome.toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.row}>
              {aoVivo && <View style={styles.dotLive} />}
              {finalizada && (
                <Icon
                  name="check-all"
                  size={15}
                  color={colors.textoSecundario}
                />
              )}
              <Text
                style={[
                  styles.tiny,
                  {
                    color: aoVivo ? colors.texto : colors.textoSecundario,
                    fontWeight: "600",
                  },
                ]}
              >
                {aoVivo ? "AO VIVO" : finalizada ? "Encerrada" : p.status}
              </Text>
            </View>
          </View>
          {finalizada && (
            <View style={[styles.row, { justifyContent: "center" }]}>
              <Icon name="trophy" size={19} color={colors.primaria} />
              <Text style={styles.winner}>
                {vencedor ? `Vitória do ${nomeTime(vencedor)}` : "Empate"}
              </Text>
            </View>
          )}
          <View style={styles.teamLine}>
            {times.map((t, index) => (
              <React.Fragment key={t.id}>
                {index === 1 && (
                  <View style={styles.scores}>
                    {[p.gols_mandante, p.gols_visitante].map((gols, lado) => (
                      <React.Fragment key={lado}>
                        {lado === 1 && <Text style={styles.muted}>·</Text>}
                        <View style={styles.scoreColumn}>
                          {aoVivo && data.podeSumula && (
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={`Registrar gol de ${times[lado].nome}`}
                              disabled={ocupado}
                              onPress={() => abrirEvento("GOL", times[lado].id)}
                              style={styles.scoreAction}
                            >
                              <Icon name="plus" size={21} color="#fff" />
                            </TouchableOpacity>
                          )}
                          <Text
                            style={[
                              styles.score,
                              width < 350 && styles.scoreSmall,
                              finalizada &&
                                vencedor === times[lado].id && {
                                  color: colors.primaria,
                                },
                            ]}
                          >
                            {gols}
                          </Text>
                          {aoVivo && data.podeSumula && (
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={`Remover último gol de ${times[lado].nome}`}
                              accessibilityState={{
                                disabled: gols === 0 || alterando,
                              }}
                              disabled={gols === 0 || alterando}
                              onPress={() => subtrair(times[lado].id)}
                              style={[
                                styles.scoreAction,
                                styles.subtract,
                                (gols === 0 || alterando) && styles.disabled,
                              ]}
                            >
                              <Icon
                                name="minus"
                                size={18}
                                color={colors.textoSecundario}
                              />
                            </TouchableOpacity>
                          )}
                        </View>
                      </React.Fragment>
                    ))}
                  </View>
                )}
                <View style={styles.team}>
                  <Escudo time={t} styles={styles} />
                  <Text numberOfLines={1} style={styles.teamName}>
                    {t.nome}
                  </Text>
                  <Text style={styles.tiny}>
                    {finalizada && vencedor === t.id
                      ? "Vencedor"
                      : index === 0
                        ? "Mandante"
                        : "Visitante"}
                  </Text>
                  {aoVivo &&
                    (() => {
                      const d = disciplinaTempo(data.eventos, t.id, tempo);
                      return (
                        <View style={styles.discipline}>
                          <View
                            style={styles.dots}
                            accessible
                            accessibilityLabel={`${d.faltas} faltas de ${t.nome} no ${tempo}º tempo`}
                          >
                            {Array.from({ length: 5 }, (_, i) => (
                              <View
                                key={i}
                                style={[
                                  styles.dot,
                                  i < d.faltas && {
                                    backgroundColor: colors.primaria,
                                    borderColor: colors.primaria,
                                  },
                                ]}
                              />
                            ))}
                            {d.faltas > 5 && (
                              <Text style={styles.tiny}>+{d.faltas - 5}</Text>
                            )}
                          </View>
                          <View style={styles.cards}>
                            {[
                              [d.amarelos, colors.amarelo],
                              [d.vermelhos, colors.vermelho],
                              [d.azuis, colors.primaria],
                            ].map(([n, cor], i) => (
                              <View key={i} style={[styles.row, { gap: 4 }]}>
                                <View
                                  style={[
                                    styles.miniCard,
                                    { backgroundColor: String(cor) },
                                  ]}
                                />
                                <Text style={styles.tiny}>{n}</Text>
                              </View>
                            ))}
                          </View>
                        </View>
                      );
                    })()}
                </View>
              </React.Fragment>
            ))}
          </View>
          <View style={styles.meta}>
            {finalizada ? (
              <View style={styles.row}>
                <Icon
                  name="calendar"
                  size={14}
                  color={colors.textoSecundario}
                />
                <Text style={styles.tiny}>
                  {p.data.slice(0, 10).split("-").reverse().join("/")} ·{" "}
                  {p.horario} {p.categoria.nome.toUpperCase()}
                </Text>
              </View>
            ) : (
              <>
                {[
                  p.local?.trim()
                    ? { icon: "location" as IconName, texto: p.local.trim() }
                    : null,
                  p.horario?.trim()
                    ? { icon: "clock" as IconName, texto: p.horario }
                    : null,
                  minha
                    ? {
                        icon: (minha.time_id === p.visitante_id
                          ? "bus"
                          : "home") as IconName,
                        texto:
                          minha.time_id === p.visitante_id ? "Fora" : "Casa",
                      }
                    : null,
                ]
                  .filter(
                    (item): item is { icon: IconName; texto: string } => !!item,
                  )
                  .map((item, i) => (
                    <React.Fragment key={item.icon}>
                      {i > 0 && <View style={styles.metaDivider} />}
                      <View style={styles.metaCell}>
                        <Icon
                          name={item.icon}
                          size={15}
                          color={colors.textoSecundario}
                        />
                        <Text numberOfLines={1} style={styles.metaText}>
                          {item.texto}
                        </Text>
                      </View>
                    </React.Fragment>
                  ))}
              </>
            )}
          </View>
          {finalizada && (
            <>
              <View style={styles.resultGrid}>
                {(
                  [
                    ["FALTA", "Faltas"],
                    ["CARTAO", "Cartões"],
                    ["ASSISTENCIA", "Assistências"],
                    ["DEFESA", "Defesas"],
                  ] as const
                ).map(([tipo, label]) => (
                  <View key={tipo} style={styles.resultStat}>
                    <Text style={styles.muted}>{label}</Text>
                    <Text style={styles.resultNumber}>
                      {totais(tipo, p.mandante_id)} ·{" "}
                      {totais(tipo, p.visitante_id)}
                    </Text>
                  </View>
                ))}
              </View>
              <Text style={styles.tiny}>
                {tempo
                  ? `Eventos do ${tempo}º tempo`
                  : "Números dos eventos registrados"}{" "}
                · {p.mandante.nome} à esquerda e {p.visitante.nome} à direita.
              </Text>
              {button(
                "Compartilhar resultado",
                () => {
                  setIncluirNomes(false);
                  setVerMensagem(false);
                  abrir("compartilhar");
                },
                true,
                false,
                "share",
              )}
              {podeOperar ? (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => abrirEvento("GOL")}
                >
                  <Text style={styles.link}>
                    Adicionar evento com justificativa
                  </Text>
                </TouchableOpacity>
              ) : (
                data.podePreparar &&
                button(
                  "Solicitar edição da súmula",
                  () => abrir("solicitar"),
                  false,
                  alterando,
                  "edit",
                )
              )}
            </>
          )}
        </View>
        {(aoVivo || finalizada) && (
          <View style={[styles.panel, styles.period]}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Tempo anterior"
              accessibilityState={{
                disabled: aoVivo
                  ? (data.podeSumula && alterando) || tempo <= 1
                  : tempo <= 0,
              }}
              disabled={
                aoVivo
                  ? (data.podeSumula && alterando) || tempo <= 1
                  : tempo <= 0
              }
              style={[styles.iconButton, styles.close]}
              onPress={() => mudarTempo(tempo - 1)}
            >
              <Icon
                name="chevron-left"
                size={22}
                color={colors.textoSecundario}
              />
            </TouchableOpacity>
            <View style={styles.periodCenter}>
              <Text style={styles.periodTitle}>
                {tempo ? `${tempo}º tempo` : "Todos os tempos"}
              </Text>
              <Text style={styles.tiny}>
                {tempo ? `${tempo}/${totalTempos}` : "Resumo completo"}
              </Text>
              {consultandoTempo && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setTempoSelecionado(0)}
                >
                  <Text style={styles.link}>Voltar ao vivo</Text>
                </TouchableOpacity>
              )}
              {finalizada && tempo > 0 && (
                <TouchableOpacity
                  accessibilityRole="button"
                  onPress={() => setTempoSelecionado(0)}
                >
                  <Text style={styles.link}>Ver todos</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Próximo tempo"
              disabled={
                tempo >=
                  (aoVivo && !data.podeSumula
                    ? p.periodo_atual
                    : totalTempos) ||
                (aoVivo && data.podeSumula && alterando)
              }
              style={[styles.iconButton, styles.close]}
              onPress={() => mudarTempo(tempo + 1)}
            >
              <Icon name="chevron-right" size={22} color={colors.texto} />
            </TouchableOpacity>
          </View>
        )}
        {aoVivo && data.podeSumula && (
          <View style={styles.panel}>
            <Text style={styles.heading}>Registrar evento</Text>
            <View style={styles.eventGrid}>
              {(
                [
                  "CARTAO_AMARELO",
                  "CARTAO_VERMELHO",
                  "CARTAO_AZUL",
                  "FALTA",
                  "DEFESA",
                  "ASSISTENCIA",
                ] as TipoEvento[]
              ).map((tipo) => (
                <TouchableOpacity
                  key={tipo}
                  accessibilityRole="button"
                  accessibilityLabel={`Registrar ${NOMES_EVENTOS[tipo].toLowerCase()}`}
                  disabled={ocupado}
                  style={styles.eventButton}
                  onPress={() => abrirEvento(tipo)}
                >
                  <EventoIcon tipo={tipo} size={23} />
                  <Text style={styles.name}>{NOMES_EVENTOS[tipo]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.divider} />
            <Text style={styles.tiny}>
              Use + para marcar gol. Novos lances têm 5 segundos para cancelar
              antes da publicação.
            </Text>
          </View>
        )}
        <View style={styles.panel}>
          <View style={styles.between}>
            <Text style={styles.heading}>Acontecimentos</Text>
            {aoVivo && podeOperar && (
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Desfazer último evento"
                disabled={alterando || !data.eventos.length}
                onPress={() =>
                  pedirRemocao([...data.eventos].sort((a, b) => b.id - a.id)[0])
                }
                style={[
                  styles.row,
                  (alterando || !data.eventos.length) && styles.disabled,
                ]}
              >
                <Icon name="undo" size={16} color={colors.primaria} />
                <Text style={styles.link}>Desfazer último</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.divider} />
          {!eventos.length && (
            <Text style={styles.muted}>
              Nenhum evento registrado{tempo ? " neste tempo" : ""}.
            </Text>
          )}
          {eventos.map((e) => (
            <View key={e.id} style={styles.eventRow}>
              <View style={styles.eventIcon}>
                <EventoIcon tipo={e.tipo} size={18} />
              </View>
              <View style={styles.eventBody}>
                <Text style={styles.tiny}>
                  <Text style={styles.name}>
                    {NOMES_EVENTOS[e.tipo] || e.tipo}
                    {e.gol_contra ? " contra" : ""}
                  </Text>{" "}
                  · {nomeTime(e.time_id)}
                </Text>
                <Text style={styles.name} numberOfLines={1}>
                  {e.jogador?.nome
                    ? `${String(data.equipes.flatMap((t) => t.escalacao).find((j) => j.jogador_id === e.jogador_id)?.numCamisa || "").padStart(2, "0")} · ${e.jogador.nome}`
                    : data.equipes.some((t) => t.time_id === timeAutor(data, e))
                      ? "Jogador a identificar"
                      : times.find((t) => t.id === timeAutor(data, e))?.nome ||
                        "Equipe externa"}
                </Text>
                {e.tipo === "GOL" && (
                  <Text style={styles.miniScore}>{placares.get(e.id)}</Text>
                )}
              </View>
              <View style={styles.eventMeta}>
                <Text style={styles.tiny}>{e.periodo}º tempo</Text>
                {(podeOperar ||
                  (data.podePreparar &&
                    e.tipo === "GOL" &&
                    !e.jogador_id &&
                    minha?.time_id === timeAutor(data, e) &&
                    aoVivo)) && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityLabel={`Opções de ${NOMES_EVENTOS[e.tipo]} ${e.id}`}
                    style={styles.iconButton}
                    onPress={(event) =>
                      setMenu({ evento: e, top: event.nativeEvent.pageY + 8 })
                    }
                  >
                    <Icon
                      name="dots-horizontal"
                      size={19}
                      color={colors.textoSecundario}
                    />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ))}
        </View>
        {data.podePreparar && (
          <View style={styles.panel}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ expanded: auditoriaAberta }}
              accessibilityLabel="Histórico de alterações"
              onPress={() => setAuditoriaAberta((v) => !v)}
              style={styles.between}
            >
              <View style={[styles.row, styles.flex]}>
                <Icon
                  name="clipboard-text-outline"
                  size={18}
                  color={colors.texto}
                />
                <View style={styles.flex}>
                  <Text style={styles.heading}>Histórico de alterações</Text>
                  <Text numberOfLines={1} style={styles.tiny}>
                    {data.auditoria?.length
                      ? `Última: ${descreverAlteracao(data.auditoria[0], data).titulo}`
                      : "Registros da operação da súmula"}
                  </Text>
                </View>
              </View>
              <Icon
                name={auditoriaAberta ? "chevron-up" : "chevron-down"}
                size={16}
                color={colors.textoSecundario}
              />
            </TouchableOpacity>
            {auditoriaAberta &&
              (!data.auditoria?.length ? (
                <Text style={styles.muted}>Nenhuma alteração disponível.</Text>
              ) : (
                data.auditoria.map((a) => (
                  <View
                    key={a.id}
                    style={{
                      gap: 5,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.linha,
                    }}
                  >
                    <Text style={styles.name}>
                      {descreverAlteracao(a, data).titulo}
                    </Text>
                    {!!descreverAlteracao(a, data).detalhes && (
                      <Text style={styles.muted}>
                        {descreverAlteracao(a, data).detalhes}
                      </Text>
                    )}
                    <Text style={styles.tiny}>
                      {new Date(a.criado_em).toLocaleString("pt-BR")}
                    </Text>
                    {!!a.dados?.motivo && (
                      <Text style={styles.muted}>{String(a.dados.motivo)}</Text>
                    )}
                  </View>
                ))
              ))}
          </View>
        )}
        {!!data.equipes.length && (
          <View style={styles.section}>
            <View style={styles.between}>
              <Text style={styles.heading}>Escalação</Text>
              {aoVivo &&
                data.podePreparar &&
                button(
                  "Fazer substituição",
                  () => {
                    setSai(undefined);
                    setEntra(undefined);
                    abrir("substituir");
                  },
                  false,
                  alterando || !minha?.escalacao.some((j) => !j.titular),
                  "swap-horizontal",
                )}
            </View>
            {data.equipes.length > 1 && (
              <View style={styles.segmented} accessibilityRole="tablist">
                {data.equipes.map((e) => (
                  <TouchableOpacity
                    key={e.id}
                    accessibilityRole="tab"
                    accessibilityState={{
                      selected: e.id === equipeVisivel?.id,
                    }}
                    onPress={() => setEquipeAtiva(e.time_id)}
                    style={[
                      styles.segment,
                      e.id === equipeVisivel?.id && styles.selectedSegment,
                    ]}
                  >
                    <View style={styles.row}>
                      <Icon
                        name="group"
                        size={16}
                        color={colors.textoSecundario}
                      />
                      <Text numberOfLines={1} style={styles.name}>
                        {e.clube.nome}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {!equipeVisivel?.publicada_em ? (
              <Text style={styles.muted}>
                Escalação ainda não divulgada pelo clube.
              </Text>
            ) : (
              <View
                style={[
                  styles.lineupColumns,
                  width >= 720 && styles.columnsWide,
                ]}
              >
                {[true, false].map((titular) => (
                  <View
                    key={String(titular)}
                    style={[styles.section, width >= 720 && styles.flex]}
                  >
                    <View style={styles.between}>
                      <Text style={styles.muted}>
                        {titular ? "EM CAMPO" : "RESERVAS"}
                      </Text>
                      <Text style={styles.tiny}>
                        {
                          equipeVisivel.escalacao.filter(
                            (j) => j.titular === titular,
                          ).length
                        }
                      </Text>
                    </View>
                    <View style={styles.playerList}>
                      {equipeVisivel.escalacao
                        .filter((j) => j.titular === titular)
                        .map(jogadorLinha)}
                    </View>
                    {!equipeVisivel.escalacao.some(
                      (j) => j.titular === titular,
                    ) && (
                      <Text style={styles.muted}>
                        Nenhum{" "}
                        {titular ? "titular registrado" : "reserva convocado"}.
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
        {aoVivo && data.podeSumula && (
          <View style={styles.finish}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityState={{ disabled: alterando }}
              disabled={alterando}
              onPress={() => abrir("encerrar")}
              style={[
                styles.button,
                styles.finishButton,
                alterando && styles.disabled,
              ]}
            >
              <Icon name="flag" size={19} color={colors.vermelho} />
              <Text style={[styles.buttonText, { fontSize: 14 }]}>
                Finalizar partida
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {!!erro && !dialogo && (
          <View style={styles.notice}>
            <Text accessibilityRole="alert" style={styles.error}>
              {erro}
            </Text>
            {button("Atualizar súmula", () => {
              void onRefresh()
                .then(() => setErro(""))
                .catch((e) => setErro(e.message));
            })}
          </View>
        )}
      </ScrollView>

      <Modal
        visible={!!menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(null)}
      >
        <Pressable
          style={styles.menuOverlay}
          accessibilityLabel="Fechar opções"
          onPress={() => setMenu(null)}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.menu,
              { top: Math.max(12, Math.min(menu?.top || 100, height - 210)) },
            ]}
          >
            {menu?.evento ? (
              <>
                {(podeOperar || !menu.evento.jogador_id) &&
                  data.equipes.some(
                    (e) => e.time_id === timeAutor(data, menu.evento!),
                  ) && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      style={styles.menuItem}
                      onPress={() => {
                        const e = menu.evento!;
                        abrirEvento(e.tipo as TipoEvento, e.time_id!, e);
                      }}
                    >
                      <Icon name="edit" size={17} color={colors.texto} />
                      <Text style={styles.text}>Corrigir jogador</Text>
                    </TouchableOpacity>
                  )}
                {podeOperar && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.menuItem}
                    onPress={() => pedirRemocao(menu.evento!)}
                  >
                    <Icon name="trash" size={17} color={colors.tituloErro} />
                    <Text style={styles.error}>Remover evento</Text>
                  </TouchableOpacity>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  accessibilityRole="button"
                  style={styles.menuItem}
                  onPress={() => abrir("responsavel")}
                >
                  <Icon name="group" size={17} color={colors.texto} />
                  <Text style={styles.text}>Responsável pela súmula</Text>
                </TouchableOpacity>
                {podeOperar && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.menuItem}
                    onPress={() => {
                      setPlacarCasa(String(p.gols_mandante));
                      setPlacarFora(String(p.gols_visitante));
                      abrir("placar");
                    }}
                  >
                    <Icon name="edit" size={17} color={colors.texto} />
                    <Text style={styles.text}>
                      Corrigir placar com justificativa
                    </Text>
                  </TouchableOpacity>
                )}
                {finalizada && podeOperar && (
                  <TouchableOpacity
                    accessibilityRole="button"
                    style={styles.menuItem}
                    onPress={() => abrirEvento("GOL")}
                  >
                    <Icon name="plus" size={17} color={colors.texto} />
                    <Text style={styles.text}>Adicionar evento</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={!!dialogo}
        transparent
        animationType={dialogo ? "fade" : "none"}
        onRequestClose={() => {
          if (!ocupado) setDialogo(null);
        }}
      >
        <View style={styles.overlay}>
          <Pressable
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            }}
            accessibilityLabel="Fechar janela"
            onPress={() => {
              if (!ocupado) setDialogo(null);
            }}
          />
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.sheetWrap}
          >
            <View accessibilityViewIsModal style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text
                  accessibilityRole="header"
                  style={[styles.title, styles.flex]}
                >
                  {dialogo ? nomesDialogo[dialogo] : ""}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Fechar janela"
                  disabled={ocupado}
                  onPress={() => setDialogo(null)}
                  style={styles.iconButton}
                >
                  <Icon name="close" size={19} color={colors.textoSecundario} />
                </TouchableOpacity>
              </View>
              {dialogo === "evento" && form ? (
                <>
                  <View style={styles.sheetBody}>
                    {(finalizada || form.tipo !== "GOL") && !form.existente && (
                      <View style={styles.segmented}>
                        {times.map((t) => (
                          <TouchableOpacity
                            key={t.id}
                            accessibilityRole="button"
                            accessibilityState={{
                              selected: form.timeId === t.id,
                            }}
                            style={[
                              styles.segment,
                              form.timeId === t.id && styles.selectedSegment,
                            ]}
                            onPress={() =>
                              setForm({
                                ...form,
                                timeId: t.id,
                                jogadorId: undefined,
                                contra: false,
                              })
                            }
                          >
                            <Text numberOfLines={1} style={styles.name}>
                              {t.nome}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                    {finalizada && !form.existente && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 6, paddingBottom: 4 }}
                      >
                        {(
                          [
                            "GOL",
                            "CARTAO_AMARELO",
                            "CARTAO_VERMELHO",
                            "CARTAO_AZUL",
                            "FALTA",
                            "DEFESA",
                            "ASSISTENCIA",
                          ] as TipoEvento[]
                        ).map((tipo) => (
                          <TouchableOpacity
                            key={tipo}
                            accessibilityRole="button"
                            style={[
                              styles.button,
                              form.tipo === tipo && styles.primary,
                            ]}
                            onPress={() =>
                              setForm({
                                ...form,
                                tipo,
                                contra: false,
                                jogadorId: undefined,
                              })
                            }
                          >
                            <Text
                              style={[
                                styles.buttonText,
                                form.tipo === tipo && { color: "#fff" },
                              ]}
                            >
                              {NOMES_EVENTOS[tipo]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    )}
                    <Text style={styles.muted}>
                      {form.contra
                        ? `Gol contra de ${nomeTime(atorTime)}. O ponto será do ${nomeTime(form.timeId)}.`
                        : equipeAutor
                          ? "Selecione o jogador. Os atletas em campo aparecem primeiro."
                          : "Equipe externa ao Ludora. O registro será vinculado apenas à equipe."}
                    </Text>
                    {!!equipeAutor && (
                      <View style={styles.search}>
                        <Icon
                          name="search"
                          size={16}
                          color={colors.textoSecundario}
                        />
                        <TextInput
                          accessibilityLabel="Buscar autor por nome ou camisa"
                          placeholder="Nome ou camisa"
                          placeholderTextColor={colors.textoSecundario}
                          value={busca}
                          onChangeText={setBusca}
                          style={styles.input}
                        />
                      </View>
                    )}
                    <FlatList
                      style={styles.pickerList}
                      contentContainerStyle={styles.pickerContent}
                      data={roster}
                      keyExtractor={(j) => String(j.jogador_id)}
                      keyboardShouldPersistTaps="handled"
                      initialNumToRender={6}
                      maxToRenderPerBatch={6}
                      ListEmptyComponent={
                        equipeAutor ? (
                          <Text style={styles.muted}>
                            Nenhum jogador encontrado.
                          </Text>
                        ) : null
                      }
                      renderItem={({ item: j }) => (
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: form.jogadorId === j.jogador_id,
                          }}
                          accessibilityLabel={`Selecionar ${j.jogador?.nome}, camisa ${j.numCamisa}`}
                          style={[
                            styles.pickerRow,
                            form.jogadorId === j.jogador_id &&
                              styles.pickerSelected,
                          ]}
                          onPress={() =>
                            setForm({ ...form, jogadorId: j.jogador_id })
                          }
                        >
                          <View style={styles.shirt}>
                            <Text style={styles.name}>
                              {String(j.numCamisa).padStart(2, "0")}
                            </Text>
                          </View>
                          <View style={styles.nameBlock}>
                            <Text numberOfLines={1} style={styles.name}>
                              {j.jogador?.nome}
                            </Text>
                            <PositionLabel
                              position={j.jogador?.posicao || ""}
                              textStyle={styles.tiny}
                              suffix={j.titular ? " · Em campo" : " · Reserva"}
                            />
                          </View>
                          <Icon
                            name={
                              form.jogadorId === j.jogador_id ? "check" : "user"
                            }
                            size={17}
                            color={
                              form.jogadorId === j.jogador_id
                                ? colors.primaria
                                : colors.texto
                            }
                          />
                        </TouchableOpacity>
                      )}
                    />
                    {form.tipo === "GOL" &&
                      !form.existente &&
                      button(
                        form.contra
                          ? "✓ Gol contra do adversário"
                          : "Gol contra do adversário",
                        () => {
                          setBusca("");
                          setForm({
                            ...form,
                            contra: !form.contra,
                            jogadorId: undefined,
                          });
                        },
                        false,
                        false,
                        "swap-horizontal",
                      )}
                    {(finalizada || form.existente) && (
                      <TextInput
                        accessibilityLabel={
                          finalizada
                            ? "Justificativa da correção"
                            : "Motivo da correção (opcional)"
                        }
                        placeholder={
                          finalizada
                            ? "Justificativa da correção"
                            : "Motivo da correção · opcional"
                        }
                        placeholderTextColor={colors.textoSecundario}
                        value={motivo}
                        onChangeText={setMotivo}
                        multiline
                        maxLength={500}
                        style={styles.reason}
                      />
                    )}
                    {!!erro && (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {erro}
                      </Text>
                    )}
                  </View>
                  <View style={styles.sheetFooter}>
                    <View style={styles.footerButtons}>
                      {button("Voltar", () => setDialogo(null))}
                      {button(
                        form.existente
                          ? "Salvar correção"
                          : form.tipo === "GOL"
                            ? "Registrar gol"
                            : "Registrar evento",
                        () => registrar(),
                        true,
                        (!!equipeAutor && !form.jogadorId && !form.contra) ||
                          (finalizada && !motivo.trim()),
                      )}
                    </View>
                    {!form.existente && !!equipeAutor && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={finalizada && !motivo.trim()}
                        onPress={() => registrar(true)}
                      >
                        <Text style={[styles.muted, { textAlign: "center" }]}>
                          {form.tipo === "GOL"
                            ? "Registrar gol sem identificar agora"
                            : "Registrar evento sem identificar agora"}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </>
              ) : (
                <>
                  <ScrollView
                    keyboardShouldPersistTaps="handled"
                    ref={scrollDialogo}
                    scrollEnabled={!arrastandoSubstituicao}
                    contentContainerStyle={styles.sheetBody}
                    style={{ flexShrink: 1 }}
                  >
                    {dialogo === "encerrar" && (
                      <>
                        <View style={styles.teamLine}>
                          <View style={styles.team}>
                            <Escudo time={p.mandante} styles={styles} />
                            <Text style={styles.name}>{p.mandante.nome}</Text>
                          </View>
                          <Text style={styles.score}>
                            {p.gols_mandante} · {p.gols_visitante}
                          </Text>
                          <View style={styles.team}>
                            <Escudo time={p.visitante} styles={styles} />
                            <Text style={styles.name}>{p.visitante.nome}</Text>
                          </View>
                        </View>
                        <Text style={styles.muted}>
                          Confira o placar e os acontecimentos antes de
                          encerrar. Os registros serão incorporados ao Scout
                          imediatamente; a análise será recalculada em seguida.
                        </Text>
                        {!!semJogador.length && (
                          <View style={styles.notice}>
                            <View style={styles.row}>
                              <Icon
                                name="alert-circle-outline"
                                size={19}
                                color={colors.texto}
                              />
                              <Text style={[styles.name, styles.flex]}>
                                {semJogador.length}{" "}
                                {semJogador.length === 1
                                  ? "evento sem jogador identificado"
                                  : "eventos sem jogador identificado"}
                              </Text>
                            </View>
                            {semJogador.map((e) => (
                              <TouchableOpacity
                                key={e.id}
                                accessibilityRole="button"
                                onPress={() =>
                                  abrirEvento(
                                    e.tipo as TipoEvento,
                                    e.time_id!,
                                    e,
                                  )
                                }
                              >
                                <Text style={styles.link}>
                                  Identificar{" "}
                                  {NOMES_EVENTOS[e.tipo].toLowerCase()} ·{" "}
                                  {nomeTime(timeAutor(data, e))}
                                </Text>
                              </TouchableOpacity>
                            ))}
                            <Text style={styles.tiny}>
                              As pendências continuarão disponíveis após o
                              encerramento.
                            </Text>
                          </View>
                        )}
                      </>
                    )}
                    {dialogo === "remover" && remover && (
                      <>
                        <View style={styles.row}>
                          <EventoIcon tipo={remover.tipo} />
                          <Text style={styles.text}>
                            {NOMES_EVENTOS[remover.tipo]} ·{" "}
                            {nomeTime(remover.time_id)}
                          </Text>
                        </View>
                        <Text style={styles.muted}>
                          O registro sairá da súmula e os totais serão
                          atualizados. A alteração ficará no histórico.
                        </Text>
                        <TextInput
                          accessibilityLabel={
                            finalizada
                              ? "Motivo da remoção"
                              : "Motivo da remoção (opcional)"
                          }
                          placeholder={
                            finalizada
                              ? "Explique o motivo da remoção"
                              : "Motivo · opcional"
                          }
                          placeholderTextColor={colors.textoSecundario}
                          value={motivo}
                          onChangeText={setMotivo}
                          maxLength={500}
                          multiline
                          style={styles.reason}
                        />
                      </>
                    )}
                    {dialogo === "tempo" && (
                      <Text style={styles.text}>
                        Voltar para o {tempoSelecionado}º tempo? Os eventos
                        registrados serão preservados. Os contadores mostrarão
                        apenas os registros desse tempo.
                      </Text>
                    )}
                    {dialogo === "responsavel" && (
                      <>
                        <View style={styles.notice}>
                          <Text style={styles.muted}>Clube responsável</Text>
                          <Text style={styles.heading}>{responsavel}</Text>
                        </View>
                        <Text style={styles.muted}>
                          O responsável controla o placar e os acontecimentos.
                          Cada clube gerencia as substituições da própria
                          equipe. A transferência de responsabilidade é definida
                          na preparação.
                        </Text>
                      </>
                    )}
                    {dialogo === "solicitar" && (
                      <>
                        <Text style={styles.text}>
                          Explique ao {responsavel} o que precisa ser corrigido.
                          Após o aceite, seu clube poderá editar a súmula por 30
                          minutos, sempre com justificativa.
                        </Text>
                        <TextInput
                          accessibilityLabel="O que precisa ser corrigido"
                          placeholder="O que precisa ser corrigido?"
                          placeholderTextColor={colors.textoSecundario}
                          value={motivo}
                          onChangeText={setMotivo}
                          multiline
                          maxLength={500}
                          style={styles.reason}
                        />
                      </>
                    )}
                    {dialogo === "placar" && (
                      <>
                        <Text style={styles.muted}>
                          Use esta opção para corrigir divergências que não
                          possam ser resolvidas pelos eventos. A justificativa
                          será registrada no histórico.
                        </Text>
                        <View style={styles.row}>
                          {[
                            [p.mandante.nome, placarCasa, setPlacarCasa],
                            [p.visitante.nome, placarFora, setPlacarFora],
                          ].map(([nome, valor, set]) => (
                            <View key={String(nome)} style={styles.flex}>
                              <Text style={styles.name}>{String(nome)}</Text>
                              <View style={styles.search}>
                                <TextInput
                                  accessibilityLabel={`Placar de ${nome}`}
                                  value={String(valor)}
                                  onChangeText={set as (v: string) => void}
                                  keyboardType="number-pad"
                                  maxLength={2}
                                  style={styles.input}
                                />
                              </View>
                            </View>
                          ))}
                        </View>
                        <TextInput
                          accessibilityLabel="Justificativa do placar"
                          placeholder="Explique a correção"
                          placeholderTextColor={colors.textoSecundario}
                          value={motivo}
                          onChangeText={setMotivo}
                          multiline
                          maxLength={500}
                          style={styles.reason}
                        />
                      </>
                    )}
                    {dialogo === "substituir" && minha && (
                      <SubstituicaoPartida
                        equipe={minha}
                        sai={sai}
                        entra={entra}
                        onSai={setSai}
                        onEntra={setEntra}
                        bloqueado={alterando}
                        onArrastando={(ativo) => {
                          scrollDialogo.current?.setNativeProps?.({
                            scrollEnabled: !ativo,
                          });
                          setArrastandoSubstituicao(ativo);
                        }}
                      />
                    )}
                    {dialogo === "compartilhar" && (
                      <>
                        <View style={styles.sharePreview}>
                          <View style={styles.between}>
                            <Text style={styles.heading}>LUDORA</Text>
                            <Text style={styles.tiny}>
                              {p.categoria.nome.toUpperCase()} ·{" "}
                              {p.data
                                .slice(0, 10)
                                .split("-")
                                .reverse()
                                .join("/")}
                            </Text>
                          </View>
                          <View style={styles.teamLine}>
                            <View style={styles.team}>
                              <Escudo time={p.mandante} styles={styles} />
                              <Text style={styles.name}>{p.mandante.nome}</Text>
                            </View>
                            <Text style={styles.score}>
                              {p.gols_mandante} · {p.gols_visitante}
                            </Text>
                            <View style={styles.team}>
                              <Escudo time={p.visitante} styles={styles} />
                              <Text style={styles.name}>
                                {p.visitante.nome}
                              </Text>
                            </View>
                          </View>
                          <View style={styles.divider} />
                          <Text style={styles.winner}>
                            {vencedor
                              ? `Vitória do ${nomeTime(vencedor)}`
                              : "Empate"}
                          </Text>
                        </View>
                        <View style={styles.between}>
                          <View style={styles.flex}>
                            <Text style={styles.name}>
                              Incluir nomes dos jogadores
                            </Text>
                            <Text style={styles.muted}>
                              Adiciona os autores dos lances à mensagem.
                            </Text>
                          </View>
                          <Switch
                            accessibilityLabel="Incluir nomes dos jogadores"
                            value={incluirNomes}
                            onValueChange={setIncluirNomes}
                            trackColor={{
                              false: colors.cardSecundario,
                              true: colors.primaria,
                            }}
                            thumbColor={colors.texto}
                          />
                        </View>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityState={{ expanded: verMensagem }}
                          style={styles.between}
                          onPress={() => setVerMensagem((v) => !v)}
                        >
                          <Text style={styles.muted}>Ver mensagem</Text>
                          <Icon
                            name={verMensagem ? "chevron-up" : "chevron-down"}
                            size={17}
                            color={colors.textoSecundario}
                          />
                        </TouchableOpacity>
                        {verMensagem && (
                          <View style={styles.notice}>
                            <Text selectable style={styles.text}>
                              {mensagem}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.tiny}>
                          Será compartilhado o texto do resultado com o link da
                          partida.
                        </Text>
                      </>
                    )}
                    {!!erro && (
                      <Text accessibilityRole="alert" style={styles.error}>
                        {erro}
                      </Text>
                    )}
                  </ScrollView>
                  <View style={styles.sheetFooter}>
                    <View style={styles.footerButtons}>
                      {button(
                        dialogo === "encerrar" ? "Continuar partida" : "Voltar",
                        () => setDialogo(null),
                      )}
                      {dialogo === "remover" &&
                        remover &&
                        button(
                          "Confirmar remoção",
                          () =>
                            enfileirar(
                              `/eventos/${remover.id}`,
                              { partida_id: p.id, motivo: motivo.trim() },
                              `Remover ${NOMES_EVENTOS[remover.tipo].toLowerCase()}`,
                              remover.tipo,
                              "DELETE",
                            ),
                          true,
                          finalizada && !motivo.trim(),
                        )}
                      {dialogo === "encerrar" &&
                        button(
                          "Confirmar encerramento",
                          () => {
                            void executar(
                              "status",
                              {
                                status: "FINALIZADA",
                                status_anterior: "AO_VIVO",
                              },
                              "PATCH",
                              () => {
                                setDialogo(null);
                                setTempoSelecionado(0);
                              },
                            );
                          },
                          true,
                          alterando,
                        )}
                      {dialogo === "tempo" &&
                        button(
                          "Confirmar tempo",
                          () => {
                            void executar(
                              "periodo",
                              { periodo: tempoSelecionado },
                              "PATCH",
                              () => setDialogo(null),
                            );
                          },
                          true,
                          alterando,
                        )}
                      {dialogo === "responsavel" &&
                        aoVivo &&
                        data.podePreparar &&
                        data.equipes.length > 1 &&
                        button(
                          data.podeSumula
                            ? "Propor transferência"
                            : "Solicitar operação",
                          () => {
                            void executar("sumula", {}, "POST", () => {
                              setDialogo(null);
                              setFeedback(
                                "Solicitação enviada. O responsável só muda após o aceite do outro clube.",
                              );
                            });
                          },
                          true,
                          alterando,
                          "email",
                        )}
                      {dialogo === "solicitar" &&
                        button(
                          "Enviar solicitação",
                          () => {
                            void executar(
                              "correcoes",
                              { motivo: motivo.trim() },
                              "POST",
                              () => {
                                setDialogo(null);
                                setFeedback(
                                  "Solicitação enviada. Acompanhe a resposta em Solicitações.",
                                );
                              },
                            );
                          },
                          true,
                          !motivo.trim(),
                        )}
                      {dialogo === "placar" &&
                        button(
                          "Salvar correção",
                          () => {
                            if (
                              !/^\d{1,2}$/.test(placarCasa) ||
                              !/^\d{1,2}$/.test(placarFora)
                            ) {
                              setErro("Informe placares de 0 a 99.");
                              return;
                            }
                            enfileirar(
                              "placar",
                              {
                                gols_mandante: Number(placarCasa),
                                gols_visitante: Number(placarFora),
                                motivo: motivo.trim(),
                              },
                              "Corrigir placar",
                              "GOL",
                              "PATCH",
                            );
                          },
                          true,
                          !motivo.trim() || alterando,
                        )}
                      {dialogo === "substituir" &&
                        button(
                          "Confirmar substituição",
                          () =>
                            enfileirar(
                              "substituicoes",
                              { sai, entra, periodo: p.periodo_atual },
                              `Substituição · ${minha?.clube.nome}`,
                              "SUBSTITUICAO",
                            ),
                          true,
                          !sai || !entra || alterando,
                        )}
                      {dialogo === "compartilhar" &&
                        button(
                          "Compartilhar resultado",
                          () => {
                            void Share.share({ message: mensagem }).catch(() =>
                              setErro(
                                "Não foi possível abrir o compartilhamento. Tente novamente.",
                              ),
                            );
                          },
                          true,
                          false,
                          "share",
                        )}
                    </View>
                  </View>
                </>
              )}
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
      <View
        pointerEvents="box-none"
        style={[styles.toastArea, { bottom: insets.bottom + 12 }]}
      >
        {!!feedback && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar aviso"
            onPress={() => setFeedback("")}
            style={styles.toast}
          >
            <Icon name="info" size={18} color={colors.primaria} />
            <Text style={[styles.text, styles.flex]}>{feedback}</Text>
            <Icon name="close" size={16} color={colors.textoSecundario} />
          </Pressable>
        )}
        {!!pendentes.length && (
          <ScrollView
            style={{ maxHeight: 250 }}
            contentContainerStyle={{ gap: 8 }}
            keyboardShouldPersistTaps="handled"
          >
            {pendentes.map((item) => (
              <Publicacao
                key={item.id}
                item={item}
                styles={styles}
                cancelar={() => fila.cancelar(item.id)}
                tentar={() => fila.tentar(item.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
