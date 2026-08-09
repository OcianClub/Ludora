import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import {
  fetchEscalacaoPartida,
  salvarEscalacaoPartida,
  fetchJogadoresParaEscalacao,
  atualizarJogador,
} from '@/src/services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface JogadorEscalado {
  id:         number;
  jogador_id: number;
  numCamisa:  number;
  titular:    boolean;
  jogador:    { nome: string; posicao: string; numCamisa: number | null };
}

export interface JogadorDisponivel {
  id_jogador: number;
  nome:       string;
  posicao:    string;
  numCamisa:  number | null;
}

interface EscalacaoPartidaProps {
  partidaId:      number;
  categoriaId:    number | null;
  competicaoId?:  number | null;
  isAdmin:        boolean;
  partidaStatus?: 'AGENDADA' | 'AO_VIVO' | 'FINALIZADA';
  onEscalacaoAtualizada?: (escalacao: JogadorEscalado[]) => void;
}

const MAX_TITULARES = 5;

// ── Sub-componente: linha de jogador escalado ─────────────────────────────────

function JogadorRow({ escalado }: { escalado: JogadorEscalado }) {
  return (
    <View style={[jr.row, escalado.titular && { borderColor: colors.primary + '44' }]}>
      <View style={jr.numero}>
        <Text style={jr.numeroTxt}>{escalado.numCamisa}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={jr.nome}>{escalado.jogador.nome}</Text>
        <Text style={jr.pos}>{escalado.jogador.posicao}</Text>
      </View>
      {escalado.titular && (
        <View style={jr.badge}>
          <Text style={jr.badgeTxt}>TITULAR</Text>
        </View>
      )}
    </View>
  );
}

const jr = {
  row: {
    flexDirection: 'row' as const, alignItems: 'center' as const,
    backgroundColor: '#1a1a1a', borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: '#2a2a2a', gap: 10,
  },
  numero: {
    width: 36, height: 36, borderRadius: 9, backgroundColor: '#252525',
    alignItems: 'center' as const, justifyContent: 'center' as const,
  },
  numeroTxt: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 14 },
  nome: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 14 },
  pos:  { fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11, marginTop: 1 },
  badge: { backgroundColor: colors.primary + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  badgeTxt: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 10 },
};

// ── Componente principal ──────────────────────────────────────────────────────

