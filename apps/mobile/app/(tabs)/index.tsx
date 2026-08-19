import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';
import { ActivityIndicator, Alert, View, Text, FlatList, TouchableOpacity, Modal } from 'react-native';
import { styles } from '../../src/styles/indexStyles';
import { Header } from '@/src/components/Header';
import { useRef, useState, useCallback } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { HistoricoPartidas } from '@/src/components/HistoricoPartidas';
import { atualizarStatusPartida, fetchEscalacaoPartida, fetchPartidas } from '@/src/services/api';
import { CarrosselSubs, SUBS_INICIACAO, SUBS_BASE } from '@/src/components/CarrosselSubs';
import DetalhesPartida, { Partida as PartidaDetalhes } from '@/src/components/DetalhesPartida';
import { HomeSkeleton, Skeleton } from '@/src/components/Skeleton';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';

interface Time { id: number; nome: string; escudo: string | null; }
interface Partida {
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
  competicao?: { id: number; nome: string; ano: number } | null;
}

interface Estatisticas {
  pontos: number;
  vitorias: number;
}

interface PageContentProps {
  carregando: boolean;
  proximoJogo: Partida | null;
  estatisticas: Estatisticas;
  historico: Partida[];
  podeGerenciar: boolean;
  iniciandoPartidaId: number | null;
  onVerDetalhes: (partida: Partida) => void;
  onIniciarPartida: (partida: Partida) => void;
}

