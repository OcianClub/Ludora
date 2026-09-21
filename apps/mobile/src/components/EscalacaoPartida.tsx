import { Icon } from '@ludora/icons';
import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  Modal, ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@ludora/design-tokens';
import { styles } from '@/src/styles/escalacaoPartidaStyles';

import {
  fetchEscalacaoPartida,
  salvarEscalacaoPartida,
  fetchJogadoresParaEscalacao,
  atualizarJogador,
} from '@/src/services/api';
import { subscribe } from 'diagnostics_channel';

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
  partidaStatus?: 'AGENDADA' | 'PREPARADA' | 'AO_VIVO' | 'FINALIZADA' | 'CANCELADA';
  onEscalacaoAtualizada?: (escalacao: JogadorEscalado[]) => void;
}

const MAX_TITULARES = 5;

// ── Sub-componente: linha de jogador escalado ─────────────────────────────────

function JogadorRow({ escalado }: { escalado: JogadorEscalado }) {
  return (
    <View style={[styles.rowItem, escalado.titular && styles.rowItemTitular]}>
      <View style={styles.rowNumBox}>
        <Text style={styles.rowNumTxt}>{escalado.numCamisa}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowNome}>{escalado.jogador.nome}</Text>
        <Text style={styles.rowPos}>{escalado.jogador.posicao}</Text>
      </View>
      {escalado.titular && (
        <View style={styles.rowBadge}>
          <Text style={styles.rowBadgeTxt}>TITULAR</Text>
        </View>
      )}
    </View>
  );
}

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
    if (convocados.includes(id)) {
      setConvocados(prev => prev.filter(i => i !== id));
      return;
    }
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
                  prev.map(d => d.id_jogador === duplicado.id_jogador ? { ...d, numCamisa: null } : d)
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

  const abrirEdicaoCamisa = (jogador: JogadorDisponivel) => {
    if (modoSubstituicao) return;
    setModalCamisa(jogador);
    setNovaCamisa(jogador.numCamisa ? String(jogador.numCamisa) : '');
  };

  const salvarCamisa = async () => {
    if (!modalCamisa) return;
    const num = Number(novaCamisa.trim());
    if (!novaCamisa.trim() || isNaN(num) || num <= 0) {
      Alert.alert('Atenção', 'Digite um número de camisa válido.');
      return;
    }

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
        prev.map(d => Number(d.id_jogador) === Number(modalCamisa.id_jogador) ? { ...d, numCamisa: num } : d)
      );
      setModalCamisa(null);
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar a camisa.');
    } finally { setSalvandoCamisa(false); }
  };

  const confirmarEscalacao = async () => {
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
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <View style={styles.sectionBar} />
            <Text style={styles.sectionTitle}>ESCALAÇÃO</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity onPress={abrirModal} style={styles.fundoSubstituicao}>
              <Text style={styles.sectionActionBtn}>{modoSubstituicao ? 'SUBSTITUIÇÃO' : 'ALTERAR'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {carregando ? (
          <ActivityIndicator color={colors.primaria} />
        ) : escalacao.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="account-group-outline" size={40} color={colors.textoSecundario} />
            <Text style={styles.emptyTxt}>Nenhum jogador escalado</Text>
            {isAdmin && (
              <TouchableOpacity style={styles.emptyBtn} onPress={abrirModal}>
                <Text style={styles.emptyBtnTxt}>DEFINIR ESCALAÇÃO</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          <>
            {emCampo.length > 0 && (
              <>
                <Text style={styles.sectionSubLabel}>EM CAMPO</Text>
                {emCampo.map(j => <JogadorRow key={j.id} escalado={j} />)}
              </>
            )}
            {reservas.length > 0 && (
              <>
                <Text style={[styles.sectionSubLabel, { color: colors.textoSecundario }]}>RESERVAS</Text>
                {reservas.map(j => <JogadorRow key={j.id} escalado={j} />)}
              </>
            )}
          </>
        )}
      </View>

      {/* ── Modal de Escalação / Substituição ── */}
      <Modal visible={modalEscalacao} transparent={false} animationType="slide" onRequestClose={() => setModalEscalacao(false)}>
        <SafeAreaView style={styles.modalRoot}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalEscalacao(false)}>
              <Icon name="close" size={22} color={colors.texto} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>{modoSubstituicao ? 'SUBSTITUIÇÃO' : 'ESCALAÇÃO'}</Text>
            {modoSubstituicao ? (
              <View style={styles.modalCounterBox}>
                <Text style={styles.modalCounterNum}>{subPares.length}</Text>
                <Text style={styles.modalCounterSep}>/</Text>
                <Text style={styles.modalCounterMax}>{MAX_SUBS}</Text>
              </View>
            ) : (
              <View style={styles.modalCounterBox}>
                <Text style={styles.modalCounterNum}>{Math.min(convocados.length, MAX_TITULARES)}</Text>
                <Text style={styles.modalCounterSep}>/</Text>
                <Text style={styles.modalCounterMax}>{MAX_TITULARES}</Text>
              </View>
            )}
          </View>

          <View style={styles.modalDicaBox}>
            <Icon name="information-outline" size={14} color={colors.textoSecundario} />
            <Text style={styles.modalDicaTxt}>
              {modoSubstituicao
                ? `Escolha quem SAI, depois quem ENTRA · máx. ${MAX_SUBS} trocas por partida`
                : `Toque para convocar · Segure para editar camisa · Primeiros ${MAX_TITULARES} = titulares`
              }
            </Text>
          </View>

          {modoSubstituicao ? (
            /* ══ MODO SUBSTITUIÇÃO ══════════════════════════════════════════════ */
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              {subPares.length > 0 && (
                <View style={{ marginBottom: 16, gap: 6 }}>
                  <Text style={[styles.sectionSubLabel, { color: colors.textoSecundario }]}>SUBSTITUIÇÕES DEFINIDAS</Text>
                  {subPares.map((par, i) => {
                    const saindo   = escalacao.find(e => e.jogador_id === par.saindo);
                    const entrando = escalacao.find(e => e.jogador_id === par.entrando);
                    return (
                      <View key={i} style={styles.cardTitular}>
                        <View style={styles.cardCamisa}><Text style={[styles.cardCamisaNum, { color: colors.vermelho }]}>{saindo?.numCamisa}</Text></View>
                        <Text style={[styles.cardNome, { flex: 1 }]} numberOfLines={1}>{saindo?.jogador.nome}</Text>
                        <Icon name="arrow-right" size={16} color={colors.primaria} />
                        <View style={styles.cardCamisa}><Text style={[styles.cardCamisaNum, { color: colors.primaria }]}>{entrando?.numCamisa}</Text></View>
                        <Text style={[styles.cardNome, { flex: 1 }]} numberOfLines={1}>{entrando?.jogador.nome}</Text>
                        <TouchableOpacity onPress={() => setSubPares(p => p.filter((_, j) => j !== i))}>
                          <Icon name="close-circle" size={18} color={colors.vermelho} />
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              )}

              {subPares.length < MAX_SUBS && (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14, marginTop: 14, backgroundColor: colors.card, borderRadius: 10, padding: 12 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: subStep === 'saindo' ? colors.fundoErro : colors.fundoBotao, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: subStep === 'saindo' ? colors.bordaErro : colors.bordaBotao }}>
                      <Icon name={subStep === 'saindo' ? 'arrow-up-circle' : 'arrow-down-circle'} size={18} color={subStep === 'saindo' ? colors.texto : colors.primaria} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowNome}>
                        {subStep === 'saindo' ? 'Quem SAI do campo?' : 'Quem ENTRA em campo?'}
                      </Text>
                      <Text style={styles.rowPos}>
                        {subStep === 'saindo'
                          ? 'Toque no titular que vai ao banco'
                          : `Substituindo: ${escalacao.find(e => e.jogador_id === subSaindo)?.jogador.nome ?? ''}`
                        }
                      </Text>
                    </View>
                    {subStep === 'entrando' && (
                      <TouchableOpacity onPress={() => { setSubStep('saindo'); setSubSaindo(null); }}>
                        <Text style={styles.sectionActionBtn}>← VOLTAR</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {subStep === 'saindo' ? (
                    escalacao
                      .filter(e => e.titular && !subPares.find(s => s.saindo === e.jogador_id))
                      .map(item => (
                        <TouchableOpacity key={item.jogador_id} style={styles.cardTitular} onPress={() => { setSubSaindo(item.jogador_id); setSubStep('entrando'); }} activeOpacity={0.8}>
                          <View style={styles.cardCamisa}><Text style={styles.cardCamisaNum}>{item.numCamisa}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardNome}>{item.jogador.nome}</Text>
                            <Text style={styles.cardPos}>{item.jogador.posicao}</Text>
                          </View>
                          <View style={styles.tagTitular}><Text style={styles.tagTitularTxt}>EM CAMPO</Text></View>
                          <Icon name="chevron-right" size={20} color={colors.textoSecundario} />
                        </TouchableOpacity>
                      ))
                  ) : (
                    escalacao
                      .filter(e => !e.titular && !subPares.find(s => s.entrando === e.jogador_id))
                      .map(item => (
                        <TouchableOpacity key={item.jogador_id} style={styles.cardBancoConvocado} onPress={() => { setSubPares(p => [...p, { saindo: subSaindo!, entrando: item.jogador_id }]); setSubStep('saindo'); setSubSaindo(null); }} activeOpacity={0.8}>
                          <View style={[styles.cardCamisa, { backgroundColor: colors.textoSecundario + '33' }]}>
                            <Text style={styles.cardCamisaNum}>{item.numCamisa}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.cardNome}>{item.jogador.nome}</Text>
                            <Text style={styles.cardPos}>{item.jogador.posicao}</Text>
                          </View>
                          <View style={styles.tagBanco}><Text style={styles.tagBancoTxt}>BANCO</Text></View>
                          <Icon name="arrow-up-circle-outline" size={20} color={colors.primaria} />
                        </TouchableOpacity>
                      ))
                  )}

                  {subPares.length > 0 && (
                    <Text style={[styles.rowPos, { textAlign: 'center', marginTop: 8 }]}>
                      {MAX_SUBS - subPares.length} troca(s) restante(s)
                    </Text>
                  )}
                </>
              )}
            </ScrollView>
          ) : disponiveis.length === 0 ? (
            /* ══ MODO NORMAL — sem jogadores ════════════════════════════════════ */
            <View style={styles.modalEmptyBox}>
              <Icon name="account-group-outline" size={48} color={colors.textoSecundario} />
              <Text style={styles.modalEmptyTxt}>Nenhum jogador encontrado</Text>
              <Text style={styles.modalEmptySubTxt}>
                Verifique se o elenco foi inscrito nessa competição em Equipes → Campeonatos.
              </Text>
            </View>
          ) : (
            /* ══ MODO NORMAL — lista de convocação ══════════════════════════════ */
            <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
              <View style={styles.modalSubHeader}>
                <View style={[styles.modalSubDot, { backgroundColor: colors.primaria }]} />
                <Text style={styles.modalSubTitle}>EM CAMPO</Text>
                <Text style={styles.modalSubCount}>{Math.min(convocados.length, MAX_TITULARES)}/{MAX_TITULARES}</Text>
              </View>

              {disponiveis.map(item => {
                const id      = Number(item.id_jogador);
                const pos     = convocados.indexOf(id);
                const titular = pos >= 0 && pos < MAX_TITULARES;
                if (!titular) return null;
                const semCamisa = !item.numCamisa || item.numCamisa <= 0;
                return (
                  <TouchableOpacity key={String(item.id_jogador)} style={[styles.cardTitular, semCamisa && { borderColor: '#F5C51860' }]} onPress={() => toggleConvocado(id)} onLongPress={() => abrirEdicaoCamisa(item)} activeOpacity={0.75}>
                    <View style={styles.cardOrdem}><Text style={styles.cardOrdemNum}>{pos + 1}</Text></View>
                    <View style={[styles.cardCamisa, semCamisa && { backgroundColor: '#F5C51820' }]}>
                      {semCamisa ? <Icon name="tshirt-crew-outline" size={18} color="#F5C518" /> : <Text style={styles.cardCamisaNum}>{item.numCamisa}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardNome}>{item.nome}</Text>
                      <Text style={styles.cardPos}>{item.posicao}{semCamisa ? ' · Segure para definir camisa' : ''}</Text>
                    </View>
                    <View style={styles.tagTitular}><Text style={styles.tagTitularTxt}>TITULAR</Text></View>
                    <Icon name="close-circle" size={20} color={colors.texto} />
                  </TouchableOpacity>
                );
              })}
              {Math.min(convocados.length, MAX_TITULARES) < MAX_TITULARES &&
                Array.from({ length: MAX_TITULARES - Math.min(convocados.length, MAX_TITULARES) }).map((_, i) => (
                  <View key={`slot-${i}`} style={styles.slotVazio}>
                    <Icon name="account-plus-outline" size={18} color={colors.textoSecundario} />
                    <Text style={styles.slotVazioTxt}>Toque em um jogador abaixo</Text>
                  </View>
                ))
              }

              <View style={styles.modalSubHeader}>
                <View style={[styles.modalSubDot, { backgroundColor: colors.textoSecundario }]} />
                <Text style={styles.modalSubTitle}>BANCO</Text>
                <Text style={styles.modalSubCount}>{Math.max(0, convocados.length - MAX_TITULARES)}</Text>
              </View>

              {disponiveis.map(item => {
                const id        = Number(item.id_jogador);
                const pos       = convocados.indexOf(id);
                const convocado = pos >= 0;
                const titular   = convocado && pos < MAX_TITULARES;
                if (titular) return null;
                const semCamisa = !item.numCamisa || item.numCamisa <= 0;
                return (
                  <TouchableOpacity key={String(item.id_jogador)} style={[styles.cardBanco, convocado && styles.cardBancoConvocado, semCamisa && convocado && { borderColor: '#F5C51850' }]} onPress={() => toggleConvocado(id)} onLongPress={() => abrirEdicaoCamisa(item)} activeOpacity={0.75}>
                    <View style={[styles.cardCamisa, convocado && { backgroundColor: colors.textoSecundario + '33' }, semCamisa && convocado && { backgroundColor: '#F5C51820' }]}>
                      {semCamisa && convocado ? <Icon name="tshirt-crew-outline" size={16} color="#F5C518" /> : <Text style={[styles.cardCamisaNum, { color: convocado ? colors.texto : colors.texto }]}>{item.numCamisa ?? '?'}</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.cardNome, !convocado && { color: colors.textoSecundario }]}>{item.nome}</Text>
                      <Text style={styles.cardPos}>{item.posicao}{semCamisa ? ' · Segure p/ definir camisa' : ''}</Text>
                    </View>
                    {convocado ? (
                      <>
                        <View style={styles.tagBanco}><Text style={styles.tagBancoTxt}>BANCO</Text></View>
                        <Icon name="close-circle" size={20} color={colors.texto} />
                      </>
                    ) : (
                      <Icon name="plus-circle-outline" size={22} color={colors.textoSecundario} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          <TouchableOpacity style={[styles.salvarBtn, (salvandoEscalacao || (modoSubstituicao ? subPares.length === 0 : disponiveis.length === 0)) && { opacity: 0.5 }]} onPress={confirmarEscalacao} disabled={salvandoEscalacao || (modoSubstituicao ? subPares.length === 0 : disponiveis.length === 0)}>
            {salvandoEscalacao ? <ActivityIndicator color="#fff" /> : <Text style={styles.salvarBtnTxt}>{modoSubstituicao ? `CONFIRMAR ${subPares.length} SUBSTITUIÇÃO(ÕES)` : `SALVAR · ${convocados.length} CONVOCADO${convocados.length !== 1 ? 'S' : ''}`}</Text>}
          </TouchableOpacity>
        </SafeAreaView>
      </Modal>

      {/* ── Modais Auxiliares (Camisa / Troca) ── */}
      <Modal visible={!!modalCamisa} transparent animationType="fade" onRequestClose={() => setModalCamisa(null)}>
        <View style={styles.mcOverlay}>
          <View style={styles.mcBox}>
            <Text style={styles.mcTitulo}>Número de Camisa</Text>
            <Text style={styles.mcSub}>{modalCamisa?.nome}</Text>
            <TextInput style={styles.mcInput} placeholder="Ex: 10" placeholderTextColor={colors.textoSecundario} value={novaCamisa} onChangeText={v => setNovaCamisa(v.replace(/\D/g, ''))} keyboardType="numeric" maxLength={2} autoFocus />
            <View style={styles.mcBtnRow}>
              <TouchableOpacity style={styles.mcBtnCancel} onPress={() => setModalCamisa(null)}><Text style={styles.mcBtnCancelTxt}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.mcBtnSave, salvandoCamisa && { opacity: 0.6 }]} onPress={salvarCamisa} disabled={salvandoCamisa}>
                {salvandoCamisa ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.mcBtnSaveTxt}>SALVAR</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!modalTroca} transparent animationType="fade" onRequestClose={() => setModalTroca(null)}>
        <View style={styles.mtOverlay}>
          <View style={styles.mtBox}>
            <View style={styles.mtIconWrap}><Icon name="tshirt-crew" size={26} color="#F5C518" /></View>
            <Text style={styles.mtTitulo}>Camisa #{modalTroca?.camisaA} em uso</Text>
            <Text style={styles.mtDesc}><Text style={styles.mtBold}>{modalTroca?.nomeB}</Text> já usa essa camisa.{'\n'}Deseja fazer a troca?</Text>
            <View style={styles.mtTrocaRow}>
              <View style={styles.mtCard}>
                <View style={styles.mtBadge}><Text style={styles.mtBadgeNum}>#{modalTroca?.camisaA}</Text></View>
                <Text style={styles.mtCardNome} numberOfLines={1}>{modalTroca?.nomeA}</Text>
              </View>
              <Icon name="swap-horizontal" size={24} color={colors.primaria} />
              <View style={styles.mtCard}>
                <View style={[styles.mtBadge, { backgroundColor: colors.cardSecundario }]}><Text style={[styles.mtBadgeNum, { color: colors.textoSecundario }]}>#{modalTroca?.camisaB || '—'}</Text></View>
                <Text style={styles.mtCardNome} numberOfLines={1}>{modalTroca?.nomeB}</Text>
              </View>
            </View>
            <View style={styles.mtBtnRow}>
              <TouchableOpacity style={styles.mtBtnCancel} onPress={() => setModalTroca(null)}><Text style={styles.mtBtnCancelTxt}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.mtBtnConfirm} onPress={modalTroca?.onConfirmar}><Icon name="check" size={15} color="#fff" /><Text style={styles.mtBtnConfirmTxt}>TROCAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
