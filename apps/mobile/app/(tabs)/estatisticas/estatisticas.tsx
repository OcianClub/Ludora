import { CategoryFilterScroll } from "@/src/components/CategoryPager";
import { SearchField, IconButton, AppButton } from "@/src/components/ui/Controls";
import { PositionLabel } from "@/src/components/PositionIcon";
import { Icon, type IconName } from "@ludora/icons";
import React, {
  memo,
  useDeferredValue,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from "react";
import {
  AppState,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  FlatList,
  Modal,
  RefreshControl,
} from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  CategoryPager,
  type CategoryPagerHandle,
} from "@/src/components/CategoryPager";
import { CategoryPageMotion } from "@/src/components/CategoryPageMotion";
import { useCategoryPagerMotion } from "@/src/hooks/useCategoryPagerMotion";

import { obterPerfisJogadores, Jogador } from "@/src/services/mlService";
import { Header } from "@/src/components/Header";
import { HeaderClube } from "@/src/components/HeaderClube";
import { PaginaCategoria } from "@/src/components/PaginaCategoria";
import {
  CarrosselSubs,
  SUBS_INICIACAO,
  SUBS_BASE,
} from "@/src/components/CarrosselSubs";
import { useTheme, type ThemeColors } from "@/src/contexts/ThemeContext";
import { createStyles } from "@/src/styles/estatisticasStyles";
import { CardsSkeleton } from "@/src/components/Skeleton";
import { ErroCarregamento } from "@/src/components/ErroCarregamento";
import { AvisoConsultaLocal } from "@/src/components/AvisoConsultaLocal";
import {
  ScoutHelp,
  ScoutFilters,
  ORDENS_SCOUT,
  ScoutSortIndicator,
  ScoutSheet,
} from "@/src/components/ScoutControls";
import { ContextoAtletaScout } from "@/src/components/ContextoAtletaScout";
import { consultarComCopiaLocal } from "@/src/services/cacheConsultas";
import { selecionarJogadoresLocais } from "@/src/utils/dadosConsultaLocal";
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";
import { permiteConsultaLocal } from "@/src/utils/request";
import { criarControleRequisicoes } from "@/src/utils/request";
import { iniciarMedicaoCarregamento } from "@/src/utils/desempenho";
import {
  filtrarJogadoresScout,
  type PerfilScout,
  type OrdenacaoScout,
  type DirecaoScout,
  type FiltrosScout,
  FILTROS_SCOUT_INICIAIS,
  proximaOrdenacaoScout,
} from "@/src/utils/filtrosScout";
import {
  criarCatalogoScout,
  chaveCategoriaScout,
  CATEGORIA_SCOUT_VAZIA,
  normalizarCategoriaScout as normalizarCategoria,
} from "@/src/utils/catalogoScout";

// ── Cores por perfil ──────────────────────────────────────────────────────────
const getCoresPerfil = (
  colors: ThemeColors,
  escuro: boolean,
): Record<string, string> => ({
  Artilheiro: colors.primaria,
  Paredão: escuro ? "#2DD4BF" : "#087F72",
  Armador: escuro ? "#B69AFF" : "#703BD1",
  "Sem dados": colors.textoSecundario,
});

const OPCOES_ORDENACAO = ORDENS_SCOUT;
const ATLETAS_POR_PAGINA = 10;

