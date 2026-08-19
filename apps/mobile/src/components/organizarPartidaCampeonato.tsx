import { Icon } from '@ludora/icons';
import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, Pressable, Image, ActivityIndicator, Alert,
} from 'react-native';

// ── Tipografia e Cores Oficiais ──
import { colors, typography } from '@ludora/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';

// ── Componentes Compartilhados ──
import { Header } from '@/src/components/Header';
import TeamSelectorCard from '@/src/components/TeamSelectorCard';
import MandoCampo from '@/src/components/mandoCampo';
import InputDataHora from '@/src/components/InputDataHora';
import EscudoTime from '@/src/components/EscudoTime';

// ── Serviços e Estilos ──
import { fetchTimes, fetchCategorias, criarPartida, atualizarPartida } from '@/src/services/api';
import { styles } from '@/src/styles/organizarPartidaCampeonatoStyles';

// ── Interfaces ──
interface Categoria { id: number; nome: string; tipo: 'INICIACAO' | 'BASE'; }
interface Time { id: number; nome: string; escudo: string | null; categoria_id: number; }
interface Competicao { id: number; nome: string; ano: number; tipo: 'INICIACAO' | 'BASE'; }

interface PartidaExistente {
  id: number; rodada: number | null; grupo: string | null;
  data: string; horario: string | null; local: string | null; emCasa: boolean;
  mandante: Time; visitante: Time; categoria: { id: number; nome: string };
}

interface PartidaPendente {
  uid: string;
  mandante: Time;
  visitante: Time;
  categoria: { id: number; nome: string };
  rodada: number;
  grupo: string | null;
  data: string;
  horario: string;
  local: string;
  emCasa: boolean;
}

interface Props {
  competicao: Competicao; partida?: PartidaExistente;
  onFechar: () => void; onSalvo: () => void;
}

const ORDEM_SUBS: Record<string, number> = {
  'SUB 7': 1,'SUB-7': 1,'SUB 8': 2,'SUB-8': 2,'SUB 9': 3,'SUB-9': 3,
  'SUB 10': 4,'SUB-10': 4,'SUB 12': 5,'SUB-12': 5,'SUB 14': 6,'SUB-14': 6,
  'SUB 16': 7,'SUB-16': 7,'SUB 18': 8,'SUB-18': 8,
};
const GRUPOS = ['A', 'B', 'C', 'D'];

function uid() { return Math.random().toString(36).slice(2); }

function dataParaInput(dataStr: string): string {
  const [, mes, dia] = dataStr.split('T')[0].split('-');
  return `${dia}/${mes}`;
}

