import { SeletorEscalacao } from "./SeletorEscalacao";
import { equipesEscalacao, equipeEscalacaoVisivel } from "../utils/equipesEscalacao";
import { enviarComConfirmacao } from "../utils/confirmacaoPublicacao";
import { ErroConexao } from "../utils/request";
import { SearchField, IconButton, AppButton } from "./ui/Controls";
import { useSheetKeyboard } from "../hooks/useSheetKeyboard";
import { SheetFrame } from "./ui/AppSheet";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Alert,
  Animated,
  BackHandler,
  Image,
  Modal,
  Pressable,
  ScrollView,
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
  ATRASO_PUBLICACAO,
  type ItemPublicacao,
} from "../utils/filaPublicacao";
import {
  descreverAlteracao,
  criarIndiceAlteracoes,
  indexarEstatisticasJogadores,
  ESTATISTICAS_VAZIAS,
  disciplinaTempo,
  eventosSemJogador,
  NOMES_EVENTOS,
  placaresEventos,
  timeAutor,
  type TipoEvento,
} from "../utils/sumulaPartida";
import { createStyles } from "../styles/sumulaPartidaStyles";
import { PositionLabel } from "./PositionIcon";
import SubstituicaoPartida from "./SubstituicaoPartida";
import AnalisePartida from './AnalisePartida';
import PalpitePartida from './PalpitePartida';
import CompartilharPartida from './CompartilharPartida';
import { useFilaSumula } from '../hooks/useFilaSumula';
import { SelectField } from './ui/SelectField';
import { validarLance, ultimoLance, placarDoPeriodo, trocaValida, ultimoPeriodoIniciado, podeControlarAoVivo, podeAvancarTempo } from '../utils/validacaoSumula';

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
  minuto?: string;
  assistenteId?: number;
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
  headerAccessory?: React.ReactNode;
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
              : item.status === 'pausado' ? 'Pausado. Retome para ter novos 5 segundos.' : `Aguardando publicação · ${segundos}s`}
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
      {(item.status === "erro" || item.status === "pausado") && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={`Verificar envio de ${item.dados.titulo}`}
          onPress={tentar}
        >
          <Text style={styles.link}>{item.status === "pausado" ? "Retomar" : "Verificar"}</Text>
        </TouchableOpacity>
      )}
      {item.status !== "enviando" && (
        <TouchableOpacity
          style={{ paddingVertical: 9, paddingHorizontal: 5 }}
          accessibilityRole="button"
          accessibilityLabel={`Cancelar ${item.dados.titulo}`}
          onPress={cancelar}
        >
  <Text style={styles.text}>{item.status === "erro" ? "Dispensar aviso" : "Cancelar"}</Text>
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
  headerAccessory,
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
  const [desfazendo, setDesfazendo] = useState(false);
  const [remover, setRemover] = useState<EventoPartida | null>(null),
    [motivo, setMotivo] = useState("");
  const [busca, setBusca] = useState(""),
    [erro, setErro] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [extrasAbertos, setExtrasAbertos] = useState(false);
  const ultimaCaptura = useRef({ chave: '', em: 0 });
  const [limiteEventos, setLimiteEventos] = useState(30);
  const [menu, setMenu] = useState<{
    top: number;
    evento?: EventoPartida;
  } | null>(null);
  const [auditoriaAberta, setAuditoriaAberta] = useState(false);
  const [equipeAtiva, setEquipeAtiva] = useState<number | null>(null);
  const [tempoSelecionado, setTempoSelecionado] = useState(0);
  const [proximoTempo, setProximoTempo] = useState<number | null>(null);
  const [sai, setSai] = useState<number>(),
    [entra, setEntra] = useState<number>();
  const reposicao = minha?.escalacao.find(j => j.jogador_id === sai && j.expulso && j.reposicao_pendente);
  const equipeParaTroca = minha && { ...minha, escalacao: minha.escalacao.filter(j => !j.expulso || j.jogador_id === reposicao?.jogador_id).map(j => ({ ...j, titular: reposicao ? j.jogador_id === reposicao.jogador_id || (j.titular && !j.expulso) : j.titular })) };
  const [placarCasa, setPlacarCasa] = useState(""),
    [placarFora, setPlacarFora] = useState("");
  const ultimo = useRef(data),
    refreshAtual = useRef(onRefresh),
    montado = useRef(true),
    operando = useRef(false);
  if (data.partida.versao >= ultimo.current.partida.versao)
    ultimo.current = data;
  refreshAtual.current = onRefresh;
  const { fila, pendentes, restaurando, erroPersistencia } = useFilaSumula<Acao>(p.id, clubeId, async (item) => {
          if (AppState.currentState !== 'active') throw new Error('Envio pausado em segundo plano. Volte à partida e toque em Verificar.');
          const recenteAntes = await refreshAtual.current();
          if (recenteAntes) ultimo.current = recenteAntes;
          const atual = ultimo.current;
          if (AppState.currentState !== 'active') throw new Error('Envio pausado em segundo plano. Volte à partida e toque em Verificar.');
          if (atual.auditoria?.some(a => a.dados?.request_id === item.id)) return;
          if (item.dados.endpoint.endsWith('/substituicoes') && !podeControlarAoVivo(atual))
            throw new Error('Somente o responsável pela súmula pode fazer substituições durante o jogo.');
          if (!atual.podeSumula && !(atual.partida.status === 'FINALIZADA' && atual.podeCorrigir) &&
              !(item.dados.method === 'PATCH' && /eventos\/\d+$/.test(item.dados.endpoint) && atual.podePreparar))
            throw new Error('Seu acesso à súmula mudou. Atualize antes de continuar.');
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
            const confirmado = await enviarComConfirmacao(
              item.id,
              () => requisicaoPartida(
                item.dados.endpoint,
                clubeId,
                {
                  ...item.dados.payload,
                  versao: atual.partida.versao,
                  request_id: item.id,
                },
                item.dados.method,
              ),
              async () => {
                const recente = await refreshAtual.current();
                if (recente) ultimo.current = recente;
                return recente;
              },
            );
            if (confirmado) return;
          } catch (e) {
            if (e instanceof ErroConexao) {
              throw new Error("Envio sem confirmação. Confira a súmula ou toque em Verificar.");
            }
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
  });
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);
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
                    for (const item of fila.pendentes()) fila.cancelar(item.id);
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

  const vermelhosVistos = useRef(new Set(data.eventos.filter(e => e.tipo === 'CARTAO_VERMELHO').map(e => e.id)));
  useEffect(() => {
    for (const evento of data.eventos.filter(e => e.tipo === 'CARTAO_VERMELHO')) {
      if (vermelhosVistos.current.has(evento.id)) continue;
      vermelhosVistos.current.add(evento.id);
      const jogador = minha?.escalacao.find(j => j.jogador_id === evento.jogador_id);
      if (!podeControlarAoVivo(data) || !jogador?.reposicao_pendente) continue;
      Alert.alert('Jogador expulso', `${jogador.jogador?.nome} saiu de campo. Escolha um reserva para repor a vaga.`, [
        { text: 'Depois', style: 'cancel' },
        { text: 'Escolher reposição', onPress: () => { setSai(jogador.jogador_id); setEntra(undefined); abrir('substituir'); } },
      ]);
    }
  }, [data.eventos, minha, aoVivo, data.podeSumula]);

  const alterando = ocupado || restaurando || pendentes.length > 0;
  const tempo = aoVivo ? Math.min(tempoSelecionado || p.periodo_atual, p.periodo_atual) : tempoSelecionado;
  const consultandoTempo = aoVivo && tempo !== p.periodo_atual;
  const scrollDialogo = useRef<ScrollView>(null);
  const revelarCampo = useSheetKeyboard(scrollDialogo);
  const [arrastandoSubstituicao, setArrastandoSubstituicao] = useState(false);
  const totalTempos = Math.max(
    /(?:16|18)/.test(p.categoria.nome) ? 2 : 4,
    p.periodo_atual,
    ...data.eventos.map((e) => e.periodo),
  );
  const eventos = useMemo(
    () =>
      data.eventos
        .filter((e) => (aoVivo && !consultandoTempo) || !tempo || e.periodo === tempo)
        .sort((a, b) => b.id - a.id),
    [data.eventos, tempo, aoVivo, consultandoTempo],
  );
  const placares = useMemo(
    () => placaresEventos(data),
    [data.eventos, p.gols_mandante, p.gols_visitante],
  );
  const semJogador = useMemo(
    () => eventosSemJogador(data),
    [data.eventos, data.equipes],
  );
  const periodoEstatisticas =
    (finalizada || consultandoTempo) && tempo ? tempo : undefined;
  const estatisticas = useMemo(
    () => indexarEstatisticasJogadores(data.eventos, periodoEstatisticas),
    [data.eventos, periodoEstatisticas],
  );
  const historico = useMemo(() => {
    const indice = criarIndiceAlteracoes(data);
    return (data.auditoria || []).map((registro) => ({
      ...registro,
      descricao: descreverAlteracao(registro, data, indice),
    }));
  }, [data]);
  const equipesDaEscalacao = useMemo(() => equipesEscalacao(data), [data.equipes, p.mandante_id, p.visitante_id]);
  const equipeVisivel = equipeEscalacaoVisivel(equipesDaEscalacao, equipeAtiva, data.minhaEquipeId);
  const atorTime = form
    ? timeAutor(data, { time_id: form.timeId, gol_contra: form.contra })
    : undefined;
  const equipeAutor = data.equipes.find((e) => e.time_id === atorTime);
  const golContraSemAutor = !!form?.contra && !form.existente;
  const podeSubstituir = podeControlarAoVivo(data);
  const nomeTime = (id?: number | null) =>
    times.find((t) => t.id === id)?.nome || "Equipe";
  const roster = [...(equipeAutor?.publicada_em ? equipeAutor.escalacao : [])]
    .sort(
      (a, b) =>
        Number(b.titular) - Number(a.titular) || a.numCamisa - b.numCamisa,
    )
    .filter(j => !aoVivo || !!form?.existente || !j.expulso)
    .filter(
      (j) =>
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

  async function executar(
    endpoint: string,
    payload: object,
    method = "POST",
    sucesso?: () => void,
  ) {
    if (operando.current || restaurando || fila.pendentes().length) return;
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
    if (dialog === "substituir" && !podeControlarAoVivo(ultimo.current)) return;
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
    if (aoVivo && !existente) setTempoSelecionado(0);
    setBusca("");
    setExtrasAbertos(false);
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
    if (endpoint === "substituicoes" && !podeControlarAoVivo(ultimo.current)) { setErro("Somente o responsável pela súmula pode fazer substituições."); return; }
    if (endpoint === "substituicoes" && !trocaValida(minha, payload.sai as number, payload.entra as number)) { setErro("Escolha uma vaga elegível e um reserva disponível. Na troca comum, preserve a posição do goleiro."); return; }
    const caminho = endpoint.startsWith("/")
      ? endpoint
      : `/partidas/${p.id}/${endpoint}`;
    if (restaurando || operando.current) return;
    const chave = JSON.stringify([caminho, method, payload]);
    if (ultimaCaptura.current.chave === chave && Date.now() - ultimaCaptura.current.em < 600) return;
    ultimaCaptura.current = { chave, em: Date.now() };
    fila.adicionar({ endpoint: caminho, payload, method, titulo, tipo });
    setDialogo(null);
    setErro("");
  }
  function registrar(identificarDepois = false) {
    if (!form || ocupado || restaurando) return;
    const falha = validarLance(data, form, identificarDepois);
    if (falha) { setErro(falha); return; }
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
          jogador_id: identificarDepois || form.contra ? undefined : form.jogadorId,
          gol_contra: form.contra,
          minuto: form.minuto ? Number(form.minuto) : undefined,
          assistencia_jogador_id: !identificarDepois && !form.contra ? form.assistenteId : undefined,
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
  function pedirRemocao(e: EventoPartida, desfazer = false) {
    setDesfazendo(desfazer);
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
    const gol = [...data.eventos].sort((a, b) => b.id - a.id).find((e) => e.tipo === "GOL" && e.time_id === timeId);
    if (gol) pedirRemocao(gol);
    else {
      setPlacarCasa(String(p.gols_mandante));
      setPlacarFora(String(p.gols_visitante));
      abrir("placar");
    }
  }
  function mudarTempo(n: number) {
    if (!aoVivo) { setTempoSelecionado(Math.max(0, Math.min(n, ultimoPeriodoIniciado(data)))); return; }
    if (n > tempo && !podeAvancarTempo(data, tempo, totalTempos, alterando)) return;
    if (n <= p.periodo_atual) { setTempoSelecionado(n === p.periodo_atual ? 0 : Math.max(1, n)); return; }
    if (!data.podeSumula || alterando || n !== p.periodo_atual + 1 || n > totalTempos) return;
    setProximoTempo(n);
    abrir("tempo");
  }
  function button(
    label: string,
    press: () => void,
    primary = false,
    disabled = false,
    icon?: IconName,
  ) {
    return (
      <AppButton
        label={label}
        onPress={press}
        icon={icon}
        variant={primary ? "primary" : "secondary"}
        disabled={disabled || ocupado}
        style={{ flexShrink: 1, minWidth: 0 }}
      />
    );
  }
  function jogadorLinha(j: EquipePartida["escalacao"][number]) {
    const stats = estatisticas.get(j.jogador_id) || ESTATISTICAS_VAZIAS;
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
        ? form.contra ? `Gol contra a favor do ${nomeTime(form.timeId)}` : `Quem marcou pelo ${nomeTime(form.timeId)}?`
        : `Registrar ${NOMES_EVENTOS[form?.tipo || "FALTA"].toLowerCase()}`,
    remover: "Remover evento?",
    encerrar: "Encerrar a partida?",
    substituir: "Fazer substituição",
    responsavel: data.podeSumula ? "Transferir súmula" : "Solicitar responsabilidade",
    compartilhar: "Compartilhar resultado",
    placar: "Corrigir placar",
    solicitar: "Solicitar edição da súmula",
    tempo: "Iniciar próximo tempo?",
  };

  return (
    <SafeAreaView
      style={styles.root}
      edges={["top", "bottom", "left", "right"]}
    >
      <View style={styles.header}>
        <IconButton
          icon="close"
          label="Voltar às partidas"
          onPress={() => sairAtual.current()}
          variant="filled"
        />
        <Text numberOfLines={1} style={styles.headerTitle}>
          {p.mandante.nome} × {p.visitante.nome}
        </Text>
        {headerAccessory}
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          pendentes.length > 0 && { paddingBottom: 140 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {restaurando && data.podePreparar && <Text style={styles.muted}>Conferindo lançamentos salvos…</Text>}
        {!!erroPersistencia && <Text accessibilityRole="alert" style={styles.error}>{erroPersistencia}</Text>}
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
        {finalizada && <View style={[styles.row, { flexWrap: 'wrap' }]}><Text style={styles.muted}>Registros por tempo</Text>{Array.from({ length: ultimoPeriodoIniciado(data) + 1 }, (_, n) => <TouchableOpacity key={n} accessibilityRole="tab" accessibilityState={{ selected: tempo === n }} onPress={() => setTempoSelecionado(n)} style={[styles.button, tempo === n && { borderColor: colors.primaria }]}><Text style={styles.text}>{n ? `${n}º tempo` : 'Todos'}</Text></TouchableOpacity>)}</View>}
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
                {vencedor ? `Vitória do ${nomeTime(vencedor)}!` : "Empate entre as equipes"}
              </Text>
            </View>
          )}
          <View style={styles.teamLine}>
            {times.map((t, index) => (
              <React.Fragment key={t.id}>
                {index === 1 && (
                  <View style={styles.scores}>
                    {(consultandoTempo ? placarDoPeriodo(data, tempo) : [p.gols_mandante, p.gols_visitante]).map((gols, lado) => (
                      <React.Fragment key={lado}>
                        {lado === 1 && <Text style={styles.muted}>·</Text>}
                        <View style={styles.scoreColumn}>
                          {aoVivo && data.podeSumula && (
                            <TouchableOpacity
                              accessibilityRole="button"
                              accessibilityLabel={`Registrar gol de ${times[lado].nome}`}
                              disabled={ocupado || restaurando || gols >= 99}
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
        {aoVivo && (
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
              accessibilityState={{ disabled: !podeAvancarTempo(data, tempo, totalTempos, alterando) }}
              disabled={!podeAvancarTempo(data, tempo, totalTempos, alterando)}
              style={[styles.iconButton, styles.close, !podeAvancarTempo(data, tempo, totalTempos, alterando) && styles.disabled]}
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
                  disabled={ocupado || restaurando}
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
                  pedirRemocao(ultimoLance(data)!, true)
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
          {eventos.slice(0, limiteEventos).map((e, index) => {
            const direita = e.time_id === p.visitante_id;
            const permitido = podeOperar || (data.podePreparar && e.tipo === 'GOL' && !e.jogador_id && minha?.time_id === timeAutor(data, e) && aoVivo);
            return <React.Fragment key={e.id}>
              {(index === 0 || eventos[index - 1].periodo !== e.periodo) && <View style={styles.row}><View style={[styles.divider, styles.flex]} /><Text style={styles.tiny}>{e.periodo}º tempo</Text><View style={[styles.divider, styles.flex]} /></View>}
              <View style={{ flexDirection: direita ? 'row-reverse' : 'row', alignItems: 'flex-start', gap: 8 }}>
                {permitido && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Opções de ${NOMES_EVENTOS[e.tipo]} ${e.id}`} style={{ minWidth: 28, minHeight: 40, alignItems: 'center', justifyContent: 'center' }} onPress={event => setMenu({ evento: e, top: event.nativeEvent.pageY + 8 })}><View style={{ transform: [{ rotate: '90deg' }] }}><Icon name="dots-horizontal" size={18} color={colors.textoSecundario} /></View></TouchableOpacity>}
                <View style={styles.eventIcon}><EventoIcon tipo={e.tipo} size={18} /></View>
                <View style={{ flexShrink: 1, alignItems: direita ? 'flex-end' : 'flex-start', gap: 4, maxWidth: '76%' }}>
                  <Text style={styles.name}>{NOMES_EVENTOS[e.tipo] || e.tipo}{e.gol_contra ? ' contra' : ''}</Text>
                  <Text style={styles.tiny}>{nomeTime(e.time_id)}{e.minuto != null ? ` · ${e.minuto}′` : ''}</Text>
                  <Text style={[styles.name, { textAlign: direita ? 'right' : 'left' }]}>{e.jogador_id ? `${String(data.equipes.flatMap(t => t.escalacao).find(j => j.jogador_id === e.jogador_id)?.numCamisa || '').padStart(2, '0')} · ${e.jogador?.nome || 'Jogador'}` : data.equipes.some(t => t.time_id === timeAutor(data, e)) ? 'Jogador a identificar' : nomeTime(timeAutor(data, e))}</Text>
                  {e.tipo === 'GOL' && <Text style={styles.miniScore}>{placares.get(e.id)}</Text>}
                </View>
              </View>
            </React.Fragment>;
          })}
          {eventos.length > limiteEventos && <AppButton label={`Carregar mais acontecimentos (${eventos.length - limiteEventos})`} onPress={() => setLimiteEventos(v => v + 30)} />}
        </View>
        {(finalizada || (aoVivo && !data.podePreparar && !data.podeSumula)) && (
          <PalpitePartida data={data} />
        )}
        {finalizada && <AnalisePartida data={data} periodo={tempo || null} onPeriodoChange={value => setTempoSelecionado(value || 0)} />}
        {!!equipesDaEscalacao.length && (
          <View style={styles.section}>
            <View style={styles.between}>
              <Text style={styles.heading}>Escalação</Text>
              {podeSubstituir &&
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
            {podeSubstituir && minha?.escalacao.filter(j => j.reposicao_pendente).map(j => <View key={j.jogador_id} style={styles.notice}>
              <Text style={styles.name}>Expulsão · {j.jogador?.nome}</Text>
              <Text style={styles.muted}>Há uma vaga para reposição. O jogador expulso não pode retornar.</Text>
              {button('Escolher reposição', () => { setSai(j.jogador_id); setEntra(undefined); abrir('substituir'); }, false, alterando, 'swap-horizontal')}
            </View>)}
            <SeletorEscalacao equipes={equipesDaEscalacao} timeSelecionado={equipeVisivel?.time_id} onSelecionar={setEquipeAtiva} />
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
                            (j) => j.titular === titular && (!aoVivo || !j.expulso),
                          ).length
                        }
                      </Text>
                    </View>
                    <View style={styles.playerList}>
                      {equipeVisivel.escalacao
                        .filter((j) => j.titular === titular && (!aoVivo || !j.expulso))
                        .map(jogadorLinha)}
                    </View>
                    {!equipeVisivel.escalacao.some(
                      (j) => j.titular === titular && (!aoVivo || !j.expulso),
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
        {aoVivo && !!equipeVisivel?.escalacao.some(j => j.expulso) && <View style={styles.section}>
          <Text style={styles.muted}>EXPULSOS</Text>
          {equipeVisivel.escalacao.filter(j => j.expulso).map(jogadorLinha)}
        </View>}
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
              <Icon name="flag" size={19} color={colors.tituloErro} />
              <Text style={[styles.buttonText, { fontSize: 14, color: colors.tituloErro }]}>
                Finalizar partida
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {aoVivo && <AnalisePartida data={data} />}
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
                      ? `Última: ${historico[0].descricao.titulo}`
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
                historico.map((a) => (
                  <View
                    key={a.id}
                    style={{
                      gap: 5,
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: colors.linha,
                    }}
                  >
                    <Text style={styles.name}>{a.descricao.titulo}</Text>
                    {!!a.descricao.detalhes && (
                      <Text style={styles.muted}>{a.descricao.detalhes}</Text>
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
                  <Text style={styles.text}>{data.podeSumula ? "Transferir súmula" : "Solicitar responsabilidade pela súmula"}</Text>
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

      {dialogo && dialogo !== "compartilhar" && <SheetFrame
        title={nomesDialogo[dialogo]}
        disabled={ocupado}
        onClose={() => setDialogo(null)}
        expanded={dialogo === "substituir"}
      >
              {dialogo === "evento" && form ? (
                <>
                  <ScrollView ref={scrollDialogo} style={{ flexShrink: 1 }} contentContainerStyle={styles.sheetBody} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" nestedScrollEnabled>
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
                                assistenteId: undefined,
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
                      {golContraSemAutor
                        ? `Gol contra do adversário. Conta a favor do ${nomeTime(form.timeId)}, sem identificar jogador.`
                        : equipeAutor
                          ? "Selecione o jogador. Os atletas em campo aparecem primeiro."
                          : "Equipe externa ao Ludora. O registro será vinculado apenas à equipe."}
                    </Text>
                    {!!equipeAutor && !golContraSemAutor && (
                      <SearchField
                        accessibilityLabel="Buscar autor por nome ou camisa"
                        placeholder="Nome ou camisa"
                        value={busca}
                        onChangeText={setBusca}
                        containerStyle={{ flex: 0 }}
                        onFocus={revelarCampo}
                      />
                    )}
                    {!golContraSemAutor && <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerContent} nestedScrollEnabled keyboardShouldPersistTaps="handled">
                      {!roster.length && !!equipeAutor && <Text style={styles.muted}>Nenhum jogador encontrado.</Text>}
                      {roster.map(j => (
                        <TouchableOpacity key={j.jogador_id}
                          accessibilityRole="button"
                          accessibilityState={{
                            selected: form.jogadorId === j.jogador_id,
                          }}
                          accessibilityLabel={`Selecionar ${j.jogador?.nome}, camisa ${j.numCamisa}`}
                          disabled={aoVivo && !form.existente && !j.titular}
                          style={[
                            styles.pickerRow,
                            aoVivo && !form.existente && !j.titular && styles.disabled,
                            form.jogadorId === j.jogador_id &&
                              styles.pickerSelected,
                          ]}
                          onPress={() =>
                            setForm({ ...form, jogadorId: j.jogador_id, assistenteId: form.assistenteId === j.jogador_id ? undefined : form.assistenteId })
                          }
                        >
                          <View style={[styles.shirt, j.titular && { backgroundColor: colors.primaria } ]}>
                            <Text style={[styles.name, j.titular && { color: "#fff" }]}>
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
                          <View style={{ width: 19, height: 19, borderRadius: 10, borderWidth: 1, borderColor: form.jogadorId === j.jogador_id ? colors.primaria : colors.textoSecundario, backgroundColor: form.jogadorId === j.jogador_id ? colors.primaria : 'transparent', alignItems: 'center', justifyContent: 'center' }}>{form.jogadorId === j.jogador_id && <Icon name="check" size={13} color="#fff" />}</View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>}
                    {!form.existente && <View style={{ gap: 16 }}>
                      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded: extrasAbertos }} onPress={() => setExtrasAbertos(v => !v)} style={[styles.row, { minHeight: 36 }]}><Icon name={extrasAbertos ? 'chevron-down' : 'chevron-right'} size={14} color={colors.textoSecundario} /><Text style={styles.muted}>{form.tipo === 'GOL' && !form.contra ? 'Adicionar assistência e minuto' : 'Adicionar minuto'}</Text></TouchableOpacity>
                      {extrasAbertos && <View style={{ gap: 18 }}>
                        {form.tipo === 'GOL' && !form.contra && <SelectField label="Assistência (opcional)" value={form.assistenteId ? String(form.assistenteId) : ''} options={[{ value: '', label: 'Sem assistência' }, ...(equipeAutor?.escalacao || []).filter(j => j.jogador_id !== form.jogadorId && (!aoVivo || j.titular)).map(j => ({ value: String(j.jogador_id), label: `${String(j.numCamisa).padStart(2, '0')} · ${j.jogador?.nome}` }))]} onChange={value => setForm({ ...form, assistenteId: value ? Number(value) : undefined })} />}
                        <View style={{ gap: 8 }}><Text style={styles.name}>Minuto (opcional)</Text><TextInput onFocus={revelarCampo} accessibilityLabel="Minuto do lance" value={form.minuto || ''} onChangeText={value => setForm({ ...form, minuto: value.replace(/[^0-9]/g, '').slice(0, 3) })} keyboardType="number-pad" inputMode="numeric" maxLength={3} style={[styles.reason, { minHeight: 44 }]} placeholder="De 0 a 200" placeholderTextColor={colors.textoSecundario} /></View>
                      </View>}
                    </View>}
                    {form.tipo === 'GOL' && !form.existente && (
                      <TouchableOpacity
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: form.contra }}
                        aria-checked={form.contra}
                        style={{ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 11, borderRadius: 8, borderWidth: form.contra ? 2 : 1, borderColor: form.contra ? colors.tituloAtencao : colors.bordaAtencao, backgroundColor: colors.fundoAtencao }}
                        onPress={() => { setBusca(''); setErro(''); setForm({ ...form, contra: !form.contra, jogadorId: undefined, assistenteId: undefined }); }}
                      >
                        <Icon name="ball" size={22} color={colors.tituloAtencao} />
                        <View style={styles.flex}>
                          <Text style={[styles.name, { color: colors.tituloAtencao }]}>Gol contra do adversário</Text>
                          <Text style={[styles.tiny, { color: colors.corpoAtencao }]}>{form.contra ? 'Selecionado · sem identificar jogador.' : `Conta a favor do ${nomeTime(form.timeId)}.`}</Text>
                        </View>
                        <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: colors.tituloAtencao, backgroundColor: form.contra ? colors.tituloAtencao : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                          {form.contra && <Icon name="check" size={14} color={colors.fundo} />}
                        </View>
                      </TouchableOpacity>
                    )}
                    {(finalizada || form.existente) && (
                      <TextInput onFocus={revelarCampo}
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
                  </ScrollView>
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
                        (!!equipeAutor && !form.jogadorId && !golContraSemAutor) || restaurando ||
                          (finalizada && !motivo.trim()),
                      )}
                    </View>
                    {!form.existente && !!equipeAutor && !golContraSemAutor && (
                      <TouchableOpacity
                        accessibilityRole="button"
                        disabled={finalizada && !motivo.trim()}
                        onPress={() => registrar(true)}
                        style={[styles.button, { backgroundColor: colors.cardSecundario + "88" }]}
                      >
                        <Icon name="user" size={16} color={colors.texto} /><Text style={[styles.name, { textAlign: "center", flexShrink: 1 }]}>
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
                          encerrar. Os registros da partida serão incorporados ao scout
                          imediatamente; a avaliação por IA será recalculada em seguida.
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
                        <Text style={styles.text}>{remover.jogador?.nome || 'Sem jogador identificado'} · {remover.periodo}º tempo{remover.minuto != null ? ` · ${remover.minuto}′` : ''}</Text>
                        <Text style={styles.muted}>
                          O registro sairá da súmula e os totais serão
                          atualizados. A alteração ficará no histórico.
                        </Text>
                        <TextInput onFocus={revelarCampo}
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
                        Iniciar o {proximoTempo}º tempo? Os eventos anteriores serão preservados e os contadores passarão a mostrar o novo tempo.
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
                          {data.podeSumula
                            ? 'Envie uma proposta para o outro clube assumir a súmula. Você continua operando até ele aceitar.'
                            : 'Peça ao clube responsável para assumir a súmula. A operação muda somente após o aceite.'}
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
                        <TextInput onFocus={revelarCampo}
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
                                <TextInput onFocus={revelarCampo}
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
                        <TextInput onFocus={revelarCampo}
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
                    {dialogo === "substituir" && podeSubstituir && minha && (
                      <><Text style={styles.muted}>{reposicao ? `Escolha um reserva para a vaga de ${reposicao.jogador?.nome}. O expulso não poderá voltar.` : 'Selecione quem sai e quem entra. Mantenha um goleiro em campo.'}</Text>{!!sai && !!entra && !trocaValida(minha, sai, entra) && <Text accessibilityRole="alert" style={styles.error}>Selecione um reserva elegível. A troca comum deve manter um goleiro em campo.</Text>}<SubstituicaoPartida
                        equipe={equipeParaTroca!}
                        sai={sai}
                        entra={entra}
                        onSai={id => { if (!reposicao) setSai(id); }}
                        onEntra={setEntra}
                        bloqueado={alterando}
                        onArrastando={(ativo) => {
                          scrollDialogo.current?.setNativeProps?.({
                            scrollEnabled: !ativo,
                          });
                          setArrastandoSubstituicao(ativo);
                        }}
                      /></>
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
                              { partida_id: p.id, motivo: motivo.trim(), desfeito: desfazendo },
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
                              { periodo: proximoTempo },
                              "PATCH",
                              () => { setDialogo(null); setTempoSelecionado(0); setProximoTempo(null); },
                            );
                          },
                          true,
                          alterando || proximoTempo !== p.periodo_atual + 1,
                        )}
                      {dialogo === "responsavel" &&
                        aoVivo &&
                        data.podePreparar &&
                        data.equipes.length > 1 &&
                        button(
                          data.podeSumula
                            ? "Solicitar transferência"
                            : "Pedir responsabilidade",
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
                              { sai, entra, periodo: p.periodo_atual, reposicao_expulsao: !!reposicao },
                              `Substituição · ${minha?.clube.nome}`,
                              "SUBSTITUICAO",
                            ),
                          true,
                          !podeSubstituir || !trocaValida(minha, sai, entra) || alterando,
                        )}

                    </View>
                  </View>
                </>
              )}
      </SheetFrame>}
      {dialogo === 'compartilhar' && <CompartilharPartida data={data} link={link} onClose={() => setDialogo(null)} />}
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
                tentar={() => item.status === "pausado" ? fila.retomar() : fila.tentar(item.id)}
              />
            ))}
          </ScrollView>
        )}
      </View>
    </SafeAreaView>
  );
}