export default function EscalacaoPartida({
  partidaId, categoriaId, competicaoId, isAdmin, partidaStatus, onEscalacaoAtualizada,
}: EscalacaoPartidaProps) {
  const modoSubstituicao = partidaStatus === 'AO_VIVO';
  const MAX_SUBS = 3;

  const [escalacao,         setEscalacao]         = useState<JogadorEscalado[]>([]);
  const [disponiveis,       setDisponiveis]       = useState<JogadorDisponivel[]>([]);
  const [carregando,        setCarregando]        = useState(false);
  const [modalEscalacao,    setModalEscalacao]    = useState(false);
  const [convocados,        setConvocados]        = useState<number[]>([]);
  const [salvandoEscalacao, setSalvandoEscalacao] = useState(false);

  // Substituição AO_VIVO
  const [subStep,   setSubStep]   = useState<'saindo' | 'entrando'>('saindo');
  const [subSaindo, setSubSaindo] = useState<number | null>(null);
  const [subPares,  setSubPares]  = useState<{ saindo: number; entrando: number }[]>([]);

  // ── Edição de camisa ──────────────────────────────────────────────────────
  const [modalCamisa,       setModalCamisa]       = useState<JogadorDisponivel | null>(null);
  const [novaCamisa,        setNovaCamisa]        = useState('');
  const [salvandoCamisa,    setSalvandoCamisa]    = useState(false);

  // ── Confirmação de troca de camisa ────────────────────────────────────────
  const [modalTroca, setModalTroca] = useState<{
    nomeA: string; camisaA: string | number | null;
    nomeB: string; camisaB: string | number | null;
    onConfirmar: () => void;
  } | null>(null);

  const emCampo  = escalacao.filter(e => e.titular);
  const reservas = escalacao.filter(e => !e.titular);

  const carregarEscalacao = useCallback(async () => {
    setCarregando(true);
    try {
      const data = await fetchEscalacaoPartida(partidaId);
      setEscalacao(data);
      onEscalacaoAtualizada?.(data);
    } catch {
    } finally { setCarregando(false); }
  }, [partidaId]);

  const carregarDisponiveis = useCallback(async () => {
    if (!categoriaId) return;
    try {
      const data = await fetchJogadoresParaEscalacao(categoriaId, competicaoId ?? null);
      setDisponiveis(data);
    } catch (e: any) {
      if (isAdmin) Alert.alert('Atenção', e.message || 'Não foi possível carregar o elenco.');
    }
  }, [categoriaId, competicaoId]);

  useEffect(() => {
    carregarEscalacao();
    carregarDisponiveis();
  }, [carregarEscalacao, carregarDisponiveis]);

  const abrirModal = () => {
    if (modoSubstituicao) {
      setSubStep('saindo');
      setSubSaindo(null);
      setSubPares([]);
    } else {
      const tits = escalacao.filter(e => e.titular).map(e => e.jogador_id);
      const bnco = escalacao.filter(e => !e.titular).map(e => e.jogador_id);
      setConvocados([...tits, ...bnco]);
    }
    setModalEscalacao(true);
  };

  const toggleConvocado = (id: number) => {
    // Removendo
    if (convocados.includes(id)) {
      setConvocados(prev => prev.filter(i => i !== id));
      return;
    }
    // Adicionando — checar camisa duplicada
    const jogadorNovo = disponiveis.find(d => Number(d.id_jogador) === id);
    const camisaNova  = jogadorNovo?.numCamisa;
    if (camisaNova && camisaNova > 0) {
      const duplicado = disponiveis.find(d =>
        Number(d.id_jogador) !== id &&
        d.numCamisa === camisaNova &&
        convocados.includes(Number(d.id_jogador))
      );
      if (duplicado) {
        Alert.alert(
          `Camisa #${camisaNova} em uso`,
          `${duplicado.nome} já usa a camisa ${camisaNova}.\n\nDeseja remover a camisa de ${duplicado.nome} e convocar ${jogadorNovo?.nome} com ela?`,
          [
            { text: 'Cancelar', style: 'cancel' },
            {
              text: 'Confirmar troca',
              onPress: () => {
                setDisponiveis(prev =>
                  prev.map(d =>
                    d.id_jogador === duplicado.id_jogador ? { ...d, numCamisa: null } : d
                  )
                );
                setConvocados(prev => [...prev, id]);
              },
            },
          ]
        );
        return;
      }
    }
    setConvocados(prev => [...prev, id]);
  };

  // ── Abre modal de edição de camisa (bloqueado durante jogo ao vivo) ────────
  const abrirEdicaoCamisa = (jogador: JogadorDisponivel) => {
    if (modoSubstituicao) return;
    setModalCamisa(jogador);
    setNovaCamisa(jogador.numCamisa ? String(jogador.numCamisa) : '');
  };

  // ── Salva nova camisa — com detecção de conflito entre convocados ─────────
  const salvarCamisa = async () => {
    if (!modalCamisa) return;
    const num = Number(novaCamisa.trim());
    if (!novaCamisa.trim() || isNaN(num) || num <= 0) {
      Alert.alert('Atenção', 'Digite um número de camisa válido.');
      return;
    }

    // Verifica se outro jogador JÁ CONVOCADO tem essa camisa
    const conflito = disponiveis.find(d =>
      Number(d.id_jogador) !== Number(modalCamisa.id_jogador) &&
      d.numCamisa === num &&
      convocados.includes(Number(d.id_jogador))
    );

    if (conflito) {
      const camisaAtual = modalCamisa.numCamisa ?? null;
      setModalTroca({
        nomeA: modalCamisa.nome, camisaA: num,
        nomeB: conflito.nome,    camisaB: camisaAtual,
        onConfirmar: async () => {
          setModalTroca(null);
          setSalvandoCamisa(true);
          try {
            await atualizarJogador(Number(modalCamisa.id_jogador), { numCamisa: num });
            if (camisaAtual && camisaAtual > 0) {
              await atualizarJogador(Number(conflito.id_jogador), { numCamisa: camisaAtual });
            }
            setDisponiveis(prev => prev.map(d => {
              if (Number(d.id_jogador) === Number(modalCamisa.id_jogador)) return { ...d, numCamisa: num };
              if (Number(d.id_jogador) === Number(conflito.id_jogador))    return { ...d, numCamisa: camisaAtual ?? null };
              return d;
            }));
            setModalCamisa(null);
          } catch (e: any) {
            Alert.alert('Erro', e.message || 'Não foi possível salvar.');
          } finally { setSalvandoCamisa(false); }
        },
      });
      return;
    }

    setSalvandoCamisa(true);
    try {
      await atualizarJogador(Number(modalCamisa.id_jogador), { numCamisa: num });
      setDisponiveis(prev =>
        prev.map(d =>
          Number(d.id_jogador) === Number(modalCamisa.id_jogador) ? { ...d, numCamisa: num } : d
        )
      );
      setModalCamisa(null);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar a camisa.');
    } finally { setSalvandoCamisa(false); }
  };

  const confirmarEscalacao = async () => {
    // ── MODO SUBSTITUIÇÃO (AO_VIVO) ──────────────────────────────────────────
    if (modoSubstituicao) {
      if (subPares.length === 0) {
        Alert.alert('Atenção', 'Defina ao menos uma substituição.');
        return;
      }
      setSalvandoEscalacao(true);
      try {
        const novaEsc = escalacao.map(e => {
          const saiu   = subPares.find(s => s.saindo   === e.jogador_id);
          const entrou = subPares.find(s => s.entrando === e.jogador_id);
          if (saiu)   return { ...e, titular: false };
          if (entrou) return { ...e, titular: true };
          return e;
        });
        await salvarEscalacaoPartida(
          partidaId,
          novaEsc.map(e => ({ jogador_id: e.jogador_id, numCamisa: e.numCamisa, titular: e.titular }))
        );
        await carregarEscalacao();
        setModalEscalacao(false);
      } catch (e: any) {
        Alert.alert('Erro', e.message || 'Não foi possível salvar.');
      } finally { setSalvandoEscalacao(false); }
      return;
    }

    // ── MODO NORMAL (pré-jogo) ────────────────────────────────────────────────
    if (convocados.length === 0) {
      Alert.alert('Atenção', 'Convoque ao menos um jogador.');
      return;
    }
    const semCamisa = convocados
      .map(id => disponiveis.find(d => Number(d.id_jogador) === id))
      .filter(d => !d?.numCamisa || d.numCamisa <= 0);

    if (semCamisa.length > 0) {
      Alert.alert(
        'Número de camisa ausente',
        `Segure o nome do jogador para definir a camisa:\n\n${semCamisa.map(d => d?.nome).join('\n')}`,
      );
      return;
    }
    setSalvandoEscalacao(true);
    try {
      const payload = convocados.map((id, idx) => {
        const disp = disponiveis.find(d => Number(d.id_jogador) === id)!;
        return { jogador_id: id, numCamisa: disp.numCamisa!, titular: idx < MAX_TITULARES };
      });
      await salvarEscalacaoPartida(partidaId, payload);
      await carregarEscalacao();
      setModalEscalacao(false);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar a escalação.');
    } finally { setSalvandoEscalacao(false); }
  };

  // ── Seção de visualização ─────────────────────────────────────────────────
  return (
    <>
      <View style={sv.section}>
        <View style={sv.header}>
          <View style={sv.titleRow}>
            <View style={sv.bar} />
            <Text style={sv.title}>ESCALAÇÃO</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity onPress={abrirModal}>
              <Text style={sv.action}>{modoSubstituicao ? 'SUBSTITUIÇÃO' : 'ALTERAR'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {carregando ? (
          <ActivityIndicator color={colors.primary} />
        ) : escalacao.length === 0 ? (
          <View style={sv.empty}>
            <MaterialCommunityIcons name="account-group-outline" size={40} color="#333" />
            <Text style={sv.emptyTxt}>Nenhum jogador escalado</Text>
            {isAdmin && (
              <TouchableOpacity style={sv.emptyBtn} onPress={abrirModal}>
                <Text style={sv.emptyBtnTxt}>DEFINIR ESCALAÇÃO</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {emCampo.length > 0 && (
              <>
                <Text style={sv.subLabel}>EM CAMPO</Text>
                {emCampo.map(j => <JogadorRow key={j.id} escalado={j} />)}
              </>
            )}
            {reservas.length > 0 && (
              <>
                <Text style={[sv.subLabel, { color: colors.text_secondary, marginTop: 12 }]}>RESERVAS</Text>
                {reservas.map(j => <JogadorRow key={j.id} escalado={j} />)}
              </>
            )}
          </>
        )}
      </View>

      <Modal visible={modalEscalacao} transparent={false} animationType="slide" onRequestClose={() => setModalEscalacao(false)}>
        <SafeAreaView style={m.root}>
          <View style={m.header}>
            <TouchableOpacity onPress={() => setModalEscalacao(false)}>
              <MaterialCommunityIcons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
            <Text style={m.title}>{modoSubstituicao ? 'SUBSTITUIÇÃO' : 'ESCALAÇÃO'}</Text>
            {modoSubstituicao ? (
              <View style={m.counter}>
                <Text style={m.counterNum}>{subPares.length}</Text>
                <Text style={m.counterSep}>/</Text>
                <Text style={m.counterMax}>{MAX_SUBS}</Text>
              </View>
            ) : (
              <View style={m.counter}>
                <Text style={m.counterNum}>{Math.min(convocados.length, MAX_TITULARES)}</Text>
                <Text style={m.counterSep}>/</Text>
                <Text style={m.counterMax}>{MAX_TITULARES}</Text>
              </View>
            )}
          </View>

          <View style={m.dica}>
            <MaterialCommunityIcons name="information-outline" size={14} color={colors.text_secondary} />
            <Text style={m.dicaTxt}>
              {modoSubstituicao
                ? `Escolha quem SAI, depois quem ENTRA · máx. ${MAX_SUBS} trocas por partida`
                : `Toque para convocar · Segure para editar camisa · Primeiros ${MAX_TITULARES} = titulares`
              }
            </Text>
          </View>

          {modoSubstituicao ? (
            /* ══ MODO SUBSTITUIÇÃO ══════════════════════════════════════════════ */
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>

              {/* Pares já definidos */}
              {subPares.length > 0 && (
                <View style={{ marginBottom: 16, gap: 6 }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 4 }}>SUBSTITUIÇÕES DEFINIDAS</Text>
                  {subPares.map((par, i) => {
                    const saindo   = escalacao.find(e => e.jogador_id === par.saindo);
                    const entrando = escalacao.find(e => e.jogador_id === par.entrando);
                    return (
                      <View key={i} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary + '10', borderRadius: 10, padding: 10, gap: 8, borderWidth: 1, borderColor: colors.primary + '30' }}>
                        <View style={m.camisa}><Text style={[m.camisaNum, { color: colors.vermelho }]}>{saindo?.numCamisa}</Text></View>
                        <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{saindo?.jogador.nome}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
                        <View style={m.camisa}><Text style={[m.camisaNum, { color: colors.primary }]}>{entrando?.numCamisa}</Text></View>
                        <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 12, flex: 1 }} numberOfLines={1}>{entrando?.jogador.nome}</Text>
                        <TouchableOpacity onPress={() => setSubPares(p => p.filter((_, j) => j !== i))}>
                          <MaterialCommunityIcons name="close-circle" size={18} color={colors.vermelho + '88'} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {subPares.length < MAX_SUBS && (
                <>
                  {/* Indicador de passo */}
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, backgroundColor: '#1a1a1a', borderRadius: 12, padding: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: subStep === 'saindo' ? colors.vermelho : colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                      <MaterialCommunityIcons name={subStep === 'saindo' ? 'arrow-up-circle' : 'arrow-down-circle'} size={18} color="#fff" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 14 }}>
                        {subStep === 'saindo' ? 'Quem SAI do campo?' : 'Quem ENTRA em campo?'}
                      </Text>
                      <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>
                        {subStep === 'saindo'
                          ? 'Toque no titular que vai ao banco'
                          : `Substituindo: ${escalacao.find(e => e.jogador_id === subSaindo)?.jogador.nome ?? ''}`
                        }
                      </Text>
                    </View>
                    {subStep === 'entrando' && (
                      <TouchableOpacity onPress={() => { setSubStep('saindo'); setSubSaindo(null); }}>
                        <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 12 }}>← VOLTAR</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {subStep === 'saindo' ? (
                    // Lista de TITULARES disponíveis para sair
                    escalacao
                      .filter(e => e.titular && !subPares.find(s => s.saindo === e.jogador_id))
                      .map(item => (
                        <TouchableOpacity
                          key={item.jogador_id}
                          style={[m.cardTitular, { marginBottom: 8 }]}
                          onPress={() => { setSubSaindo(item.jogador_id); setSubStep('entrando'); }}
                          activeOpacity={0.8}
                        >
                          <View style={m.camisa}><Text style={m.camisaNum}>{item.numCamisa}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={m.nome}>{item.jogador.nome}</Text>
                            <Text style={m.pos}>{item.jogador.posicao}</Text>
                          </View>
                          <View style={m.tagTitular}><Text style={m.tagTitularTxt}>EM CAMPO</Text></View>
                          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.vermelho} />
                        </TouchableOpacity>
                      ))
                  ) : (
                    // Lista de RESERVAS disponíveis para entrar
                    escalacao
                      .filter(e => !e.titular && !subPares.find(s => s.entrando === e.jogador_id))
                      .map(item => (
                        <TouchableOpacity
                          key={item.jogador_id}
                          style={[m.cardBanco, m.cardBancoConvocado, { marginBottom: 8 }]}
                          onPress={() => {
                            setSubPares(p => [...p, { saindo: subSaindo!, entrando: item.jogador_id }]);
                            setSubStep('saindo');
                            setSubSaindo(null);
                          }}
                          activeOpacity={0.8}
                        >
                          <View style={[m.camisa, { backgroundColor: colors.text_secondary + '33' }]}>
                            <Text style={m.camisaNum}>{item.numCamisa}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={m.nome}>{item.jogador.nome}</Text>
                            <Text style={m.pos}>{item.jogador.posicao}</Text>
                          </View>
                          <View style={m.tagBanco}><Text style={m.tagBancoTxt}>BANCO</Text></View>
                          <MaterialCommunityIcons name="arrow-up-circle-outline" size={20} color={colors.primary} />
                        </TouchableOpacity>
                      ))
                  )}

                  {subPares.length > 0 && (
                    <Text style={{ fontFamily: 'Creato-Regular', color: '#555', fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                      {MAX_SUBS - subPares.length} troca(s) restante(s)
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          ) : disponiveis.length === 0 ? (
            /* ══ MODO NORMAL — sem jogadores ════════════════════════════════════ */
            <View style={m.empty}>
              <MaterialCommunityIcons name="account-group-outline" size={48} color="#333" />
              <Text style={m.emptyTxt}>Nenhum jogador encontrado</Text>
              <Text style={m.emptySubTxt}>
                Verifique se o elenco foi inscrito nessa competição em Equipes → Campeonatos.
              </Text>
            </View>
          ) : (
            /* ══ MODO NORMAL — lista de convocação ══════════════════════════════ */
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              <View style={m.sectionHeader}>
                <View style={[m.sectionDot, { backgroundColor: colors.primary }]} />
                <Text style={m.sectionTitle}>EM CAMPO</Text>
                <Text style={m.sectionCount}>{Math.min(convocados.length, MAX_TITULARES)}/{MAX_TITULARES}</Text>
              </View>

              {disponiveis.map(item => {
                const id      = Number(item.id_jogador);
                const pos     = convocados.indexOf(id);
                const titular = pos >= 0 && pos < MAX_TITULARES;
                if (!titular) return null;
                const semCamisa = !item.numCamisa || item.numCamisa <= 0;
                return (
                  <TouchableOpacity
                    key={String(item.id_jogador)}
                    style={[m.cardTitular, semCamisa && { borderColor: colors.amarelo + '60' }]}
                    onPress={() => toggleConvocado(id)}
                    onLongPress={() => abrirEdicaoCamisa(item)}
                    activeOpacity={0.75}
                  >
                    <View style={m.ordem}>
                      <Text style={m.ordemNum}>{pos + 1}</Text>
                    </View>
                    <View style={[m.camisa, semCamisa && { backgroundColor: colors.amarelo + '20' }]}>
                      {semCamisa
                        ? <MaterialCommunityIcons name="tshirt-crew-outline" size={18} color={colors.amarelo} />
                        : <Text style={m.camisaNum}>{item.numCamisa}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={m.nome}>{item.nome}</Text>
                      <Text style={m.pos}>{item.posicao}{semCamisa ? ' · Segure para definir camisa' : ''}</Text>
                    </View>
                    <View style={m.tagTitular}>
                      <Text style={m.tagTitularTxt}>TITULAR</Text>
                    </View>
                    <MaterialCommunityIcons name="close-circle" size={20} color={colors.vermelho + '88'} />
                  </TouchableOpacity>
                );
              })}
              {Math.min(convocados.length, MAX_TITULARES) < MAX_TITULARES &&
                Array.from({ length: MAX_TITULARES - Math.min(convocados.length, MAX_TITULARES) }).map((_, i) => (
                  <View key={`slot-${i}`} style={m.slotVazio}>
                    <MaterialCommunityIcons name="account-plus-outline" size={18} color="#333" />
                    <Text style={m.slotVazioTxt}>Toque em um jogador abaixo</Text>
                  </View>
                ))
              }

              <View style={[m.sectionHeader, { marginTop: 20 }]}>
                <View style={[m.sectionDot, { backgroundColor: colors.text_secondary }]} />
                <Text style={m.sectionTitle}>BANCO</Text>
                <Text style={m.sectionCount}>{Math.max(0, convocados.length - MAX_TITULARES)}</Text>
              </View>

              {disponiveis.map(item => {
                const id        = Number(item.id_jogador);
                const pos       = convocados.indexOf(id);
                const convocado = pos >= 0;
                const titular   = convocado && pos < MAX_TITULARES;
                if (titular) return null;
                const semCamisa = !item.numCamisa || item.numCamisa <= 0;
                return (
                  <TouchableOpacity
                    key={String(item.id_jogador)}
                    style={[m.cardBanco, convocado && m.cardBancoConvocado, semCamisa && convocado && { borderColor: colors.amarelo + '50' }]}
                    onPress={() => toggleConvocado(id)}
                    onLongPress={() => abrirEdicaoCamisa(item)}
                    activeOpacity={0.75}
                  >
                    <View style={[m.camisa, convocado && { backgroundColor: colors.text_secondary + '33' }, semCamisa && convocado && { backgroundColor: colors.amarelo + '20' }]}>
                      {semCamisa && convocado
                        ? <MaterialCommunityIcons name="tshirt-crew-outline" size={16} color={colors.amarelo} />
                        : <Text style={[m.camisaNum, { color: convocado ? colors.text : '#555' }]}>{item.numCamisa ?? '?'}</Text>
                      }
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[m.nome, !convocado && { color: '#555' }]}>{item.nome}</Text>
                      <Text style={m.pos}>{item.posicao}{semCamisa ? ' · Segure p/ definir camisa' : ''}</Text>
                    </View>
                    {convocado ? (
                      <>
                        <View style={m.tagBanco}><Text style={m.tagBancoTxt}>BANCO</Text></View>
                        <MaterialCommunityIcons name="close-circle" size={20} color={colors.vermelho + '88'} />
                      </>
                    ) : (
                      <MaterialCommunityIcons name="plus-circle-outline" size={22} color="#333" />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity
            style={[m.salvarBtn, (salvandoEscalacao || (modoSubstituicao ? subPares.length === 0 : disponiveis.length === 0)) && { opacity: 0.5 }]}
            onPress={confirmarEscalacao}
            disabled={salvandoEscalacao || (modoSubstituicao ? subPares.length === 0 : disponiveis.length === 0)}
          >
            {salvandoEscalacao
              ? <ActivityIndicator color="#fff" />
              : <Text style={m.salvarBtnTxt}>
                  {modoSubstituicao
                    ? `CONFIRMAR ${subPares.length} SUBSTITUIÇÃO(ÕES)`
                    : `SALVAR · ${convocados.length} CONVOCADO${convocados.length !== 1 ? 'S' : ''}`
                  }
                </Text>
            }
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      <Modal visible={!!modalCamisa} transparent animationType="fade" onRequestClose={() => setModalCamisa(null)}>
        <View style={mc.overlay}>
          <View style={mc.box}>
            <Text style={mc.titulo}>Número de Camisa</Text>
            <Text style={mc.sub}>{modalCamisa?.nome}</Text>
            <TextInput
              style={mc.input}
              placeholder="Ex: 10"
              placeholderTextColor="#444"
              value={novaCamisa}
              onChangeText={v => setNovaCamisa(v.replace(/\D/g, ''))}
              keyboardType="numeric"
              maxLength={2}
              autoFocus
            />
            <View style={mc.btnRow}>
              <TouchableOpacity style={mc.btnCancel} onPress={() => setModalCamisa(null)}>
                <Text style={mc.btnCancelTxt}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[mc.btnSave, salvandoCamisa && { opacity: 0.6 }]}
                onPress={salvarCamisa}
                disabled={salvandoCamisa}
              >
                {salvandoCamisa
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={mc.btnSaveTxt}>SALVAR</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* ── Modal de troca de camisa ──────────────────────────────────────── */}
      <Modal visible={!!modalTroca} transparent animationType="fade" onRequestClose={() => setModalTroca(null)}>
        <View style={mt.overlay}>
          <View style={mt.box}>
            <View style={mt.iconWrap}>
              <MaterialCommunityIcons name="tshirt-crew" size={26} color={colors.amarelo} />
            </View>
            <Text style={mt.titulo}>Camisa #{modalTroca?.camisaA} em uso</Text>
            <Text style={mt.desc}>
              <Text style={mt.bold}>{modalTroca?.nomeB}</Text> já usa essa camisa.{'\n'}Deseja fazer a troca?
            </Text>
            <View style={mt.trocaRow}>
              <View style={mt.card}>
                <View style={mt.badge}><Text style={mt.badgeNum}>#{modalTroca?.camisaA}</Text></View>
                <Text style={mt.cardNome} numberOfLines={1}>{modalTroca?.nomeA}</Text>
              </View>
              <MaterialCommunityIcons name="swap-horizontal" size={24} color={colors.primary} />
              <View style={mt.card}>
                <View style={[mt.badge, { backgroundColor: '#252525' }]}>
                  <Text style={[mt.badgeNum, { color: colors.text_secondary }]}>#{modalTroca?.camisaB || '—'}</Text>
                </View>
                <Text style={mt.cardNome} numberOfLines={1}>{modalTroca?.nomeB}</Text>
              </View>
            </View>
            <View style={mt.btnRow}>
              <TouchableOpacity style={mt.btnCancel} onPress={() => setModalTroca(null)}>
                <Text style={mt.btnCancelTxt}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={mt.btnConfirm} onPress={modalTroca?.onConfirmar}>
                <MaterialCommunityIcons name="check" size={15} color="#fff" />
                <Text style={mt.btnConfirmTxt}>TROCAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── Estilos da seção de visualização ─────────────────────────────────────────
const sv = {
  section: { paddingHorizontal: 16, paddingVertical: 20, borderTopWidth: 1, borderTopColor: '#1e1e1e' },
  header: { flexDirection: 'row' as const, justifyContent: 'space-between' as const, alignItems: 'center' as const, marginBottom: 14 },
  titleRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8 },
  bar: { width: 3, height: 16, borderRadius: 2, backgroundColor: colors.primary },
  title: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 13, letterSpacing: 1 },
  action: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 12, letterSpacing: 0.5 },
  subLabel: { fontFamily: 'Creato-Bold', color: colors.azulClaro, fontSize: 11, letterSpacing: 1.2, marginBottom: 8 },
  empty: { alignItems: 'center' as const, paddingVertical: 20, gap: 8 },
  emptyTxt: { fontFamily: 'Creato-Regular', color: '#444', fontSize: 13 },
  emptyBtn: { marginTop: 8, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20 },
  emptyBtnTxt: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 13 },
};

// ── Estilos do modal de edição de escalação ───────────────────────────────────
const m = {
  root: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row' as const, alignItems: 'center' as const, justifyContent: 'space-between' as const, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  title: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 15, letterSpacing: 1 },
  counter: { flexDirection: 'row' as const, alignItems: 'baseline' as const, gap: 2 },
  counterNum: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 22 },
  counterSep: { fontFamily: 'Creato-Regular', color: '#444', fontSize: 16 },
  counterMax: { fontFamily: 'Creato-Regular', color: '#444', fontSize: 16 },
  dica: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 6, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#1a1a1a', borderBottomWidth: 1, borderBottomColor: '#1e1e1e' },
  dicaTxt: { fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 12, flex: 1 },
  empty: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const, gap: 12, paddingHorizontal: 32 },
  emptyTxt: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 14, textAlign: 'center' as const },
  emptySubTxt: { fontFamily: 'Creato-Regular', color: '#444', fontSize: 12, textAlign: 'center' as const },
  sectionHeader: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 8, marginBottom: 10, marginTop: 16 },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 12, letterSpacing: 1, flex: 1 },
  sectionCount: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 12 },
  cardTitular: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: colors.primary + '12', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: colors.primary + '40' },
  cardBanco: { flexDirection: 'row' as const, alignItems: 'center' as const, backgroundColor: '#111', borderRadius: 12, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: '#1e1e1e' },
  cardBancoConvocado: { backgroundColor: '#1a1a1a', borderColor: colors.text_secondary + '40' },
  ordem: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary + '30', alignItems: 'center' as const, justifyContent: 'center' as const },
  ordemNum: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 12 },
  camisa: { width: 36, height: 36, borderRadius: 9, backgroundColor: '#252525', alignItems: 'center' as const, justifyContent: 'center' as const },
  camisaNum: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 14 },
  nome: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 14 },
  pos:  { fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11, marginTop: 1 },
  tagTitular: { backgroundColor: colors.primary + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagTitularTxt: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 10 },
  tagBanco: { backgroundColor: colors.text_secondary + '22', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagBancoTxt: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 10 },
  slotVazio: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, backgroundColor: '#0d0d0d', borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: '#1a1a1a', borderStyle: 'dashed' as const },
  slotVazioTxt: { fontFamily: 'Creato-Regular', color: '#333', fontSize: 12 },
  salvarBtn: { margin: 16, backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' as const },
  salvarBtnTxt: { fontFamily: 'Creato-Bold', color: '#FFF', fontSize: 14, letterSpacing: 1 },
};

// ── Estilos do modal de camisa ────────────────────────────────────────────────
const mc = {
  overlay: { flex: 1, backgroundColor: '#000000aa', alignItems: 'center' as const, justifyContent: 'center' as const, padding: 32 },
  box: { backgroundColor: '#1a1a1a', borderRadius: 16, padding: 24, width: '100%' as const, borderWidth: 1, borderColor: '#2a2a2a' },
  titulo: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16, marginBottom: 4 },
  sub: { fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13, marginBottom: 16 },
  input: {
    backgroundColor: '#111', borderRadius: 10, borderWidth: 1, borderColor: '#333',
    color: colors.text, fontFamily: 'Creato-Bold', fontSize: 24,
    paddingVertical: 12, paddingHorizontal: 16, textAlign: 'center' as const, marginBottom: 20,
  },
  btnRow: { flexDirection: 'row' as const, gap: 10 },
  btnCancel: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: '#333', alignItems: 'center' as const },
  btnCancelTxt: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 },
  btnSave: { flex: 1, paddingVertical: 12, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center' as const },
  btnSaveTxt: { fontFamily: 'Creato-Bold', color: '#FFF', fontSize: 13 },
};

