import { Icon, type IconName } from '@ludora/icons';
import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, Image, ScrollView,
  Modal, Pressable, ActivityIndicator, RefreshControl,
} from 'react-native';
import { styles } from '@/src/styles/jogosStyles';
import { Header } from '@/src/components/Header';
import { colors } from '@ludora/design-tokens';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import PagerView from 'react-native-pager-view';
import * as SecureStore from 'expo-secure-store';
import { fetchPartidas } from '@/src/services/api';
import OrganizarPartidas from '../organizarPartidas/organizarPartidas';
import { CarrosselSubs, SUBS_INICIACAO, SUBS_BASE } from '@/src/components/CarrosselSubs';
import DetalhesPartida, { Partida as PartidaDetalhes } from '@/src/components/DetalhesPartida';
import { CardsSkeleton } from '@/src/components/Skeleton';

const FILTROS_MES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type StatusFiltro = 'TODOS' | 'AGENDADA' | 'AO_VIVO' | 'FINALIZADA';
const STATUS_OPTIONS: { label: string; value: StatusFiltro; icon: IconName; iconColor: string }[] = [
  { label: 'Todos os jogos', value: 'TODOS', icon: 'soccer', iconColor: colors.primaria },
  { label: 'Ao vivo',        value: 'AO_VIVO', icon: 'record-circle-outline', iconColor: colors.vermelho },
  { label: 'Agendadas',      value: 'AGENDADA', icon: 'calendar-clock', iconColor: colors.textoSecundario },
  { label: 'Finalizadas',    value: 'FINALIZADA', icon: 'check', iconColor: colors.primaria },
];

// Papel é por CLUBE (ADMIN/MESARIO/TECNICO/TORCEDOR), não mais um "userRole"
// global — o mesmo usuário pode ser TECNICO num clube e TORCEDOR em outro.
// Cobre tudo que não é torcedor puro: criar/editar/apagar partida, apontar
// placar, registrar eventos etc. (mesmo comportamento que "isAdmin" tinha
// antes no DetalhesPartida — só que agora calculado por clube).
const PAPEIS_GESTORES = ['ADMIN', 'TECNICO', 'MESARIO'];

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
}
interface DiaJogo { data: string; partidas: Partida[]; }

function agruparPorDia(partidas: Partida[]): DiaJogo[] {
  const mapa = new Map<string, Partida[]>();
  for (const p of partidas) {
    const [ano, mes, dia] = p.data.split('T')[0].split('-');
    const dataObj = new Date(Number(ano), Number(mes) - 1, Number(dia));
    const chave = dataObj.toLocaleDateString('pt-BR', {
      weekday: 'long', day: '2-digit', month: 'long',
    }).toUpperCase();
    if (!mapa.has(chave)) mapa.set(chave, []);
    mapa.get(chave)!.push(p);
  }
  return Array.from(mapa.entries()).map(([data, partidas]) => ({ data, partidas }));
}

function ordenarPartidas(partidas: Partida[]): Partida[] {
  const aoVivo    = partidas.filter(p => p.status === 'AO_VIVO');
  const agendadas = partidas
    .filter(p => p.status === 'AGENDADA')
    .sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
  const finalizadas = partidas
    .filter(p => p.status === 'FINALIZADA')
    .sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  return [...aoVivo, ...agendadas, ...finalizadas];
}

