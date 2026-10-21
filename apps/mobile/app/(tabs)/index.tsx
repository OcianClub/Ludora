import {
  Alert,
  AppState,
  View,
  Text,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { createStyles } from '../../src/styles/indexStyles';
import { useTheme } from '@/src/contexts/ThemeContext';
import { HeaderClube } from '@/src/components/HeaderClube';
import { PaginaCategoria } from '@/src/components/PaginaCategoria';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import PagerView, {
  type PagerViewOnPageScrollEvent,
} from 'react-native-pager-view';
import Animated, { useEvent, useSharedValue } from 'react-native-reanimated';
import {
  atualizarStatusPartida,
  fetchEscalacaoPartida,
  fetchPartidas,
} from '@/src/services/api';
import {
  CarrosselSubs,
  SUBS_INICIACAO,
  SUBS_BASE,
} from '@/src/components/CarrosselSubs';
import DetalhesPartida, {
  Partida as PartidaDetalhes,
} from '@/src/components/DetalhesPartida';
import HomeCategoria, {
  type PartidaHome as Partida,
} from '@/src/components/HomeCategoria';
import { ErroCarregamento } from '@/src/components/ErroCarregamento';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import { criarControleRequisicoes } from '@/src/utils/request';
import { resumirPartidas } from '@/src/utils/resumoPartidas';
import { consultarComCopiaLocal } from '@/src/services/cacheConsultas';
import { selecionarPartidasLocais } from '@/src/utils/dadosConsultaLocal';
import { AvisoConsultaLocal } from '@/src/components/AvisoConsultaLocal';

const AnimatedPagerView = Animated.createAnimatedComponent(PagerView);

export default function Home() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pagerRef = useRef<PagerView>(null);
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
  const iniciando = useRef(false);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [consultaLocal, setConsultaLocal] = useState<number | null>(null);
  const consultaLocalRef = useRef(consultaLocal);
  consultaLocalRef.current = consultaLocal;
  const [consultandoServidor, setConsultandoServidor] = useState(false);

  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(
    null
  );
  const [iniciandoPartidaId, setIniciandoPartidaId] = useState<number | null>(
    null
  );
  const [faseAtiva, setFaseAtiva] = useState<'INICIACAO' | 'BASE'>('INICIACAO');
  const [subIndex, setSubIndex] = useState(0);

  const [partidasGlobais, setPartidasGlobais] = useState<Partida[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [revisao, setRevisao] = useState(0);

  const subsAtuais = faseAtiva === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  const { clubeAtivo, podeGerenciar } = useClubeAtivo();
  const { versaoNotificacoes } = useNotificacoes();

  const carregarDadosDoClube = useCallback(async () => {
    const pedido = controle.iniciar();
    setConsultandoServidor(true);
    setErroCarregamento('');
    const clubeMudou = clubeCarregadoId.current !== (clubeAtivo?.id ?? null);
    try {
      if (!carregouUmaVez.current || clubeMudou) setCarregando(true);
      if (clubeMudou) {
        setPartidasGlobais([]);
        setConsultaLocal(null);
      }
      if (!clubeAtivo?.id) {
        setPartidasGlobais([]);
        return;
      }
      const resultado = await consultarComCopiaLocal<Partida[]>({
        clubeId: clubeAtivo.id,
        recurso: 'home',
        carregar: () => fetchPartidas({ resumo: true }, clubeAtivo.id),
        selecionar: selecionarPartidasLocais,
        onLocal: (local) => {
          if (
            !controle.atual(pedido) ||
            (!clubeMudou && carregouUmaVez.current)
          )
            return;
          setPartidasGlobais(local.dados);
          setConsultaLocal(local.salvoEm);
          setCarregando(false);
          clubeCarregadoId.current = clubeAtivo.id;
        },
      });
      if (!controle.atual(pedido)) return;
      setPartidasGlobais(resultado.dados);
      setConsultaLocal(resultado.origem === 'local' ? resultado.salvoEm : null);
      setRevisao((valor) => valor + 1);
      clubeCarregadoId.current = clubeAtivo.id;
    } catch (error) {
      if (controle.atual(pedido)) {
        setPartidasGlobais([]);
        setConsultaLocal(null);
        setErroCarregamento(
          error instanceof Error
            ? error.message
            : 'Não foi possível carregar a Home.'
        );
      }
    } finally {
      if (controle.atual(pedido)) {
        carregouUmaVez.current = true;
        setCarregando(false);
        setConsultandoServidor(false);
      }
    }
  }, [clubeAtivo?.id, controle]);

  useFocusEffect(
    useCallback(() => {
      void carregarDadosDoClube();
      const appState = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') void carregarDadosDoClube();
      });
      const intervalo = setInterval(() => {
        if (
          consultaLocalRef.current !== null &&
          AppState.currentState === 'active'
        )
          void carregarDadosDoClube();
      }, 30_000);
      return () => {
        appState.remove();
        clearInterval(intervalo);
        controle.invalidar();
      };
    }, [carregarDadosDoClube, controle, versaoNotificacoes])
  );

  const atualizarHome = useCallback(async () => {
    setAtualizando(true);
    try {
      await carregarDadosDoClube();
    } finally {
      setAtualizando(false);
    }
  }, [carregarDadosDoClube]);

  const fecharDetalhes = useCallback(() => {
    setPartidaSelecionada(null);
    void carregarDadosDoClube();
  }, [carregarDadosDoClube]);

  useEffect(() => {
    setPartidaSelecionada(null);
  }, [clubeAtivo?.id]);

  const diaAtual = new Date().toDateString();
  const resumos = useMemo(
    () =>
      subsAtuais.map((sub) => {
        const partidas = partidasGlobais.filter(
          (p) => p.categoria?.nome.replace(' ', '-').toUpperCase() === sub.title
        );
        return { sub, ...resumirPartidas(partidas) };
      }),
    [partidasGlobais, subsAtuais, diaAtual]
  );

  const handleIniciarPartida = useCallback(async (partida: Partida) => {
    if (iniciando.current) return;
    iniciando.current = true;
    setIniciandoPartidaId(partida.id);
    try {
      const escalacao = await fetchEscalacaoPartida(partida.id);
      const titulares = escalacao.filter(
        (jogador: { titular?: boolean }) => jogador.titular
      ).length;
      if (titulares !== 5) {
        Alert.alert(
          'Escalação incompleta',
          `Para iniciar é obrigatório definir exatamente 5 titulares. Atualmente há ${titulares}.`,
          [
            { text: 'Agora não', style: 'cancel' },
            {
              text: 'Preparar equipe',
              onPress: () => setPartidaSelecionada(partida),
            },
          ]
        );
        return;
      }
      await atualizarStatusPartida(partida.id, 'AO_VIVO');
      const partidaAoVivo: Partida = { ...partida, status: 'AO_VIVO' };
      setPartidasGlobais((atuais) =>
        atuais.map((item) => (item.id === partida.id ? partidaAoVivo : item))
      );
      setPartidaSelecionada(partidaAoVivo);
    } catch {
      Alert.alert(
        'Erro',
        'Não foi possível iniciar a partida. Tente novamente.'
      );
    } finally {
      iniciando.current = false;
      setIniciandoPartidaId(null);
    }
  }, []);

  const handleTrocarFase = useCallback(
    (novaFase: 'INICIACAO' | 'BASE') => {
      setFaseAtiva(novaFase);
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

  return (
    <View style={styles.container}>
      <HeaderClube />

      <CarrosselSubs
        tipoFiltro={faseAtiva}
        onTrocarTipo={handleTrocarFase}
        indexAtual={subIndex}
        onChangeIndex={handleSubChange}
        progressoPagina={progressoPagina}
      />
      {consultaLocal !== null && (
        <AvisoConsultaLocal
          salvoEm={consultaLocal}
          atualizando={consultandoServidor}
          onAtualizar={() => void atualizarHome()}
        />
      )}
      {!!erroCarregamento && (
        <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
          <ErroCarregamento
            compacto={partidasGlobais.length > 0}
            titulo={
              partidasGlobais.length > 0
                ? 'Exibindo dados anteriores'
                : 'Não foi possível carregar a Home'
            }
            descricao={
              partidasGlobais.length > 0
                ? 'Não conseguimos atualizar agora. Os dados exibidos podem estar desatualizados.'
                : 'Confira sua conexão e tente atualizar novamente.'
            }
            onTentarNovamente={() => void carregarDadosDoClube()}
          />
        </View>
      )}

      <AnimatedPagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={onPageSelected}
        onPageScroll={acompanharPagina}
        scrollEnabled={true}
        offscreenPageLimit={1}
      >
        {resumos.map(({ sub, proximoJogo, historico, agenda }, index) => {
          return (
            <View
              key={`${clubeAtivo?.id}-pagina-${index}`}
              style={styles.pageContainer}
              collapsable={false}
            >
              <PaginaCategoria
                grupo={`${clubeAtivo?.id}-${faseAtiva}`}
                preparar={Math.abs(index - subIndex) <= 1}
              >
                <HomeCategoria
                  ativa={index === subIndex && !partidaSelecionada}
                  carregando={carregando}
                  atualizando={atualizando}
                  revisao={revisao}
                  onAtualizar={atualizarHome}
                  proximoJogo={proximoJogo}
                  agenda={agenda}
                  historico={historico}
                  podeGerenciar={podeGerenciar && consultaLocal === null}
                  consultaLocal={consultaLocal !== null}
                  iniciandoPartidaId={iniciandoPartidaId}
                  onVerDetalhes={setPartidaSelecionada}
                  onIniciarPartida={handleIniciarPartida}
                />
              </PaginaCategoria>
            </View>
          );
        })}
      </AnimatedPagerView>

      {partidaSelecionada && (
        <Modal
          visible={!!partidaSelecionada}
          transparent={false}
          animationType="slide"
          onRequestClose={fecharDetalhes}
        >
          <DetalhesPartida
            partida={partidaSelecionada as PartidaDetalhes}
            isAdmin={podeGerenciar && consultaLocal === null && !partidaSelecionada.somente_leitura}
            consultaLocal={consultaLocal !== null}
            onBack={fecharDetalhes}
          />
        </Modal>
      )}
    </View>
  );
}
