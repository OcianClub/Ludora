import { Alert, View, Text, TouchableOpacity, Modal } from 'react-native';
import { createStyles } from '../../src/styles/indexStyles';
import { useTheme } from '@/src/contexts/ThemeContext';
import { Header } from '@/src/components/Header';
import { useRef, useState, useCallback, useMemo, useEffect } from 'react';
import { useFocusEffect } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { atualizarStatusPartida, fetchEscalacaoPartida, fetchPartidas } from '@/src/services/api';
import { CarrosselSubs, SUBS_INICIACAO, SUBS_BASE } from '@/src/components/CarrosselSubs';
import DetalhesPartida, { Partida as PartidaDetalhes } from '@/src/components/DetalhesPartida';
import HomeCategoria, { type PartidaHome as Partida } from '@/src/components/HomeCategoria';
import { ErroCarregamento } from '@/src/components/ErroCarregamento';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import { criarControleRequisicoes } from '@/src/utils/request';
import { agendaDaCategoria, resumirPartidas } from '@/src/utils/resumoPartidas';

export default function Home() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const pagerRef = useRef<PagerView>(null);
  const carregouUmaVez = useRef(false);
  const clubeCarregadoId = useRef<number | null>(null);
  const controle = useRef(criarControleRequisicoes()).current;
  const iniciando = useRef(false);
  const [erroCarregamento, setErroCarregamento] = useState('');

  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(null);
  const [iniciandoPartidaId, setIniciandoPartidaId] = useState<number | null>(null);
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
        setErroCarregamento('');
        const clubeMudou = clubeCarregadoId.current !== (clubeAtivo?.id ?? null);
        try {
          if (!carregouUmaVez.current || clubeMudou) setCarregando(true);
          if (clubeMudou) setPartidasGlobais([]);
          if (!clubeAtivo?.id) {
            setPartidasGlobais([]);
            return;
          }
          const partidas = await fetchPartidas({}, clubeAtivo.id);
          if (!controle.atual(pedido)) return;
          setPartidasGlobais(partidas);
          setRevisao(valor => valor + 1);
          clubeCarregadoId.current = clubeAtivo.id;
        } catch (error) {
          if (controle.atual(pedido)) setErroCarregamento(error instanceof Error ? error.message : 'Não foi possível carregar a Home.');
        } finally {
          if (controle.atual(pedido)) {
            carregouUmaVez.current = true;
            setCarregando(false);
          }
        }
  }, [clubeAtivo?.id, controle]);

  useFocusEffect(useCallback(() => {
    void carregarDadosDoClube();
    return () => controle.invalidar();
  }, [carregarDadosDoClube, controle, versaoNotificacoes]));

  const atualizarHome = useCallback(async () => {
    setAtualizando(true);
    try { await carregarDadosDoClube(); }
    finally { setAtualizando(false); }
  }, [carregarDadosDoClube]);

  const fecharDetalhes = useCallback(() => {
    setPartidaSelecionada(null);
    void carregarDadosDoClube();
  }, [carregarDadosDoClube]);

  useEffect(() => { setPartidaSelecionada(null); }, [clubeAtivo?.id]);

  const diaAtual = new Date().toDateString();
  const resumos = useMemo(() => subsAtuais.map(sub => {
    const partidas = partidasGlobais.filter(p => p.categoria?.nome.replace(' ', '-').toUpperCase() === sub.title);
    return { sub, ...resumirPartidas(partidas), agenda: agendaDaCategoria(partidas) };
  }), [partidasGlobais, subsAtuais, diaAtual]);

  const handleIniciarPartida = useCallback(async (partida: Partida) => {
    if (iniciando.current) return;
    iniciando.current = true;
    setIniciandoPartidaId(partida.id);
    try {
      const escalacao = await fetchEscalacaoPartida(partida.id);
      const titulares = escalacao.filter((jogador: { titular?: boolean }) => jogador.titular).length;
      if (titulares !== 5) {
        Alert.alert(
          'Escalação incompleta',
          `Para iniciar é obrigatório definir exatamente 5 titulares. Atualmente há ${titulares}.`,
          [{ text: 'Agora não', style: 'cancel' }, { text: 'Preparar equipe', onPress: () => setPartidaSelecionada(partida) }],
        );
        return;
      }
      await atualizarStatusPartida(partida.id, 'AO_VIVO');
      const partidaAoVivo: Partida = { ...partida, status: 'AO_VIVO' };
      setPartidasGlobais((atuais) =>
        atuais.map((item) => item.id === partida.id ? partidaAoVivo : item),
      );
      setPartidaSelecionada(partidaAoVivo);
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a partida. Tente novamente.');
    } finally {
      iniciando.current = false;
      setIniciandoPartidaId(null);
    }
  }, []);

  const handleTrocarFase = (novaFase: 'INICIACAO' | 'BASE') => {
    setFaseAtiva(novaFase);
    handleSubChange(0); 
  };

  const handleSubChange = (index: number) => {
    setSubIndex(index);
    pagerRef.current?.setPage(index);
  };

  const onPageSelected = (e: any) => {
    const index = e.nativeEvent.position;
    if (index !== subIndex) setSubIndex(index);
  };

  return (
    <View style={styles.container}>
      <Header 
        title={clubeAtivo?.nome ?? 'MEU CLUBE'}
        logoUrl={clubeAtivo?.escudo ?? null}
        btnNotificacao="bell" 
        showLogo={true} 
        showProfile={true}
        papelUsuario={clubeAtivo?.papel ?? undefined}
      />

      <CarrosselSubs 
        tipoFiltro={faseAtiva}
        onTrocarTipo={handleTrocarFase}
        indexAtual={subIndex} 
        onChangeIndex={handleSubChange} 
      />
      {!!erroCarregamento && (
        <View style={{ marginHorizontal: 20, marginBottom: 12 }}>
          <ErroCarregamento
            compacto={partidasGlobais.length > 0}
            titulo={partidasGlobais.length > 0 ? 'Exibindo dados anteriores' : 'Não foi possível carregar a Home'}
            descricao={partidasGlobais.length > 0
              ? 'Não conseguimos atualizar agora. Os dados exibidos podem estar desatualizados.'
              : 'Confira sua conexão e tente atualizar novamente.'}
            onTentarNovamente={() => void carregarDadosDoClube()}
          />
        </View>
      )}

      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={onPageSelected}
        scrollEnabled={true}
      >
        {resumos.map(({ sub, proximoJogo, historico, agenda }, index) => {
          return (
            <View key={`${clubeAtivo?.id}-${faseAtiva}-${sub.id}`} style={styles.pageContainer} collapsable={false}>
              <HomeCategoria
                ativa={index === subIndex && !partidaSelecionada}
                carregando={carregando}
                atualizando={atualizando}
                revisao={revisao}
                onAtualizar={() => void atualizarHome()}
                proximoJogo={proximoJogo}
                agenda={agenda}
                historico={historico}
                podeGerenciar={podeGerenciar}
                iniciandoPartidaId={iniciandoPartidaId}
                onVerDetalhes={setPartidaSelecionada}
                onIniciarPartida={handleIniciarPartida}
              />
            </View>
          );
        })}
      </PagerView>

      {partidaSelecionada && (
        <Modal
          visible={!!partidaSelecionada}
          transparent={false}
          animationType="slide"
          onRequestClose={fecharDetalhes}
        >
          <DetalhesPartida
            partida={partidaSelecionada as PartidaDetalhes}
            isAdmin={podeGerenciar}
            onBack={fecharDetalhes}
          />
        </Modal>
      )}
    </View>
  );
}
