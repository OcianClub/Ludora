import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { io, type Socket } from 'socket.io-client';
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
  TextInput,
  TouchableOpacity,
  SectionList,
  ScrollView,
  AppState,
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
import { BASE_URL, fetchAgenda, invalidarConsultasRecentes } from '@/src/services/api';
import { CartaoJogo, type PartidaJogo } from '@/src/components/CartaoJogo';
import { agoraAgenda, categoriaAgenda, secoesAgenda, unirPaginasAgenda, reutilizarPartidasAgenda, type GrupoAgenda } from '@/src/utils/agendaJogos';
import OrganizarPartidas, {
  type OrganizarPartidasRef,
} from '../organizarPartidas/organizarPartidas';
import {
  CarrosselSubs,
  SUBS_INICIACAO,
  SUBS_BASE,
} from '@/src/components/CarrosselSubs';
import { requisicaoPartida } from '@/src/services/partidasCompartilhadas';
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
  const destinoHome = useLocalSearchParams<{ status?: string; sub?: string; ano?: string }>();
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

  const [acordeoes, setAcordeoes] = useState<Record<string, boolean>>({});
  const [busca, setBusca] = useState('');
  const [filtros, setFiltros] = useState(() => ({ ...filtrosJogosAtuais(), todosPeriodos: true, periodo: 'todos' }) as ValoresFiltros);
  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);

  const [tipoFiltro, setTipoFiltro] = useState<'INICIACAO' | 'BASE'>(
    'INICIACAO'
  );
  const [subIndex, setSubIndex] = useState(0);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [agora, setAgora] = useState(() => new Date());
  const referenciaAgenda = useRef('');
  const carregandoMaisRef = useRef(false);
  const consultaPendente = useRef(false);
  const geracaoAgenda = useRef(0);
  const [carregandoMais, setCarregandoMais] = useState<string | null>(null);
  const [errosMais, setErrosMais] = useState<Record<string, string>>({});
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOrganizar, setModalOrganizar] = useState(false);
  const [solicitacoesPendentes, setSolicitacoesPendentes] = useState(0);

  useEffect(() => {
    const termo = busca.trim();
    const timer = setTimeout(() => {
      setFiltros(atuais => (atuais.busca ?? '') === termo ? atuais : { ...atuais, busca: termo || undefined });
    }, 300);
    return () => clearTimeout(timer);
  }, [busca]);

  const { busca: termoBusca, ano, mes, todosPeriodos, periodo, de, ate, organizadas, preparacao, mando } = filtros;
  const parametrosConsulta = useMemo(() => ({
    ...parametrosJogos({ busca: termoBusca, ano, mes, todosPeriodos, periodo, de, ate, organizadas, preparacao, mando, status: 'TODOS' }),
    por_situacao: true,
  }), [termoBusca, ano, mes, todosPeriodos, periodo, de, ate, organizadas, preparacao, mando]);

  const carregarPartidas = useCallback(async (revalidar = false) => {
    const pedido = controle.iniciar();
    geracaoAgenda.current += 1;
    consultaPendente.current = true;
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
      const params = { ...parametrosConsulta, agora: referencia };
      const partidas: Partida[] = await fetchAgenda(params, clubeAtivo.id, revalidar);
      if (!controle.atual(pedido)) return;
      referenciaAgenda.current = referencia;
      setAgora(atual => agoraAgenda(atual) === referencia ? atual : new Date());
      setPartidas(atuais => reutilizarPartidasAgenda(atuais, partidas));
      clubeCarregadoId.current = clubeAtivo.id;
    } catch (e) {
      if (controle.atual(pedido))
        setErroCarregamento(
          e instanceof Error ? e.message : 'Não foi possível carregar os jogos.'
        );
    } finally {
      if (controle.atual(pedido)) {
        consultaPendente.current = false;
        setCarregando(false);
        setRefreshing(false);
      }
    }
  }, [clubeAtivo?.id, parametrosConsulta, controle]);

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
        geracaoAgenda.current += 1;
        consultaPendente.current = false;
        carregandoMaisRef.current = false;
        setCarregandoMais(null);
      };
    }, [carregarPartidas])
  );

  const atualizarAgendaRef = useRef(carregarPartidas);
  atualizarAgendaRef.current = carregarPartidas;
  const clubeId = clubeAtivo?.id;

  useFocusEffect(useCallback(() => {
    if (!clubeId) return;
    let ativo = true;
    let socket: Socket | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setSolicitacoesPendentes(0);
    const atualizarSolicitacoes = async () => {
      if (!podeGerenciar) return;
      try {
        const resumo = await requisicaoPartida<{ pendentes: number }>('/partidas/solicitacoes/resumo', clubeId);
        if (ativo) setSolicitacoesPendentes(resumo.pendentes);
      } catch {}
    };
    void atualizarSolicitacoes();
    const atualizar = () => {
      invalidarConsultasRecentes();
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (ativo && AppState.currentState === 'active') void atualizarAgendaRef.current(true);
      }, 200);
    };
    void SecureStore.getItemAsync('userToken').then(token => {
      if (!ativo || !token) return;
      socket = io(BASE_URL, { auth: { token, clubeId }, transports: ['websocket', 'polling'] });
      let primeiraConexao = true;
      socket.on('connect', () => {
        if (!primeiraConexao) atualizar();
        primeiraConexao = false;
      });
      socket.on('partida_atualizada', atualizar);
      socket.on('placar_atualizado', atualizar);
      socket.on('solicitacao_partida', () => { invalidarConsultasRecentes(); void atualizarSolicitacoes(); });
      socket.on('connect', () => { void atualizarSolicitacoes(); });
    }).catch(() => undefined);
    const appState = AppState.addEventListener('change', estado => {
      if (estado === 'active') { atualizar(); void atualizarSolicitacoes(); }
    });
    const fallback = setInterval(() => {
      if (!socket?.connected) { atualizar(); void atualizarSolicitacoes(); }
    }, 12_000);
    return () => {
      ativo = false;
      clearTimeout(timer);
      clearInterval(fallback);
      appState.remove();
      socket?.disconnect();
    };
  }, [clubeId, podeGerenciar]));

  const abrirJogo = useCallback((item: Partida) => {
    if (item.organizador_id) {
      router.push({ pathname: '/partida-compartilhada/[id]', params: { id: String(item.id) } });
    } else setPartidaSelecionada(item);
  }, [router]);

  const onRefresh = () => {
    setRefreshing(true);
    carregarPartidas(true);
  };
  const { status: statusHome, sub: subHome, ano: anoHome } = destinoHome;
  useEffect(() => {
    if (!subHome) return;
    const inicio = SUBS_INICIACAO.findIndex(item => item.title === subHome);
    const base = SUBS_BASE.findIndex(item => item.title === subHome);
    if (inicio < 0 && base < 0) return;
    const index = inicio >= 0 ? inicio : base;
    setTipoFiltro(inicio >= 0 ? 'INICIACAO' : 'BASE');
    setSubIndex(index);
    pagerRef.current?.setPageWithoutAnimation(index);
    setBusca('');
    setFiltros({
      ...filtrosJogosAtuais(),
      ano: Number(anoHome) || new Date().getFullYear(),
      mes: null,
      todosPeriodos: true, periodo: 'todos',
      status: statusHome === 'FINALIZADA' ? 'FINALIZADA' : statusHome === 'AGENDADA' ? 'PROXIMAS' : 'TODOS',
    });
    router.setParams({ status: undefined, sub: undefined, ano: undefined });
  }, [anoHome, router, statusHome, subHome]);

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
      ), true),
    })),
    [partidas, dadosAtuais]
  );

  const paginas = useMemo(() => secoesPorSub.map(({ sub, secoes }, indexPagina) => {
    const categorias = filtros.ordem === 'categoria'
      ? [...secoesPorSub.slice(indexPagina), ...secoesPorSub.slice(0, indexPagina)]
      : [{ sub, secoes }];
    return categorias.flatMap(categoria => categoria.secoes.filter(secao => {
      if (filtros.status === 'TODOS') return true;
      if (filtros.status === 'PROXIMAS') return secao.key === 'agenda' || secao.key === 'pendentes';
      if (filtros.status === 'AO_VIVO') return secao.key === 'ao_vivo';
      return secao.key === (filtros.status === 'FINALIZADA' ? 'finalizadas' : 'canceladas');
    }).map(secao => {
      const key = `${categoria.sub.title}-${secao.key}`;
      const expansivel = filtros.status === 'TODOS';
      const aberto = !expansivel || (acordeoes[key] ?? !['finalizadas', 'canceladas', 'historico'].includes(secao.key));
      return { ...secao, key, expansivel, aberto, data: aberto ? secao.data : [], categoria: categoria.sub.title };
    }));
  }), [secoesPorSub, filtros.ordem, filtros.status, acordeoes]);

  const totais = (secoesPorSub[subIndex]?.secoes ?? []).reduce((contagem, secao) => {
    const total = secao.total ?? secao.data.length;
    contagem.TODOS += total;
    if (secao.key === 'ao_vivo') contagem.AO_VIVO += total;
    if (secao.key === 'agenda' || secao.key === 'pendentes') contagem.PROXIMAS += total;
    if (secao.key === 'finalizadas') contagem.FINALIZADA += total;
    if (secao.key === 'canceladas') contagem.CANCELADA += total;
    return contagem;
  }, { TODOS: 0, AO_VIVO: 0, PROXIMAS: 0, FINALIZADA: 0, CANCELADA: 0 });

  const carregarMais = async (categoria: string, grupo: GrupoAgenda, apos: number) => {
    if (!clubeAtivo?.id || carregando || refreshing || carregandoMaisRef.current || consultaPendente.current) return;
    const chave = categoria + ':' + grupo;
    const pedido = geracaoAgenda.current;
    carregandoMaisRef.current = true;
    setCarregandoMais(chave);
    setErrosMais((atuais) => ({ ...atuais, [chave]: '' }));
    try {
      const novas: Partida[] = await fetchAgenda({
        ...parametrosConsulta,
        agora: referenciaAgenda.current,
        categoria_nome: categoria, grupo, apos,
      }, clubeAtivo.id);
      if (pedido !== geracaoAgenda.current) return;
      setPartidas((atuais) => novas.length ? unirPaginasAgenda(atuais, novas) : atuais.map((partida) =>
        categoriaAgenda(partida.categoria?.nome ?? '') === categoria && partida.grupo_agenda === grupo
          ? { ...partida, total_grupo: apos } : partida
      ));
    } catch {
      if (pedido === geracaoAgenda.current) setErrosMais((atuais) => ({
        ...atuais, [chave]: 'Não foi possível carregar mais jogos. Tente novamente.',
      }));
    } finally {
      if (pedido === geracaoAgenda.current) {
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
    const mudouConsulta = !mesmosFiltrosJogos(
      { ...filtros, status: 'TODOS', ordem: 'horario' },
      { ...novosFiltros, status: 'TODOS', ordem: 'horario' }
    );
    if (mudouConsulta) {
      controle.invalidar();
      setCarregando(true);
      setPartidas([]);
    }
    setFiltros(novosFiltros);
  };

  const aoCriarPartida = () => {
    setModalOrganizar(false);
    const novosFiltros: ValoresFiltros = {
      ...filtrosJogosAtuais(), periodo: 'todos', todosPeriodos: true, status: 'PROXIMAS',
    };
    setBusca('');
    if (mesmosFiltrosJogos(filtros, novosFiltros)) void carregarPartidas();
    else aplicarFiltros(novosFiltros);
  };

  const controles = (
    <View style={{ marginHorizontal: -12 }}>


      <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityRole="tablist"
        style={styles.statusTabScroll} contentContainerStyle={styles.statusTabs}>
        {STATUS_JOGOS.map(option => {
          const selected = filtros.status === option.value;
          return (
            <TouchableOpacity
              key={option.value}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.statusTab, selected && styles.statusTabSelected]}
              onPress={() => setFiltros(atuais => ({ ...atuais, status: option.value }))}
            >
              {option.value === 'AO_VIVO' && <View style={styles.statusLiveDot} />}
              <Text style={[styles.statusTabLabel, selected && styles.statusTabLabelSelected]}>
                {option.value === 'TODOS' ? 'Todos' : option.label}
              </Text>
              <Text style={styles.accordionCount}>{totais[option.value]}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.filterBarContainer}>
        {podeGerenciar && <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Solicitações: ${solicitacoesPendentes} aguardando sua resposta`} style={styles.moreFiltersButton} onPress={() => router.push('/solicitacoes-partidas')}>
          <Icon name="email-outline" size={19} color={colors.texto} />
          {solicitacoesPendentes > 0 && <View style={styles.requestsBadge}><Text style={styles.requestsBadgeText}>{solicitacoesPendentes > 99 ? '99+' : solicitacoesPendentes}</Text></View>}
        </TouchableOpacity>}
        <View style={styles.searchField}>
          <Icon name="magnify" size={18} color={colors.textoSecundario} />
          <TextInput
            style={styles.searchInput}
            value={busca}
            onChangeText={setBusca}
            placeholder="Time ou adversário"
            placeholderTextColor={colors.textoSecundario}
            accessibilityLabel="Buscar time, adversário ou local"
            autoCorrect={false}
            returnKeyType="search"
            maxLength={100}
          />
        </View>
        <TouchableOpacity
          style={styles.moreFiltersButton}
          onPress={() => setModalFiltrosVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={`Mais filtros: ${periodoJogos(filtros)}`}
        >
          <Icon name="sliders-horizontal" size={20} color={colors.textoSecundario} />
        </TouchableOpacity>
      </View>

      {filtros.periodo && filtros.periodo !== 'todos' && (
        <TouchableOpacity
          style={styles.periodChip}
          accessibilityRole="button"
          accessibilityLabel={`Limpar período: ${periodoJogos(filtros)}`}
          onPress={() => aplicarFiltros({ ...filtros, periodo: 'todos', todosPeriodos: true, de: undefined, ate: undefined })}
        >
          <Text style={styles.statusTabLabelSelected}>{periodoJogos(filtros)}</Text>
          <Icon name="close" size={16} color={colors.textoSecundario} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <HeaderClube />

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
        {paginas.map((secoesDaPagina, indexPagina) => {
          const porCategoria = filtros.ordem === 'categoria';
          return (
            <View
              key={`pagina-${indexPagina}`}
              style={{ flex: 1 }}
              collapsable={false}
            >
              <CategoryPageMotion index={indexPagina} progress={progressoPagina} origin={pagerMotion.origin} settling={pagerMotion.settling}>
              <PaginaCategoria
                grupo={`${clubeAtivo?.id}-${tipoFiltro}`}
                preparar={Math.abs(indexPagina - subIndex) <= 1}
              >
                <SectionList
                  sections={carregando ? [] : secoesDaPagina}
                  keyExtractor={(item) => String(item.id)}
                  contentContainerStyle={styles.content}
                  showsVerticalScrollIndicator={false}
                  stickySectionHeadersEnabled={false}
                  initialNumToRender={6}
                  maxToRenderPerBatch={6}
                  updateCellsBatchingPeriod={24}
                  windowSize={5}
                  removeClippedSubviews={false}
                  refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaria} />}
                  ListHeaderComponent={<>
                    {controles}
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
                  renderSectionHeader={({ section }) => {
                    const titulo = porCategoria ? `${section.categoria} · ${section.titulo}` : section.titulo;
                    if (!section.expansivel) return (
                      <View style={styles.agendaHeading}>
                        <Text style={styles.agendaTitle}>{titulo}</Text>
                        <Text style={styles.agendaDescription}>{section.descricao}</Text>
                      </View>
                    );
                    return (
                      <TouchableOpacity style={[styles.accordionHeader, section.aberto && styles.accordionOpen]}
                        accessibilityRole="button" accessibilityState={{ expanded: section.aberto }}
                        onPress={() => setAcordeoes(atuais => ({ ...atuais, [section.key]: !section.aberto }))}>
                        <Icon name={section.titulo === 'Ao vivo' ? 'live' : section.titulo === 'Finalizadas' ? 'check-all' : section.titulo === 'Canceladas' ? 'minus' : 'clock'} size={17} color={colors.texto} />
                        <Text style={styles.accordionTitle}>{titulo}</Text>
                        <Text style={styles.accordionCount}>{section.total}</Text>
                        <View style={{ flex: 1 }} />
                        <Icon name={section.aberto ? 'chevron-down' : 'chevron-right'} size={17} color={colors.textoSecundario} />
                      </TouchableOpacity>
                    );
                  }}
                  renderItem={({ item, index, section }) => {
                    const porMes = section.expansivel;
                    const tamanhoData = porMes ? 7 : 10;
                    const mostrarData = !(porMes && item.grupo_agenda === 'ao_vivo') &&
                      (index === 0 || section.data[index - 1].data.slice(0, tamanhoData) !== item.data.slice(0, tamanhoData));
                    const hoje = item.data.slice(0, 10) === agoraAgenda(agora).slice(0, 10);
                    const data = mostrarData ? new Date(item.data.slice(0, 10) + 'T12:00:00').toLocaleDateString('pt-BR', {
                      ...(porMes ? {} : { weekday: 'long', day: '2-digit' }), month: 'long', year: 'numeric',
                    }) : '';
                    return <View style={porMes && [
                      styles.accordionItem,
                      index === 0 && styles.accordionFirstItem,
                      !section.mais && index === section.data.length - 1 && styles.accordionLastItem,
                    ]}>
                      {mostrarData && <View style={styles.dateHeader}>
                        <View style={[styles.dateBar, hoje && styles.dateBarHoje]} />
                        <Text style={[styles.dateText, hoje && styles.dateTextHoje]}>
                          {hoje && !porMes ? 'HOJE • ' + data : data}
                        </Text>
                      </View>}
                      <CartaoJogo partida={item} styles={styles} onPress={abrirJogo} />
                    </View>;
                  }}
                  renderSectionFooter={({ section }) => {
                    if (!section.aberto || !section.mais) return null;
                    const { grupo, apos } = section.mais;
                    const chave = section.categoria + ':' + grupo;
                    return <View style={section.expansivel && [styles.accordionItem, styles.accordionLastItem]}>
                      {!!errosMais[chave] && <Text style={styles.agendaDescription} accessibilityRole='alert'>{errosMais[chave]}</Text>}
                      <TouchableOpacity
                        style={styles.moreButton}
                        disabled={carregandoMais !== null}
                        onPress={() => void carregarMais(section.categoria, grupo, apos)}
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
          filtros={{ ...filtros, busca: busca.trim() || undefined }}
          onAplicar={novos => {
            setBusca(novos.busca ?? '');
            aplicarFiltros(novos);
          }}
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
