import { View, Text, FlatList, TouchableOpacity, Modal } from 'react-native';
import { styles } from '../../src/styles/indexStyles';
import { Header } from '@/src/components/Header';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import Octicons from '@expo/vector-icons/Octicons';
import { useRef, useState, useCallback, useEffect } from 'react';
import { Link, useFocusEffect } from 'expo-router';
import PagerView from 'react-native-pager-view';
import { HistoricoPartidas } from '@/src/components/HistoricoPartidas';
import { fetchPartidas } from '@/src/services/api';
import { CarrosselSubs, SUBS_INICIACAO, SUBS_BASE } from '@/src/components/CarrosselSubs';
import DetalhesPartida, { Partida as PartidaDetalhes } from '@/src/components/DetalhesPartida';
import * as SecureStore from 'expo-secure-store';
import { HomeSkeleton, Skeleton } from '@/src/components/Skeleton';

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
  status: 'AGENDADA' | 'AO_VIVO' | 'FINALIZADA';
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
  nomeClubeAtivo: string;
  onVerDetalhes: (partida: Partida) => void;
}

const formatarDataCard = (dataStr: string) => {
  const [ano, mes, dia] = dataStr.split('T')[0].split('-');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
};

const isClubeAtivo = (nomeTime: string, nomeClube: string) => {
  if (!nomeClube) return false;
  return nomeTime.toUpperCase().includes(nomeClube.toUpperCase());
};

