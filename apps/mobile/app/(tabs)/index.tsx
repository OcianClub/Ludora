import {
  AppState,
  View,
  Text,
  TouchableOpacity,
  Modal,
  InteractionManager,
} from 'react-native';
import { createStyles } from '../../src/styles/indexStyles';
import { MARGEM_TELA } from '../../src/styles/layout';
import { useTheme } from '@/src/contexts/ThemeContext';
import { HeaderClube } from '@/src/components/HeaderClube';
import { PaginaCategoria } from '@/src/components/PaginaCategoria';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { CategoryPager, type CategoryPagerHandle } from '@/src/components/CategoryPager';
import { CategoryPageMotion } from '@/src/components/CategoryPageMotion';
import { useCategoryPagerMotion } from '@/src/hooks/useCategoryPagerMotion';
import {
  apiFetch,
  fetchClubes,
  fetchCategorias,
  fetchHome,
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
import { selecionarJogadoresLocais } from '@/src/utils/dadosConsultaLocal';
import { obterPerfisJogadores } from '@/src/services/mlService';
import { iniciarMedicaoCarregamento } from '@/src/utils/desempenho';
import { AvisoConsultaLocal } from '@/src/components/AvisoConsultaLocal';
import { io } from 'socket.io-client';
import { BASE_URL, invalidarConsultasRecentes } from '@/src/services/api';


const normalizarSub = (nome: string) => nome.trim().replace(/\s+/g, '-').toUpperCase();

type PendenciasHome = {
  clubeId: number;
  acesso: Awaited<ReturnType<typeof fetchClubes>>[number] | undefined;
  categorias: { id: number; nome: string }[];
  camisas: { categoria_id: number; semCamisa: number }[] | null;
  propostas: { categoria_nome?: string; respondente_id: number; status: string }[] | null;
};

export default function Home() {
  const router = useRouter();
  const [scoutHome, setScoutHome] = useState<{ clubeId: number; contagens: Map<string, number> } | null>(null);
  const [pendencias, setPendencias] = useState<PendenciasHome | null>(null);
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const pagerRef = useRef<CategoryPagerHandle>(null);
  const pagerMotion = useCategoryPagerMotion(pagerRef);
  const progressoPagina = pagerMotion.progress;
  const carregouUmaVez = useRef(false);
  const clubeCarregadoId = useRef<number | null>(null);
  const controle = useRef(criarControleRequisicoes()).current;
  const medicaoTela = useRef<ReturnType<
    typeof iniciarMedicaoCarregamento
  > | null>(null);
  const scoutPreparado = useRef(new Set<number>());
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [consultaLocal, setConsultaLocal] = useState<number | null>(null);
  const consultaLocalRef = useRef(consultaLocal);
  consultaLocalRef.current = consultaLocal;
  const [consultandoServidor, setConsultandoServidor] = useState(false);

  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(
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

  const carregarDadosDoClube = useCallback(async (revalidar = false) => {
    medicaoTela.current = iniciarMedicaoCarregamento('home:estado-pronto');
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
        carregar: () => fetchHome(clubeAtivo.id, revalidar),
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
      if (podeGerenciar && !scoutPreparado.current.has(clubeAtivo.id)) {
        const clubeId = clubeAtivo.id;
        scoutPreparado.current.add(clubeId);
        InteractionManager.runAfterInteractions(() => {
          if (!controle.atual(pedido)) {
            scoutPreparado.current.delete(clubeId);
            return;
          }
          void consultarComCopiaLocal({
            clubeId,
            recurso: 'scout',
            carregar: () => obterPerfisJogadores(undefined, clubeId),
            selecionar: selecionarJogadoresLocais,
          }).then(resultado => {
            if (!controle.atual(pedido) || resultado.origem === 'local') {
              scoutPreparado.current.delete(clubeId);
              return;
            }
            const contagens = new Map<string, number>();
            for (const jogador of resultado.dados) {
              if (jogador.perfil_ml && !/^sem\b/i.test(jogador.perfil_ml)) continue;
              const sub = normalizarSub(jogador.categoria);
              contagens.set(sub, (contagens.get(sub) ?? 0) + 1);
            }
            setScoutHome({ clubeId, contagens });
          }).catch(() => {
            scoutPreparado.current.delete(clubeId);
          });
        });
      }
    } catch (error) {
      if (controle.atual(pedido)) {
        clubeCarregadoId.current = clubeAtivo?.id ?? null;
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
  }, [clubeAtivo?.id, controle, podeGerenciar]);

  useEffect(() => {
    if (!carregando && medicaoTela.current) {
      medicaoTela.current({ resultado: erroCarregamento ? 'erro' : 'dados' });
      medicaoTela.current = null;
    }
  }, [carregando, partidasGlobais, erroCarregamento]);

  useFocusEffect(
    useCallback(() => {
      void carregarDadosDoClube();
      const appState = AppState.addEventListener('change', (estado) => {
        if (estado === 'active') void carregarDadosDoClube(true);
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
      await carregarDadosDoClube(true);
    } finally {
      setAtualizando(false);
    }
  }, [carregarDadosDoClube]);

  useFocusEffect(useCallback(() => {
    if (!clubeAtivo?.id || podeGerenciar) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const socket = io(`${BASE_URL}/publico`, { auth: { clubeId: clubeAtivo.id } });
    const atualizar = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (AppState.currentState === 'active') {
          invalidarConsultasRecentes();
          void carregarDadosDoClube(true);
        }
      }, 250);
    };
    socket.on('partidas_alteradas', atualizar);
    socket.on('connect', atualizar);
    const intervalo = setInterval(() => { if (!socket.connected) atualizar(); }, 30000);
    return () => { clearTimeout(timer); clearInterval(intervalo); socket.disconnect(); };
  }, [clubeAtivo?.id, podeGerenciar, carregarDadosDoClube]));

  const fecharDetalhes = useCallback(() => {
    setPartidaSelecionada(null);
    void carregarDadosDoClube(true);
  }, [carregarDadosDoClube]);

  useEffect(() => {
    setPartidaSelecionada(null);
  }, [clubeAtivo?.id]);

  const diaAtual = new Date().toDateString();
  const mudouClubeNaTela = clubeCarregadoId.current !== (clubeAtivo?.id ?? null);
  const resumos = useMemo(
    () =>
      subsAtuais.map((sub) => {
        const partidas = (mudouClubeNaTela ? [] : partidasGlobais).filter(
          (p) => p.categoria?.nome.replace(' ', '-').toUpperCase() === sub.title
        );
        return { sub, ...resumirPartidas(partidas) };
      }),
    [partidasGlobais, subsAtuais, diaAtual, mudouClubeNaTela]
  );

  const clubeId = clubeAtivo?.id;
  useEffect(() => {
    if (!clubeId || !podeGerenciar || consultaLocal !== null || revisao === 0) return;
    let ativa = true;
    const controller = new AbortController();
    const consultar = async <T,>(endpoint: string): Promise<T> => {
      const resposta = await apiFetch(endpoint, {
        headers: { 'x-clube-id': String(clubeId) },
        signal: controller.signal,
      });
      if (!resposta.ok) throw new Error('Falha ao consultar pendências.');
      return resposta.json();
    };
    void Promise.allSettled([
      fetchClubes(),
      fetchCategorias(clubeId),
      consultar<NonNullable<PendenciasHome['camisas']>>('/jogadores?resumo=true'),
      consultar<NonNullable<PendenciasHome['propostas']>>('/partidas/solicitacoes'),
    ]).then(([clubes, categorias, camisas, propostas]) => {
      if (!ativa) return;
      setPendencias({
        clubeId,
        acesso: clubes.status === 'fulfilled' ? clubes.value.find(clube => clube.id === clubeId) : undefined,
        categorias: categorias.status === 'fulfilled' ? categorias.value : [],
        camisas: camisas.status === 'fulfilled' ? camisas.value : null,
        propostas: propostas.status === 'fulfilled' ? propostas.value : null,
      });
    });
    return () => {
      ativa = false;
      controller.abort();
    };
  }, [clubeId, consultaLocal, podeGerenciar, revisao]);

  const dadosGestao = pendencias?.clubeId === clubeId ? pendencias : null;
  const temAcessoCategoria = useCallback(
    (nome: string) => {
      if (!nome || !podeGerenciar || consultaLocal !== null) return false;
      return (
        clubeAtivo?.papel === "ADMIN" ||
        !!dadosGestao?.acesso?.acessoTodasCategorias ||
        !!dadosGestao?.acesso?.categoriasAcesso?.some(
          (categoria) => normalizarSub(categoria.nome) === normalizarSub(nome),
        )
      );
    },
    [podeGerenciar, consultaLocal, clubeAtivo?.papel, dadosGestao],
  );
  const abrirPartida = useCallback(
    (partida: Partida) => {
      if (!podeGerenciar) {
        router.push({ pathname: '/partida-compartilhada/[id]', params: { id: String(partida.id) } });
        return;
      }
      const status = partida.status;
      const opera =
        (partida.sumula_clube_id ?? partida.clube_origem_id) === clubeId;
      const gerencia = temAcessoCategoria(partida.categoria?.nome ?? "");
      if (
        gerencia &&
        ((["AGENDADA", "PREPARADA"].includes(status) &&
          (!partida.somente_leitura || partida.minha_equipe_pronta != null)) ||
          (opera && (status === "AO_VIVO" || (partida.gols_sem_autor ?? 0) > 0)))
      ) {
        router.push({
          pathname: "/partida-compartilhada/[id]",
          params: { id: String(partida.id) },
        });
        return;
      }
      setPartidaSelecionada(partida);
    },
    [clubeId, temAcessoCategoria, router, podeGerenciar],
  );

  const handleTrocarFase = useCallback((novaFase: "INICIACAO" | "BASE") => {
    setFaseAtiva(novaFase);
    setSubIndex(0);
  }, []);

  const handleSubChange = useCallback((index: number, velocity?: number) => {
    pagerMotion.goTo(index, velocity);
  }, [pagerMotion.goTo]);

  const onPageSelected = useCallback(
    (event: { nativeEvent: { position: number } }) => {
      setSubIndex(event.nativeEvent.position);
    },
    [],
  );

  const conteudoPaginas = useMemo(
    () =>
      resumos.map(({ sub, proximoJogo, historico, agenda }, index) => {
        return (
          <View
            key={`${clubeAtivo?.id}-pagina-${index}`}
            style={styles.pageContainer}
            collapsable={false}
          >
            <CategoryPageMotion
              index={index}
              progress={progressoPagina}
              origin={pagerMotion.origin}
              settling={pagerMotion.settling}
            >
              <PaginaCategoria grupo={`${clubeAtivo?.id}-${faseAtiva}`} preparar>
                <HomeCategoria
                  sub={sub.title}
                  proximaCategoria={resumos.find((item) => item.sub.title !== sub.title && item.agenda.length > 0)?.sub.title}
                  semPerfil={
                    scoutHome?.clubeId === clubeId
                      ? scoutHome?.contagens.get(sub.title)
                      : undefined
                  }
                  pendencias={
                    dadosGestao
                      ? {
                          semCamisa: dadosGestao.camisas
                            ? (dadosGestao.camisas.find(
                                (item) =>
                                  item.categoria_id ===
                                  dadosGestao.categorias.find(
                                    (categoria) =>
                                      normalizarSub(categoria.nome) === sub.title,
                                  )?.id,
                              )?.semCamisa ?? 0)
                            : null,
                          solicitacoes:
                            dadosGestao.propostas?.filter(
                              (item) =>
                                item.respondente_id === clubeId &&
                                item.status === "PENDENTE" &&
                                normalizarSub(item.categoria_nome ?? "") ===
                                  sub.title,
                            ).length ?? null,
                        }
                      : undefined
                  }
                  carregando={carregando || mudouClubeNaTela}
                  atualizando={atualizando}
                  onAtualizar={atualizarHome}
                  proximoJogo={proximoJogo}
                  agenda={agenda}
                  historico={historico}
                  podeGerenciar={temAcessoCategoria(sub.title)}
                  consultaLocal={consultaLocal !== null}
                  onVerDetalhes={abrirPartida}
                />
              </PaginaCategoria>
            </CategoryPageMotion>
          </View>
        );
      }),
    [
      resumos,
      styles,
      progressoPagina,
      pagerMotion.origin,
      pagerMotion.settling,
      clubeAtivo?.id,
      faseAtiva,
      scoutHome,
      clubeId,
      dadosGestao,
      carregando,
      mudouClubeNaTela,
      atualizando,
      atualizarHome,
      temAcessoCategoria,
      consultaLocal,
      abrirPartida,
    ],
  );

  return (
    <View style={styles.container}>
      <HeaderClube />

      <CarrosselSubs
        tipoFiltro={faseAtiva}
        onTrocarTipo={handleTrocarFase}
        indexAtual={subIndex}
        onChangeIndex={handleSubChange}
        progressoPagina={progressoPagina} originPagina={pagerMotion.origin} settlingPagina={pagerMotion.settling}
      />
      {consultaLocal !== null && !mudouClubeNaTela && (
        <AvisoConsultaLocal
          salvoEm={consultaLocal}
          atualizando={consultandoServidor}
          onAtualizar={() => void atualizarHome()}
        />
      )}
      {!!erroCarregamento && !mudouClubeNaTela && (
        <View style={{ marginHorizontal: MARGEM_TELA, marginBottom: 12 }}>
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
            onTentarNovamente={() => void carregarDadosDoClube(true)}
          />
        </View>
      )}

      <CategoryPager
        key={`${clubeAtivo?.id}-${faseAtiva}`}
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={subIndex}
        onPageSelected={onPageSelected}
        progress={progressoPagina} origin={pagerMotion.origin} settling={pagerMotion.settling} onSettled={pagerMotion.onSettled}
        scrollEnabled={true}
      >
        {conteudoPaginas}
      </CategoryPager>

      {partidaSelecionada && (
        <Modal
          visible={!!partidaSelecionada}
          transparent={false}
          animationType="slide"
          onRequestClose={fecharDetalhes}
        >
          <DetalhesPartida
            partida={partidaSelecionada as PartidaDetalhes}
            isAdmin={
              temAcessoCategoria(partidaSelecionada.categoria?.nome ?? '') &&
              partidaSelecionada.status !== 'AO_VIVO' &&
              !partidaSelecionada.somente_leitura
            }
            consultaLocal={consultaLocal !== null}
            onBack={fecharDetalhes}
          />
        </Modal>
      )}
    </View>
  );
}
