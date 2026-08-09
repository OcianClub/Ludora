import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  Pressable, ActivityIndicator, Alert, Animated,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@/src/theme/colors';
import { Header } from '@/src/components/Header';
import OrganizarPartidaCampeonato from '@/src/components/organizarPartidaCampeonato';
import { fetchPartidasPorCompeticao, fetchJogadoresPorCompeticao, atualizarStatusPartida, deletarPartida } from '@/src/services/api';
import { s } from '@/src/styles/detalhesCompeticaoStyles';

interface Competicao { id: number; nome: string; ano: number; tipo: 'INICIACAO' | 'BASE'; }
interface Time { id: number; nome: string; escudo: string | null; categoria_id: number; }
interface Evento {
  id: number;
  tipo: 'GOL' | 'ASSISTENCIA' | 'DEFESA' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' | 'FALTA';
  minuto: number; doOcian: boolean; jogador_id: number | null;
  jogador: { id: number; nome: string } | null;
}
interface Partida {
  id: number; rodada: number | null; grupo: string | null;
  data: string; horario: string | null; local: string | null;
  status: string; emCasa: boolean;
  mandante: Time; visitante: Time;
  categoria: { id: number; nome: string };
  gols_mandante: number; gols_visitante: number;
  eventos: Evento[];
}
interface Jogador {
  id: number; nome: string; posicao: string;
  numCamisa: number | null; categoria_id: number;
}
interface Props { competicao: Competicao; onFechar: () => void; }

const STATUS_OPCOES = ['AGENDADA', 'PREPARADA', 'AO_VIVO', 'FINALIZADA', 'CANCELADA'] as const;

const STATUS_COR: Record<string, string> = {
  AGENDADA: colors.azulClaro,
  PREPARADA: colors.amarelo,
  AO_VIVO: colors.primary, 
  FINALIZADA: '#6FCF97',
  CANCELADA: colors.vermelho,
};

const STATUS_LABEL: Record<string, string> = {
  AGENDADA:   'Agendada',
  PREPARADA:  'Preparada',
  AO_VIVO:    'Ao Vivo',
  FINALIZADA: 'Finalizada',
  CANCELADA:  'Cancelada',
};

const TIPO_ICONE: Record<string, string> = {
  GOL:            'soccer',
  ASSISTENCIA:    'shoe-cleat',
  DEFESA:         'shield-check',
  CARTAO_AMARELO: 'card',
  CARTAO_VERMELHO:'card',
  FALTA:          'hand-back-right',
};

const TIPO_COR: Record<string, string> = {
  GOL:            '#22c55e',
  ASSISTENCIA:    colors.azulClaro,
  DEFESA:         '#a855f7',
  CARTAO_AMARELO: '#eab308',
  CARTAO_VERMELHO:colors.vermelho,
  FALTA:          '#f97316',
};

const TIPO_LABEL: Record<string, string> = {
  GOL:            'Gols',
  ASSISTENCIA:    'Assist.',
  DEFESA:         'Defesas',
  CARTAO_AMARELO: 'Amarelos',
  CARTAO_VERMELHO:'Vermelhos',
  FALTA:          'Faltas',
};

function formatarData(dataStr: string) {
  const [ano, mes, dia] = dataStr.split('T')[0].split('-');
  const d = new Date(Number(ano), Number(mes) - 1, Number(dia));
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).toUpperCase();
}

function calcularStatsJogadores(eventos: Evento[]) {
  const mapa: Record<number, { nome: string; stats: Record<string, number> }> = {};
  eventos.forEach(ev => {
    if (!ev.doOcian || !ev.jogador) return;
    if (!mapa[ev.jogador.id]) mapa[ev.jogador.id] = { nome: ev.jogador.nome, stats: {} };
    mapa[ev.jogador.id].stats[ev.tipo] = (mapa[ev.jogador.id].stats[ev.tipo] || 0) + 1;
  });
  return Object.entries(mapa).map(([id, val]) => ({ id: Number(id), ...val }));
}