const PageContent = ({ carregando, proximoJogo, estatisticas, historico, nomeClubeAtivo, onVerDetalhes }: PageContentProps) => {
  const adversario = proximoJogo 
    ? (isClubeAtivo(proximoJogo.mandante.nome, nomeClubeAtivo) ? proximoJogo.visitante.nome : proximoJogo.mandante.nome) 
    : '—';

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
                <Text style={styles.seasonStatus}>{proximoJogo ? 'EM BREVE' : 'SEM JOGOS'}</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.mainCard}>
              {carregando ? (
                <HomeSkeleton />
              ) : !proximoJogo ? (
                <View style={{ alignItems: 'center', paddingVertical: 40, gap: 12 }}>
                  <MaterialCommunityIcons name="calendar-remove-outline" size={40} color="#8B8D94" />
                  <Text style={{ fontFamily: 'Creato-Bold', color: '#666' }}>Nenhuma partida agendada</Text>
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
                      <FontAwesome5 name={proximoJogo.emCasa ? 'home' : 'bus'} size={22} color="#0E78FF" />
                    </View>
                  </View>

                  <View style={styles.hr} />

                  <View style={styles.rowSpaceBetween}>
                    <View style={styles.cardHoraData}>
                      <View style={styles.containerDataHora}>
                        <FontAwesome5 name="calendar" size={18} color="#8B8D94" />
                        <View style={styles.containerTextDataHora}>
                          <Text style={styles.titleDataHora}>Data</Text>
                          <Text style={styles.subTitleDataHora}>{formatarDataCard(proximoJogo.data)}</Text>
                        </View>
                      </View>

                      <View style={styles.containerDataHora}>
                        <FontAwesome5 name="clock" size={18} color="#8B8D94" />
                        <View style={styles.containerTextDataHora}>
                          <Text style={styles.titleDataHora}>Horário</Text>
                          <Text style={styles.subTitleDataHora}>{proximoJogo.horario || '--:--'}</Text>
                        </View>
                      </View>
                    </View>

                    <View style={styles.containerLocalizacao}>
                      <Octicons name="location" size={20} color="#8B8D94" />
                      <Text style={styles.txtLocalizacao} numberOfLines={2}>
                        {proximoJogo.local || 'Local não definido'}
                      </Text>
                    </View>

                    <TouchableOpacity style={styles.btnDetalhes} activeOpacity={0.8} onPress={() => proximoJogo && onVerDetalhes(proximoJogo)}>
                      <Text style={styles.txtDetalhes}>VER DETALHES DA PARTIDA</Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>

            <View style={styles.rowCards}>
              <View style={styles.smallCard}>
                <Text style={styles.cardLabel}>PONTUAÇÃO</Text>
                <View style={styles.smallCardContent}>
                  {carregando
                    ? <Skeleton width={52} height={30} radius={6} />
                    : <Text style={styles.cardValue}>{estatisticas.pontos}</Text>}
                  <Text style={styles.cardLabel}>Pontos ganhos</Text>
                  <MaterialCommunityIcons name="trophy-outline" size={28} color="#0E78FF" style={styles.iconRight} />
                </View>
              </View>

              <View style={styles.smallCard}>
                <Text style={styles.cardLabel}>VITÓRIAS</Text>
                <View style={styles.smallCardContent}>
                  {carregando
                    ? <Skeleton width={52} height={30} radius={6} />
                    : <Text style={styles.cardValue}>{estatisticas.vitorias}</Text>}
                  <Text style={styles.cardLabel}>Na temporada</Text>
                  <MaterialCommunityIcons name="medal-outline" size={28} color="#F0B84E" style={styles.iconRight} />
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

  const [isAdmin, setIsAdmin] = useState(false);
  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(null);
  const [faseAtiva, setFaseAtiva] = useState<'INICIACAO' | 'BASE'>('INICIACAO');
  const [subIndex, setSubIndex] = useState(0);
  
  const [partidasGlobais, setPartidasGlobais] = useState<Partida[]>([]);
  const [carregando, setCarregando] = useState(true);

  // Estados para gerenciar o nome e o escudo dinâmico do clube
  const [nomeClube, setNomeClube] = useState('CARREGANDO...');
  const [escudoClube, setEscudoClube] = useState<string | null>(null);

  const subsAtuais = faseAtiva === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  useFocusEffect(
    useCallback(() => {
      const carregarDadosDoClube = async () => {
        try {
          if (!carregouUmaVez.current) setCarregando(true);
          
          const [nomeSalvo, escudoSalvo, clubeAtivoId, dadosUserString] = await Promise.all([
            SecureStore.getItemAsync('clubeAtivoNome'),
            SecureStore.getItemAsync('clubeAtivoEscudo'),
            SecureStore.getItemAsync('clubeAtivoId'),
            SecureStore.getItemAsync('userData'),
          ]);

          if (nomeSalvo) {
            setNomeClube(nomeSalvo);
            setEscudoClube(escudoSalvo || null);
          } else {
            setNomeClube('MEU CLUBE');
          }

          if (dadosUserString && clubeAtivoId) {
            const userData = JSON.parse(dadosUserString);
            const vinculo = userData.clubes?.find((c: any) => String(c.clube_id) === String(clubeAtivoId));
            if (vinculo) {
              setIsAdmin(vinculo.papel === 'ADMIN' || vinculo.papel === 'TECNICO');
            }
          }

          const partidas = await fetchPartidas({});
          setPartidasGlobais(partidas);
        } catch (error) {
          console.error('Erro ao carregar Home:', error);
          setNomeClube('ERRO AO CARREGAR');
        } finally {
          carregouUmaVez.current = true;
          setCarregando(false);
        }
      };

      carregarDadosDoClube();
    }, [])
  );

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
        title={nomeClube} 
        logoUrl={escudoClube} 
        btnNotificacao="bell" 
        showLogo={true} 
        showProfile={true} 
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
            p.categoria?.nome.replace(' ', '-').toUpperCase() === sub.title &&
            (isClubeAtivo(p.mandante.nome, nomeClube) || isClubeAtivo(p.visitante.nome, nomeClube))
          );

          const agendadas = partidasDoSub
            .filter(p => p.status === 'AGENDADA')
            .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
          const proximoJogo = agendadas.length > 0 ? agendadas[0] : null;

          const finalizadas = partidasDoSub
            .filter(p => p.status === 'FINALIZADA')
            .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
          
          const historicoRecente = finalizadas.slice(0, 5);

          let pontos = 0;
          let vitorias = 0;
          finalizadas.forEach(p => {
            const clubeAtivoMandante = isClubeAtivo(p.mandante.nome, nomeClube);
            const golsClubeAtivo = clubeAtivoMandante ? p.gols_mandante : p.gols_visitante;
            const golsAdv = clubeAtivoMandante ? p.gols_visitante : p.gols_mandante;

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
                nomeClubeAtivo={nomeClube}
                onVerDetalhes={setPartidaSelecionada}
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
            isAdmin={isAdmin}
            onBack={() => setPartidaSelecionada(null)}
          />
        </Modal>
      )}
    </View>
  );
}
