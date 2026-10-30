import { useRouter } from 'expo-router';
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
  SectionList,
  ActivityIndicator,
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
import { CategoryPager, type CategoryPagerHandle } from '@/src/components/CategoryPager';
import { CategoryPageMotion } from '@/src/components/CategoryPageMotion';
import { useCategoryPagerMotion } from '@/src/hooks/useCategoryPagerMotion';
import { fetchAgenda } from '@/src/services/api';
import { CartaoJogo, type PartidaJogo } from '@/src/components/CartaoJogo';
import { agoraAgenda, categoriaAgenda, secoesAgenda, unirPaginasAgenda, type GrupoAgenda } from '@/src/utils/agendaJogos';
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

type Partida = PartidaJogo;


export default function Jogos() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { clubeAtivo, podeGerenciar } = useClubeAtivo();
  const pagerRef = useRef<CategoryPagerHandle>(null);
  const organizarRef = useRef<OrganizarPartidasRef>(null);
  const pagerMotion = useCategoryPagerMotion(pagerRef);
  const progressoPagina = pagerMotion.progress;
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
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [agora, setAgora] = useState(() => new Date());
  const referenciaAgenda = useRef('');
  const carregandoMaisRef = useRef(false);
  const [carregandoMais, setCarregandoMais] = useState<string | null>(null);
  const [errosMais, setErrosMais] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOrganizar, setModalOrganizar] = useState(false);

  const carregarPartidas = useCallback(async () => {
    const pedido = controle.iniciar();
    setErroCarregamento('');
    carregandoMaisRef.current = false;
    setCarregandoMais(null);
    setErrosMais({});
    const clubeMudou = clubeCarregadoId.current !== (clubeAtivo?.id ?? null);
    try {
      if (clubeMudou) {
        setCarregando(true);
        setPartidas([]);
      }
      if (!clubeAtivo?.id) {
        setPartidas([]);
        return;
      }
      const referencia = agoraAgenda();
      const params = { ...parametrosJogos(filtros), agora: referencia };
      const partidas: Partida[] = await fetchAgenda(params, clubeAtivo.id);
      if (!controle.atual(pedido)) return;
      referenciaAgenda.current = referencia;
      setAgora(new Date());
      setPartidas(partidas);
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
      const timer = setInterval(() => setAgora(new Date()), 60000);
      return () => {
        clearInterval(timer);
        controle.invalidar();
      };
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
  const secoesPorSub = useMemo(
    () => dadosAtuais.map((sub) => ({
      sub,
      secoes: secoesAgenda(partidas.filter((partida) =>
        categoriaAgenda(partida.categoria?.nome ?? '') === sub.title
      )),
    })),
    [partidas, dadosAtuais]
  );

  const carregarMais = async (categoria: string, grupo: GrupoAgenda, apos: number) => {
    if (!clubeAtivo?.id || carregando || refreshing || carregandoMaisRef.current) return;
    const chave = categoria + ':' + grupo;
    const pedido = controle.iniciar();
    carregandoMaisRef.current = true;
    setCarregandoMais(chave);
    setErrosMais((atuais) => ({ ...atuais, [chave]: '' }));
    try {
      const novas: Partida[] = await fetchAgenda({
        ...parametrosJogos(filtros),
        agora: referenciaAgenda.current,
        categoria_nome: categoria, grupo, apos,
      }, clubeAtivo.id);
      if (!controle.atual(pedido)) return;
      setPartidas((atuais) => novas.length ? unirPaginasAgenda(atuais, novas) : atuais.map((partida) =>
        categoriaAgenda(partida.categoria?.nome ?? '') === categoria && partida.grupo_agenda === grupo
          ? { ...partida, total_grupo: apos } : partida
      ));
    } catch {
      if (controle.atual(pedido)) setErrosMais((atuais) => ({
        ...atuais, [chave]: 'Não foi possível carregar mais jogos. Tente novamente.',
      }));
    } finally {
      if (controle.atual(pedido)) {
        carregandoMaisRef.current = false;
        setCarregandoMais(null);
      }
    }
  };
  const handleTrocarFase = useCallback(
    (novaFase: 'INICIACAO' | 'BASE') => {
      setTipoFiltro(novaFase);
      setSubIndex(0);
      progressoPagina.value = 0;
      pagerMotion.origin.value = 0;
      pagerRef.current?.setPageWithoutAnimation(0);
    },
    [progressoPagina]
  );

  const handleSubChange = useCallback((index: number, velocity?: number) => {
    pagerMotion.goTo(index, velocity);
  }, [pagerMotion.goTo]);

  const onPageSelected = (e: any) => {
    const index = e.nativeEvent.position;
    if (index !== subIndex) setSubIndex(index);
  };

  const aplicarFiltros = (novosFiltros: ValoresFiltros) => {
    setModalFiltrosVisible(false);
    if (mesmosFiltrosJogos(filtros, novosFiltros)) return;
    controle.invalidar();
    setCarregando(true);
    setPartidas([]);
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
      {podeGerenciar && <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/solicitacoes-partidas' as never)} style={{ paddingHorizontal: 20, paddingVertical: 10 }}><Text style={{ color: colors.primaria }}>Solicitações de partidas</Text></TouchableOpacity>}

      <CarrosselSubs
        tipoFiltro={tipoFiltro}
        onTrocarTipo={handleTrocarFase}
        indexAtual={subIndex}
        onChangeIndex={handleSubChange}
        progressoPagina={progressoPagina} originPagina={pagerMotion.origin} settlingPagina={pagerMotion.settling}
      />

      <CategoryPager
        ref={pagerRef}
        style={{ flex: 1 }}
        initialPage={0}
        onPageSelected={onPageSelected}
        progress={progressoPagina} origin={pagerMotion.origin} settling={pagerMotion.settling} onSettled={pagerMotion.onSettled}
      >
        {secoesPorSub.map(({ sub, secoes }, indexPagina) => {
          return (
            <View
              key={`pagina-${indexPagina}`}
              style={{ flex: 1 }}
              collapsable={false}
            >
              <CategoryPageMotion index={indexPagina} progress={progressoPagina} origin={pagerMotion.origin} settling={pagerMotion.settling}>
              <PaginaCategoria
                grupo={`${clubeAtivo?.id}-${tipoFiltro}`}
                preparar
              >
                <SectionList
                  sections={carregando ? [] : secoes}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerStyle={styles.content}
                  showsVerticalScrollIndicator={false}
                  stickySectionHeadersEnabled={false}
                  initialNumToRender={4}
                  maxToRenderPerBatch={4}
                  windowSize={5}
                  removeClippedSubviews={false}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaria} />}
                  ListHeaderComponent={<>
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
                      compacto={partidas.length > 0}
                      titulo={
                        partidas.length > 0
                          ? 'Exibindo jogos já carregados'
                          : 'Não foi possível carregar os jogos'
                      }
                      descricao={
                        partidas.length > 0
                          ? 'Não conseguimos atualizar a lista agora. Tente novamente em instantes.'
                          : 'Confira sua conexão e tente atualizar novamente.'
                      }
                      onTentarNovamente={onRefresh}
                    />
                  )}

                    {carregando && <CardsSkeleton rows={4} />}
                  </>}
                  ListEmptyComponent={carregando ? null : (
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
                  )}
                  renderSectionHeader={({ section }) => (
                    <View style={styles.agendaHeading}>
                      <Text style={styles.agendaTitle}>{section.titulo}</Text>
                      <Text style={styles.agendaDescription}>{section.descricao}</Text>
                    </View>
                  )}
                  renderItem={({ item, index, section }) => {
                    const mostrarData = index === 0 || section.data[index - 1].data.slice(0, 10) !== item.data.slice(0, 10);
                    const hoje = item.data.slice(0, 10) === agoraAgenda(agora).slice(0, 10);
                    const data = new Date(item.data.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', {
                      weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
                    });
                    return <View>
                      {mostrarData && <View style={styles.dateHeader}>
                        <View style={[styles.dateBar, hoje && styles.dateBarHoje]} />
                        <Text style={[styles.dateText, hoje && styles.dateTextHoje]}>
                          {hoje ? 'HOJE • ' + data : data}
                        </Text>
                      </View>}
                      <CartaoJogo partida={item} agora={agora} gestor={podeGerenciar} onPress={() => setPartidaSelecionada(item)} />
                    </View>;
                  }}
                  renderSectionFooter={({ section }) => {
                    if (!section.mais) return null;
                    const { grupo, apos } = section.mais;
                    const chave = sub.title + ':' + grupo;
                    return <View>
                      {!!errosMais[chave] && <Text style={styles.agendaDescription} accessibilityRole='alert'>{errosMais[chave]}</Text>}
                      <TouchableOpacity
                        style={styles.moreButton}
                        disabled={carregandoMais !== null}
                        onPress={() => void carregarMais(sub.title, grupo, apos)}
                        accessibilityRole='button'
                        accessibilityState={{ disabled: carregandoMais !== null, busy: carregandoMais === chave }}
                      >
                        {carregandoMais === chave
                          ? <ActivityIndicator color={colors.primaria} />
                          : <Text style={styles.moreText}>Carregar mais {grupo === 'historico' ? 'partidas anteriores' : 'jogos'}</Text>}
                      </TouchableOpacity>
                    </View>;
                  }}
                />
              </PaginaCategoria>
              </CategoryPageMotion>
            </View>
          );
        })}
      </CategoryPager>

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