export default function DetalhesCompeticao({ competicao, onFechar }: Props) {
  const [partidas,           setPartidas]           = useState<Partida[]>([]);
  const [jogadores,          setJogadores]          = useState<Jogador[]>([]);
  const [categorias,         setCategorias]         = useState<{ id: number; nome: string }[]>([]);
  const [catFiltro,          setCatFiltro]          = useState<number | null>(null);
  const [carregando,         setCarregando]         = useState(true);
  const [partidaSelecionada, setPartidaSelecionada] = useState<Partida | null>(null);
  const [modalDetalhes,      setModalDetalhes]      = useState(false);
  const [modalStatus,        setModalStatus]        = useState(false);
  const [modalEditar,        setModalEditar]        = useState(false);
  const [modalNovaPartida,   setModalNovaPartida]   = useState(false);
  const [atualizandoStatus,  setAtualizandoStatus]  = useState(false);
  const [isAdmin,            setIsAdmin]            = useState(false);

  // Seleção múltipla (long press)
  const [modoSelecao,        setModoSelecao]        = useState(false);
  const [selecionadas,       setSelecionadas]       = useState<Set<number>>(new Set());
  const [removendo,          setRemovendo]          = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    SecureStore.getItemAsync('userRole').then(role => setIsAdmin(role === 'ADMIN'));
  }, []);

  const iniciarShake = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 2, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -2, duration: 80, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
      ]),
      { iterations: -1 }
    ).start();
  };

  const pararShake = () => {
    shakeAnim.stopAnimation();
    shakeAnim.setValue(0);
  };

  const entrarModoSelecao = (partida: Partida) => {
    setModoSelecao(true);
    setSelecionadas(new Set([partida.id]));
    iniciarShake();
  };

  const sairModoSelecao = () => {
    setModoSelecao(false);
    setSelecionadas(new Set());
    pararShake();
  };

  const toggleSelecao = (id: number) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      if (next.size === 0) sairModoSelecao();
      return next;
    });
  };

  const removerSelecionadas = () => {
    Alert.alert(
      'Remover Partidas',
      `Deseja remover ${selecionadas.size} partida${selecionadas.size > 1 ? 's' : ''}? Esta ação não pode ser desfeita.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setRemovendo(true);
            try {
              await Promise.all(Array.from(selecionadas).map(id => deletarPartida(id)));
              sairModoSelecao();
              carregar(true);
            } catch (e: any) {
              Alert.alert('Erro', e.message ?? 'Não foi possível remover as partidas.');
            } finally {
              setRemovendo(false);
            }
          },
        },
      ]
    );
  };

  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    try {
      const [p, j] = await Promise.all([
        fetchPartidasPorCompeticao(competicao.id),
        fetchJogadoresPorCompeticao(competicao.id),
      ]);
      setPartidas(p);
      setJogadores(j);
      const cats = Array.from(
        new Map(p.map((x: Partida) => [x.categoria.id, x.categoria])).values()
      ) as { id: number; nome: string }[];
      setCategorias(cats.sort((a: any, b: any) => a.nome.localeCompare(b.nome)));
    } catch (e) {
      console.error(e);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [competicao.id]);

  useEffect(() => { carregar(); }, [carregar]);

  const partidasFiltradas = catFiltro
    ? partidas.filter(p => p.categoria.id === catFiltro)
    : partidas;

  const porRodada = partidasFiltradas.reduce((acc: Record<string, Partida[]>, p) => {
    const chave = p.rodada
      ? `Rodada ${p.rodada}${p.grupo ? ` • Grupo ${p.grupo}` : ''}`
      : 'Sem rodada';
    if (!acc[chave]) acc[chave] = [];
    acc[chave].push(p);
    return acc;
  }, {});

  const atualizarStatus = async (novoStatus: string) => {
    if (!partidaSelecionada) return;
    setAtualizandoStatus(true);
    try {
      await atualizarStatusPartida(partidaSelecionada.id, novoStatus);
      setPartidaSelecionada({ ...partidaSelecionada, status: novoStatus });
      setModalStatus(false);
      carregar(true);
    } catch (e: any) {
      Alert.alert('Erro', e.message);
    } finally {
      setAtualizandoStatus(false);
    }
  };

  const jogadoresDaPartida = partidaSelecionada
    ? jogadores.filter(j => j.categoria_id === partidaSelecionada.categoria.id)
    : [];

  const statsJogadores   = partidaSelecionada ? calcularStatsJogadores(partidaSelecionada.eventos ?? []) : [];
  const temStats         = statsJogadores.length > 0;

  return (
    <View style={s.container}>
      <Header
        title={competicao.nome}
        showLogo={false}
        showProfile={false}
        btnVoltar="arrow-left"
        onBtnVoltar={onFechar}
        semSafeArea={true}
      />

      {carregando ? (
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
      ) : partidas.length === 0 ? (
        <View style={s.emptyContainer}>
          <MaterialCommunityIcons name="calendar-remove-outline" size={56} color="#2a2a2a" />
          <Text style={s.emptyTxt}>Nenhuma partida importada ainda.</Text>
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={s.listaContent}>
      <View style={s.filtrosWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.filtrosContent}
        >
          {[{ id: null, nome: 'Todos' }, ...categorias].map(cat => (
            <TouchableOpacity
              key={cat.id ?? 'todos'}
              style={[s.filtroPill, catFiltro === cat.id && s.filtroPillAtivo]}
              onPress={() => setCatFiltro(cat.id)}
            >
              <Text style={s.filtroPillTxt}>
                {cat.nome.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
          {Object.entries(porRodada).map(([rodada, jogos]) => (
            <View key={rodada}>
              <Text style={s.rodadaLabel}>{rodada.toUpperCase()}</Text>
              <View style={s.rodadaJogos}>
                {jogos.map(partida => {
                  const corStatus        = STATUS_COR[partida.status] ?? colors.azulClaro;
                  const estaSelecionada  = selecionadas.has(partida.id);
                  return (
                    <Animated.View
                      key={partida.id}
                      style={{ transform: [{ rotate: shakeAnim.interpolate({ inputRange: [-2, 2], outputRange: ['-2deg', '2deg'] }) }] }}
                    >
                    <TouchableOpacity
                      style={[
                        s.cardPartida,
                        estaSelecionada && { borderWidth: 2, borderColor: colors.vermelho + 'CC', backgroundColor: colors.vermelho + '0D' },
                      ]}
                      onPress={() => {
                        if (modoSelecao) { toggleSelecao(partida.id); return; }
                        setPartidaSelecionada(partida); setModalDetalhes(true);
                      }}
                      onLongPress={() => {
                        if (!isAdmin) return;
                        if (modoSelecao) { toggleSelecao(partida.id); return; }
                        entrarModoSelecao(partida);
                      }}
                      delayLongPress={400}
                      activeOpacity={0.8}
                    >
                      <View style={s.cardTopo}>
                        <Text style={s.cardCategoriaTxt}>
                          {partida.categoria.nome.toUpperCase()}
                        </Text>
                        <View style={s.statusRow}>
                          <View style={[s.statusDot, { backgroundColor: corStatus }]} />
                          <Text style={[s.statusTxt, { color: corStatus }]}>
                            {STATUS_LABEL[partida.status] ?? partida.status}
                          </Text>
                        </View>
                      </View>

                      <View style={s.placarRow}>
                        <Text style={s.timeTxt} numberOfLines={2}>{partida.mandante.nome}</Text>
                        <View style={s.placarCentro}>
                          {partida.status === 'FINALIZADA' || partida.status === 'AO_VIVO' ? (
                            <Text style={s.placarTxt}>
                              {partida.gols_mandante} - {partida.gols_visitante}
                            </Text>
                          ) : (
                            <Text style={s.placarDash}>—</Text>
                          )}
                          <Text style={s.placarInfo}>
                            {partida.horario ?? '--:--'} • {formatarData(partida.data)}
                          </Text>
                        </View>
                        <Text style={[s.timeTxt, s.timeTxtDireita]} numberOfLines={2}>
                          {partida.visitante.nome}
                        </Text>
                      </View>

                      {partida.local ? (
                        <Text style={s.localTxt} numberOfLines={1}>{partida.local}</Text>
                      ) : null}

                      {estaSelecionada && (
                        <View style={{ position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.vermelho, alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialCommunityIcons name="check" size={16} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}

      <Modal visible={modalDetalhes} transparent animationType="slide">
        <View style={s.modalDetalhesOverlay}>
          <Pressable style={s.modalDetalhesBack} onPress={() => setModalDetalhes(false)} />
          <View style={s.modalDetalhesContent}>
            <View style={s.dragHandle}>
              <View style={s.dragBar} />
            </View>

            <ScrollView
              contentContainerStyle={s.modalDetalhesScroll}
              showsVerticalScrollIndicator={false}
            >
              {partidaSelecionada && (
                <>
                  <View style={s.modalDetalhesTitulo}>
                    <Text style={s.modalDetalhesTituloTxt}>
                      {partidaSelecionada.categoria.nome}
                      {partidaSelecionada.rodada ? ` • Rodada ${partidaSelecionada.rodada}` : ''}
                      {partidaSelecionada.grupo ? ` • Grupo ${partidaSelecionada.grupo}` : ''}
                    </Text>
                    <TouchableOpacity onPress={() => setModalDetalhes(false)}>
                      <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                    </TouchableOpacity>
                  </View>

                  <View style={s.placarCard}>
                    <View style={s.placarGrandeRow}>
                      <Text style={[s.timeTxt, { textAlign: 'center' }]} numberOfLines={2}>
                        {partidaSelecionada.mandante.nome}
                      </Text>
                      <View style={s.placarCentro}>
                        {partidaSelecionada.status === 'FINALIZADA' || partidaSelecionada.status === 'AO_VIVO' ? (
                          <Text style={s.placarGrandeTxt}>
                            {partidaSelecionada.gols_mandante} × {partidaSelecionada.gols_visitante}
                          </Text>
                        ) : (
                          <Text style={s.placarGrandeDash}>— × —</Text>
                        )}
                        <View style={s.placarGrandeStatusRow}>
                          <View style={[s.statusDot, { backgroundColor: STATUS_COR[partidaSelecionada.status] }]} />
                          <Text style={[s.statusTxt, { color: STATUS_COR[partidaSelecionada.status] }]}>
                            {STATUS_LABEL[partidaSelecionada.status]}
                          </Text>
                        </View>
                      </View>
                      <Text style={[s.timeTxt, { textAlign: 'center' }]} numberOfLines={2}>
                        {partidaSelecionada.visitante.nome}
                      </Text>
                    </View>

                    <View style={s.placarGrandeInfoRow}>
                      <Text style={s.placarGrandeInfoTxt}>{formatarData(partidaSelecionada.data)}</Text>
                      {partidaSelecionada.horario && (
                        <Text style={s.placarGrandeInfoTxt}>{partidaSelecionada.horario}</Text>
                      )}
                      {partidaSelecionada.local && (
                        <Text style={s.placarGrandeInfoTxt} numberOfLines={1}>{partidaSelecionada.local}</Text>
                      )}
                    </View>
                  </View>

                  {partidaSelecionada.status === 'FINALIZADA' && temStats && (
                    <View style={{ marginBottom: 16 }}>
                      <Text style={s.secaoLabel}>ESTATÍSTICAS DO OCIAN</Text>
                      {statsJogadores.map(j => {
                        const tiposComValor = Object.entries(j.stats).filter(([, v]) => v > 0);
                        if (tiposComValor.length === 0) return null;
                        return (
                          <View key={j.id} style={s.statJogadorCard}>
                            <Text style={s.statJogadorNome}>{j.nome.split(' ')[0]}</Text>
                            <View style={s.statBadgesRow}>
                              {tiposComValor.map(([tipo, valor]) => (
                                <View key={tipo} style={[s.statBadge, { backgroundColor: TIPO_COR[tipo] + '22' }]}>
                                  <MaterialCommunityIcons name={TIPO_ICONE[tipo] as any} size={12} color={TIPO_COR[tipo]} />
                                  <Text style={[s.statBadgeTxt, { color: TIPO_COR[tipo] }]}>
                                    {valor} {TIPO_LABEL[tipo]}
                                  </Text>
                                </View>
                              ))}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {jogadoresDaPartida.length > 0 && (
                    <View style={s.convocadosScroll}>
                      <Text style={s.secaoLabel}>CONVOCADOS ({jogadoresDaPartida.length})</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View style={s.convocadosRow}>
                          {jogadoresDaPartida.map(j => (
                            <View key={j.id} style={s.convocadoCard}>
                              <Text style={s.convocadoNum}>#{j.numCamisa ?? '—'}</Text>
                              <Text style={s.convocadoNome} numberOfLines={1}>{j.nome.split(' ')[0]}</Text>
                              <Text style={s.convocadoPosicao}>{j.posicao}</Text>
                            </View>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  <View style={s.acoesRow}>
                    <TouchableOpacity
                      style={s.btnAcao}
                      onPress={() => { setModalDetalhes(false); setModalEditar(true); }}
                    >
                      <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.azulClaro} />
                      <Text style={[s.btnAcaoTxt, { color: colors.azulClaro }]}>Editar</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[s.btnAcao, {
                        backgroundColor: STATUS_COR[partidaSelecionada.status] + '18',
                        borderColor: STATUS_COR[partidaSelecionada.status] + '60',
                      }]}
                      onPress={() => setModalStatus(true)}
                    >
                      <MaterialCommunityIcons name="swap-horizontal" size={18} color={STATUS_COR[partidaSelecionada.status]} />
                      <Text style={[s.btnAcaoTxt, { color: STATUS_COR[partidaSelecionada.status] }]}>
                        {STATUS_LABEL[partidaSelecionada.status]}
                      </Text>
                    </TouchableOpacity>
                  </View>

                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={modalStatus} transparent animationType="fade">
        <Pressable style={s.modalStatusOverlay} onPress={() => setModalStatus(false)}>
          <View style={s.modalStatusCard}>
            <Text style={s.modalStatusTitulo}>Alterar Status</Text>
            {STATUS_OPCOES.map(st => (
              <TouchableOpacity
                key={st}
                style={[
                  s.statusOpcao,
                  partidaSelecionada?.status === st && { ...s.statusOpcaoAtiva, borderColor: STATUS_COR[st] },
                  partidaSelecionada?.status === st && { backgroundColor: STATUS_COR[st] + '22' },
                ]}
                onPress={() => atualizarStatus(st)}
                disabled={atualizandoStatus}
              >
                <View style={[s.statusDot, { backgroundColor: STATUS_COR[st] }]} />
                <Text style={[s.statusOpcaoTxt, { color: STATUS_COR[st] }]}>
                  {STATUS_LABEL[st]}
                </Text>
                {atualizandoStatus && partidaSelecionada?.status !== st && (
                  <ActivityIndicator size="small" color={STATUS_COR[st]} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={modalEditar} transparent={false} animationType="slide">
        {partidaSelecionada && (
          <OrganizarPartidaCampeonato
            competicao={competicao}
            partida={partidaSelecionada}
            onFechar={() => setModalEditar(false)}
            onSalvo={() => { setModalEditar(false); carregar(true); }}
          />
        )}
      </Modal>

      <Modal visible={modalNovaPartida} transparent={false} animationType="slide">
        <OrganizarPartidaCampeonato
          competicao={competicao}
          onFechar={() => setModalNovaPartida(false)}
          onSalvo={() => { setModalNovaPartida(false); carregar(true); }}
        />
      </Modal>

      {/* Barra de ação — modo seleção múltipla */}
      {modoSelecao && (
        <View style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          flexDirection: 'row', alignItems: 'center',
          backgroundColor: '#1a1a1a',
          borderTopWidth: 1, borderTopColor: '#2a2a2a',
          paddingHorizontal: 20, paddingVertical: 14,
          paddingBottom: 28, gap: 12,
        }}>
          <TouchableOpacity onPress={sairModoSelecao} style={{ padding: 4 }}>
            <MaterialCommunityIcons name="close" size={22} color={colors.text_secondary} />
          </TouchableOpacity>
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 14, flex: 1 }}>
            {selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''}
          </Text>
          <TouchableOpacity
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 8,
              backgroundColor: colors.vermelho + '22',
              borderWidth: 1, borderColor: colors.vermelho + '55',
              paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10,
            }}
            onPress={removerSelecionadas}
            disabled={removendo}
          >
            {removendo
              ? <ActivityIndicator size="small" color={colors.vermelho} />
              : <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} />
            }
            <Text style={{ fontFamily: 'Creato-Bold', color: colors.vermelho, fontSize: 13 }}>
              Remover
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* FAB — adicionar partida */}
      {isAdmin && !modoSelecao && (
        <TouchableOpacity activeOpacity={0.8} style={{
          position: 'absolute', bottom: 20, right: 20,
          elevation: 5,
          shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3, shadowRadius: 4,
        }} onPress={() => setModalNovaPartida(true)}>
          <LinearGradient
            colors={['#0E78FF', '#2C88FE']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
            style={{ width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialCommunityIcons name="plus" size={32} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      )}
    </View>
  );
}