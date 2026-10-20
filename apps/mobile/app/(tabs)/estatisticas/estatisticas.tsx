import { Icon, type IconName } from '@ludora/icons';
import React, {
  memo,
  useDeferredValue,
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {
  AppState,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  ScrollView,
  FlatList,
  TextInput,
  Modal,
  RefreshControl,
} from 'react-native';
import { Redirect, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Polygon, Line, Text as SvgText } from 'react-native-svg';
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from 'react-native-pager-view';
import Animated, { useEvent, useSharedValue } from 'react-native-reanimated';

import {
  obterPerfisJogadores,
  Jogador,
  ScoresMl,
} from '@/src/services/mlService';
import { Header } from '@/src/components/Header';
import { HeaderClube } from '@/src/components/HeaderClube';
import { PaginaCategoria } from '@/src/components/PaginaCategoria';
import {
  CarrosselSubs,
  SUBS_INICIACAO,
  SUBS_BASE,
} from '@/src/components/CarrosselSubs';
import { useTheme, type ThemeColors } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/estatisticasStyles';
import { CardsSkeleton } from '@/src/components/Skeleton';
import { ErroCarregamento } from '@/src/components/ErroCarregamento';
import { AvisoConsultaLocal } from '@/src/components/AvisoConsultaLocal';
import { ContextoAtletaScout } from '@/src/components/ContextoAtletaScout';
import { consultarComCopiaLocal } from '@/src/services/cacheConsultas';
import { selecionarJogadoresLocais } from '@/src/utils/dadosConsultaLocal';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { criarControleRequisicoes } from '@/src/utils/request';
import {
  filtrarJogadoresScout,
  type PerfilScout,
  type OrdenacaoScout,
} from '@/src/utils/filtrosScout';
import {
  criarCatalogoScout,
  chaveCategoriaScout,
  CATEGORIA_SCOUT_VAZIA,
  normalizarCategoriaScout as normalizarCategoria,
} from '@/src/utils/catalogoScout';

// ── Cores por perfil ──────────────────────────────────────────────────────────
const getCoresPerfil = (
  colors: ThemeColors,
  escuro: boolean
): Record<string, string> => ({
  Artilheiro: colors.primaria,
  Paredão: escuro ? '#2DD4BF' : '#087F72',
  Armador: escuro ? '#B69AFF' : '#703BD1',
  'Sem dados': colors.textoSecundario,
});

const DESCRICAO_PERFIL: Record<string, string> = {
  Artilheiro:
    'Perfil associado ao grupo com maior índice médio de finalização.',
  Paredão: 'Perfil associado ao grupo com maior índice médio de defesas.',
  Armador:
    'Perfil geralmente associado à visão de jogo e à criação de jogadas.',
  'Sem dados': 'Perfil ainda não calculado. Os registros do atleta continuam disponíveis.',
};

const PERFIS: { valor: PerfilScout; icone: IconName }[] = [
  { valor: 'Todos', icone: 'account-outline' },
  { valor: 'Artilheiro', icone: 'soccer' },
  { valor: 'Armador', icone: 'handshake' },
  { valor: 'Paredão', icone: 'shield-check' },
  { valor: 'Sem dados', icone: 'information-outline' },
];

const OPCOES_ORDENACAO: { label: string; value: OrdenacaoScout }[] = [
  { label: 'Índice', value: 'NOTA' },
  { label: 'Gols', value: 'GOLS' },
  { label: 'Assistências', value: 'ASSISTENCIAS' },
  { label: 'Defesas', value: 'DEFESAS' },
];

function notaExibida(nota: number): string {
  if (!nota || nota <= 0) return '—';
  return Math.round(nota).toString();
}

// ── Hexágono SVG ─────────────────────────────────────────────────────────────
interface HexProps {
  scores: ScoresMl;
  size?: number;
}

function HexagonoScout({ scores, size = 140 }: HexProps) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.32;

  const eixos = [
    { label: 'FINALIZAÇÃO', key: 'finalizacao' },
    { label: 'VISÃO', key: 'visao_de_jogo' },
    { label: 'DEFESA', key: 'defesa' },
    { label: 'DISCIPLINA', key: 'disciplina' },
    { label: 'INTENSIDADE', key: 'intensidade' },
    { label: 'TÉCNICA', key: 'tecnica' },
  ];

  const angulo = (i: number) => Math.PI / 2 + (2 * Math.PI * i) / 6;

  const pontoBase = (i: number, r: number) => ({
    x: cx + r * Math.cos(angulo(i)),
    y: cy - r * Math.sin(angulo(i)),
  });

  const pontoValor = (i: number) => {
    const val = (scores[eixos[i].key as keyof ScoresMl] ?? 0) / 100;
    return pontoBase(i, R * val);
  };

  const gridPoly = (frac: number) =>
    eixos
      .map((_, i) => {
        const p = pontoBase(i, R * frac);
        return `${p.x},${p.y}`;
      })
      .join(' ');

  const valorPoly = eixos
    .map((_, i) => {
      const p = pontoValor(i);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <View style={{ alignItems: 'center', width: size, height: size }}>
      <HexSVG
        cx={cx}
        cy={cy}
        R={R}
        eixos={eixos}
        angulo={angulo}
        pontoBase={pontoBase}
        gridPoly={gridPoly}
        valorPoly={valorPoly}
        size={size}
      />
    </View>
  );
}

function HexSVG({
  cx,
  cy,
  R,
  eixos,
  pontoBase,
  gridPoly,
  valorPoly,
  size,
}: any) {
  const { colors } = useTheme();
  return (
    <Svg width={size} height={size}>
      {[0.33, 0.66, 1].map((frac, idx) => (
        <Polygon
          key={`grid-${idx}`}
          points={gridPoly(frac)}
          fill="none"
          stroke={frac === 1 ? colors.borda : colors.linha}
          strokeWidth={frac === 1 ? 1.5 : 1}
        />
      ))}

      {eixos.map((_: any, i: number) => {
        const p = pontoBase(i, R);
        return (
          <Line
            key={`line-${i}`}
            x1={cx}
            y1={cy}
            x2={p.x}
            y2={p.y}
            stroke={colors.linha}
            strokeWidth={1}
          />
        );
      })}

      <Polygon
        points={valorPoly}
        fill={colors.primaria + '33'}
        stroke={colors.primaria}
        strokeWidth={2}
      />

      {eixos.map((eixo: any, i: number) => {
        const p = pontoBase(i, R + 20);
        return (
          <SvgText
            key={`text-${i}`}
            x={p.x}
            y={p.y + 3}
            fill={colors.textoSecundario}
            fontSize="9"
            fontWeight="bold"
            fontFamily="Inter_600SemiBold"
            textAnchor="middle"
          >
            {eixo.label}
          </SvgText>
        );
      })}
    </Svg>
  );
}

// ── Card da Lista ─────────────────────────────────────────────────────────────
const CardJogador = memo(function CardJogador({
  jogador,
  onSelecionar,
}: {
  jogador: Jogador;
  onSelecionar: (jogador: Jogador) => void;
}) {
  const { colors, tema } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const corPerfil =
    getCoresPerfil(colors, tema === 'dark')[jogador.perfil_ml] ??
    colors.textoSecundario;
  const idade = jogador.idade ?? null;

  return (
    <TouchableOpacity
      style={styles.cardJogador}
      onPress={() => onSelecionar(jogador)}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`Ver ficha de ${jogador.nome}, ${jogador.perfil_ml}`}
    >
      <View style={styles.cardTopo}>
        <View style={styles.cardNumCamisa}>
          <Text style={styles.cardNumCamisaTxt}>
            {jogador.numCamisa != null ? `#${jogador.numCamisa}` : '—'}
          </Text>
        </View>

        <View style={styles.cardInfos}>
          <Text style={styles.cardNome} numberOfLines={1}>
            {jogador.nome}
          </Text>
          <Text style={styles.cardSub}>
            {jogador.posicao}
            {idade ? ` • ${idade} anos` : ''}
          </Text>
        </View>

        <View style={styles.cardDireita}>
          <Text style={styles.cardNotaLabel}>ÍNDICE</Text>
          <Text style={styles.cardNota}>{notaExibida(jogador.nota_geral)}</Text>
        </View>
        <Icon name="chevron-right" size={18} color={colors.textoSecundario} />
      </View>
      <View style={styles.cardRodape}>
        <View
          style={[
            styles.cardBadgePerfil,
            { backgroundColor: corPerfil + '18' },
          ]}
        >
          <View style={[styles.perfilDot, { backgroundColor: corPerfil }]} />
          <Text style={[styles.cardBadgePerfilTxt, { color: corPerfil }]}>
            {jogador.perfil_ml}
          </Text>
        </View>
        <View style={styles.cardStats}>
          <Text style={styles.cardMetricText}>
            {jogador.jogos_disputados} escalações
          </Text>
          <Icon name="soccer" size={13} color={colors.primaria} />
          <Text style={styles.cardMetricText}>{jogador.gols}</Text>
          <Icon
            name={
              jogador.perfil_ml === 'Paredão' ? 'shield-check' : 'handshake'
            }
            size={13}
            color={corPerfil}
          />
          <Text style={styles.cardMetricText}>
            {jogador.perfil_ml === 'Paredão'
              ? jogador.defesas
              : jogador.assistencias}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
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
    getCoresPerfil(colors, tema === 'dark')[jogador.perfil_ml] ??
    colors.textoSecundario;
  const idade = jogador.idade ?? null;

  const stats = [
    {
      label: 'Escalações',
      valor: jogador.jogos_disputados,
      icone: 'soccer-field',
    },
    { label: 'Gols', valor: jogador.gols, icone: 'soccer' },
    { label: 'Assist.', valor: jogador.assistencias, icone: 'handshake' },
    { label: 'Defesas', valor: jogador.defesas, icone: 'shield-check' },
    { label: 'Faltas', valor: jogador.faltas_cometidas, icone: 'whistle' },
    { label: 'Amarelos', valor: jogador.cartoes_amarelos, icone: 'card' },
    { label: 'Vermelhos', valor: jogador.cartoes_vermelhos, icone: 'card' },
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
        edges={['top', 'bottom', 'left', 'right']}
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
          <View style={[styles.scoutIdentidade, { borderColor: corPerfil }]}>
            <View
              style={[
                styles.scoutAvatarNum,
                { backgroundColor: corPerfil + '22', borderColor: corPerfil },
              ]}
            >
              <Text style={[styles.scoutAvatarNumTxt, { color: corPerfil }]}>
                {jogador.numCamisa ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.scoutNome} numberOfLines={1}>
                {jogador.nome}
              </Text>
              <Text style={styles.scoutPosicao}>{jogador.posicao}</Text>
              <View
                style={{
                  flexDirection: 'row',
                  gap: 8,
                  marginTop: 6,
                  flexWrap: 'wrap',
                }}
              >
                <View
                  style={[
                    styles.scoutChip,
                    {
                      backgroundColor: corPerfil + '22',
                      borderColor: corPerfil,
                    },
                  ]}
                >
                  <Text style={[styles.scoutChipTxt, { color: corPerfil }]}>
                    {jogador.perfil_ml}
                  </Text>
                </View>
                <View style={styles.scoutChip}>
                  <Text style={styles.scoutChipTxt}>{jogador.categoria}</Text>
                </View>
                <View style={styles.scoutChip}>
                  <Text style={styles.scoutChipTxt}>
                    {jogador.jogos_disputados}{' '}
                    {jogador.jogos_disputados === 1
                      ? 'escalação'
                      : 'escalações'}
                  </Text>
                </View>
                {idade && (
                  <View style={styles.scoutChip}>
                    <Text style={styles.scoutChipTxt}>{idade} anos</Text>
                  </View>
                )}
              </View>
              <Text style={styles.scoutPerfilDescricao} numberOfLines={2}>
                {DESCRICAO_PERFIL[jogador.perfil_ml] ??
                  DESCRICAO_PERFIL['Sem dados']}
              </Text>
            </View>
            <View style={styles.scoutNotaContainer}>
              <Text style={styles.scoutNotaLabel}>ÍNDICE</Text>
              <Text style={[styles.scoutNota, { color: corPerfil }]}>
                {notaExibida(jogador.nota_geral)}
              </Text>
            </View>
          </View>

          <ContextoAtletaScout
            key={`${clubeId}:${jogador.id_jogador}`}
            jogadorId={jogador.id_jogador}
            clubeId={clubeId}
            consultaLocal={consultaLocal}
          />

          {/* Hexágono & Barras */}
          {jogador.scores_ml ? (
            <View style={styles.scoutHexContainer}>
              <Text style={styles.scoutSecaoLabel}>ÍNDICES COMPARATIVOS</Text>
              <HexagonoScout scores={jogador.scores_ml} size={220} />
              <Text style={styles.scoutRadarNota}>
                Escala relativa aos atletas analisados. 100 representa o maior
                valor observado no conjunto atual.
              </Text>

              <View style={styles.scoutScoresGrid}>
                {Object.entries(jogador.scores_ml).map(([key, val]) => (
                  <View key={key} style={styles.scoutScoreItem}>
                    <Text style={styles.scoutScoreLabel} numberOfLines={1}>
                      {key.replace(/_/g, ' ').toUpperCase()}
                    </Text>
                    <View style={styles.scoutScoreBarBg}>
                      <View
                        style={[
                          styles.scoutScoreBar,
                          { width: `${val}%`, backgroundColor: corPerfil },
                        ]}
                      />
                    </View>
                    <Text style={[styles.scoutScoreVal, { color: corPerfil }]}>
                      {val.toFixed(0)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.scoutSemDados}>
              <Icon name="chart-arc" size={40} color={colors.borda} />
              <Text style={styles.scoutSemDadosTxt}>
                O perfil ainda não foi calculado. Os registros abaixo podem ser
                consultados independentemente do processamento do Scout IA.
              </Text>
            </View>
          )}

          <Text style={styles.scoutSecaoLabel}>TOTAIS REGISTRADOS</Text>
          <Text style={styles.scoutRadarNota}>
            Acumulado do cadastro atual, incluindo partidas em andamento. Não
            corresponde apenas ao recorte recente acima.
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
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

// ── Tela Principal ────────────────────────────────────────────────────────────
const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function Estatisticas() {
  const { colors, tema } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const coresPerfil = useMemo(
    () => getCoresPerfil(colors, tema === 'dark'),
    [colors, tema]
  );
  const { clubeAtivo, podeGerenciar, carregandoClubeAtivo } = useClubeAtivo();
  const carregouUmaVez = useRef(false);
  const clubeCarregadoId = useRef<number | null>(null);
  const controle = useRef(criarControleRequisicoes()).current;
  const pagerRef = useRef<PagerView>(null);
  const paginasScroll = useRef<Record<number, FlatList<Jogador> | null>>({});
  const progressoPagina = useSharedValue(0);
  const acompanharPagina = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      'worklet';
      progressoPagina.value = event.position + event.offset;
    },
    ['onPageScroll']
  );
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [consultaLocal, setConsultaLocal] = useState<number | null>(null);
  const consultaLocalRef = useRef(consultaLocal);
  consultaLocalRef.current = consultaLocal;
  const [consultandoServidor, setConsultandoServidor] = useState(false);
  const [busca, setBusca] = useState('');
  const buscaAplicada = useDeferredValue(busca);
  const [ordenacao, setOrdenacao] = useState<OrdenacaoScout>('NOTA');
  const [perfilAtivo, setPerfilAtivo] = useState<PerfilScout>('Todos');
  const [atualizando, setAtualizando] = useState(false);
  const [jogadorSelecionado, setJogadorSelecionado] = useState<Jogador | null>(
    null
  );

  useEffect(() => {
    setJogadorSelecionado(null);
  }, [clubeAtivo?.id]);

  const [subIndex, setSubIndex] = useState(0);
  const [tipoAtivo, setTipoAtivo] = useState<'INICIACAO' | 'BASE'>('INICIACAO');

  const subsAtivos = tipoAtivo === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
  const trocarSub = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
  }, []);
  const trocarTipo = useCallback(
    (tipo: 'INICIACAO' | 'BASE') => {
      setTipoAtivo(tipo);
      setSubIndex(0);
      progressoPagina.value = 0;
      pagerRef.current?.setPageWithoutAnimation(0);
    },
    [progressoPagina]
  );

  const carregarDados = useCallback(
    async (silencioso = false) => {
      const pedido = controle.iniciar();
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
          setJogadores(todos);
          setConsultaLocal(salvoEm);
          setCarregando(false);
          clubeCarregadoId.current = clubeAtivo.id;
          if (todos.length > 0 && mudouClube && !ajustouCategoria) {
            ajustouCategoria = true;
            const primeiro = todos[0];
            if (primeiro.categoria_tipo) setTipoAtivo(primeiro.categoria_tipo);

            const subsDoTipo =
              primeiro.categoria_tipo === 'INICIACAO'
                ? SUBS_INICIACAO
                : SUBS_BASE;

            const idxSub = subsDoTipo.findIndex(
              (s) =>
                normalizarCategoria(s.title) ===
                normalizarCategoria(primeiro.categoria)
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
          recurso: 'scout',
          carregar: () => obterPerfisJogadores(undefined, clubeAtivo.id),
          selecionar: selecionarJogadoresLocais,
          onLocal: (local) => {
            if (mudouClube || !carregouUmaVez.current)
              exibir(local.dados, local.salvoEm);
          },
        });
        exibir(
          resultado.dados,
          resultado.origem === 'local' ? resultado.salvoEm : null
        );
      } catch (e: any) {
        if (controle.atual(pedido)) {
          setJogadores([]);
          setConsultaLocal(null);
          setErro(e?.message ?? 'Erro na conexão');
        }
      } finally {
        if (controle.atual(pedido)) {
          carregouUmaVez.current = true;
          setCarregando(false);
          setConsultandoServidor(false);
        }
      }
    },
    [clubeAtivo?.id, controle, progressoPagina]
  );

  useFocusEffect(
    useCallback(() => {
      if (carregandoClubeAtivo || !podeGerenciar) return;
      carregarDados(carregouUmaVez.current);
      const appState = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') void carregarDados(true);
      });
      const intervalo = setInterval(() => {
        if (
          consultaLocalRef.current !== null &&
          AppState.currentState === 'active'
        )
          void carregarDados(true);
      }, 30_000);
      return () => {
        appState.remove();
        clearInterval(intervalo);
        controle.invalidar();
      };
    }, [carregarDados, carregandoClubeAtivo, podeGerenciar])
  );
  useEffect(() => {
    setJogadorSelecionado(null);
    setBusca('');
    setPerfilAtivo('Todos');
  }, [clubeAtivo?.id]);
  useEffect(() => {
    Object.values(paginasScroll.current).forEach((scroll) =>
      scroll?.scrollToOffset({ offset: 0, animated: false })
    );
  }, [perfilAtivo, buscaAplicada, ordenacao, tipoAtivo]);

  const atualizarScout = useCallback(async () => {
    setAtualizando(true);
    try {
      await carregarDados(true);
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
    [subsAtivos, catalogo, tipoAtivo]
  );
  const paginas = useMemo(
    () =>
      categorias.map((categoria) => ({
        ...categoria,
        jogadoresFiltrados: filtrarJogadoresScout(
          categoria.jogadoresDaCategoria,
          buscaAplicada,
          perfilAtivo,
          ordenacao
        ),
      })),
    [categorias, buscaAplicada, perfilAtivo, ordenacao]
  );
  const renderizarJogador = useCallback(
    ({ item }: { item: Jogador }) => (
      <CardJogador jogador={item} onSelecionar={setJogadorSelecionado} />
    ),
    []
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
      />

      {consultaLocal !== null && (
        <AvisoConsultaLocal
          salvoEm={consultaLocal}
          atualizando={consultandoServidor}
          onAtualizar={() => void atualizarScout()}
        />
      )}
      <AnimatedPagerView
        key={clubeAtivo?.id}
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={subIndex}
        onPageSelected={({ nativeEvent }) => setSubIndex(nativeEvent.position)}
        onPageScroll={acompanharPagina}
        keyboardDismissMode="on-drag"
        offscreenPageLimit={1}
      >
        {paginas.map(
          (
            {
              categoriaAtual,
              jogadoresDaCategoria,
              jogadoresFiltrados,
              resumo,
              contagens,
            },
            indexPagina
          ) => (
            <View
              key={`pagina-${indexPagina}`}
              style={{ flex: 1 }}
              collapsable={false}
            >
              <PaginaCategoria
                grupo={`${clubeAtivo?.id}-${tipoAtivo}`}
                preparar={Math.abs(indexPagina - subIndex) <= 1}
              >
                {carregando ? (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={styles.listaContent}
                  >
                    <CardsSkeleton rows={5} />
                  </ScrollView>
                ) : erro ? (
                  <View style={styles.centralizado}>
                    <ErroCarregamento
                      titulo="Não foi possível carregar as estatísticas"
                      descricao="Confira sua conexão e tente atualizar os dados dos jogadores novamente."
                      onTentarNovamente={() => void carregarDados()}
                    />
                  </View>
                ) : (
                  <FlatList<Jogador>
                    ref={(ref) => {
                      paginasScroll.current[indexPagina] = ref;
                    }}
                    data={jogadoresFiltrados}
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
                        <View style={styles.filtrosContainer}>
                          <View style={styles.buscaContainer}>
                            <Icon
                              name="magnify"
                              size={19}
                              color={colors.textoSecundario}
                            />
                            <TextInput
                              style={styles.buscaInput}
                              placeholder="Buscar nome ou posição"
                              placeholderTextColor={colors.textoSecundario}
                              value={busca}
                              onChangeText={setBusca}
                              autoCorrect={false}
                              returnKeyType="search"
                              accessibilityLabel="Buscar atleta por nome ou posição"
                            />
                            {!!busca && (
                              <TouchableOpacity
                                style={styles.limparBusca}
                                onPress={() => setBusca('')}
                                accessibilityRole="button"
                                accessibilityLabel="Limpar busca"
                              >
                                <Icon
                                  name="close"
                                  size={18}
                                  color={colors.textoSecundario}
                                />
                              </TouchableOpacity>
                            )}
                          </View>
                          <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.perfisContent}
                            keyboardShouldPersistTaps="handled"
                          >
                            {PERFIS.map(({ valor, icone }) => {
                              const ativo = perfilAtivo === valor;
                              const cor = coresPerfil[valor] ?? colors.primaria;
                              const corAtiva =
                                valor === 'Sem dados'
                                  ? colors.texto
                                  : colors.textoSobrePrimaria;
                              const quantidade = contagens[valor];
                              return (
                                <TouchableOpacity
                                  key={valor}
                                  style={[
                                    styles.perfilFiltro,
                                    ativo && {
                                      backgroundColor:
                                        valor === 'Sem dados'
                                          ? colors.cardSecundario
                                          : cor,
                                      borderColor: cor,
                                    },
                                  ]}
                                  onPress={() => setPerfilAtivo(valor)}
                                  activeOpacity={0.8}
                                  accessibilityRole="button"
                                  accessibilityState={{ selected: ativo }}
                                  accessibilityLabel={`${valor}, ${quantidade} atletas`}
                                >
                                  <Icon
                                    name={icone}
                                    size={16}
                                    color={ativo ? corAtiva : cor}
                                  />
                                  <Text
                                    style={[
                                      styles.perfilFiltroTexto,
                                      ativo && { color: corAtiva },
                                    ]}
                                  >
                                    {valor}
                                  </Text>
                                  <Text
                                    style={[
                                      styles.perfilQuantidade,
                                      ativo && { color: corAtiva },
                                    ]}
                                  >
                                    {quantidade}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </ScrollView>
                        </View>
                        {jogadoresDaCategoria.length > 0 && (
                          <View style={styles.resumoContainer}>
                            <View style={styles.resumoHeader}>
                              <Text style={styles.resumoTitulo}>
                                Visão da categoria
                              </Text>
                              <Text style={styles.resumoSub}>
                                {categoriaAtual}
                              </Text>
                            </View>
                            <View style={styles.resumoCards}>
                              <View style={styles.resumoCard}>
                                <View
                                  style={[
                                    styles.resumoIcone,
                                    { backgroundColor: colors.primaria + '18' },
                                  ]}
                                >
                                  <Icon
                                    name="soccer"
                                    size={18}
                                    color={colors.primaria}
                                  />
                                </View>
                                <Text style={styles.resumoCardLabel}>
                                  MAIS GOLS
                                </Text>
                                <Text style={styles.resumoCardValor}>
                                  {resumo.artilheiro?.gols || '—'}
                                </Text>
                                <Text
                                  style={styles.resumoCardNome}
                                  numberOfLines={2}
                                >
                                  {resumo.artilheiro?.gols
                                    ? resumo.artilheiro.nome
                                    : 'Sem gols registrados'}
                                </Text>
                              </View>
                              <View style={styles.resumoCard}>
                                <View
                                  style={[
                                    styles.resumoIcone,
                                    {
                                      backgroundColor:
                                        coresPerfil.Armador + '18',
                                    },
                                  ]}
                                >
                                  <Icon
                                    name="handshake"
                                    size={18}
                                    color={coresPerfil.Armador}
                                  />
                                </View>
                                <Text style={styles.resumoCardLabel}>
                                  ASSISTÊNCIAS
                                </Text>
                                <Text style={styles.resumoCardValor}>
                                  {resumo.assistente?.assistencias || '—'}
                                </Text>
                                <Text
                                  style={styles.resumoCardNome}
                                  numberOfLines={2}
                                >
                                  {resumo.assistente?.assistencias
                                    ? resumo.assistente.nome
                                    : 'Sem assistências'}
                                </Text>
                              </View>
                              <View style={styles.resumoCard}>
                                <View
                                  style={[
                                    styles.resumoIcone,
                                    {
                                      backgroundColor:
                                        coresPerfil['Paredão'] + '18',
                                    },
                                  ]}
                                >
                                  <Icon
                                    name="radar"
                                    size={18}
                                    color={coresPerfil['Paredão']}
                                  />
                                </View>
                                <Text style={styles.resumoCardLabel}>
                                  MAIOR ÍNDICE
                                </Text>
                                <Text style={styles.resumoCardValor}>
                                  {resumo.lider?.pontos || '—'}
                                </Text>
                                <Text
                                  style={styles.resumoCardNome}
                                  numberOfLines={2}
                                >
                                  {resumo.lider?.pontos
                                    ? resumo.lider.nome
                                    : 'Em análise'}
                                </Text>
                              </View>
                            </View>
                          </View>
                        )}

                        <View style={styles.listaHeader}>
                          <Text style={styles.listaTitulo}>
                            {perfilAtivo === 'Todos' ? 'Atletas' : perfilAtivo}
                          </Text>
                          <Text style={styles.listaContador}>
                            {jogadoresFiltrados.length} de{' '}
                            {jogadoresDaCategoria.length} atletas
                          </Text>
                        </View>

                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          contentContainerStyle={styles.ordenacaoContent}
                          keyboardShouldPersistTaps="handled"
                        >
                          {OPCOES_ORDENACAO.map((opcao) => (
                            <TouchableOpacity
                              key={opcao.value}
                              style={[
                                styles.ordenacaoPill,
                                ordenacao === opcao.value &&
                                  styles.ordenacaoPillAtiva,
                              ]}
                              onPress={() => setOrdenacao(opcao.value)}
                              activeOpacity={0.75}
                              accessibilityRole="button"
                              accessibilityLabel={`Ordenar por ${opcao.label}`}
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
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </>
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
                            ? 'Categoria sem atletas'
                            : 'Nenhum atleta neste filtro'}
                        </Text>
                        <Text style={styles.txtErro}>
                          {jogadoresDaCategoria.length === 0
                            ? 'Os atletas cadastrados nesta categoria aparecerão aqui.'
                            : busca.trim()
                              ? 'Tente outro nome ou posição, ou escolha Todos os perfis.'
                              : perfilAtivo === 'Sem dados'
                                ? 'Todos os atletas desta categoria já possuem um perfil.'
                                : `Ainda não há atletas com perfil ${perfilAtivo} nesta categoria.`}
                        </Text>
                        {jogadoresDaCategoria.length > 0 &&
                          (busca.trim() || perfilAtivo !== 'Todos') && (
                            <TouchableOpacity
                              style={styles.btnRetry}
                              onPress={() => {
                                setBusca('');
                                setPerfilAtivo('Todos');
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
                    ListFooterComponent={
                      <View style={styles.infoAnalise}>
                        <Icon
                          name="information-outline"
                          size={16}
                          color={colors.primaria}
                        />
                        <Text style={styles.infoAnaliseTxt}>
                          Os destaques consideram toda a categoria. Perfis e
                          índices são comparativos e dependem das partidas
                          registradas e do processamento do Scout.
                        </Text>
                      </View>
                    }
                  />
                )}
              </PaginaCategoria>
            </View>
          )
        )}
      </AnimatedPagerView>

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