// ── Card da Lista ─────────────────────────────────────────────────────────────
const CardJogador = memo(function CardJogador({
  jogador,
  onSelecionar,
}: {
  jogador: Jogador;
  onSelecionar: (jogador: Jogador) => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const goleiro = /goleiro/i.test(jogador.posicao);
  return <TouchableOpacity style={styles.cardJogador} onPress={() => onSelecionar(jogador)} activeOpacity={0.8}
    accessibilityRole="button" accessibilityLabel={`Ver ficha de ${jogador.nome}. ${jogador.jogos_disputados} convocações, ${jogador.gols} gols, ${goleiro ? jogador.defesas + ' defesas' : jogador.assistencias + ' assistências'}`}>
    <View style={styles.cardNumCamisa}><Text style={styles.cardNumCamisaTxt}>{jogador.numCamisa == null ? '—' : String(jogador.numCamisa).padStart(2, '0')}</Text></View>
    <View style={styles.cardInfos}>
      <Text style={styles.cardNome} numberOfLines={1}>{jogador.nome}</Text>
      <PositionLabel position={jogador.posicao} textStyle={styles.cardSub} />
    </View>
    <View style={styles.cardStats}>
      {([['CONV', jogador.jogos_disputados], ['GOL', jogador.gols], [goleiro ? 'DEF' : 'AST', goleiro ? jogador.defesas : jogador.assistencias]] as const).map(([label, value]) => <View key={label} style={{ minWidth: 24, alignItems: 'center', gap: 3 }}>
        <Text style={styles.cardMetricValue}>{value}</Text><Text style={styles.cardMetricText}>{label}</Text>
      </View>)}
    </View>
  </TouchableOpacity>;
});

// ── Modal de Scout ────────────────────────────────────────────────────────────
function ModalScout({
  jogador,
  onFechar,
  clubeId,
  consultaLocal,
}: {
  jogador: Jogador;
  onFechar: () => void;
  clubeId: number;
  consultaLocal: boolean;
}) {
  const { colors, tema } = useTheme();
  const styles = createStyles(colors);
  const corPerfil =
    getCoresPerfil(colors, tema === "dark")[jogador.perfil_ml] ??
    colors.textoSecundario;
  const idade = jogador.idade ?? null;

  const stats = [
    {
      label: "Convocações",
      valor: jogador.jogos_disputados,
      icone: "soccer-field",
    },
    { label: "Gols", valor: jogador.gols, icone: "soccer" },
    { label: "Assist.", valor: jogador.assistencias, icone: "handshake" },
    { label: "Defesas", valor: jogador.defesas, icone: "shield-check" },
    { label: "Faltas", valor: jogador.faltas_cometidas, icone: "whistle" },
    { label: "Amarelos", valor: jogador.cartoes_amarelos, icone: "card" },
    { label: "Vermelhos", valor: jogador.cartoes_vermelhos, icone: "card" },
  ] as const;

  return (
    <Modal
      visible
      animationType="slide"
      transparent={false}
      onRequestClose={onFechar}
    >
      <SafeAreaView
        style={styles.scoutContainer}
        edges={["top", "bottom", "left", "right"]}
      >
        <Header
          title="Ficha do atleta"
          semSafeArea
          btnVoltar="arrow-left"
          showLogo={false}
          showProfile={false}
          onBtnVoltar={onFechar}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scoutContent}
        >
          <View style={styles.scoutIdentidade}>
            <View style={styles.scoutAvatarNum}>
              {jogador.numCamisa != null ? (
                <Text style={styles.scoutAvatarNumTxt}>
                  #{jogador.numCamisa}
                </Text>
              ) : (
                <Icon
                  name="tshirt-crew-outline"
                  size={24}
                  color={colors.texto}
                />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: 7 }}>
              <Text style={styles.scoutNome} numberOfLines={2}>
                {jogador.nome}
              </Text>
              <PositionLabel
                position={jogador.posicao}
                textStyle={styles.scoutPosicao}
                suffix={` · ${jogador.categoria.toUpperCase()}${idade != null ? ` · ${idade} anos` : ""}`}
              />
            </View>
          </View>

          <ContextoAtletaScout
            key={`${clubeId}:${jogador.id_jogador}`}
            jogadorId={jogador.id_jogador}
            clubeId={clubeId}
            consultaLocal={consultaLocal}
          />

          {consultaLocal && (
            <>
              <Text style={styles.scoutSecaoLabel}>TOTAIS REGISTRADOS</Text>
              <Text style={styles.scoutRadarNota}>
                Histórico geral do cadastro atual, somente partidas finalizadas.
                Não corresponde apenas ao recorte recente acima.
              </Text>
              <View style={styles.scoutStatsGrid}>
                {stats.map((s) => (
                  <View key={s.label} style={styles.scoutStatCard}>
                    <Icon
                      name={s.icone}
                      size={22}
                      color={corPerfil}
                      style={{ opacity: 0.8 }}
                    />
                    <Text style={styles.scoutStatValor}>{s.valor}</Text>
                    <Text style={styles.scoutStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>

              <View style={{ height: 60 }} />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Tela Principal ────────────────────────────────────────────────────────────

export default function Estatisticas() {
  const { colors, tema } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const coresPerfil = useMemo(
    () => getCoresPerfil(colors, tema === "dark"),
    [colors, tema],
  );
  const { clubeAtivo, podeGerenciar, carregandoClubeAtivo } = useClubeAtivo();
  const carregouUmaVez = useRef(false);
  const clubeCarregadoId = useRef<number | null>(null);
  const controle = useRef(criarControleRequisicoes()).current;
  const medicaoTela = useRef<ReturnType<
    typeof iniciarMedicaoCarregamento
  > | null>(null);
  const pagerRef = useRef<CategoryPagerHandle>(null);
  const paginasScroll = useRef<Record<number, FlatList<Jogador> | null>>({});
  const pagerMotion = useCategoryPagerMotion(pagerRef);
  const progressoPagina = pagerMotion.progress;
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [consultaLocal, setConsultaLocal] = useState<number | null>(null);
  const consultaLocalRef = useRef(consultaLocal);
  consultaLocalRef.current = consultaLocal;
  const cargaEmAndamento = useRef<{
    pedido: number;
    clubeId: number | undefined;
  } | null>(null);
  const jogadoresAtuais = useRef(jogadores);
  jogadoresAtuais.current = jogadores;
  const [falhaAtualizacao, setFalhaAtualizacao] = useState(false);
  const [consultandoServidor, setConsultandoServidor] = useState(false);
  const [busca, setBusca] = useState("");
  const buscaAplicada = useDeferredValue(busca);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoScout>("NOTA");
  const [empate, setEmpate] = useState<{
    titulo: string;
    jogadores: Jogador[];
  } | null>(null);
  const [direcao, setDirecao] = useState<DirecaoScout>("");
  const [filtros, setFiltros] = useState<FiltrosScout>(FILTROS_SCOUT_INICIAIS);
  const [filtrosAbertos, setFiltrosAbertos] = useState(false);
  const [ajudaAberta, setAjudaAberta] = useState(false);
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilScout>("Todos");
  const [limitesPorCategoria, setLimitesPorCategoria] = useState<Record<string, number>>({});
  const [atualizando, setAtualizando] = useState(false);
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Jogador | null>(
    null,
  );

  useEffect(() => {
    setJogadorSelecionado(null);
  }, [clubeAtivo?.id]);

  const [subIndex, setSubIndex] = useState(0);
  const [tipoAtivo, setTipoAtivo] = useState<"INICIACAO" | "BASE">("INICIACAO");

  const subsAtivos = tipoAtivo === "INICIACAO" ? SUBS_INICIACAO : SUBS_BASE;
  const trocarSub = useCallback(
    (index: number, velocity?: number) => {
      pagerMotion.goTo(index, velocity);
    },
    [pagerMotion.goTo],
  );
  const trocarTipo = useCallback((tipo: "INICIACAO" | "BASE") => {
    setTipoAtivo(tipo);
    setSubIndex(0);
  }, []);

  const carregarDados = useCallback(
    async (silencioso = false, revalidar = false) => {
      const atual = cargaEmAndamento.current;
      if (
        atual?.clubeId === clubeAtivo?.id &&
        atual &&
        controle.atual(atual.pedido)
      )
        return;
      medicaoTela.current = iniciarMedicaoCarregamento("scout:estado-pronto");
      const pedido = controle.iniciar();
      cargaEmAndamento.current = { pedido, clubeId: clubeAtivo?.id };
      setFalhaAtualizacao(false);
      setConsultandoServidor(true);
      const mudouClube = clubeCarregadoId.current !== clubeAtivo?.id;
      if (!silencioso || mudouClube) setCarregando(true);
      if (mudouClube) {
        setJogadores([]);
        setConsultaLocal(null);
      }
      setErro(null);
      try {
        if (!clubeAtivo?.id) return;
        let ajustouCategoria = false;
        const exibir = (todos: Jogador[], salvoEm: number | null) => {
          if (!controle.atual(pedido)) return;
          setJogadores((anteriores) =>
            anteriores === todos ? anteriores : todos,
          );
          setConsultaLocal(salvoEm);
          setCarregando(false);
          clubeCarregadoId.current = clubeAtivo.id;
          if (todos.length > 0 && mudouClube && !ajustouCategoria) {
            ajustouCategoria = true;
            const primeiro = todos[0];
            if (primeiro.categoria_tipo) setTipoAtivo(primeiro.categoria_tipo);

            const subsDoTipo =
              primeiro.categoria_tipo === "INICIACAO"
                ? SUBS_INICIACAO
                : SUBS_BASE;

            const idxSub = subsDoTipo.findIndex(
              (s) =>
                normalizarCategoria(s.title) ===
                normalizarCategoria(primeiro.categoria),
            );

            if (idxSub >= 0) {
              setSubIndex(idxSub);
              progressoPagina.value = idxSub;
              pagerRef.current?.setPageWithoutAnimation(idxSub);
            }
          }
        };
        const resultado = await consultarComCopiaLocal<Jogador[]>({
          clubeId: clubeAtivo.id,
          recurso: "scout",
          carregar: () =>
            obterPerfisJogadores(undefined, clubeAtivo.id, revalidar),
          selecionar: selecionarJogadoresLocais,
          onLocal: (local) => {
            if (mudouClube || !carregouUmaVez.current)
              exibir(local.dados, local.salvoEm);
          },
        });
        exibir(
          resultado.dados,
          resultado.origem === "local" ? resultado.salvoEm : null,
        );
      } catch (e: any) {
        if (controle.atual(pedido)) {
          if (
            permiteConsultaLocal(e) &&
            clubeCarregadoId.current === clubeAtivo?.id &&
            jogadoresAtuais.current.length
          ) {
            setFalhaAtualizacao(true);
          } else {
            setJogadores([]);
            setConsultaLocal(null);
            setErro(e?.message ?? "Erro na conexão");
          }
        }
      } finally {
        if (cargaEmAndamento.current?.pedido === pedido)
          cargaEmAndamento.current = null;
        if (controle.atual(pedido)) {
          carregouUmaVez.current = true;
          setCarregando(false);
          setConsultandoServidor(false);
        }
      }
    },
    [clubeAtivo?.id, controle, progressoPagina],
  );

  useEffect(() => {
    if (!carregando && medicaoTela.current) {
      medicaoTela.current({ resultado: erro ? "erro" : "dados" });
      medicaoTela.current = null;
    }
  }, [carregando, jogadores, erro]);

  useFocusEffect(
    useCallback(() => {
      if (carregandoClubeAtivo || !podeGerenciar) return;
      carregarDados(carregouUmaVez.current);
      const appState = AppState.addEventListener("change", (estado) => {
        if (estado === "active") void carregarDados(true, true);
      });
      const intervalo = setInterval(() => {
        if (
          consultaLocalRef.current !== null &&
          AppState.currentState === "active"
        )
          void carregarDados(true);
      }, 30_000);
      return () => {
        appState.remove();
        clearInterval(intervalo);
        controle.invalidar();
      };
    }, [carregarDados, carregandoClubeAtivo, podeGerenciar]),
  );
  useEffect(() => {
    setJogadorSelecionado(null);
    setBusca("");
    setPerfilAtivo("Todos");
    setFiltros(FILTROS_SCOUT_INICIAIS);
    setDirecao("");
    setOrdenacao("NOTA");
    setFiltrosAbertos(false);
    setAjudaAberta(false);
  }, [clubeAtivo?.id]);
  useEffect(() => {
    Object.values(paginasScroll.current).forEach((scroll) =>
      scroll?.scrollToOffset({ offset: 0, animated: false }),
    );
  }, [perfilAtivo, buscaAplicada, ordenacao, direcao, filtros, tipoAtivo]);

  useEffect(() => {
    setLimitesPorCategoria({});
  }, [clubeAtivo?.id, tipoAtivo, buscaAplicada, perfilAtivo, ordenacao, direcao, filtros]);

  const atualizarScout = useCallback(async () => {
    setAtualizando(true);
    try {
      await carregarDados(true, true);
    } finally {
      setAtualizando(false);
    }
  }, [carregarDados]);

  const catalogo = useMemo(() => criarCatalogoScout(jogadores), [jogadores]);
  const categorias = useMemo(
    () =>
      subsAtivos.map((sub) => {
        const dados =
          catalogo.get(chaveCategoriaScout(tipoAtivo, sub.title)) ??
          CATEGORIA_SCOUT_VAZIA;
        return {
          categoriaAtual: sub.title,
          jogadoresDaCategoria: dados.jogadores,
          resumo: dados.resumo,
          contagens: dados.contagens,
        };
      }),
    [subsAtivos, catalogo, tipoAtivo],
  );
  const paginas = useMemo(
    () =>
      categorias.map((categoria) => ({
        ...categoria,
        jogadoresFiltrados: filtrarJogadoresScout(
          categoria.jogadoresDaCategoria,
          buscaAplicada,
          perfilAtivo,
          ordenacao,
          direcao,
          filtros,
        ),
      })),
    [categorias, buscaAplicada, perfilAtivo, ordenacao, direcao, filtros],
  );
  const renderizarJogador = useCallback(
    ({ item }: { item: Jogador }) => (
      <CardJogador jogador={item} onSelecionar={setJogadorSelecionado} />
    ),
    [],
  );

  const conteudoPaginas = useMemo(
    () =>
      paginas.map(
        (
          {
            categoriaAtual,
            jogadoresDaCategoria,
            jogadoresFiltrados,
            resumo,
            contagens,
          },
          indexPagina,
        ) => (
          <View
            key={`pagina-${indexPagina}`}
            style={{ flex: 1 }}
            collapsable={false}
          >
            <CategoryPageMotion
              index={indexPagina}
              progress={progressoPagina}
              origin={pagerMotion.origin}
              settling={pagerMotion.settling}
            >
              <PaginaCategoria grupo={`${clubeAtivo?.id}-${tipoAtivo}`} preparar>
                {carregando ? (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listaContent}
                  >
                    <Text
                      style={styles.contextNote}
                      accessibilityLiveRegion="polite"
                    >
                      Carregando atletas da categoria…
                    </Text>
                    <CardsSkeleton rows={3} />
                  </ScrollView>
                ) : erro ? (
                  <View style={styles.centralizado}>
                    <ErroCarregamento
                      titulo="Não foi possível carregar as estatísticas"
                      descricao="Confira sua conexão e tente atualizar os dados dos jogadores novamente."
                      onTentarNovamente={() => void carregarDados(false, true)}
                    />
                  </View>
                ) : (
                  <FlatList<Jogador>
                    ref={(ref) => {
                      paginasScroll.current[indexPagina] = ref;
                    }}
                    data={jogadoresFiltrados.slice(0, limitesPorCategoria[categoriaAtual] ?? ATLETAS_POR_PAGINA)}
                    keyExtractor={(jogador) => String(jogador.id_jogador)}
                    initialNumToRender={6}
                    maxToRenderPerBatch={6}
                    windowSize={3}
                    renderItem={renderizarJogador}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.telaContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    refreshControl={
                      <RefreshControl
                        refreshing={atualizando}
                        onRefresh={atualizarScout}
                        tintColor={colors.primaria}
                        colors={[colors.primaria]}
                      />
                    }
                    ListHeaderComponent={
                      <>
                        {!!jogadoresDaCategoria.length && (
                          <View style={styles.resumoCards}>
                            {(
                              [
                                {
                                  label: "Mais gols",
                                  field: "gols",
                                  value: resumo.artilheiro?.gols ?? 0,
                                },
                                {
                                  label: "Assistências",
                                  field: "assistencias",
                                  value: resumo.assistente?.assistencias ?? 0,
                                },
                                {
                                  label: "Convocações",
                                  field: "jogos_disputados",
                                  value: resumo.lider?.pontos ?? 0,
                                },
                              ] as const
                            ).map((h, highlightIndex) => {
                              const lideres =
                                h.value > 0
                                  ? jogadoresDaCategoria.filter(
                                      (j) => j[h.field] === h.value,
                                    )
                                  : [];
                              return (
                                <TouchableOpacity
                                  key={h.label}
                                  style={[styles.resumoCard, highlightIndex > 0 && { borderLeftWidth: 1, borderLeftColor: colors.borda }]}
                                  activeOpacity={0.8}
                                  disabled={!lideres.length}
                                  accessibilityRole="button"
                                  accessibilityLabel={`${h.label}: ${h.value}${lideres.length > 1 ? `, ${lideres.length} atletas empatados` : lideres[0] ? `, ${lideres[0].nome}` : ", sem registros"}`}
                                  onPress={() =>
                                    lideres.length > 1
                                      ? setEmpate({
                                          titulo: h.label,
                                          jogadores: lideres,
                                        })
                                      : setJogadorSelecionado(lideres[0])
                                  }
                                >
                                  <Icon name={h.field === 'gols' ? 'soccer' : h.field === 'assistencias' ? 'cleat' : 'group'} size={17}
                                    color={h.field === 'gols' ? colors.primaria : h.field === 'assistencias' ? coresPerfil.Armador : coresPerfil.Paredão} />
                                  <Text style={styles.resumoCardLabel} numberOfLines={1}>{h.label}</Text>
                                  <Text style={styles.resumoCardValor}>{h.value}</Text>
                                  <Text style={styles.resumoCardNome} numberOfLines={1}>{lideres[0]?.nome || 'Sem registros'}</Text>

                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        )}
                        <View style={styles.filtrosContainer}>
                          <View style={styles.searchRow}>
                            <SearchField
                              placeholder="Nome, camisa ou posição"
                              value={busca}
                              onChangeText={setBusca}
                              accessibilityLabel="Buscar atleta por nome, camisa ou posição"
                            />
                            <IconButton
                              icon="sliders-horizontal"
                              label="Mais filtros de atletas"
                              state={{ expanded: filtrosAbertos }}
                              onPress={() => setFiltrosAbertos(true)}
                              dot={
                                !!filtros.posicao ||
                                filtros.participacao !== "todos" ||
                                filtros.perfil !== "todos" || perfilAtivo !== "Todos"
                              }
                            />
                          </View>

                        </View>
                        <View style={styles.listaHeader}>
                          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                            <Text style={styles.listaTitulo}>{jogadoresFiltrados.length} atletas</Text>
                            <Text style={styles.listaContador}>{categoriaAtual}</Text>
                          </View>
                          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Como ler o Scout" onPress={() => setAjudaAberta(true)} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, minHeight: 40 }}>
                            <Icon name="information-outline" size={15} color={colors.primaria} /><Text style={{ color: colors.primaria, fontSize: 11 }}>Como ler o Scout</Text>
                          </TouchableOpacity>
                        </View>

                        <CategoryFilterScroll
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.ordenacaoContent}
                          keyboardShouldPersistTaps="handled"
                        >
                          {OPCOES_ORDENACAO.map((opcao) => (
                            <TouchableOpacity
                              key={opcao.value}
                              hitSlop={{ top: 5, bottom: 5 }}
                              style={[
                                styles.ordenacaoPill,
                                ordenacao === opcao.value &&
                                  styles.ordenacaoPillAtiva,
                              ]}
                              onPress={() => {
                                const next = proximaOrdenacaoScout(
                                  ordenacao,
                                  opcao.value,
                                  direcao,
                                );
                                setOrdenacao(next.ordenacao);
                                setDirecao(next.direcao);
                              }}
                              activeOpacity={0.75}
                              accessibilityRole="button"
                              accessibilityLabel={`${opcao.label}: ${ordenacao === opcao.value && direcao ? (direcao === "asc" ? "crescente" : "decrescente") : "padrão"}`}
                              accessibilityHint="Toque para alternar a direção ou voltar ao padrão"
                              accessibilityState={{
                                selected: ordenacao === opcao.value,
                              }}
                            >
                              <Text
                                style={[
                                  styles.ordenacaoTxt,
                                  ordenacao === opcao.value &&
                                    styles.ordenacaoTxtAtiva,
                                ]}
                              >
                                {opcao.label}
                              </Text>
                              <ScoutSortIndicator
                                direction={
                                  ordenacao === opcao.value ? direcao : ""
                                }
                              />
                            </TouchableOpacity>
                          ))}
                        </CategoryFilterScroll>

                      </>
                    }
                    ListFooterComponent={
                      jogadoresFiltrados.length > (limitesPorCategoria[categoriaAtual] ?? ATLETAS_POR_PAGINA) ? (
                        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 }}>
                          <AppButton
                            label={`Carregar mais atletas (${jogadoresFiltrados.length - (limitesPorCategoria[categoriaAtual] ?? ATLETAS_POR_PAGINA)})`}
                            accessibilityLabel={`Carregar mais atletas. ${jogadoresFiltrados.length - (limitesPorCategoria[categoriaAtual] ?? ATLETAS_POR_PAGINA)} restantes nesta categoria`}
                            variant="secondary"
                            style={{ backgroundColor: 'transparent' }}
                            onPress={() => setLimitesPorCategoria((atuais) => ({
                              ...atuais,
                              [categoriaAtual]: (atuais[categoriaAtual] ?? ATLETAS_POR_PAGINA) + ATLETAS_POR_PAGINA,
                            }))}
                          />
                        </View>
                      ) : null
                    }
                    ListEmptyComponent={
                      <View style={styles.listaVazia}>
                        <View style={styles.estadoIcone}>
                          <Icon
                            name="account-off-outline"
                            size={28}
                            color={colors.textoSecundario}
                          />
                        </View>
                        <Text style={styles.vazioTitulo}>
                          {jogadoresDaCategoria.length === 0
                            ? "Categoria sem atletas"
                            : "Nenhum atleta neste filtro"}
                        </Text>
                        <Text style={styles.txtErro}>
                          {jogadoresDaCategoria.length === 0
                            ? "Os atletas cadastrados nesta categoria aparecerão aqui."
                            : busca.trim()
                              ? "Tente outro nome ou posição, ou escolha Todos os perfis."
                              : perfilAtivo === "Sem dados"
                                ? "Todos os atletas desta categoria já possuem um perfil."
                                : `Ainda não há atletas com perfil ${perfilAtivo} nesta categoria.`}
                        </Text>
                        {jogadoresDaCategoria.length > 0 &&
                          (busca.trim() || perfilAtivo !== "Todos") && (
                            <TouchableOpacity
                              style={styles.btnRetry}
                              onPress={() => {
                                setBusca("");
                                setPerfilAtivo("Todos");
                              }}
                              accessibilityRole="button"
                            >
                              <Text style={styles.txtBtnRetry}>
                                Limpar filtros
                              </Text>
                            </TouchableOpacity>
                          )}
                      </View>
                    }
                  />
                )}
              </PaginaCategoria>
            </CategoryPageMotion>
          </View>
        ),
      ),
    [
      paginas,
      limitesPorCategoria,
      styles,
      progressoPagina,
      pagerMotion.origin,
      pagerMotion.settling,
      clubeAtivo?.id,
      tipoAtivo,
      carregando,
      erro,
      carregarDados,
      renderizarJogador,
      atualizando,
      atualizarScout,
      colors,
      coresPerfil,
      perfilAtivo,
      busca,
      filtros,
      filtrosAbertos,
      ordenacao,
      direcao,
    ],
  );

  if (carregandoClubeAtivo) {
    return (
      <View style={styles.containerCarregandoPermissao}>
        <ActivityIndicator size="large" color={colors.primaria} />
      </View>
    );
  }

  if (!podeGerenciar) {
    return <Redirect href="/(tabs)" />;
  }

  return (
    <View style={styles.container}>
      <HeaderClube />

      <CarrosselSubs
        tipoFiltro={tipoAtivo}
        onTrocarTipo={trocarTipo}
        indexAtual={subIndex}
        onChangeIndex={trocarSub}
        progressoPagina={progressoPagina}
        originPagina={pagerMotion.origin}
        settlingPagina={pagerMotion.settling}
      />

      {falhaAtualizacao && (
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            padding: 12,
          }}
          accessibilityRole="alert"
        >
          <Icon name="wifi-off" size={16} color={colors.textoSecundario} />
          <Text style={[styles.contextNote, { flex: 1, margin: 0 }]}>
            Não foi possível atualizar. Seus últimos dados continuam visíveis.
          </Text>
          <TouchableOpacity
            onPress={() => void atualizarScout()}
            accessibilityRole="button"
            accessibilityLabel="Atualizar Scout"
            style={{ padding: 8 }}
          >
            <Text style={{ color: colors.primaria, fontSize: 12 }}>
              Atualizar
            </Text>
          </TouchableOpacity>
        </View>
      )}
      {consultaLocal !== null && (
        <AvisoConsultaLocal
          salvoEm={consultaLocal}
          atualizando={consultandoServidor}
          onAtualizar={() => void atualizarScout()}
        />
      )}
      <CategoryPager
        key={`${clubeAtivo?.id}-${tipoAtivo}`}
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={subIndex}
        onPageSelected={({ nativeEvent }) => setSubIndex(nativeEvent.position)}
        progress={progressoPagina}
        origin={pagerMotion.origin}
        settling={pagerMotion.settling}
        onSettled={pagerMotion.onSettled}
        keyboardDismissMode="on-drag"
      >
        {conteudoPaginas}
      </CategoryPager>

      {empate && (
        <ScoutSheet
          title={`${empate.titulo} · atletas empatados`}
          onClose={() => setEmpate(null)}
        >
          <Text style={styles.contextNote}>
            Atletas com o mesmo resultado nesta categoria. Selecione um para ver
            sua ficha.
          </Text>
          {empate.jogadores.map((j) => (
            <TouchableOpacity
              key={j.id_jogador}
              style={styles.tieRow}
              accessibilityRole="button"
              accessibilityLabel={`Ver ficha de ${j.nome}`}
              onPress={() => {
                setEmpate(null);
                setJogadorSelecionado(j);
              }}
            >
              <Text style={[styles.cardNome, { flex: 1 }]}>{j.nome}</Text>
              <Icon name="chevron-right" size={18} color={colors.texto} />
            </TouchableOpacity>
          ))}
        </ScoutSheet>
      )}
      {ajudaAberta && <ScoutHelp onClose={() => setAjudaAberta(false)} />}
      {filtrosAbertos && (
        <ScoutFilters
          initial={filtros}
          perfilInicial={perfilAtivo}
          order={ordenacao}
          direction={direcao}
          onClose={() => setFiltrosAbertos(false)}
          onApply={(f, o, d, perfil) => {
            setPerfilAtivo(perfil);
            setFiltros(f);
            setOrdenacao(o);
            setDirecao(d);
          }}
        />
      )}
      {jogadorSelecionado &&
        clubeAtivo?.id &&
        clubeCarregadoId.current === clubeAtivo.id && (
          <ModalScout
            jogador={jogadorSelecionado}
            onFechar={() => setJogadorSelecionado(null)}
            clubeId={clubeAtivo.id}
            consultaLocal={consultaLocal !== null}
          />
        )}
    </View>
  );
}