export default function Jogos() {
  const pagerRef = useRef<PagerView>(null);
  const carregouUmaVez = useRef(false);

  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(null);

  // "podeGerenciar" = papel do usuário NO CLUBE ATIVO é ADMIN/TECNICO/MESARIO.
  const [podeGerenciar, setPodeGerenciar] = useState(false);

  // Clube ativo (dinâmico) — antes era fixo "CFA OCIAN" no Header.
  // Lido do mesmo SecureStore que o ClubesExplorer grava ao acessar um clube.
  const [nomeClubeAtivo, setNomeClubeAtivo] = useState('MEU CLUBE');
  const [escudoClubeAtivo, setEscudoClubeAtivo] = useState<string | null>(null);
  
  // Estados Reais (aplicados)
  const [mesAtivo, setMesAtivo] = useState(new Date().getMonth() + 1);
  const [statusFiltro, setStatusFiltro] = useState<StatusFiltro>('TODOS');
  
  // Estados Temporários do Modal
  const [modalFiltrosVisible, setModalFiltrosVisible] = useState(false);
  const [tempMes, setTempMes] = useState(mesAtivo);
  const [tempStatus, setTempStatus] = useState<StatusFiltro>(statusFiltro);
  const [showMonthGrid, setShowMonthGrid] = useState(false);

  const [tipoFiltro, setTipoFiltro] = useState<'INICIACAO' | 'BASE'>('INICIACAO');
  const [subIndex, setSubIndex] = useState(0);
  const [dias, setDias] = useState<DiaJogo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOrganizar, setModalOrganizar] = useState(false);

  const carregarPartidas = useCallback(async () => {
    try {
      const params: any = { mes: mesAtivo };
      if (statusFiltro !== 'TODOS') params.status = statusFiltro;
      const partidas: Partida[] = await fetchPartidas(params);
      setDias(agruparPorDia(ordenarPartidas(partidas)));
    } catch (e) {
      console.error(e);
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [mesAtivo, statusFiltro]);

  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      (async () => {
        // Recarrega o clube ativo (e o papel do usuário nele) a cada foco,
        // pra pegar troca de clube feita na aba "Clubes".
        const [nome, escudo, papel] = await Promise.all([
          SecureStore.getItemAsync('clubeAtivoNome'),
          SecureStore.getItemAsync('clubeAtivoEscudo'),
          SecureStore.getItemAsync('clubeAtivoPapel'),
        ]);
        if (ativo && nome) setNomeClubeAtivo(nome);
        if (ativo) setEscudoClubeAtivo(escudo || null);
        if (ativo) setPodeGerenciar(!!papel && PAPEIS_GESTORES.includes(papel));
      })();
      if (!carregouUmaVez.current) setCarregando(true);
      carregarPartidas().finally(() => {
        carregouUmaVez.current = true;
      });
      return () => {
        ativo = false;
      };
    }, [carregarPartidas])
  );

  const onRefresh = () => { setRefreshing(true); carregarPartidas(); };
  const dadosAtuais = tipoFiltro === 'INICIACAO' ? SUBS_INICIACAO : SUBS_BASE;

  const handleTrocarFase = (novaFase: 'INICIACAO' | 'BASE') => {
    setTipoFiltro(novaFase);
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

  const filtrarPartidasPorSub = (partidas: Partida[], subName: string) =>
    partidas.filter(p => {
      if (!p.categoria) return false;
      const catNome = p.categoria.nome.toUpperCase().replace(' ', '-');
      return catNome === subName;
    });

  // Abre o modal passando os estados atuais para o temporário
  const abrirFiltros = () => {
    setTempMes(mesAtivo);
    setTempStatus(statusFiltro);
    setShowMonthGrid(false);
    setModalFiltrosVisible(true);
  };

  // Aplica os filtros e recarrega
  const aplicarFiltros = () => {
    setMesAtivo(tempMes);
    setStatusFiltro(tempStatus);
    setModalFiltrosVisible(false);
    setCarregando(true);
  };

  return (
    <View style={styles.container}>
      <Header
        title={nomeClubeAtivo}
        logoUrl={escudoClubeAtivo}
        btnNotificacao="bell"
        showLogo={true}
        showProfile={true}
      />

      {/* 1. Mova o CarrosselSubs para FORA do filtersContainer para não dobrar o padding */}
      <CarrosselSubs
        tipoFiltro={tipoFiltro}
        onTrocarTipo={handleTrocarFase}
        indexAtual={subIndex}
        onChangeIndex={handleSubChange}
      />

      {/* 2. O filtersContainer agora envolve APENAS o botão do modal de filtros */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity activeOpacity={0.7} style={styles.singleFilterBtn} onPress={abrirFiltros}>
          <Icon name="filter-variant" size={20} color={colors.primaria} />
          <Text style={styles.filterBtnText}>
            {FILTROS_MES[mesAtivo - 1]} • {STATUS_OPTIONS.find(o => o.value === statusFiltro)?.label}
          </Text>
          <Icon name="chevron-down" size={20} color={colors.textoSecundario} />
        </TouchableOpacity>
      </View>

      <PagerView ref={pagerRef} style={{ flex: 1 }} initialPage={0} onPageSelected={onPageSelected}>
        {dadosAtuais.map((sub) => {
          const diasComPartidas = dias
            .map(dia => ({ ...dia, filtradas: filtrarPartidasPorSub(dia.partidas, sub.title) }))
            .filter(dia => dia.filtradas.length > 0);

          return (
            <View key={`${tipoFiltro}-${sub.id}`} style={{ flex: 1 }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primaria} />}
              >
                {carregando ? (
                  <CardsSkeleton rows={4} />
                ) : diasComPartidas.length === 0 ? (
                  <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
                    <Icon name="calendar-remove-outline" size={48} color={colors.borda} />
                    <Text style={{ fontFamily: 'Inter_600SemiBold', color: colors.textoSecundario, fontSize: 14 }}>
                      NENHUM JOGO ENCONTRADO
                    </Text>
                  </View>
                ) : (
                  diasComPartidas.map((dia, index) => (
                    <View key={index} style={styles.daySection}>
                      <View style={styles.dateHeader}>
                        <View style={styles.dateBar} />
                        <Text style={styles.dateText}>{dia.data}</Text>
                      </View>

                      {dia.filtradas.map(partida => (
                        <TouchableOpacity
                          key={partida.id}
                          style={styles.matchCard}
                          activeOpacity={0.85}
                          onPress={() => setPartidaSelecionada(partida)}
                        >
                          {/* TOP CARD */}
                          <View style={styles.cardTop}>
                            <View style={styles.cardTopLeft}>
                              <Icon name="clock-outline" size={16} color={colors.textoSecundario} />
                              <Text style={styles.timeText}>{partida.horario ?? '--:--'}</Text>
                              <View style={styles.separator} />
                              <Text style={styles.catText}>{partida.categoria?.nome.replace('SUB', '').trim() ?? '?'}</Text>
                            </View>
                            <View style={[styles.badge, !partida.emCasa && { backgroundColor: colors.cardSecundario }]}>
                              <Icon name={partida.emCasa ? 'home-outline' : 'bus'} size={14} color={colors.texto} />
                              <Text style={styles.badgeText}>{partida.emCasa ? 'CASA' : 'FORA'}</Text>
                            </View>
                          </View>

                          {/* BODY CARD */}
                          <View style={styles.cardBody}>
                            <View style={styles.teamCol}>
                              {partida.mandante.escudo ? (
                                  <Image source={{ uri: partida.mandante.escudo }} style={styles.teamLogo} />
                              ) : (
                                <View style={styles.fundoImg}>
                                  <Image source={require('@/assets/images/SóPreto.png')} style={styles.teamLogo} />
                                </View>
                              )}
                              <Text style={styles.teamName} numberOfLines={2}>{partida.mandante.nome}</Text>
                            </View>

                            <View style={styles.placarCentral}>
                              {partida.status === 'AGENDADA' ? (
                                <>
                                  <Text style={styles.placarText}>-</Text>
                                  <Text style={styles.vsText}>VS</Text>
                                </>
                              ) : (
                                <Text style={styles.placarText}>{partida.gols_mandante} - {partida.gols_visitante}</Text>
                              )}
                            </View>

                            <View style={styles.teamCol}>
                              {partida.visitante.escudo ? (
                                <Image source={{ uri: partida.visitante.escudo }} style={styles.teamLogo} />
                              ) : (
                                <View style={styles.fundoImg}>
                                  <Image source={require('@/assets/images/SóPreto.png')} style={styles.teamLogo} />
                                </View>
                              )}
                              <Text style={styles.teamName} numberOfLines={2}>{partida.visitante.nome}</Text>
                            </View>
                          </View>

                          {/* FOOTER CARD */}
                          <View style={styles.cardFooterDivider} />
                          <View style={styles.cardFooter}>
                            <Icon name="map-marker-outline" size={16} color={colors.texto} />
                            <Text style={styles.locationText}>{partida.local ?? 'Local não definido'}</Text>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </View>
                  ))
                )}
                <View style={{ height: 100 }} />
              </ScrollView>
            </View>
          );
        })}
      </PagerView>

      {/* FAB ICON */}
      {podeGerenciar && (
        <TouchableOpacity activeOpacity={0.8} style={styles.fab} onPress={() => setModalOrganizar(true)}>
          <LinearGradient colors={[colors.primaria, '#0055FF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.fabGradient}>
            <Icon name="plus" size={32} color={colors.texto} />
          </LinearGradient>
        </TouchableOpacity>
      )}

      {/* MODAL NOVO DE FILTROS */}
      <Modal visible={modalFiltrosVisible} transparent={true} animationType="fade" onRequestClose={() => setModalFiltrosVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalFiltrosVisible(false)}>
          <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
            
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>FILTROS</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalFiltrosVisible(false)}>
                <Icon name="close" size={18} color={colors.texto} />
              </TouchableOpacity>
            </View>

            {/* SEÇÃO 1: DATA */}
            <Text style={styles.filterSectionLabel}>Data</Text>
            <TouchableOpacity 
              style={styles.dateSelectorBtn} 
              activeOpacity={0.7} 
              onPress={() => setShowMonthGrid(!showMonthGrid)}
            >
              <Icon name="calendar-outline" size={20} color={colors.textoSecundario} />
              <Text style={styles.dateSelectorText}>{FILTROS_MES[tempMes - 1]}</Text>
              <Icon name={showMonthGrid ? "chevron-up" : "chevron-down"} size={20} color={colors.textoSecundario} />
            </TouchableOpacity>

            {/* EXPANSÃO DOS MESES */}
            {showMonthGrid && (
              <View style={styles.monthGrid}>
                {FILTROS_MES.map((mes, index) => (
                  <TouchableOpacity
                    key={mes}
                    style={[styles.monthGridItem, tempMes === index + 1 && styles.monthGridItemActive]}
                    onPress={() => { setTempMes(index + 1); setShowMonthGrid(false); }}
                  >
                    <Text style={[styles.monthGridText, tempMes === index + 1 && styles.monthGridTextActive]}>
                      {mes.substring(0, 3)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* SEÇÃO 2: STATUS */}
            <Text style={styles.filterSectionLabel}>Status dos Jogos</Text>
            <View style={styles.statusOptionsContainer}>
              {STATUS_OPTIONS.map((status) => (
                <TouchableOpacity
                  key={status.value}
                  style={[styles.statusItem, tempStatus === status.value && styles.statusItemActive]}
                  onPress={() => setTempStatus(status.value)}
                >
                  <Text style={styles.statusItemText}>{status.label}</Text>
                  <Icon name={status.icon} size={20} color={tempStatus === status.value ? colors.primaria : status.iconColor} />
                </TouchableOpacity>
              ))}
            </View>

            {/* BOTÃO APLICAR */}
            <TouchableOpacity style={styles.applyBtn} activeOpacity={0.8} onPress={aplicarFiltros}>
              <Text style={styles.applyBtnText}>APLICAR FILTROS</Text>
            </TouchableOpacity>

          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modalOrganizar} transparent={false} animationType="slide" onRequestClose={() => setModalOrganizar(false)}>
        <OrganizarPartidas noModal={true} onFechar={() => { setModalOrganizar(false); carregarPartidas(); }} />
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
            isAdmin={podeGerenciar}
            onBack={() => { setPartidaSelecionada(null); carregarPartidas(); }}
          />
        </Modal>
      )}
    </View>
  );
}