// ── Estilos do modal de troca de camisa ──────────────────────────────────────
const mt = {
  overlay: { flex: 1, backgroundColor: '#000000cc', alignItems: 'center' as const, justifyContent: 'center' as const, padding: 28 },
  box: { backgroundColor: '#161616', borderRadius: 20, padding: 24, width: '100%' as const, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' as const },
  iconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: colors.amarelo + '18', alignItems: 'center' as const, justifyContent: 'center' as const, marginBottom: 14 },
  titulo: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16, marginBottom: 8, textAlign: 'center' as const },
  desc: { fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13, textAlign: 'center' as const, lineHeight: 20, marginBottom: 24 },
  bold: { fontFamily: 'Creato-Bold', color: colors.text },
  trocaRow: { flexDirection: 'row' as const, alignItems: 'center' as const, gap: 10, marginBottom: 28, width: '100%' as const },
  card: { flex: 1, alignItems: 'center' as const, gap: 8, backgroundColor: '#1e1e1e', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#2a2a2a' },
  badge: { backgroundColor: colors.primary + '20', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  badgeNum: { fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 20 },
  cardNome: { fontFamily: 'Creato-Bold', color: colors.text, fontSize: 12, textAlign: 'center' as const },
  btnRow: { flexDirection: 'row' as const, gap: 10, width: '100%' as const },
  btnCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', alignItems: 'center' as const },
  btnCancelTxt: { fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 },
  btnConfirm: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: colors.primary, alignItems: 'center' as const, flexDirection: 'row' as const, justifyContent: 'center' as const, gap: 6 },
  btnConfirmTxt: { fontFamily: 'Creato-Bold', color: '#FFF', fontSize: 13, letterSpacing: 0.5 },
};