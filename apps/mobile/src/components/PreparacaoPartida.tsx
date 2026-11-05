import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as SecureStore from "expo-secure-store";
import { Icon, type IconName } from "@ludora/icons";
import { useTheme } from "../contexts/ThemeContext";
import { apiFetch } from "../services/api";
import {
  requisicaoPartida,
  type GestaoPartida,
} from "../services/partidasCompartilhadas";
import {
  atualizarCamisas,
  conciliarCamisas,
  escalaValida,
  etapaPreparacao,
  normalizarConvocados,
  numeroCamisa,
  trocarConvocados,
  type Convocado,
} from "../utils/preparacaoPartida";
import { createStyles } from "../styles/preparacaoPartidaStyles";
import { PositionLabel } from "./PositionIcon";
import { ErroConsulta } from "../utils/request";
import { criarGestoTroca } from "../utils/gestoTroca";
import {
  mascaraDataPartida,
  mascaraHorarioPartida,
} from "../utils/organizarPartida";

type Jogador = {
  id: number;
  nome: string;
  posicao: string;
  numCamisa: number | null;
};
type ConflitoCamisa = {
  jogador_id: number;
  nome: string;
  categoria: string;
  camisa_anterior: number | null;
};
type Dialogo =
  | "camisa"
  | "adversario"
  | "ajuda"
  | "responsavel"
  | "editar"
  | null;
type Props = {
  data: GestaoPartida;
  clubeId: number;
  onBack: () => void;
  onRefresh: () => Promise<GestaoPartida | undefined>;
};

const ajudaTroca =
  "Segure brevemente a alça de três pontos e arraste um convocado sobre outro. Pelo teclado, selecione o ícone do primeiro jogador e depois o do segundo. Isso também permite trocar um titular por um reserva.";