const formatarDataCard = (dataStr: string) => {
  const [ano, mes, dia] = dataStr.split('T')[0].split('-');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

const isHoje = (dataStr: string) => {
  const hoje = new Date();
  const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
  return hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes && hoje.getDate() === dia;
};

const PageContent = ({
  carregando,
  proximoJogo,
  estatisticas,
  historico,
  podeGerenciar,
  iniciandoPartidaId,
  onVerDetalhes,
  onIniciarPartida,
}: PageContentProps) => {
  const adversario = proximoJogo 
    ? (proximoJogo.emCasa ? proximoJogo.visitante.nome : proximoJogo.mandante.nome)
    : '—';
  const jogoHoje = !!proximoJogo && isHoje(proximoJogo.data);
  const podeIniciar = !!proximoJogo
    && podeGerenciar
    && jogoHoje
    && (proximoJogo.status === 'AGENDADA' || proximoJogo.status === 'PREPARADA');
  const estaAoVivo = proximoJogo?.status === 'AO_VIVO';

  return (
    <View style={styles.pageContainer}>
      <FlatList
        data={historico}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.flatListContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          !carregando ? (
            <View style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ fontFamily: 'Creato-Medium', color: '#666' }}>Nenhuma partida finalizada neste Sub.</Text>
            </View>
          ) : null
        )}
        ListHeaderComponent={() => (
          <View style={styles.headerContainer}>

            <View style={styles.seasonCard}>
              <Text style={styles.seasonTitle}>PRÓXIMO JOGO</Text>
              <TouchableOpacity activeOpacity={0.6}>
                <Text style={[styles.seasonStatus, estaAoVivo && styles.seasonStatusAoVivo]}>
                  {estaAoVivo ? '● AO VIVO' : jogoHoje ? 'SEU JOGO • HOJE' : proximoJogo ? 'EM BREVE' : 'SEM JOGOS'}
                </Text>
              </TouchableOpacity>
            </View>

            {carregando ? (
              <HomeSkeleton style={styles.mainCard} />
            ) : (
              <View style={[styles.mainCard, estaAoVivo && styles.mainCardAoVivo]}>
                {!proximoJogo ? (
                  <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                    <Icon
                      name="calendar-remove-outline"
                      size={40}
                      color="#8B8D94"
                    />

                    <Text style={{ fontFamily: 'Creato-Bold', color: '#666' }}>
                      Nenhuma partida agendada
                    </Text>
                  </View>
                ) : (
                  <>
                  <View style={styles.containerIcon}>
                    <View style={styles.topCard}>
                      <Text style={styles.cardLabel} numberOfLines={1}>
                        {proximoJogo.competicao?.nome || 'Amistoso / Campeonato Regional'}
                      </Text>
                      <View>
                        <Text style={styles.teamName} numberOfLines={1}>{adversario}</Text>
                      </View>
                    </View>
                    <View>
                      <Icon name={proximoJogo.emCasa ? 'home' : 'bus'} size={22} color="#0E78FF" />
                    </View>
                  </View>

                  <View style={styles.hr} />

                  <View style={styles.rowSpaceBetween}>
                    <View style={styles.cardHoraData}>
                      <View style={styles.containerDataHora}>
                        <Icon name="calendar" size={18} color="#8B8D94" />
                        <View style={styles.containerTextDataHora}>
                          <Text style={styles.titleDataHora}>Data</Text>
                          <Text style={styles.subTitleDataHora}>{formatarDataCard(proximoJogo.data)}</Text>
                        </View>
                      </View>

                      <View style={styles.containerDataHora}>
                        <Icon name="clock" size={18} color="#8B8D94" />
                        <View style={styles.containerTextDataHora}>
                          <Text style={styles.titleDataHora}>Horário</Text>
                          <Text style={styles.subTitleDataHora}>{proximoJogo.horario || '--:--'}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.containerLocalizacao}>
                      <Icon name="location" size={20} color="#8B8D94" />
                      <Text style={styles.txtLocalizacao} numberOfLines={2}>
                        {proximoJogo.local || 'Local não definido'}
                      </Text>
                    </View>

                    <TouchableOpacity
                      style={styles.btnDetalhes}
                      activeOpacity={0.8}
                      disabled={iniciandoPartidaId === proximoJogo.id}
                      onPress={() => podeIniciar ? onIniciarPartida(proximoJogo) : onVerDetalhes(proximoJogo)}
                    >
                      {iniciandoPartidaId === proximoJogo.id ? (
                        <ActivityIndicator color={colors.texto} />
                      ) : (
                        <View style={styles.btnDetalhesContent}>
                          <Text style={styles.txtDetalhes}>
                            {podeIniciar ? 'INICIAR PARTIDA' : estaAoVivo ? 'ACOMPANHAR AO VIVO' : 'VER DETALHES DA PARTIDA'}
                          </Text>
                          {(podeIniciar || estaAoVivo) && (
                            <Icon name="live" size={20} color={colors.texto} />
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
                )}
              </View>
            )}

            <View style={styles.rowCards}>
              <View style={styles.smallCard}>
                <Text style={styles.cardLabel}>PONTUAÇÃO</Text>
                <View style={styles.smallCardContent}>
                  {carregando
                    ? <Skeleton width={52} height={30} radius={6} />
                    : <Text style={styles.cardValue}>{estatisticas.pontos}</Text>}
                  <Text style={styles.cardLabel}>Pontos ganhos</Text>
                  <Icon name="trophy-outline" size={28} color="#0E78FF" style={styles.iconRight} />
                </View>
              </View>

              <View style={styles.smallCard}>
                <Text style={styles.cardLabel}>VITÓRIAS</Text>
                <View style={styles.smallCardContent}>
                  {carregando
                    ? <Skeleton width={52} height={30} radius={6} />
                    : <Text style={styles.cardValue}>{estatisticas.vitorias}</Text>}
                  <Text style={styles.cardLabel}>Na temporada</Text>
                  <Icon name="medal-outline" size={28} color="#F0B84E" style={styles.iconRight} />
                </View>
              </View>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>ÚLTIMAS PARTIDAS</Text>
              <TouchableOpacity activeOpacity={0.6}>
              <Link href="/jogos/jogos">
                <Text style={styles.seeAllButton} >VER TUDO</Text>
              </Link>
              </TouchableOpacity>
            </View>
 
          </View>
        )}
        renderItem={({ item }) => (
          <View style={{ paddingHorizontal: 20 }}>
            <HistoricoPartidas partida={item} />
          </View>
        )}
      />
    </View>
  );
};

export default function Home() {
  const pagerRef = useRef<PagerView>(null);
  const carregouUmaVez = useRef(false);
  const clubeCarregadoId = useRef<number | null>(null);

  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(null);
  const [iniciandoPartidaId, setIniciandoPartidaId] = useState<number | null>(null);
  const [faseAtiva, setFaseAtiva] = useState<'INICIACAO' | 'BASE'>('INICIACAO');
  const [subIndex, setSubIndex] = useState(0);
  
  const [partidasGlobais, setPartidasGlobais] = useState<Partida[]>([]);
  const [carregando, setCarregando] = useState(true);

  const subsAtuais = faseAtiva === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  const { clubeAtivo, podeGerenciar } = useClubeAtivo();


  useFocusEffect(
    useCallback(() => {
      const carregarDadosDoClube = async () => {
        const clubeMudou = clubeCarregadoId.current !== (clubeAtivo?.id ?? null);
        try {
          if (!carregouUmaVez.current || clubeMudou) setCarregando(true);
          if (clubeMudou) setPartidasGlobais([]);
          if (!clubeAtivo?.id) {
            setPartidasGlobais([]);
            return;
          }
          const partidas = await fetchPartidas({}, clubeAtivo.id);
          setPartidasGlobais(partidas);
          clubeCarregadoId.current = clubeAtivo.id;
        } catch (error) {
          console.error('Erro ao carregar Home:', error);
        } finally {
          carregouUmaVez.current = true;
          setCarregando(false);
        }
      };

      carregarDadosDoClube();
    }, [clubeAtivo?.id])
  );

  const handleIniciarPartida = useCallback(async (partida: Partida) => {
    setIniciandoPartidaId(partida.id);
    try {
      const escalacao = await fetchEscalacaoPartida(partida.id);
      const titulares = escalacao.filter((jogador: { titular?: boolean }) => jogador.titular).length;
      if (titulares !== 5) {
        Alert.alert(
          'Escalação incompleta',
          `Para iniciar é obrigatório definir exatamente 5 titulares. Atualmente há ${titulares}.`,
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

      <PagerView
        ref={pagerRef}
        style={styles.pagerView}
        initialPage={0}
        onPageSelected={onPageSelected}
        scrollEnabled={true}
      >
        {subsAtuais.map((sub) => {
          const partidasDoSub = partidasGlobais.filter(p =>
            p.categoria?.nome.replace(' ', '-').toUpperCase() === sub.title
          );

          const inicioHoje = new Date();
          inicioHoje.setHours(0, 0, 0, 0);
          const aoVivo = partidasDoSub.find(p => p.status === 'AO_VIVO') ?? null;
          const proximas = partidasDoSub
            .filter(p =>
              (p.status === 'AGENDADA' || p.status === 'PREPARADA')
              && new Date(`${p.data.split('T')[0]}T00:00:00`).getTime() >= inicioHoje.getTime()
            )
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
          const proximoJogo = aoVivo ?? proximas[0] ?? null;

          const finalizadas = partidasDoSub
            .filter(p => p.status === 'FINALIZADA')
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          
          const historicoRecente = finalizadas.slice(0, 5);

          let pontos = 0;
          let vitorias = 0;
          finalizadas.forEach(p => {
            const golsClubeAtivo = p.emCasa ? p.gols_mandante : p.gols_visitante;
            const golsAdv = p.emCasa ? p.gols_visitante : p.gols_mandante;

            if (golsClubeAtivo > golsAdv) {
              pontos += 3;
              vitorias += 1;
            } else if (golsClubeAtivo === golsAdv) {
              pontos += 1;
            }
          });

          return (
            <View key={`${faseAtiva}-${sub.id}`}>
              <PageContent
                carregando={carregando}
                proximoJogo={proximoJogo}
                estatisticas={{ pontos, vitorias }}
                historico={historicoRecente}
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
          onRequestClose={() => setPartidaSelecionada(null)}
        >
          <DetalhesPartida
            partida={partidaSelecionada as PartidaDetalhes}
            isAdmin={podeGerenciar}
            onBack={() => setPartidaSelecionada(null)}
          />
        </Modal>
      )}
    </View>
  );
}
