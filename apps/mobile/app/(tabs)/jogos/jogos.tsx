import { Icon } from '@ludora/icons';
import React, {
  useState,
  useCallback,
  useRef,
  useMemo,
  useEffect,
} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Modal,
  RefreshControl,
} from 'react-native';
import { createStyles } from '@/src/styles/jogosStyles';
import { HeaderClube } from '@/src/components/HeaderClube';
import { PaginaCategoria } from '@/src/components/PaginaCategoria';
import { useTheme } from '@/src/contexts/ThemeContext';
import { FiltrosJogos } from '@/src/components/FiltrosJogos';
import {
  filtrosJogosAtuais,
  mesmosFiltrosJogos,
  parametrosJogos,
  periodoJogos,
  STATUS_JOGOS,
  type FiltrosJogos as ValoresFiltros,
} from '@/src/utils/filtrosJogos';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from 'react-native-pager-view';
import Animated, { useEvent, useSharedValue } from 'react-native-reanimated';
import { fetchPartidas } from '@/src/services/api';
import OrganizarPartidas, {
  type OrganizarPartidasRef,
} from '../organizarPartidas/organizarPartidas';
import {
  CarrosselSubs,
  SUBS_INICIACAO,
  SUBS_BASE,
} from '@/src/components/CarrosselSubs';
import DetalhesPartida, {
  Partida as PartidaDetalhes,
} from '@/src/components/DetalhesPartida';
import { CardsSkeleton } from '@/src/components/Skeleton';
import { ErroCarregamento } from '@/src/components/ErroCarregamento';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { criarControleRequisicoes } from '@/src/utils/request';

interface Time {
  id: number;
  nome: string;
  escudo: string | null;
}
interface Partida {
  somente_leitura?: boolean;
  id: number;
  mandante: Time;
  visitante: Time;
  gols_mandante: number;
  gols_visitante: number;
  data: string;
  horario: string | null;
  local: string | null;
  status: 'AGENDADA' | 'PREPARADA' | 'AO_VIVO' | 'FINALIZADA' | 'CANCELADA';
  emCasa: boolean;
  categoria: { id: number; nome: string } | null;
}
interface DiaJogo {
  data: string;
  partidas: Partida[];
}

function isHoje(dataStr: string): boolean {
  const hoje = new Date();
  const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
  return (
    hoje.getFullYear() === ano &&
    hoje.getMonth() + 1 === mes &&
    hoje.getDate() === dia
  );
}

function agruparPorDia(partidas: Partida[]): DiaJogo[] {
  const mapa = new Map<string, Partida[]>();
  for (const p of partidas) {
    const [ano, mes, dia] = p.data.split('T')[0].split('-');
    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const chave = dataObj
      .toLocaleDateString('pt-BR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
      })
      .toUpperCase();
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push(p);
  }
  return Array.from(mapa.entries()).map(([data, partidas]) => ({
    data,
    partidas,
  }));
}