function Escudo({
  nome,
  url,
  pequeno = false,
}: {
  nome: string;
  url?: string;
  pequeno?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [falhou, setFalhou] = useState(false);
  useEffect(() => setFalhou(false), [url]);
  return (
    <View style={[styles.crest, pequeno && styles.smallCrest]}>
      {url && !falhou ? (
        <Image
          source={{ uri: url }}
          onError={() => setFalhou(true)}
          resizeMode="contain"
          style={pequeno ? styles.smallCrestImage : styles.crestImage}
          accessibilityLabel={`Escudo do ${nome}`}
        />
      ) : (
        <Text style={styles.crestInitial}>
          {nome.slice(0, 1).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

function ConvocadoLinha({
  jogador,
  ordem,
  editavel = false,
  selecionado = false,
  bloqueado = false,
  registrarRef,
  onArrastar,
  onSoltar,
  onTrocar,
  onRemover,
  onCamisa,
}: {
  jogador: Convocado;
  ordem?: number;
  editavel?: boolean;
  selecionado?: boolean;
  bloqueado?: boolean;
  registrarRef?: (id: number, ref: View | null) => void;
  onArrastar?: () => void;
  onSoltar?: (id: number, deltaX: number, deltaY: number) => void;
  onTrocar?: () => void;
  onRemover?: () => void;
  onCamisa?: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const deslocamento = useRef(new Animated.ValueXY()).current;
  const [emArraste, setEmArraste] = useState(false);
  const handlers = useRef({ onArrastar, onSoltar, onTrocar, bloqueado });
  handlers.current = { onArrastar, onSoltar, onTrocar, bloqueado };
  const gestoTroca = useMemo(
    () =>
      criarGestoTroca({
        capturar: () => handlers.current.onArrastar?.(),
        ativar: setEmArraste,
        mover: (x, y) => deslocamento.setValue({ x, y }),
        soltar: (x, y) => handlers.current.onSoltar?.(jogador.jogador_id, x, y),
        tocar: () => handlers.current.onTrocar?.(),
      }),
    [deslocamento, jogador.jogador_id],
  );
  useEffect(() => () => gestoTroca.cancelar(), [gestoTroca]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !handlers.current.bloqueado,
        onStartShouldSetPanResponderCapture: () => !handlers.current.bloqueado,
        onPanResponderGrant: () => gestoTroca.iniciar(),
        onPanResponderMove: (_, gesto) => gestoTroca.mover(gesto.dx, gesto.dy),
        onPanResponderRelease: (_, gesto) => {
          gestoTroca.mover(gesto.dx, gesto.dy);
          gestoTroca.soltar();
        },
        onPanResponderTerminate: () => gestoTroca.cancelar(),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [gestoTroca],
  );
  return (
    <View
      ref={(ref) => registrarRef?.(jogador.jogador_id, ref)}
      collapsable={false}
      style={emArraste && styles.draggedWrapper}
    >
      <Animated.View
        style={[
          styles.row,
          selecionado && styles.selectedRow,
          emArraste && styles.draggedRow,
          { transform: deslocamento.getTranslateTransform() },
        ]}
      >
        {ordem !== undefined && <Text style={styles.order}>{ordem + 1}</Text>}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Camisa ${numeroCamisa(jogador.numCamisa)} de ${jogador.jogador?.nome}`}
          disabled={!editavel || bloqueado}
          onPress={onCamisa}
          style={styles.shirt}
        >
          <Text style={styles.shirtNumber}>
            {numeroCamisa(jogador.numCamisa)}
          </Text>
        </TouchableOpacity>
        <View style={styles.playerIdentity}>
          <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
            {jogador.jogador?.nome || "Jogador"}
          </Text>
          <PositionLabel
            position={jogador.jogador?.posicao || ""}
            textStyle={styles.position}
          />
        </View>
        {editavel && (
          <>
            <View
              {...responder.panHandlers}
              accessible
              focusable
              accessibilityRole="button"
              accessibilityLabel={`Trocar ${jogador.jogador?.nome}`}
              accessibilityHint="Segure para arrastar ou selecione este jogador e depois outro para trocar suas posições."
              accessibilityState={{
                selected: selecionado,
                disabled: bloqueado,
              }}
              accessibilityActions={[
                { name: "activate", label: "Selecionar para troca" },
              ]}
              onAccessibilityAction={() => {
                if (!bloqueado) onTrocar?.();
              }}
              {...(Platform.OS === "web"
                ? {
                    onKeyDown: (event: {
                      key: string;
                      preventDefault: () => void;
                    }) => {
                      if (!bloqueado && ["Enter", " "].includes(event.key)) {
                        event.preventDefault();
                        onTrocar?.();
                      }
                    },
                  }
                : {})}
              style={[
                styles.rowAction,
                Platform.OS === "web" && ({ touchAction: "none" } as ViewStyle),
              ]}
            >
              <Icon
                name="grip-vertical"
                size={18}
                color={selecionado ? colors.primaria : colors.textoSecundario}
              />
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`Remover ${jogador.jogador?.nome} da convocação`}
              disabled={bloqueado}
              onPress={onRemover}
              style={styles.rowAction}
            >
              <Icon name="close" size={18} color={colors.textoSecundario} />
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </View>
  );
}

export default function PreparacaoPartida({
  data,
  clubeId,
  onBack,
  onRefresh,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const largo = width >= 720;
  const partida = data.partida;
  const minhaEquipe = data.equipes.find(
    (equipe) => equipe.id === data.minhaEquipeId,
  )!;
  const adversario = data.equipes.find(
    (equipe) => equipe.id !== minhaEquipe.id,
  );
  const quantidadeTitulares = partida.titulares_necessarios || 5;
  const [convocados, setConvocados] = useState<Convocado[]>(
    minhaEquipe.escalacao,
  );
  const convocadosRef = useRef(convocados);
  convocadosRef.current = convocados;
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [carregandoElenco, setCarregandoElenco] = useState(true);
  const [erroElenco, setErroElenco] = useState("");
  const [elencoCarregado, setElencoCarregado] = useState(false);
  const [etapa, setEtapa] = useState(() => etapaPreparacao(data, null));
  const [busca, setBusca] = useState("");
  const [limiteElenco, setLimiteElenco] = useState(12);
  const [ocupado, setOcupado] = useState(false);
  const [restaurando, setRestaurando] = useState(true);
  const [erro, setErro] = useState("");
  const [alterado, setAlterado] = useState(false);
  const [menu, setMenu] = useState(false);
  const [menuTop, setMenuTop] = useState(120);
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const ultimoDialogo = useRef<Dialogo>(null);
  if (dialogo) ultimoDialogo.current = dialogo;
  const dialogoVisivel = dialogo || ultimoDialogo.current;
  const [jogadorCamisa, setJogadorCamisa] = useState<Jogador | null>(null);
  const [camisa, setCamisa] = useState("");
  const [conflito, setConflito] = useState<ConflitoCamisa | null>(null);
  const [troca, setTroca] = useState<number | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [alturaConvocados, setAlturaConvocados] = useState(600);
  const [dataEdicao, setDataEdicao] = useState("");
  const [horarioEdicao, setHorarioEdicao] = useState("");
  const [localEdicao, setLocalEdicao] = useState("");
  const chave = useRef<string | null>(null);
  const ultimaData = useRef(data);
  ultimaData.current = data;
  const alteradoRef = useRef(alterado);
  alteradoRef.current = alterado;
  const emOperacao = useRef(false);
  const elencoEmAndamento = useRef(false);
  const montado = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const elencoInput = useRef<TextInput>(null);
  const linhas = useRef(new Map<number, View>());
  const posicoes = useRef(
    new Map<number, { x: number; y: number; width: number; height: number }>(),
  );
  const sairAtual = useRef(sair);
  sairAtual.current = sair;

  useEffect(() => {
    if (!alteradoRef.current && !emOperacao.current)
      setConvocados(minhaEquipe.escalacao);
  }, [minhaEquipe.escalacao, ocupado]);

  useEffect(() => {
    let ativo = true;
    montado.current = true;
    async function restaurar() {
      try {
        const email = (await SecureStore.getItemAsync("userEmail")) || "sessao";
        const conta = Array.from(email)
          .map((letra) => letra.charCodeAt(0).toString(16))
          .join("");
        const key = `ludora.preparacao.${conta}.${clubeId}.${partida.id}`;
        const salva = await SecureStore.getItemAsync(key);
        if (ativo) {
          chave.current = key;
          setEtapa(etapaPreparacao(ultimaData.current, salva));
        }
      } catch {
        /* A escalação salva no servidor permite retomar se o armazenamento estiver indisponível. */
      } finally {
        if (ativo) setRestaurando(false);
      }
    }
    void restaurar();
    return () => {
      ativo = false;
      montado.current = false;
    };
  }, [clubeId, partida.id, minhaEquipe.categoria_id]);

  useEffect(() => {
    if (etapa <= 1 && !restaurando && !elencoCarregado) void carregarElenco();
  }, [etapa, restaurando]);

  useEffect(() => {
    const listener = BackHandler.addEventListener("hardwareBackPress", () => {
      sairAtual.current();
      return true;
    });
    return () => listener.remove();
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      scroll.current?.scrollTo({ y: 0, animated: false });
    });
    return () => cancelAnimationFrame(frame);
  }, [etapa]);

  async function carregarElenco() {
    if (elencoEmAndamento.current) return;
    elencoEmAndamento.current = true;
    setCarregandoElenco(true);
    setErroElenco("");
    try {
      const lista = await requisicaoPartida<Jogador[]>(
        `/jogadores?categoria_id=${minhaEquipe.categoria_id}&convocacao=true`,
        clubeId,
      );
      if (montado.current) {
        setJogadores(lista);
        setElencoCarregado(true);
        const anteriores = convocadosRef.current;
        const conciliados = conciliarCamisas(
          anteriores,
          lista,
          quantidadeTitulares,
        );
        if (conciliados !== anteriores) atualizarConvocados(conciliados);
      }
    } catch (error) {
      if (montado.current) setErroElenco((error as Error).message);
    } finally {
      elencoEmAndamento.current = false;
      if (montado.current) setCarregandoElenco(false);
    }
  }

  async function lembrar(passo: number) {
    if (chave.current)
      await SecureStore.setItemAsync(chave.current, String(passo)).catch(
        () => undefined,
      );
  }

  function sair() {
    if (!alteradoRef.current) {
      onBack();
      return;
    }
    Alert.alert(
      "Salvar a escalação?",
      "Existem alterações que ainda não foram salvas.",
      [
        { text: "Continuar editando", style: "cancel" },
        { text: "Sair sem salvar", style: "destructive", onPress: onBack },
        {
          text: "Salvar e sair",
          onPress: () => {
            void salvarESair();
          },
        },
      ],
    );
  }

  async function executar(caminho: string, dados: object, metodo = "POST") {
    await requisicaoPartida(
      `/partidas/${partida.id}${caminho ? `/${caminho}` : ""}`,
      clubeId,
      { ...dados, versao: ultimaData.current.partida.versao },
      metodo,
    );
    const atualizada = await onRefresh();
    if (!atualizada)
      throw new Error(
        "Atualize a partida para confirmar as alterações salvas.",
      );
    ultimaData.current = atualizada;
    return atualizada;
  }

  async function operar(operacao: () => Promise<void>) {
    if (emOperacao.current) return;
    emOperacao.current = true;
    setOcupado(true);
    setErro("");
    try {
      await operacao();
    } catch (error) {
      if (error instanceof ErroConsulta && error.status === 409) {
        await Promise.allSettled([onRefresh(), carregarElenco()]);
      }
      if (montado.current) setErro((error as Error).message);
    } finally {
      emOperacao.current = false;
      if (montado.current) setOcupado(false);
    }
  }

  async function salvar() {
    if (!alteradoRef.current) return;
    const atualizada = await executar(
      "escalacao",
      {
        jogadores: convocados.map(({ jogador_id, numCamisa, titular }) => ({
          jogador_id,
          numCamisa,
          titular,
        })),
      },
      "PUT",
    );
    const equipe = atualizada.equipes.find(
      (item) => item.id === atualizada.minhaEquipeId,
    );
    setConvocados(equipe?.escalacao || []);
    alteradoRef.current = false;
    setAlterado(false);
  }

  async function salvarESair() {
    await operar(async () => {
      await salvar();
      await lembrar(etapa);
      onBack();
    });
  }

  async function irPara(passo: number) {
    await operar(async () => {
      if (passo === 2 && !escalaValida(convocados, quantidadeTitulares))
        throw new Error(
          `Selecione ${quantidadeTitulares} titulares com camisas diferentes de 1 a 99 antes de revisar.`,
        );
      if (etapa === 1 || passo === 2) await salvar();
      await lembrar(passo);
      setEtapa(passo);
    });
  }

  function atualizarConvocados(proximos: Convocado[]) {
    const normalizados = normalizarConvocados(proximos, quantidadeTitulares);
    convocadosRef.current = normalizados;
    setConvocados(normalizados);
    alteradoRef.current = true;
    setAlterado(true);
    setErro("");
  }

  function abrirCamisa(jogador: Jogador) {
    setJogadorCamisa(jogador);
    setCamisa(jogador.numCamisa ? String(jogador.numCamisa) : "");
    setConflito(null);
    setErro("");
    setDialogo("camisa");
  }

  function adicionar(jogador: Jogador) {
    if (ocupado || convocados.some((item) => item.jogador_id === jogador.id))
      return;
    if (convocados.length >= 50) {
      setErro("A convocação pode ter até 50 jogadores.");
      return;
    }
    if (!jogador.numCamisa) {
      abrirCamisa(jogador);
      return;
    }
    if (convocados.some((item) => item.numCamisa === jogador.numCamisa)) {
      setErro(
        "Esta camisa já aparece na convocação. Confira a numeração antes de adicionar.",
      );
      return;
    }
    atualizarConvocados([
      ...convocados,
      {
        jogador_id: jogador.id,
        numCamisa: jogador.numCamisa,
        titular: false,
        jogador,
      },
    ]);
  }

  function trocar(origem: number, destino: number) {
    const resultado = trocarConvocados(
      convocados,
      origem,
      destino,
      quantidadeTitulares,
    );
    if (resultado !== convocados) {
      atualizarConvocados(resultado);
      AccessibilityInfo.announceForAccessibility(
        "Jogadores trocados. Salve a escalação para confirmar.",
      );
    }
    setTroca(null);
  }

  function iniciarArraste() {
    scroll.current?.setNativeProps?.({ scrollEnabled: false });
    posicoes.current.clear();
    linhas.current.forEach((linha, id) =>
      linha.measureInWindow((x, y, width, height) =>
        posicoes.current.set(id, { x, y, width, height }),
      ),
    );
    setArrastando(true);
  }

  function soltar(origem: number, deltaX: number, deltaY: number) {
    scroll.current?.setNativeProps?.({ scrollEnabled: true });
    setArrastando(false);
    const inicio = posicoes.current.get(origem);
    if (!inicio || !Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    const x = inicio.x + inicio.width / 2 + deltaX;
    const y = inicio.y + inicio.height / 2 + deltaY;
    const destino = [...posicoes.current.entries()].find(
      ([id, area]) =>
        id !== origem &&
        x >= area.x &&
        x <= area.x + area.width &&
        y >= area.y &&
        y <= area.y + area.height,
    );
    if (destino) trocar(origem, destino[0]);
  }

  async function salvarCamisa() {
    if (!jogadorCamisa) return;
    if (
      !/^\d{1,2}$/.test(camisa) ||
      Number(camisa) < 1 ||
      Number(camisa) > 99
    ) {
      setErro("Informe uma camisa de 1 a 99.");
      return;
    }
    await operar(async () => {
      Keyboard.dismiss();
      const numero = Number(camisa);
      const resposta = await apiFetch(`/jogadores/${jogadorCamisa.id}`, {
        method: "PATCH",
        headers: {
          "x-clube-id": String(clubeId),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          numCamisa: numero,
          ...(conflito
            ? {
                confirmar_camisa: {
                  jogador_id: conflito.jogador_id,
                  camisa_anterior: conflito.camisa_anterior,
                },
              }
            : {}),
        }),
      });
      const corpo = await resposta.json();
      if (resposta.status === 409 && corpo.conflito_camisa) {
        setConflito(corpo.conflito_camisa);
        return;
      }
      if (!resposta.ok)
        throw new Error(
          corpo.error || "Não foi possível salvar a camisa. Tente novamente.",
        );
      setJogadores((lista) =>
        lista.map((item) =>
          item.id === jogadorCamisa.id
            ? { ...item, numCamisa: numero }
            : item.id === conflito?.jogador_id
              ? { ...item, numCamisa: conflito.camisa_anterior }
              : item,
        ),
      );
      const proximos = atualizarCamisas(
        convocados,
        jogadorCamisa.id,
        numero,
        conflito || undefined,
        quantidadeTitulares,
      );
      const afetaConvocacao = convocados.some(
        (item) =>
          item.jogador_id === jogadorCamisa.id ||
          item.jogador_id === conflito?.jogador_id,
      );
      if (afetaConvocacao) {
        atualizarConvocados(proximos);
        const atualizada = await executar(
          "escalacao",
          {
            jogadores: proximos.map(({ jogador_id, numCamisa, titular }) => ({
              jogador_id,
              numCamisa,
              titular,
            })),
          },
          "PUT",
        );
        setConvocados(
          atualizada.equipes.find(
            (item) => item.id === atualizada.minhaEquipeId,
          )?.escalacao || [],
        );
        alteradoRef.current = false;
        setAlterado(false);
        await lembrar(1);
      }
      setTroca(null);
      setDialogo(null);
    });
  }

  const titulares = convocados.filter((item) => item.titular);
  const reservas = convocados.filter((item) => !item.titular);
  const confirmada = minhaEquipe.pronta && !alterado;
  const todasConfirmadas =
    data.equipes.every((equipe) => equipe.pronta) && confirmada;
  const podeIniciar =
    data.podeSumula && partida.status === "PREPARADA" && todasConfirmadas;
  const jogadoresPorId = useMemo(
    () => new Map(jogadores.map((j) => [j.id, j])),
    [jogadores],
  );
  const elenco = useMemo(() => {
    const ids = new Set(convocados.map((j) => j.jogador_id));
    const termo = busca.trim().toLocaleLowerCase("pt-BR");
    return jogadores.filter(
      (item) =>
        !ids.has(item.id) &&
        `${item.nome} ${item.posicao} ${item.numCamisa || ""}`
          .toLocaleLowerCase("pt-BR")
          .includes(termo),
    );
  }, [jogadores, convocados, busca]);
  useEffect(() => setLimiteElenco(12), [busca, jogadores]);
  const responsavel =
    data.equipes.find((equipe) => equipe.clube_id === partida.sumula_clube_id)
      ?.clube.nome || data.organizador.nome;
  const times = [partida.mandante, partida.visitante];
  const idsTimes = [partida.mandante_id, partida.visitante_id];
  const dataFormatada = new Date(`${partida.data.slice(0, 10)}T12:00:00Z`)
    .toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
    .replace(/ de /g, " ")
    .replace(/\./g, "")
    .toUpperCase();

  function botao(
    label: string,
    onPress: () => void,
    primary = false,
    disabled = false,
    icon?: IconName,
  ) {
    return (
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityState={{ disabled: disabled || ocupado || restaurando }}
        disabled={disabled || ocupado || restaurando}
        onPress={onPress}
        style={[
          styles.button,
          primary && styles.primaryButton,
          (disabled || ocupado) && styles.disabled,
        ]}
      >
        <Text style={[styles.buttonText, primary && styles.primaryText]}>
          {label}
        </Text>
        {icon && (
          <Icon
            name={icon}
            size={16}
            color={primary ? "#fff" : colors.textoSecundario}
          />
        )}
      </TouchableOpacity>
    );
  }

  function linhaConvocado(item: Convocado, ordem: number) {
    const jogador = jogadoresPorId.get(item.jogador_id);
    return (
      <ConvocadoLinha
        key={item.jogador_id}
        jogador={{ ...item, jogador: jogador || item.jogador }}
        ordem={ordem}
        editavel
        selecionado={troca === item.jogador_id}
        bloqueado={ocupado}
        registrarRef={(id, ref) => {
          if (ref) linhas.current.set(id, ref);
          else linhas.current.delete(id);
        }}
        onArrastar={iniciarArraste}
        onSoltar={soltar}
        onTrocar={() => {
          if (troca === null) setTroca(item.jogador_id);
          else trocar(troca, item.jogador_id);
        }}
        onRemover={() => {
          atualizarConvocados(
            convocados.filter((row) => row.jogador_id !== item.jogador_id),
          );
          setTroca(null);
        }}
        onCamisa={() =>
          abrirCamisa(
            jogador || {
              id: item.jogador_id,
              nome: item.jogador?.nome || "Jogador",
              posicao: item.jogador?.posicao || "",
              numCamisa: item.numCamisa,
            },
          )
        }
      />
    );
  }

  function equipeRevisao(timeId: number, nome: string, escudo?: string) {
    const equipe = data.equipes.find((item) => item.time_id === timeId);
    const propria = equipe?.id === minhaEquipe.id;
    const lista = propria
      ? convocados
      : equipe?.publicada_em
        ? equipe.escalacao
        : [];
    return (
      <View
        style={[styles.panel, styles.reviewTeam, largo && styles.columnWide]}
      >
        <View style={styles.reviewHeader}>
          <Escudo nome={nome} url={escudo} pequeno />
          <View style={styles.flex}>
            <Text accessibilityRole="header" style={styles.heading}>
              {nome}
            </Text>
            <Text style={styles.muted}>
              {propria ? "Sua equipe" : "Adversário"} ·{" "}
              {equipe
                ? equipe.pronta && !(propria && alterado)
                  ? "Confirmada"
                  : "A confirmar"
                : "Time externo"}
            </Text>
          </View>
        </View>
        {!propria && !equipe?.publicada_em ? (
          <View style={styles.inline}>
            <Icon name="info" size={18} color={colors.textoSecundario} />
            <Text style={[styles.muted, styles.flex]}>
              {equipe
                ? "Aguardando o clube publicar a escalação. Os rascunhos são privados."
                : "Adversário fora do Ludora. A escalação não está disponível no sistema."}
            </Text>
          </View>
        ) : (
          [true, false].map((titular) => (
            <View key={String(titular)} style={styles.section}>
              <View style={styles.between}>
                <Text style={styles.name}>
                  {titular ? "Titulares" : "Reservas"}
                </Text>
                <Text style={styles.muted}>
                  {lista.filter((item) => item.titular === titular).length}
                  {titular ? `/${quantidadeTitulares}` : ""}
                </Text>
              </View>
              <View style={styles.list}>
                {lista
                  .filter((item) => item.titular === titular)
                  .map((item) => (
                    <ConvocadoLinha
                      key={item.jogador_id}
                      jogador={{
                        ...item,
                        jogador: propria
                          ? jogadores.find(
                              (jogador) => jogador.id === item.jogador_id,
                            ) || item.jogador
                          : item.jogador,
                      }}
                    />
                  ))}
              </View>
              {!lista.some((item) => item.titular === titular) && (
                <Text style={styles.muted}>
                  {titular
                    ? "Nenhum titular convocado."
                    : "Nenhum reserva convocado."}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    );
  }

  function fecharDialogo() {
    if (!ocupado) {
      setDialogo(null);
      setErro("");
    }
  }

  const tituloRodape =
    etapa === 0
      ? "Próximo passo: montar sua equipe"
      : etapa === 1
        ? confirmada
          ? "Equipe confirmada"
          : alterado
            ? "Alterações na escalação"
            : "Monte sua equipe"
        : confirmada
          ? "Sua equipe está confirmada"
          : "Confirme sua equipe";
  const descricaoRodape =
    etapa === 0
      ? "Você pode sair e continuar depois."
      : etapa === 1
        ? `${titulares.length}/${quantidadeTitulares} titulares · ${reservas.length} reservas${reservas.length ? "" : " · Considere convocar reservas."}`
        : confirmada
          ? todasConfirmadas
            ? podeIniciar
              ? "As equipes estão prontas para jogar."
              : `Aguardando ${responsavel} iniciar a partida.`
            : `Aguardando confirmação do ${adversario?.clube.nome || "outro clube"}.`
          : "A confirmação publica sua escalação para o outro clube.";

  return (
    <SafeAreaView
      edges={["top", "bottom", "left", "right"]}
      style={styles.root}
    >
      <View
        style={styles.header}
        onLayout={(event) => {
          const { y, height } = event.nativeEvent.layout;
          setMenuTop(y + height + 6);
        }}
      >
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Sair da preparação"
          onPress={sair}
          style={[styles.iconButton, styles.closeButton]}
        >
          <Icon name="close" size={19} color={colors.textoSecundario} />
        </TouchableOpacity>
        <Text
          accessibilityRole="header"
          numberOfLines={1}
          style={styles.headerTitle}
        >
          Preparação da partida
        </Text>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Opções da partida"
          accessibilityState={{ expanded: menu }}
          onPress={() => setMenu(true)}
          style={[styles.iconButton, styles.menuButton]}
        >
          <Icon
            name="dots-horizontal"
            size={20}
            color={colors.textoSecundario}
          />
        </TouchableOpacity>
      </View>
      <ScrollView
        ref={scroll}
        testID="preparacao-conteudo"
        scrollEnabled={!arrastando}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.content}
      >
        <View
          accessibilityLabel="Informações da partida"
          style={styles.context}
        >
          <View style={styles.contextTeams}>
            {times.map((time, index) => {
              const equipe = data.equipes.find(
                (item) => item.time_id === idsTimes[index],
              );
              const pronta =
                equipe?.pronta && !(equipe.id === minhaEquipe.id && alterado);
              return (
                <React.Fragment key={idsTimes[index]}>
                  {index === 1 && (
                    <View style={styles.contextCenter}>
                      <Text style={styles.category}>
                        {partida.categoria.nome.toUpperCase()}
                      </Text>
                      <Text style={styles.date}>{dataFormatada}</Text>
                      <Text style={styles.time}>
                        {partida.horario || "A definir"}
                      </Text>
                    </View>
                  )}
                  <View style={styles.team}>
                    <Escudo nome={time.nome} url={time.escudo} />
                    <Text style={styles.teamName} numberOfLines={2}>
                      {time.nome}
                    </Text>
                    <Text style={styles.role}>
                      {index === 0 ? "Mandante" : "Visitante"}
                    </Text>
                    {equipe?.clube_id === data.organizador.id && (
                      <View style={styles.organizer}>
                        <Icon name="handshake" size={12} color={colors.texto} />
                        <Text style={[styles.role, styles.confirmed]}>
                          Organizador
                        </Text>
                      </View>
                    )}
                    <View style={styles.readiness}>
                      <Icon
                        name={pronta ? "check-all" : "group"}
                        size={13}
                        color={
                          pronta ? colors.primaria : colors.textoSecundario
                        }
                      />
                      <Text
                        style={[
                          styles.readinessText,
                          pronta && styles.confirmed,
                        ]}
                      >
                        {equipe
                          ? pronta
                            ? "Confirmada"
                            : "A confirmar"
                          : "Time externo"}
                      </Text>
                    </View>
                  </View>
                </React.Fragment>
              );
            })}
          </View>
          <View style={styles.location}>
            <Icon name="location" size={16} color={colors.textoSecundario} />
            <Text style={styles.muted}>
              {partida.local || "Local a definir"}
            </Text>
          </View>
        </View>
        <View accessibilityLabel="Etapas da preparação" style={styles.stepper}>
          {["Dados", "Escalação", "Revisão"].map((nome, index) => (
            <TouchableOpacity
              key={nome}
              accessibilityRole="button"
              accessibilityLabel={`Etapa ${index + 1} de 3, ${nome}`}
              accessibilityState={{
                selected: etapa === index,
                disabled: ocupado || index > etapa,
              }}
              disabled={ocupado || index > etapa}
              onPress={() => {
                void irPara(index);
              }}
              style={[styles.step, index <= etapa && styles.activeStep]}
            >
              <View
                style={[
                  styles.stepNumber,
                  index === etapa && styles.activeStepNumber,
                ]}
              >
                {index < etapa ? (
                  <Icon name="check-all" size={16} color={colors.texto} />
                ) : (
                  <Text
                    style={[
                      styles.stepText,
                      index === etapa && styles.primaryText,
                    ]}
                  >
                    {index + 1}
                  </Text>
                )}
              </View>
              <Text
                style={[
                  styles.stepText,
                  index === etapa && styles.activeStepText,
                ]}
              >
                {nome}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.section}>
          <Text style={styles.muted}>Etapa {etapa + 1} de 3</Text>
          <Text accessibilityRole="header" style={styles.title}>
            {
              ["Dados da partida", "Monte sua equipe", "Revise sua equipe"][
                etapa
              ]
            }
          </Text>
          <Text style={styles.muted}>
            {
              [
                "Confira o confronto, a data e o local antes de montar sua equipe.",
                `Selecione ${quantidadeTitulares} titulares e convoque os reservas.`,
                "Confira os convocados antes de publicar a escalação.",
              ][etapa]
            }
          </Text>
          {etapa < 2 && adversario && (
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => setDialogo("adversario")}
              style={styles.link}
            >
              <Icon name="group" size={16} color={colors.textoSecundario} />
              <Text style={styles.linkText}>Ver escalação adversária</Text>
              <Icon
                name="chevron-right"
                size={14}
                color={colors.textoSecundario}
              />
            </TouchableOpacity>
          )}
        </View>
        {etapa === 0 && (
          <View style={styles.details}>
            <View style={styles.between}>
              <Text style={styles.heading}>Detalhes do confronto</Text>
              {partida.status === "AGENDADA" && (
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Editar dados da partida"
                  style={[styles.iconButton, styles.menuButton]}
                  onPress={() => {
                    setDataEdicao(
                      partida.data.slice(0, 10).split("-").reverse().join("/"),
                    );
                    setHorarioEdicao(partida.horario || "");
                    setLocalEdicao(partida.local || "");
                    setDialogo("editar");
                  }}
                >
                  <Icon name="edit" size={17} color={colors.textoSecundario} />
                </TouchableOpacity>
              )}
            </View>
            <View style={styles.inline}>
              <Icon
                name="trophy-outline"
                size={21}
                color={colors.textoSecundario}
              />
              <View style={styles.flex}>
                <Text style={styles.muted}>Competição</Text>
                <Text style={[styles.text, styles.name]}>
                  {partida.competicao?.nome || "Amistoso"}
                </Text>
              </View>
            </View>
            <View style={styles.inline}>
              <Icon
                name={
                  minhaEquipe.time_id === partida.mandante_id ? "home" : "bus"
                }
                size={21}
                color={colors.textoSecundario}
              />
              <View style={styles.flex}>
                <Text style={styles.muted}>Mando da sua equipe</Text>
                <Text style={[styles.text, styles.name]}>
                  {minhaEquipe.time_id === partida.mandante_id
                    ? "Em casa"
                    : "Fora de casa"}
                </Text>
              </View>
            </View>
            {adversario && (
              <View style={styles.inline}>
                <Icon name="info" size={17} color={colors.textoSecundario} />
                <Text style={[styles.muted, styles.flex]}>
                  Alterações de data, horário ou local precisam do aceite do{" "}
                  {adversario.clube.nome}.
                </Text>
              </View>
            )}
          </View>
        )}
        {etapa === 1 && (
          <>
            <View style={styles.between}>
              <View style={[styles.inline, styles.flex]}>
                <Icon name="info" size={16} color={colors.textoSecundario} />
                <Text style={[styles.muted, styles.flex]}>
                  Segure a alça de três pontos para arrastar.
                </Text>
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                onPress={() => setDialogo("ajuda")}
                style={styles.link}
              >
                <Text style={styles.linkText}>Como trocar</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.lineupColumns, largo && styles.columnsWide]}>
              <View
                onLayout={(event) =>
                  setAlturaConvocados(event.nativeEvent.layout.height)
                }
                style={[styles.panel, largo && styles.columnWide]}
              >
                <View style={styles.between}>
                  <Text style={styles.heading}>Titulares</Text>
                  <Text style={styles.muted}>
                    {titulares.length}/{quantidadeTitulares}
                  </Text>
                </View>
                <View style={styles.list}>
                  {titulares.map(linhaConvocado)}
                  {Array.from(
                    {
                      length: Math.max(
                        0,
                        quantidadeTitulares - titulares.length,
                      ),
                    },
                    (_, index) => (
                      <TouchableOpacity
                        key={`vaga-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel="Escolher um titular no elenco"
                        onPress={() => elencoInput.current?.focus()}
                        style={styles.emptySlot}
                      >
                        <Icon
                          name="account-plus-outline"
                          size={22}
                          color={colors.textoSecundario}
                        />
                        <Text style={[styles.muted, styles.flex]}>
                          Selecione um jogador no elenco
                        </Text>
                      </TouchableOpacity>
                    ),
                  )}
                </View>
                <View style={styles.between}>
                  <Text style={styles.heading}>Reservas</Text>
                  <Text style={styles.muted}>{reservas.length}</Text>
                </View>
                <View style={styles.list}>
                  {reservas.map((item, index) =>
                    linhaConvocado(item, titulares.length + index),
                  )}
                  {!reservas.length && (
                    <TouchableOpacity
                      accessibilityRole="button"
                      accessibilityLabel="Adicionar reservas pelo elenco"
                      onPress={() => elencoInput.current?.focus()}
                      style={styles.emptySlot}
                    >
                      <Icon
                        name="account-plus-outline"
                        size={22}
                        color={colors.textoSecundario}
                      />
                      <Text style={[styles.muted, styles.flex]}>
                        Convoque reservas pelo elenco
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
              {!largo && <View style={styles.lineupSeparator} />}
              <View
                style={[
                  styles.panel,
                  largo && styles.columnWide,
                  largo && { height: alturaConvocados },
                ]}
              >
                <View style={styles.between}>
                  <View style={styles.inline}>
                    <Icon name="group" size={18} color={colors.texto} />
                    <Text style={styles.heading}>
                      Elenco {minhaEquipe.categoria.nome.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.muted}>{elenco.length} disponíveis</Text>
                </View>
                <View style={styles.search}>
                  <Icon
                    name="search"
                    size={17}
                    color={colors.textoSecundario}
                  />
                  <TextInput
                    ref={elencoInput}
                    accessibilityLabel="Buscar jogador por nome, camisa ou posição"
                    value={busca}
                    onChangeText={setBusca}
                    placeholder="Buscar nome, camisa ou posição"
                    placeholderTextColor={colors.textoSecundario}
                    style={styles.searchInput}
                  />
                </View>
                <Text style={styles.muted}>
                  Os primeiros {quantidadeTitulares} convocados são titulares.
                  Os demais entram como reservas.
                </Text>
                {carregandoElenco ? (
                  <ActivityIndicator
                    accessibilityLabel="Carregando elenco"
                    color={colors.primaria}
                  />
                ) : erroElenco ? (
                  <>
                    <Text style={styles.error}>{erroElenco}</Text>
                    {botao("Tentar novamente", () => {
                      void carregarElenco();
                    })}
                  </>
                ) : (
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={largo ? styles.flex : styles.rosterScroll}
                    contentContainerStyle={styles.rosterContent}
                    scrollEventThrottle={100}
                    onContentSizeChange={(_, altura) => {
                      if (largo && altura < alturaConvocados)
                        setLimiteElenco((limite) =>
                          Math.min(limite + 12, elenco.length),
                        );
                    }}
                    onScroll={({
                      nativeEvent: {
                        contentOffset,
                        layoutMeasurement,
                        contentSize,
                      },
                    }) => {
                      if (
                        contentOffset.y + layoutMeasurement.height >=
                        contentSize.height - 160
                      )
                        setLimiteElenco((limite) =>
                          Math.min(limite + 12, elenco.length),
                        );
                    }}
                  >
                    {elenco.slice(0, limiteElenco).map((jogador) => (
                      <View key={jogador.id} style={styles.row}>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={
                            jogador.numCamisa
                              ? `Editar camisa ${numeroCamisa(jogador.numCamisa)} de ${jogador.nome}`
                              : `Definir camisa de ${jogador.nome}`
                          }
                          disabled={ocupado}
                          onPress={() => abrirCamisa(jogador)}
                          style={[
                            styles.shirt,
                            !jogador.numCamisa && styles.shirtMissing,
                          ]}
                        >
                          {jogador.numCamisa ? (
                            <Text style={styles.shirtNumber}>
                              {numeroCamisa(jogador.numCamisa)}
                            </Text>
                          ) : (
                            <Icon
                              name="tshirt-crew-outline"
                              size={22}
                              color={colors.texto}
                            />
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          accessibilityRole="button"
                          accessibilityLabel={`Convocar ${jogador.nome}`}
                          disabled={ocupado}
                          onPress={() => adicionar(jogador)}
                          style={[styles.inline, styles.flex]}
                        >
                          <View style={styles.playerIdentity}>
                            <Text numberOfLines={1} style={styles.name}>
                              {jogador.nome}
                            </Text>
                            <PositionLabel
                              position={jogador.posicao}
                              textStyle={styles.position}
                            />
                          </View>
                          <View style={styles.rowAction}>
                            <Icon
                              name="plus"
                              size={20}
                              color={colors.textoSecundario}
                            />
                          </View>
                        </TouchableOpacity>
                      </View>
                    ))}
                    {!elenco.length && (
                      <Text style={styles.muted}>
                        {busca
                          ? "Nenhum jogador encontrado para esta busca."
                          : "Todos os jogadores disponíveis já foram convocados."}
                      </Text>
                    )}
                  </ScrollView>
                )}
              </View>
            </View>
          </>
        )}
        {etapa === 2 && (
          <>
            <View style={styles.between}>
              <Text style={styles.heading}>Equipes convocadas</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Alterar sua equipe"
                disabled={ocupado}
                onPress={() => {
                  void irPara(1);
                }}
                style={[styles.iconButton, styles.menuButton]}
              >
                <Icon name="edit" size={17} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <View style={[styles.review, largo && styles.reviewWide]}>
              {times.map((time, index) => (
                <React.Fragment key={idsTimes[index]}>
                  {index === 1 && !largo && <View style={styles.separator} />}
                  {equipeRevisao(idsTimes[index], time.nome, time.escudo)}
                </React.Fragment>
              ))}
            </View>
          </>
        )}
        {!!erro && !dialogo && (
          <View accessibilityRole="alert" style={styles.notice}>
            <Icon name="info" size={18} color={colors.texto} />
            <Text style={[styles.error, styles.flex]}>{erro}</Text>
          </View>
        )}
        <View style={styles.footer}>
          <View style={styles.between}>
            <Text style={styles.name}>{tituloRodape}</Text>
            {ocupado && <ActivityIndicator color={colors.primaria} />}
          </View>
          <Text style={styles.muted}>{descricaoRodape}</Text>
          <View style={styles.footerActions}>
            {etapa === 1 &&
              botao("Salvar e sair", () => {
                void salvarESair();
              })}
            {etapa === 2 &&
              botao("Voltar à escalação", () => {
                void irPara(1);
              })}
            {etapa < 2
              ? botao(
                  etapa === 0 ? "Montar escalação" : "Salvar e revisar",
                  () => {
                    void irPara(etapa + 1);
                  },
                  true,
                  etapa === 1 && !escalaValida(convocados, quantidadeTitulares),
                  "chevron-right",
                )
              : !confirmada
                ? botao(
                    "Confirmar minha equipe",
                    () => {
                      void operar(async () => {
                        await salvar();
                        await executar("preparacao", {});
                        await lembrar(2);
                      });
                    },
                    true,
                    !escalaValida(convocados, quantidadeTitulares),
                    "check-all",
                  )
                : podeIniciar &&
                  botao(
                    "Iniciar partida",
                    () => {
                      void operar(async () => {
                        await executar(
                          "status",
                          { status: "AO_VIVO" },
                          "PATCH",
                        );
                      });
                    },
                    true,
                    false,
                    "chevron-right",
                  )}
          </View>
        </View>
      </ScrollView>
      <Modal
        visible={menu}
        transparent
        animationType="fade"
        onRequestClose={() => setMenu(false)}
      >
        <View style={{ flex: 1 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fechar opções"
            style={styles.backdrop}
            onPress={() => setMenu(false)}
          />
          <View
            accessibilityViewIsModal
            style={[styles.menu, { top: menuTop }]}
          >
            {partida.status === "AGENDADA" && (
              <TouchableOpacity
                accessibilityRole="button"
                style={styles.menuItem}
                onPress={() => {
                  setMenu(false);
                  setDataEdicao(
                    partida.data.slice(0, 10).split("-").reverse().join("/"),
                  );
                  setHorarioEdicao(partida.horario || "");
                  setLocalEdicao(partida.local || "");
                  setDialogo("editar");
                }}
              >
                <Icon name="edit" size={18} color={colors.textoSecundario} />
                <Text style={styles.text}>Editar partida</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              accessibilityRole="button"
              style={styles.menuItem}
              onPress={() => {
                setMenu(false);
                setDialogo("responsavel");
              }}
            >
              <Icon name="group" size={18} color={colors.textoSecundario} />
              <Text style={styles.text}>Responsável pela súmula</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <Modal
        visible={dialogo !== null}
        transparent
        animationType="slide"
        onRequestClose={fecharDialogo}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar janela"
            style={styles.backdrop}
            onPress={fecharDialogo}
          />
          <KeyboardAvoidingView
            pointerEvents="box-none"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={[
              styles.overlay,
              dialogoVisivel === "camisa" && styles.overlayCentered,
            ]}
          >
            <SafeAreaView
              edges={dialogoVisivel === "camisa" ? [] : ["bottom"]}
              accessibilityViewIsModal
              style={[
                styles.sheet,
                largo && styles.sheetWide,
                dialogoVisivel === "camisa" && styles.sheetCentered,
              ]}
            >
              <View style={styles.sheetHeader}>
                <Text
                  accessibilityRole="header"
                  style={[styles.heading, styles.flex]}
                >
                  {dialogoVisivel === "camisa"
                    ? conflito
                      ? "Confirmar troca de camisas"
                      : "Número da camisa"
                    : dialogoVisivel === "ajuda"
                      ? "Como trocar jogadores"
                      : dialogoVisivel === "adversario"
                        ? `Escalação do ${adversario?.clube.nome}`
                        : dialogoVisivel === "responsavel"
                          ? "Responsável pela súmula"
                          : "Editar partida"}
                </Text>
                <TouchableOpacity
                  accessibilityRole="button"
                  accessibilityLabel="Fechar janela"
                  disabled={ocupado}
                  onPress={fecharDialogo}
                  style={styles.iconButton}
                >
                  <Icon name="close" size={19} color={colors.textoSecundario} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.sheetBody}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.sheetContent}
              >
                {dialogoVisivel === "ajuda" && (
                  <Text style={styles.text}>{ajudaTroca}</Text>
                )}
                {dialogoVisivel === "adversario" &&
                  adversario &&
                  equipeRevisao(
                    adversario.time_id,
                    adversario.clube.nome,
                    times[idsTimes.indexOf(adversario.time_id)]?.escudo,
                  )}
                {dialogoVisivel === "responsavel" && (
                  <>
                    <View style={styles.conflict}>
                      <Text style={styles.muted}>Clube responsável</Text>
                      <Text style={styles.heading}>{responsavel}</Text>
                    </View>
                    <Text style={styles.muted}>
                      O responsável inicia a partida e registra o placar e os
                      eventos. Cada clube continua gerenciando sua própria
                      escalação.
                    </Text>
                    <Text style={styles.muted}>
                      {data.podeSumula && adversario
                        ? `A transferência para o ${adversario.clube.nome} depende do aceite na aba Solicitações.`
                        : adversario
                          ? `Você pode solicitar ao ${responsavel} a operação da súmula. A troca só ocorre após o aceite.`
                          : "Esta partida tem apenas um clube participante no Ludora."}
                    </Text>
                  </>
                )}
                {dialogoVisivel === "camisa" && jogadorCamisa && (
                  <>
                    <View style={styles.inline}>
                      <View style={styles.shirt}>
                        <Icon
                          name="tshirt-crew-outline"
                          size={23}
                          color={colors.primaria}
                        />
                      </View>
                      <View style={styles.flex}>
                        <Text style={styles.name}>{jogadorCamisa.nome}</Text>
                        <Text style={styles.muted}>
                          {minhaEquipe.categoria.nome.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    {conflito ? (
                      <>
                        <Text style={styles.heading}>
                          A camisa {numeroCamisa(Number(camisa))} já está em uso
                        </Text>
                        <Text style={styles.muted}>
                          Ela pertence a {conflito.nome} no{" "}
                          {conflito.categoria.toUpperCase()}.
                        </Text>
                        <View style={styles.conflict}>
                          <View style={styles.between}>
                            <Text style={[styles.text, styles.flex]}>
                              {jogadorCamisa.nome}
                            </Text>
                            <Text style={styles.name}>
                              Camisa {numeroCamisa(Number(camisa))}
                            </Text>
                          </View>
                          <View style={styles.between}>
                            <Text style={[styles.text, styles.flex]}>
                              {conflito.nome}
                            </Text>
                            <Text style={styles.muted}>
                              {conflito.camisa_anterior
                                ? `Camisa ${numeroCamisa(conflito.camisa_anterior)}`
                                : "Sem camisa definida"}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.muted}>
                          {conflito.camisa_anterior
                            ? "Ao confirmar, os jogadores trocam os números de camisa."
                            : "Ao confirmar, o outro jogador ficará sem número e será retirado da sua convocação. Defina uma nova camisa para convocá-lo novamente."}
                        </Text>
                      </>
                    ) : (
                      <>
                        <Text style={styles.name}>Número da camisa</Text>
                        <TextInput
                          accessibilityLabel="Número da camisa, de 1 a 99"
                          autoFocus
                          keyboardType="number-pad"
                          maxLength={2}
                          value={camisa}
                          onChangeText={(valor) => {
                            setCamisa(valor.replace(/\D/g, ""));
                            setErro("");
                          }}
                          placeholder="De 1 a 99"
                          placeholderTextColor={colors.textoSecundario}
                          style={styles.input}
                        />
                        <Text style={styles.muted}>
                          A numeração é exclusiva entre os jogadores ativos da
                          mesma categoria.
                        </Text>
                      </>
                    )}
                  </>
                )}
                {dialogoVisivel === "editar" && (
                  <>
                    <Text style={styles.name}>Data</Text>
                    <TextInput
                      accessibilityLabel="Data da partida"
                      placeholder="DD/MM/AAAA"
                      placeholderTextColor={colors.textoSecundario}
                      value={dataEdicao}
                      onChangeText={(valor) =>
                        setDataEdicao(mascaraDataPartida(valor))
                      }
                      keyboardType="number-pad"
                      style={styles.input}
                    />
                    <Text style={styles.name}>Horário</Text>
                    <TextInput
                      accessibilityLabel="Horário da partida"
                      placeholder="HH:MM"
                      placeholderTextColor={colors.textoSecundario}
                      value={horarioEdicao}
                      onChangeText={(valor) =>
                        setHorarioEdicao(mascaraHorarioPartida(valor))
                      }
                      keyboardType="numbers-and-punctuation"
                      style={styles.input}
                    />
                    <Text style={styles.name}>Local · opcional</Text>
                    <TextInput
                      accessibilityLabel="Local da partida"
                      value={localEdicao}
                      onChangeText={setLocalEdicao}
                      style={styles.input}
                    />
                    {adversario && (
                      <Text style={styles.muted}>
                        A alteração só será aplicada após o aceite do{" "}
                        {adversario.clube.nome}.
                      </Text>
                    )}
                  </>
                )}
                {!!erro && (
                  <Text accessibilityRole="alert" style={styles.error}>
                    {erro}
                  </Text>
                )}
              </ScrollView>
              <View style={styles.sheetFooter}>
                {dialogoVisivel === "camisa" ? (
                  <>
                    {botao(conflito ? "Voltar e editar" : "Cancelar", () => {
                      if (conflito) {
                        setConflito(null);
                        setErro("");
                      } else fecharDialogo();
                    })}
                    {botao(
                      conflito ? "Confirmar troca" : "Salvar camisa",
                      () => {
                        void salvarCamisa();
                      },
                      true,
                    )}
                  </>
                ) : dialogoVisivel === "editar" ? (
                  <>
                    {botao("Cancelar", fecharDialogo)}
                    {botao(
                      adversario ? "Solicitar alteração" : "Salvar dados",
                      () => {
                        void operar(async () => {
                          const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(
                            dataEdicao,
                          );
                          if (!match)
                            throw new Error(
                              "Informe a data no formato DD/MM/AAAA.",
                            );
                          const iso = `${match[3]}-${match[2]}-${match[1]}`;
                          const date = new Date(`${iso}T12:00:00Z`);
                          if (
                            Number.isNaN(date.getTime()) ||
                            date.toISOString().slice(0, 10) !== iso
                          )
                            throw new Error("Informe uma data válida.");
                          if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(horarioEdicao))
                            throw new Error(
                              "Informe um horário válido, de 00:00 a 23:59.",
                            );
                          await executar(
                            "",
                            {
                              data: iso,
                              horario: horarioEdicao,
                              local: localEdicao,
                            },
                            "PATCH",
                          );
                          setDialogo(null);
                          if (adversario)
                            Alert.alert(
                              "Alteração enviada",
                              `Aguarde o aceite do ${adversario.clube.nome} em Solicitações.`,
                            );
                        });
                      },
                      true,
                    )}
                  </>
                ) : (
                  <>
                    {botao("Fechar", fecharDialogo)}
                    {dialogoVisivel === "responsavel" &&
                      adversario &&
                      botao(
                        data.podeSumula
                          ? "Propor transferência"
                          : "Solicitar operação",
                        () => {
                          void operar(async () => {
                            await executar("sumula", {});
                            setDialogo(null);
                            Alert.alert(
                              "Solicitação enviada",
                              "O responsável só será alterado após o aceite do outro clube.",
                            );
                          });
                        },
                        true,
                      )}
                  </>
                )}
              </View>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