// ── Card da Fila (Estilizado com os Design Tokens) ──
function CardPartidaPendente({
  partida, selecionada, onLongPress, modoSelecao, onPress,
}: {
  partida: PartidaPendente; selecionada: boolean;
  onLongPress: () => void; modoSelecao: boolean; onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onLongPress={onLongPress}
      onPress={onPress}
      style={{
        backgroundColor: selecionada ? colors.fundoBotao : colors.card,
        borderRadius: 12, padding: 14, marginBottom: 12,
        borderWidth: 1, borderColor: selecionada ? colors.primaria : colors.borda,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Icon name="clock-outline" size={13} color={colors.textoSecundario} />
          <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.textoSecundario, fontSize: 11 }}>
            {partida.horario}
          </Text>
          <View style={{ width: 1, height: 12, backgroundColor: colors.borda }} />
          <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 11 }}>
            {partida.categoria.nome}
          </Text>
          {partida.grupo && (
            <>
              <View style={{ width: 1, height: 12, backgroundColor: colors.borda }} />
              <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.primaria, fontSize: 11 }}>
                GRP {partida.grupo}
              </Text>
            </>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            backgroundColor: colors.cardSecundario, paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <Icon name={partida.emCasa ? 'home-outline' : 'bus'} size={11} color={colors.texto} />
            <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 10 }}>
              {partida.emCasa ? 'CASA' : 'FORA'}
            </Text>
          </View>
          {modoSelecao && (
            <View style={{
              width: 22, height: 22, borderRadius: 6,
              backgroundColor: selecionada ? colors.primaria : colors.cardSecundario,
              borderWidth: 1, borderColor: selecionada ? colors.primaria : colors.borda,
              alignItems: 'center', justifyContent: 'center',
            }}>
              {selecionada && <Icon name="check" size={13} color="#FFF" />}
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <View style={{ alignItems: 'center', flex: 1, gap: 4 }}>
          <EscudoTime escudo={partida.mandante.escudo} nome={partida.mandante.nome} size={38} />
          <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 10, textAlign: 'center', textTransform: 'uppercase' }} numberOfLines={2}>
            {partida.mandante.nome}
          </Text>
        </View>
        <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.textoSecundario, fontSize: 13, letterSpacing: 1 }}>VS</Text>
          <Text style={{ fontFamily: typography.fontFamily.corpo.regular, color: colors.textoSecundario, fontSize: 9, marginTop: 2 }}>Rodada {partida.rodada}</Text>
        </View>
        <View style={{ alignItems: 'center', flex: 1, gap: 4 }}>
          <EscudoTime escudo={partida.visitante.escudo} nome={partida.visitante.nome} size={38} />
          <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 10, textAlign: 'center', textTransform: 'uppercase' }} numberOfLines={2}>
            {partida.visitante.nome}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: colors.borda, paddingTop: 10, marginTop: 12 }}>
        <Icon name="calendar-outline" size={12} color={colors.textoSecundario} />
        <Text style={{ fontFamily: typography.fontFamily.corpo.regular, color: colors.textoSecundario, fontSize: 11 }}>
          {partida.data.split('-').reverse().join('/')}
          {partida.local ? ` • ${partida.local}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function OrganizarPartidaCampeonato({ competicao, partida, onFechar, onSalvo }: Props) {
  const modoEdicao = !!partida;

  // ── Estados ──
  const [times, setTimes] = useState<Time[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [categoriaId, setCategoriaId] = useState<number | null>(partida?.categoria.id ?? null);
  const [mandante, setMandante] = useState<Time | null>(partida?.mandante ?? null);
  const [visitante, setVisitante] = useState<Time | null>(partida?.visitante ?? null);
  const [modalTime, setModalTime] = useState<'mandante' | 'visitante' | null>(null);
  const [buscaTime, setBuscaTime] = useState('');
  
  const [rodada, setRodada] = useState(partida?.rodada ? String(partida.rodada) : '');
  const [grupo, setGrupo] = useState<string | null>(partida?.grupo ?? null);
  const [data, setData] = useState(partida?.data ? dataParaInput(partida.data) : '');
  const [horario, setHorario] = useState(partida?.horario ?? '');
  const [local, setLocal] = useState(partida?.local ?? '');
  const [emCasa, setEmCasa] = useState(partida?.emCasa ?? true);
  
  const [salvando, setSalvando] = useState(false);
  const ehBase = competicao.tipo === 'BASE';

  const [partidasPendentes, setPartidasPendentes] = useState<PartidaPendente[]>([]);
  const [modalRevisao, setModalRevisao] = useState(false);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [modoSelecao, setModoSelecao] = useState(false);
  const [enviandoTudo, setEnviandoTudo] = useState(false);

  useEffect(() => {
    Promise.all([fetchTimes(), fetchCategorias()])
      .then(([timesData, catData]) => {
        setTimes(timesData);
        const catFiltradas: Categoria[] = catData
          .filter((c: Categoria) => c.tipo === competicao.tipo)
          .sort((a: Categoria, b: Categoria) => (ORDEM_SUBS[a.nome.toUpperCase()] ?? 99) - (ORDEM_SUBS[b.nome.toUpperCase()] ?? 99));
        setCategorias(catFiltradas);
        if (!partida && catFiltradas.length > 0) setCategoriaId(catFiltradas[0].id);
      })
      .catch(console.error)
      .finally(() => setCarregando(false));
  }, []);

  const timesFiltrados = times.filter(t =>
    t.categoria_id === categoriaId && t.nome.toLowerCase().includes(buscaTime.toLowerCase())
  );
  
  const categoriaAtual = categorias.find(c => c.id === categoriaId);
  const isValido = !!(mandante && visitante && categoriaId && rodada && data.length === 5 && horario.length === 5 && (!ehBase || grupo));

  const selecionarTime = (time: Time) => {
    if (modalTime === 'mandante') setMandante(time); else setVisitante(time);
    setModalTime(null); setBuscaTime('');
  };

  const handleDataChange = (text: string) => {
    const n = text.replace(/\D/g, '');
    setData(n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2, 4)}` : n);
  };

  const handleHorarioChange = (text: string) => {
    const n = text.replace(/\D/g, '');
    setHorario(n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2, 4)}` : n);
  };

  const resetarFormulario = () => {
    setMandante(null); setVisitante(null); setData(''); setHorario('');
    setLocal(''); setEmCasa(true); setGrupo(null);
    setRodada(r => r ? String(Number(r) + 1) : '1');
  };

  const salvarEdicao = async () => {
    if (!isValido) return;
    setSalvando(true);
    try {
      const [dia, mes] = data.split('/');
      const dataISO = `${new Date().getFullYear()}-${mes}-${dia}`;
      await atualizarPartida(partida!.id, {
        mandante_id: mandante!.id, visitante_id: visitante!.id,
        data: dataISO, horario, local, emCasa, categoria_id: categoriaId!,
        rodada: Number(rodada), grupo: grupo ?? undefined,
      });
      onSalvo(); onFechar();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  };

  const adicionarNaFila = () => {
    if (!isValido) return;
    const [dia, mes] = data.split('/');
    const dataISO = `${new Date().getFullYear()}-${mes}-${dia}`;
    const cat = categorias.find(c => c.id === categoriaId)!;

    const nova: PartidaPendente = {
      uid: uid(), mandante: mandante!, visitante: visitante!,
      categoria: { id: cat.id, nome: cat.nome },
      rodada: Number(rodada), grupo, data: dataISO, horario, local, emCasa,
    };

    setPartidasPendentes(prev => [...prev, nova]);
    resetarFormulario();
  };

  const enviarTudo = async () => {
    if (partidasPendentes.length === 0) return;
    setEnviandoTudo(true);
    try {
      await Promise.all(
        partidasPendentes.map(p =>
          criarPartida({
            mandante_id: p.mandante.id, visitante_id: p.visitante.id,
            data: p.data, horario: p.horario, local: p.local,
            emCasa: p.emCasa, categoria_id: p.categoria.id,
            competicao_id: competicao.id, rodada: p.rodada, grupo: p.grupo ?? undefined,
          })
        )
      );
      setModalRevisao(false); onSalvo(); onFechar();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar algumas partidas.');
    } finally { setEnviandoTudo(false); }
  };

  const toggleSelecao = (uid: string) => {
    setSelecionadas(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      if (next.size === 0) setModoSelecao(false);
      return next;
    });
  };

  const ativarModoSelecao = (uid: string) => {
    setModoSelecao(true); setSelecionadas(new Set([uid]));
  };

  const removerSelecionadas = () => {
    Alert.alert('Remover partidas', `Remover ${selecionadas.size} partida(s)?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => {
          setPartidasPendentes(prev => prev.filter(p => !selecionadas.has(p.uid)));
          setSelecionadas(new Set()); setModoSelecao(false);
      }},
    ]);
  };

  const cancelarSelecao = () => { setSelecionadas(new Set()); setModoSelecao(false); };

  return (
    <View style={styles.container}>
      <Header
        title={modoEdicao ? 'EDITAR PARTIDA' : competicao.nome}
        showLogo={false} showProfile={false}
        btnVoltar="arrow-left" onBtnVoltar={onFechar} semSafeArea
      />

      {modoEdicao && (
        <View style={styles.editBanner}>
          <Icon name="pencil-circle" size={15} color={colors.amarelo} />
          <Text style={styles.editBannerTxt}>{competicao.nome} • Rodada {partida?.rodada ?? '—'}</Text>
        </View>
      )}

      {!modoEdicao && partidasPendentes.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setModalRevisao(true)}
          style={styles.filaPendenteAlerta}
        >
          <View style={styles.filaBadgeNum}>
            <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: '#FFF', fontSize: 11 }}>{partidasPendentes.length}</Text>
          </View>
          <Text style={styles.filaPendenteTexto}>
            {partidasPendentes.length === 1 ? '1 partida aguardando' : `${partidasPendentes.length} partidas aguardando`}
          </Text>
          <Icon name="chevron-right" size={16} color={colors.primaria} />
        </TouchableOpacity>
      )}

      {carregando ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primaria} />
          <Text style={styles.loadingTxt}>Carregando dados...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: 6, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >

          <Text style={styles.sectionLabel}>CATEGORIA</Text>
          {modoEdicao ? (
            <View style={styles.categoriaLocked}>
              <Icon name="lock-outline" size={14} color={colors.textoSecundario} />
              <Text style={styles.categoriaLockedNome}>{categorias.find(c => c.id === categoriaId)?.nome ?? partida?.categoria.nome}</Text>
              <Text style={styles.categoriaLockedSub}>Não pode ser alterada</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {categorias.map(cat => (
                <TouchableOpacity key={cat.id} style={[styles.pill, categoriaId === cat.id && styles.pillActive]}
                  onPress={() => { setCategoriaId(cat.id); setMandante(null); setVisitante(null); }}>
                  <Text style={[styles.pillText, categoriaId === cat.id && styles.pillTextActive]}>{cat.nome.replace('SUB', 'sub')}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          <Text style={styles.sectionLabel}>RODADA</Text>
          <View style={styles.stepperContainer}>
            <TouchableOpacity
              style={[styles.stepperBtn, Number(rodada) > 1 && styles.stepperBtnAtivo, Number(rodada) <= 1 && styles.stepperBtnDisabled]}
              onPress={() => setRodada(r => String(Math.max(1, Number(r) - 1)))}
              disabled={Number(rodada) <= 1}
              activeOpacity={0.7}
            >
              <Icon name="minus" size={18} color={Number(rodada) > 1 ? colors.primaria : colors.textoSecundario} />
            </TouchableOpacity>
            <View style={styles.stepperDivider} />
            <View style={styles.stepperValue}>
              <Text style={[styles.stepperValueTxt, Number(rodada) === 0 && styles.stepperValueZero]}>
                {rodada || '—'}
              </Text>
            </View>
            <View style={styles.stepperDivider} />
            <TouchableOpacity
              style={[styles.stepperBtn, styles.stepperBtnAtivo]}
              onPress={() => setRodada(r => String(Number(r || '0') + 1))}
              activeOpacity={0.7}
            >
              <Icon name="plus" size={18} color={colors.primaria} />
            </TouchableOpacity>
          </View>

          {ehBase && (
            <>
              <Text style={styles.sectionLabel}>GRUPO</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {GRUPOS.map(g => (
                  <TouchableOpacity
                    key={g}
                    style={[styles.grupoPill, grupo === g && styles.grupoPillAtivo]}
                    onPress={() => setGrupo(g)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.grupoPillTxt, grupo === g && styles.grupoPillTxtAtivo]}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>CONFRONTO</Text>
          <View style={styles.confrontoContainer}>
            <TeamSelectorCard 
                time={mandante} 
                tipo="MANDANTE" 
                onPress={() => setModalTime('mandante')} 
            />
            <View style={styles.vsBadgeContainer}>
                <Text style={styles.vsText}>VS</Text>
            </View>
            <TeamSelectorCard 
                time={visitante} 
                tipo="VISITANTE" 
                onPress={() => setModalTime('visitante')} 
            />
          </View>

          <Text style={styles.sectionLabel}>MANDO DE CAMPO</Text>
          <MandoCampo emCasa={emCasa} onChange={setEmCasa} />

          <InputDataHora data={data} horario={horario} onChangeData={handleDataChange} onChangeHorario={handleHorarioChange} />

          <Text style={styles.sectionLabel}>LOCAL DA PARTIDA</Text>
          <View style={styles.inputRow}>
            <Icon name="map-marker-outline" size={18} color={colors.textoSecundario} />
            <TextInput style={[styles.inputText, { flex: 1 }]} placeholder="Ginásio, quadra ou campo..." placeholderTextColor={colors.textoSecundario} value={local} onChangeText={setLocal} />
          </View>

          {isValido && (
            <View style={styles.resumoCard}>
              <View style={styles.resumoRow}>
                <Icon name="check-circle" size={14} color="#6FCF97" />
                <Text style={styles.resumoTxt} numberOfLines={1}>{mandante?.nome} vs {visitante?.nome}</Text>
              </View>
              <View style={styles.resumoRow}>
                <Icon name="check-circle" size={14} color="#6FCF97" />
                <Text style={styles.resumoTxt}>{data} às {horario}{rodada ? ` • Rodada ${rodada}` : ''}{local ? ` • ${local}` : ''}</Text>
              </View>
            </View>
          )}

          {modoEdicao ? (
            <TouchableOpacity
              activeOpacity={0.85} onPress={salvarEdicao}
              style={[styles.salvarBtn, { marginTop: isValido ? 16 : 32 }, !isValido && { opacity: 0.4 }]}
              disabled={!isValido || salvando}
            >
              <LinearGradient colors={[colors.primaria, '#0055FF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                {salvando ? <ActivityIndicator color="#FFF" /> : (
                  <View style={styles.salvarBtnInner}>
                    <Icon name="content-save-edit-outline" size={18} color="#FFF" />
                    <Text style={styles.salvarText}>SALVAR ALTERAÇÕES</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: isValido ? 16 : 32, gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85} onPress={adicionarNaFila}
                style={[
                  { borderRadius: 10, borderWidth: 1, borderColor: isValido ? colors.bordaBotao : colors.borda, paddingVertical: 15, alignItems: 'center', backgroundColor: isValido ? colors.fundoBotao : 'transparent' },
                  !isValido && { opacity: 0.35 },
                ]}
                disabled={!isValido}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Icon name="plus-circle-outline" size={18} color={isValido ? colors.primaria : colors.textoSecundario} />
                  <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: isValido ? colors.primaria : colors.textoSecundario, fontSize: 14, letterSpacing: 1 }}>
                    ADICIONAR E CRIAR OUTRA
                  </Text>
                </View>
              </TouchableOpacity>

              {(partidasPendentes.length > 0 || isValido) && (
                <TouchableOpacity
                  activeOpacity={0.85}
                  onPress={() => {
                    if (isValido) adicionarNaFila();
                    setTimeout(() => setModalRevisao(true), 50);
                  }}
                  style={[styles.salvarBtn, { marginTop: 0 }]}
                >
                  <LinearGradient colors={[colors.primaria, '#0055FF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                    <View style={styles.salvarBtnInner}>
                      <Icon name="check-all" size={18} color="#FFF" />
                      <Text style={styles.salvarText}>
                        FINALIZAR{partidasPendentes.length > 0 ? ` (${isValido ? partidasPendentes.length + 1 : partidasPendentes.length})` : ''}
                      </Text>
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}

          <View style={{ height: 40 }} />
        </ScrollView>
      )}

      {/* ── MODAL DE SELEÇÃO DE TIME (PADRÃO ORGANIZAR PARTIDAS) ── */}
      <Modal visible={modalTime !== null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setModalTime(null); setBuscaTime(''); }}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTime === 'mandante' ? 'Selecionar mandante' : 'Selecionar visitante'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setModalTime(null); setBuscaTime(''); }}>
                <Icon name="close" size={18} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <View style={styles.buscaContainer}>
              <Icon name="magnify" size={20} color={colors.textoSecundario} />
              <TextInput style={styles.buscaText} placeholder="Buscar time..." placeholderTextColor={colors.textoSecundario} value={buscaTime} onChangeText={setBuscaTime} autoFocus />
            </View>
            {categoriaAtual && (
                <Text style={styles.subCategoriaText}>{categoriaAtual.nome} · {categoriaAtual.tipo}</Text>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
              {timesFiltrados.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                  <Icon name="shield-off-outline" size={36} color={colors.textoSecundario} />
                  <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.textoSecundario, fontSize: 13 }}>Nenhum time encontrado</Text>
                </View>
              ) : (
                timesFiltrados.map((time, index) => {
                  const sel = modalTime === 'mandante' ? mandante?.id === time.id : visitante?.id === time.id;
                  const iconColors = ['#0E78FF', '#F0B84E', '#FF4D00', '#2E7D32'];
                  const timeColor = sel ? colors.primaria : iconColors[index % iconColors.length];

                  return (
                    <TouchableOpacity key={time.id} style={[styles.modalItem, sel && styles.modalItemActive]} onPress={() => selecionarTime(time)} activeOpacity={0.7}>
                      <View style={[styles.modalIconCircle, { backgroundColor: sel ? colors.primaria : colors.cardSecundario }]}>
                          {time.escudo ? (
                               <Image source={{ uri: time.escudo }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                          ) : (
                              <Icon name={sel ? "shield-check" : "shield"} size={20} color={sel ? '#FFF' : timeColor} />
                          )}
                      </View>
                      <View style={{ flex: 1 }}>
                          <Text style={styles.modalItemText}>{time.nome}</Text>
                          <Text style={styles.modalItemSub}>{sel ? (modalTime === 'mandante' ? 'Mandante de casa' : 'Visitante convidado') : ((Math.floor(Math.random() * 8) + 2) + ' partidas na competição')}</Text>
                      </View>
                      {sel ? (
                          <Icon name="check-circle" size={24} color={colors.primaria} />
                      ) : (
                          <Icon name="circle-outline" size={24} color={colors.borda} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      {/* ── MODAL DE REVISÃO DA FILA ── */}
      <Modal visible={modalRevisao} transparent={false} animationType="slide" onRequestClose={() => { if (!enviandoTudo) { cancelarSelecao(); setModalRevisao(false); } }}>
        <View style={{ flex: 1, backgroundColor: colors.fundo }}>
          <View style={{
            paddingTop: 56, paddingBottom: 16, paddingHorizontal: 20,
            borderBottomWidth: 1, borderBottomColor: colors.borda,
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            {modoSelecao ? (
              <>
                <TouchableOpacity onPress={cancelarSelecao} style={styles.closeBtn}>
                  <Icon name="close" size={22} color={colors.texto} />
                </TouchableOpacity>
                <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 16, flex: 1 }}>
                  {selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  onPress={removerSelecionadas}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: colors.fundoErro, paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 10, borderWidth: 1, borderColor: colors.bordaErro,
                  }}
                >
                  <Icon name="trash-can-outline" size={16} color={colors.vermelho} />
                  <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.vermelho, fontSize: 12 }}>REMOVER</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setModalRevisao(false)} style={styles.closeBtn}>
                  <Icon name="arrow-left" size={22} color={colors.texto} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 17 }}>
                    Revisar Partidas
                  </Text>
                  <Text style={{ fontFamily: typography.fontFamily.corpo.regular, color: colors.textoSecundario, fontSize: 11, marginTop: 1 }}>
                    {competicao.nome} • {partidasPendentes.length} partida{partidasPendentes.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.fundoBotao, paddingHorizontal: 10,
                  paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.bordaBotao,
                }}>
                  <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.primaria, fontSize: 11, letterSpacing: 0.5 }}>
                    SEGURAR = SELECIONAR
                  </Text>
                </View>
              </>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 120 }}>
            {partidasPendentes.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
                <Icon name="soccer" size={48} color={colors.textoSecundario} />
                <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.textoSecundario, fontSize: 14, letterSpacing: 1 }}>
                  NENHUMA PARTIDA NA FILA
                </Text>
              </View>
            ) : (
              partidasPendentes.map(p => (
                <CardPartidaPendente
                  key={p.uid} partida={p} selecionada={selecionadas.has(p.uid)}
                  modoSelecao={modoSelecao} onLongPress={() => ativarModoSelecao(p.uid)}
                  onPress={() => { if (modoSelecao) toggleSelecao(p.uid); }}
                />
              ))
            )}
          </ScrollView>

          {!modoSelecao && partidasPendentes.length > 0 && (
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: 20, paddingBottom: 36, backgroundColor: colors.fundo,
              borderTopWidth: 1, borderTopColor: colors.borda,
            }}>
              <TouchableOpacity activeOpacity={0.85} onPress={enviandoTudo ? undefined : enviarTudo} style={[styles.salvarBtn, { marginTop: 0 }]} disabled={enviandoTudo}>
                <LinearGradient colors={[colors.primaria, '#0055FF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                  {enviandoTudo ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={styles.salvarBtnInner}>
                      <Icon name="cloud-upload-outline" size={18} color="#FFF" />
                      <Text style={styles.salvarText}>
                        SALVAR {partidasPendentes.length} PARTIDA{partidasPendentes.length !== 1 ? 'S' : ''}
                      </Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}