function ordenarPartidas(partidas: Partida[]): Partida[] {
  const aoVivo = partidas.filter((p) => p.status === 'AO_VIVO');
  const agendadas = partidas
    .filter((p) => p.status === 'AGENDADA' || p.status === 'PREPARADA')
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const finalizadas = partidas
    .filter((p) => p.status === 'FINALIZADA')
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  const canceladas = partidas.filter((p) => p.status === 'CANCELADA');
  return [...aoVivo, ...agendadas, ...finalizadas, ...canceladas];
}

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function Jogos() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { clubeAtivo, podeGerenciar } = useClubeAtivo();
  const pagerRef = useRef<PagerView>(null);
  const organizarRef = useRef<OrganizarPartidasRef>(null);
  const progressoPagina = useSharedValue(0);
  const acompanharPagina = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      'worklet';
      progressoPagina.value = event.position + event.offset;
    },
    ['onPageScroll']
  );
  const carregouUmaVez = useRef(false);
  const clubeCarregadoId = useRef<number | null>(null);
  const controle = useRef(criarControleRequisicoes()).current;
  const [erroCarregamento, setErroCarregamento] = useState('');

  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(
    null
  );

  const [filtros, setFiltros] = useState(() => filtrosJogosAtuais());
  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);

  const [tipoFiltro, setTipoFiltro] = useState<'INICIACAO' | 'BASE'>(
    'INICIACAO'
  );
  const [subIndex, setSubIndex] = useState(0);
  const [dias, setDias] = useState<DiaJogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOrganizar, setModalOrganizar] = useState(false);

  const carregarPartidas = useCallback(async () => {
    const pedido = controle.iniciar();
    setErroCarregamento('');
    const clubeMudou = clubeCarregadoId.current !== (clubeAtivo?.id ?? null);
    try {
      if (clubeMudou) {
        setCarregando(true);
        setDias([]);
      }
      if (!clubeAtivo?.id) {
        setDias([]);
        return;
      }
      const params = parametrosJogos(filtros);
      const partidas: Partida[] = await fetchPartidas(params, clubeAtivo.id);
      if (!controle.atual(pedido)) return;
      setDias(agruparPorDia(ordenarPartidas(partidas)));
      clubeCarregadoId.current = clubeAtivo.id;
    } catch (e) {
      if (controle.atual(pedido))
        setErroCarregamento(
          e instanceof Error ? e.message : 'Não foi possível carregar os jogos.'
        );
    } finally {
      if (controle.atual(pedido)) {
        setCarregando(false);
        setRefreshing(false);
      }
    }
  }, [clubeAtivo?.id, filtros, controle]);

  useFocusEffect(
    useCallback(() => {
      if (!carregouUmaVez.current) setCarregando(true);
      carregarPartidas().finally(() => {
        carregouUmaVez.current = true;
      });
      return () => controle.invalidar();
    }, [carregarPartidas])
  );

  const onRefresh = () => {
    setRefreshing(true);
    carregarPartidas();
  };
  const dadosAtuais = tipoFiltro === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;
  useEffect(() => {
    setPartidaSelecionada(null);
    setModalOrganizar(false);
    setModalFiltrosVisible(false);
  }, [clubeAtivo?.id]);
  const diasPorSub = useMemo(
    () =>
      dadosAtuais.map((sub) => ({
        sub,
        diasComPartidas: dias
          .map((dia) => ({
            ...dia,
            filtradas: dia.partidas.filter(
              (p) =>
                p.categoria?.nome.toUpperCase().replace(' ', '-') === sub.title
            ),
          }))
          .filter((dia) => dia.filtradas.length > 0),
      })),
    [dias, dadosAtuais]
  );

  const handleTrocarFase = useCallback(
    (novaFase: 'INICIACAO' | 'BASE') => {
      setTipoFiltro(novaFase);
      setSubIndex(0);
      progressoPagina.value = 0;
      pagerRef.current?.setPageWithoutAnimation(0);
    },
    [progressoPagina]
  );

  const handleSubChange = useCallback((index: number) => {
    pagerRef.current?.setPage(index);
  }, []);

  const onPageSelected = (e: any) => {
    const index = e.nativeEvent.position;
    if (index !== subIndex) setSubIndex(index);
  };

  const aplicarFiltros = (novosFiltros: ValoresFiltros) => {
    setModalFiltrosVisible(false);
    if (mesmosFiltrosJogos(filtros, novosFiltros)) return;
    controle.invalidar();
    setCarregando(true);
    setDias([]);
    setFiltros(novosFiltros);
  };

  const aoCriarPartida = (dataISO: string) => {
    setModalOrganizar(false);
    const [ano, mes] = dataISO.split('-').map(Number);
    const novosFiltros: ValoresFiltros = { mes, ano, status: 'TODOS' };
    if (mesmosFiltrosJogos(filtros, novosFiltros)) void carregarPartidas();
    else aplicarFiltros(novosFiltros);
  };

  return (
    <View style={styles.container}>
      <HeaderClube />

      <CarrosselSubs
        tipoFiltro={tipoFiltro}
        onTrocarTipo={handleTrocarFase}
        indexAtual={subIndex}
        onChangeIndex={handleSubChange}
        progressoPagina={progressoPagina}
      />

      <AnimatedPagerView
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={onPageSelected}
        onPageScroll={acompanharPagina}
        offscreenPageLimit={1}
      >
        {diasPorSub.map(({ sub, diasComPartidas }, indexPagina) => {
          return (
            <View
              key={`pagina-${indexPagina}`}
              style={{ flex: 1 }}
              collapsable={false}
            >
              <PaginaCategoria
                grupo={`${clubeAtivo?.id}-${tipoFiltro}`}
                preparar={Math.abs(indexPagina - subIndex) <= 1}
              >
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.content}
                  refreshControl={
                    <RefreshControl
                      refreshing={refreshing}
                      onRefresh={onRefresh}
                      tintColor={colors.primaria}
                    />
                  }
                >
                  <View style={styles.filterBarContainer}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      style={styles.singleFilterBtn}
                      onPress={() => setModalFiltrosVisible(true)}
                      accessibilityRole="button"
                      accessibilityLabel={`Alterar filtros: ${periodoJogos(filtros)}, ${STATUS_JOGOS.find((opcao) => opcao.value === filtros.status)?.label}`}
                      accessibilityHint="Abre as opções de mês, ano e status"
                    >
                      <Icon
                        name="filter-variant"
                        size={20}
                        color={colors.primaria}
                      />
                      <View style={styles.filterSummary}>
                        <Text style={styles.filterBtnText}>
                          {periodoJogos(filtros)}
                        </Text>
                        <Text style={styles.filterStatusText}>
                          {
                            STATUS_JOGOS.find(
                              (opcao) => opcao.value === filtros.status
                            )?.label
                          }
                        </Text>
                      </View>
                      <Icon
                        name="chevron-down"
                        size={20}
                        color={colors.textoSecundario}
                      />
                    </TouchableOpacity>
                  </View>

                  {!!erroCarregamento && (
                    <ErroCarregamento
                      compacto={dias.length > 0}
                      titulo={
                        dias.length > 0
                          ? 'Exibindo jogos já carregados'
                          : 'Não foi possível carregar os jogos'
                      }
                      descricao={
                        dias.length > 0
                          ? 'Não conseguimos atualizar a lista agora. Tente novamente em instantes.'
                          : 'Confira sua conexão e tente atualizar novamente.'
                      }
                      onTentarNovamente={onRefresh}
                    />
                  )}
                  {carregando ? (
                    <CardsSkeleton rows={4} />
                  ) : diasComPartidas.length === 0 ? (
                    <View
                      style={{ alignItems: 'center', marginTop: 60, gap: 12 }}
                    >
                      <Icon
                        name="calendar-remove-outline"
                        size={48}
                        color={colors.borda}
                      />
                      <Text
                        style={{
                          fontFamily: 'Inter_600SemiBold',
                          color: colors.textoSecundario,
                          fontSize: 14,
                        }}
                      >
                        NENHUM JOGO ENCONTRADO
                      </Text>
                    </View>
                  ) : (
                    diasComPartidas.map((dia, index) => {
                      const diaEhHoje = dia.filtradas.some((partida) =>
                        isHoje(partida.data)
                      );
                      return (
                        <View key={index} style={styles.daySection}>
                          <View style={styles.dateHeader}>
                            <View
                              style={[
                                styles.dateBar,
                                diaEhHoje && styles.dateBarHoje,
                              ]}
                            />
                            <Text
                              style={[
                                styles.dateText,
                                diaEhHoje && styles.dateTextHoje,
                              ]}
                            >
                              {diaEhHoje ? `HOJE • ${dia.data}` : dia.data}
                            </Text>
                          </View>

                          {dia.filtradas.map((partida) => {
                            const partidaEhHoje = isHoje(partida.data);
                            const partidaAoVivo = partida.status === 'AO_VIVO';
                            return (
                              <TouchableOpacity
                                key={partida.id}
                                style={[
                                  styles.matchCard,
                                  partidaEhHoje && styles.matchCardHoje,
                                  partidaAoVivo && styles.matchCardAoVivo,
                                ]}
                                activeOpacity={0.85}
                                onPress={() => setPartidaSelecionada(partida)}
                              >
                                {/* TOP CARD */}
                                <View style={styles.cardTop}>
                                  <View style={styles.cardTopLeft}>
                                    <Icon
                                      name="clock-outline"
                                      size={16}
                                      color={colors.textoSecundario}
                                    />
                                    <Text style={styles.timeText}>
                                      {partida.horario ?? '--:--'}
                                    </Text>
                                    <View style={styles.separator} />
                                    <Text style={styles.catText}>
                                      {partida.categoria?.nome
                                        .replace('SUB', '')
                                        .trim() ?? '?'}
                                    </Text>
                                    {partidaEhHoje && !partidaAoVivo && (
                                      <View style={styles.todayBadge}>
                                        <Text style={styles.todayBadgeText}>
                                          HOJE
                                        </Text>
                                      </View>
                                    )}
                                  </View>
                                  <View style={styles.cardBadges}>
                                    {partidaAoVivo && (
                                      <View style={styles.liveBadge}>
                                        <Icon
                                          name="live"
                                          size={14}
                                          color={colors.tituloErro}
                                        />
                                        <Text style={styles.liveBadgeText}>
                                          AO VIVO
                                        </Text>
                                      </View>
                                    )}
                                    <View
                                      style={[
                                        styles.badge,
                                        !partida.emCasa && {
                                          backgroundColor:
                                            colors.cardSecundario,
                                        },
                                      ]}
                                    >
                                      <Icon
                                        name={
                                          partida.emCasa
                                            ? 'home-outline'
                                            : 'bus'
                                        }
                                        size={14}
                                        color={
                                          partida.emCasa
                                            ? colors.textoSobrePrimaria
                                            : colors.texto
                                        }
                                      />
                                      <Text
                                        style={[
                                          styles.badgeText,
                                          {
                                            color: partida.emCasa
                                              ? colors.textoSobrePrimaria
                                              : colors.texto,
                                          },
                                        ]}
                                      >
                                        {partida.emCasa ? 'CASA' : 'FORA'}
                                      </Text>
                                    </View>
                                  </View>
                                </View>

                                {/* BODY CARD */}
                                <View style={styles.cardBody}>
                                  <View style={styles.teamCol}>
                                    {partida.mandante.escudo ? (
                                      <Image
                                        source={{
                                          uri: partida.mandante.escudo,
                                        }}
                                        style={styles.teamLogo}
                                      />
                                    ) : (
                                      <View style={styles.fundoImg}>
                                        <Image
                                          source={require('@/assets/images/SóPreto.png')}
                                          style={styles.teamLogo}
                                        />
                                      </View>
                                    )}
                                    <Text
                                      style={styles.teamName}
                                      numberOfLines={2}
                                    >
                                      {partida.mandante.nome}
                                    </Text>
                                  </View>

                                  <View style={styles.placarCentral}>
                                    {partida.status === 'AGENDADA' ||
                                    partida.status === 'PREPARADA' ||
                                    partida.status === 'CANCELADA' ? (
                                      <>
                                        <Text style={styles.placarText}>-</Text>
                                        <Text style={styles.vsText}>VS</Text>
                                      </>
                                    ) : (
                                      <Text style={styles.placarText}>
                                        {partida.gols_mandante} -{' '}
                                        {partida.gols_visitante}
                                      </Text>
                                    )}
                                  </View>

                                  <View style={styles.teamCol}>
                                    {partida.visitante.escudo ? (
                                      <Image
                                        source={{
                                          uri: partida.visitante.escudo,
                                        }}
                                        style={styles.teamLogo}
                                      />
                                    ) : (
                                      <View style={styles.fundoImg}>
                                        <Image
                                          source={require('@/assets/images/SóPreto.png')}
                                          style={styles.teamLogo}
                                        />
                                      </View>
                                    )}
                                    <Text
                                      style={styles.teamName}
                                      numberOfLines={2}
                                    >
                                      {partida.visitante.nome}
                                    </Text>
                                  </View>
                                </View>

                                {/* FOOTER CARD */}
                                <View style={styles.cardFooterDivider} />
                                <View style={styles.cardFooter}>
                                  <Icon
                                    name="map-marker-outline"
                                    size={16}
                                    color={colors.texto}
                                  />
                                  <Text style={styles.locationText}>
                                    {partida.local ?? 'Local não definido'}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      );
                    })
                  )}
                </ScrollView>
              </PaginaCategoria>
            </View>
          );
        })}
      </AnimatedPagerView>

      {/* FAB ICON */}
      {podeGerenciar && (
        <TouchableOpacity
          activeOpacity={0.8}
          style={styles.fab}
          onPress={() => setModalOrganizar(true)}
        >
          <LinearGradient
            colors={[colors.primaria, '#0055FF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.fabGradient}
          >
            <Icon name="plus" size={28} color={colors.textoSobrePrimaria} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {modalFiltrosVisible && (
        <FiltrosJogos
          filtros={filtros}
          onAplicar={aplicarFiltros}
          onFechar={() => setModalFiltrosVisible(false)}
        />
      )}

      <Modal
        visible={modalOrganizar}
        transparent={false}
        animationType="slide"
        onRequestClose={() => organizarRef.current?.solicitarFechamento()}
      >
        <OrganizarPartidas
          ref={organizarRef}
          noModal={true}
          categoriaInicial={dadosAtuais[subIndex]?.title}
          onCriada={aoCriarPartida}
          onFechar={() => {
            setModalOrganizar(false);
            carregarPartidas();
          }}
        />
      </Modal>

      {partidaSelecionada && (
        <Modal
          visible={!!partidaSelecionada}
          transparent={false}
          animationType="slide"
          onRequestClose={() => setPartidaSelecionada(null)}
        >
          <DetalhesPartida
            partida={partidaSelecionada as PartidaDetalhes}
            isAdmin={podeGerenciar && !partidaSelecionada.somente_leitura}
            onBack={() => {
              setPartidaSelecionada(null);
              carregarPartidas();
            }}
          />
        </Modal>
      )}
    </View>
  );
}
