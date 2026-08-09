import React, { useState, useEffect } from 'react';

import {
  View, Text, TouchableOpacity, ScrollView, TextInput,
  Modal, Pressable, Image, ActivityIndicator, Alert,
} from 'react-native';

import { Header } from '@/src/components/Header';
import { colors } from '@/src/theme/colors';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchTimes, fetchCategorias, criarPartida, atualizarPartida } from '@/src/services/api';
import { styles } from '@/src/styles/organizarPartidaCampeonatoStyles';

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

function EscudoTime({ escudo, nome, size = 40 }: { escudo: string | null; nome: string; size?: number }) {
  if (escudo) return <Image source={{ uri: escudo }} style={{ width: size, height: size, resizeMode: 'contain', borderRadius: size * 0.2 }} />;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.25, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' }}>
      <Text style={{ color: colors.text_secondary, fontFamily: 'Creato-Bold', fontSize: size * 0.28 }}>
        {nome.split(' ').map(p => p[0]).join('').slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
}

function dataParaInput(dataStr: string): string {
  const [, mes, dia] = dataStr.split('T')[0].split('-');
  return `${dia}/${mes}`;
}

function CardPartidaPendente({
  partida,
  selecionada,
  onLongPress,
  modoSelecao,
  onPress,
}: {
  partida: PartidaPendente;
  selecionada: boolean;
  onLongPress: () => void;
  modoSelecao: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onLongPress={onLongPress}
      onPress={onPress}
      style={{
        backgroundColor: selecionada ? colors.primary + '12' : '#1a1a1a',
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: selecionada ? colors.primary : '#2a2a2a',
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <MaterialCommunityIcons name="clock-outline" size={13} color={colors.text_secondary} />
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11 }}>
            {partida.horario}
          </Text>
          <View style={{ width: 1, height: 12, backgroundColor: '#2a2a2a' }} />
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 11 }}>
            {partida.categoria.nome}
          </Text>
          {partida.grupo && (
            <>
              <View style={{ width: 1, height: 12, backgroundColor: '#2a2a2a' }} />
              <Text style={{ fontFamily: 'Creato-Bold', color: colors.azulClaro, fontSize: 11 }}>
                GRP {partida.grupo}
              </Text>
            </>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{
            backgroundColor: colors.secondary,
            paddingHorizontal: 8, paddingVertical: 3,
            borderRadius: 6, flexDirection: 'row', alignItems: 'center', gap: 4,
          }}>
            <MaterialCommunityIcons name={partida.emCasa ? 'home-outline' : 'bus'} size={11} color={colors.text} />
            <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 10 }}>
              {partida.emCasa ? 'CASA' : 'FORA'}
            </Text>
          </View>
          {modoSelecao && (
            <View style={{
              width: 22, height: 22, borderRadius: 6,
              backgroundColor: selecionada ? colors.primary : '#2a2a2a',
              borderWidth: 1.5, borderColor: selecionada ? colors.primary : '#3a3a3a',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {selecionada && <MaterialCommunityIcons name="check" size={13} color="#FFF" />}
            </View>
          )}
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <View style={{ alignItems: 'center', flex: 1, gap: 4 }}>
          <EscudoTime escudo={partida.mandante.escudo} nome={partida.mandante.nome} size={38} />
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 10, textAlign: 'center', textTransform: 'uppercase' }} numberOfLines={2}>
            {partida.mandante.nome}
          </Text>
        </View>

        <View style={{ alignItems: 'center', paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13, letterSpacing: 1 }}>VS</Text>
          <Text style={{ fontFamily: 'Creato-Regular', color: '#444', fontSize: 9, marginTop: 2 }}>Rodada {partida.rodada}</Text>
        </View>

        <View style={{ alignItems: 'center', flex: 1, gap: 4 }}>
          <EscudoTime escudo={partida.visitante.escudo} nome={partida.visitante.nome} size={38} />
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 10, textAlign: 'center', textTransform: 'uppercase' }} numberOfLines={2}>
            {partida.visitante.nome}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, borderTopWidth: 1, borderTopColor: '#222', paddingTop: 10, marginTop: 12 }}>
        <MaterialCommunityIcons name="calendar-outline" size={12} color="#555" />
        <Text style={{ fontFamily: 'Creato-Regular', color: '#555', fontSize: 11 }}>
          {partida.data.split('-').reverse().join('/')}
          {partida.local ? ` • ${partida.local}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
export default function OrganizarPartidaCampeonato({ competicao, partida, onFechar, onSalvo }: Props) {
  const modoEdicao = !!partida;

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
    setMandante(null);
    setVisitante(null);
    setData('');
    setHorario('');
    setLocal('');
    setEmCasa(true);
    setGrupo(null);
    setRodada(r => r ? String(Number(r) + 1) : '1');
  };

  const salvarEdicao = async () => {
    if (!mandante || !visitante || !categoriaId || !rodada) return;
    if (data.length < 5 || horario.length < 5) return;
    if (ehBase && !grupo) return Alert.alert('Atenção', 'Selecione o grupo da partida.');
    setSalvando(true);
    try {
      const [dia, mes] = data.split('/');
      const dataISO = `${new Date().getFullYear()}-${mes}-${dia}`;
      await atualizarPartida(partida!.id, {
        mandante_id: mandante.id, visitante_id: visitante.id,
        data: dataISO, horario, local, emCasa, categoria_id: categoriaId,
        rodada: Number(rodada), grupo: grupo ?? undefined,
      });
      onSalvo(); onFechar();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally { setSalvando(false); }
  };

  const adicionarNaFila = () => {
    if (!mandante || !visitante || !categoriaId || !rodada) return;
    if (data.length < 5 || horario.length < 5) return;
    if (ehBase && !grupo) return Alert.alert('Atenção', 'Selecione o grupo da partida.');

    const [dia, mes] = data.split('/');
    const dataISO = `${new Date().getFullYear()}-${mes}-${dia}`;
    const cat = categorias.find(c => c.id === categoriaId)!;

    const nova: PartidaPendente = {
      uid: uid(),
      mandante, visitante,
      categoria: { id: cat.id, nome: cat.nome },
      rodada: Number(rodada),
      grupo, data: dataISO, horario, local, emCasa,
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
            competicao_id: competicao.id, rodada: p.rodada,
            grupo: p.grupo ?? undefined,
          })
        )
      );
      setModalRevisao(false);
      onSalvo();
      onFechar();
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
    setModoSelecao(true);
    setSelecionadas(new Set([uid]));
  };

  const removerSelecionadas = () => {
    Alert.alert(
      'Remover partidas',
      `Remover ${selecionadas.size} partida(s) da lista?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover', style: 'destructive',
          onPress: () => {
            setPartidasPendentes(prev => prev.filter(p => !selecionadas.has(p.uid)));
            setSelecionadas(new Set());
            setModoSelecao(false);
          },
        },
      ]
    );
  };

  const cancelarSelecao = () => {
    setSelecionadas(new Set());
    setModoSelecao(false);
  };

  const isValido = !!(mandante && visitante && categoriaId && rodada && data.length === 5 && horario.length === 5 && (!ehBase || grupo));

  return (
    <View style={styles.container}>
      <Header
        title={modoEdicao ? 'EDITAR PARTIDA' : competicao.nome}
        showLogo={false} showProfile={false}
        btnVoltar="arrow-left" onBtnVoltar={onFechar} semSafeArea
      />

      {modoEdicao && (
        <View style={styles.editBanner}>
          <MaterialCommunityIcons name="pencil-circle" size={15} color={colors.amarelo} />
          <Text style={styles.editBannerTxt}>{competicao.nome} • Rodada {partida?.rodada ?? '—'}</Text>
        </View>
      )}

      {!modoEdicao && partidasPendentes.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => setModalRevisao(true)}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: 10,
            backgroundColor: colors.primary + '15',
            borderBottomWidth: 1, borderBottomColor: colors.primary + '25',
            paddingHorizontal: 20, paddingVertical: 10,
          }}
        >
          <View style={{
            width: 22, height: 22, borderRadius: 11,
            backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
          }}>
            <Text style={{ fontFamily: 'Creato-Bold', color: '#FFF', fontSize: 11 }}>
              {partidasPendentes.length}
            </Text>
          </View>
          <Text style={{ fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 12, letterSpacing: 0.5, flex: 1 }}>
            {partidasPendentes.length === 1
              ? '1 partida aguardando'
              : `${partidasPendentes.length} partidas aguardando`}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={16} color={colors.primary} />
        </TouchableOpacity>
      )}

      {carregando ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTxt}>Carregando dados...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.content, { paddingTop: 6, paddingBottom: 40 }]}
          keyboardShouldPersistTaps="handled"
        >

          {/* CATEGORIA */}
          <Text style={styles.sectionLabel}>CATEGORIA</Text>
          {modoEdicao ? (
            <View style={styles.categoriaLocked}>
              <MaterialCommunityIcons name="lock-outline" size={14} color="#444" />
              <Text style={styles.categoriaLockedNome}>{categorias.find(c => c.id === categoriaId)?.nome ?? partida?.categoria.nome}</Text>
              <Text style={styles.categoriaLockedSub}>Não pode ser alterada</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
              {categorias.map(cat => (
                <TouchableOpacity key={cat.id} style={[styles.pill, categoriaId === cat.id && styles.pillActive]}
                  onPress={() => { setCategoriaId(cat.id); setMandante(null); setVisitante(null); }}>
                  <Text style={[styles.pillText, categoriaId === cat.id && styles.pillTextActive]}>{cat.nome}</Text>
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
              <MaterialCommunityIcons name="minus" size={18} color={Number(rodada) > 1 ? colors.primary : colors.text_secondary} />
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
              <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
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
            {(['mandante', 'visitante'] as const).map((tipo, index) => {
              const time = tipo === 'mandante' ? mandante : visitante;
              return (
                <React.Fragment key={tipo}>
                  <TouchableOpacity style={[styles.timeCard, time !== null && styles.timeCardSelecionado]} activeOpacity={0.8} onPress={() => setModalTime(tipo)}>
                    {time ? (
                      <>
                        <EscudoTime escudo={time.escudo} nome={time.nome} size={48} />
                        <Text style={styles.timeCardLabel}>{tipo === 'mandante' ? 'MANDANTE' : 'VISITANTE'}</Text>
                        <Text style={styles.timeCardNome} numberOfLines={2}>{time.nome}</Text>
                        <View style={styles.trocarBtn}>
                          <MaterialCommunityIcons name="swap-horizontal" size={11} color={colors.azulClaro} />
                          <Text style={styles.trocarTxt}>TROCAR</Text>
                        </View>
                      </>
                    ) : (
                      <>
                        <View style={[styles.addIconCircle, styles.addCircle]}>
                          <MaterialCommunityIcons name="plus" size={26} color={colors.primary} />
                        </View>
                        <Text style={styles.timeCardLabel}>{tipo === 'mandante' ? 'MANDANTE' : 'VISITANTE'}</Text>
                        <Text style={[styles.timeCardSub, { color: colors.primary + 'aa' }]}>Selecionar time</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  {index === 0 && (
                    <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={styles.vsBadge}>
                      <Text style={styles.vsText}>VS</Text>
                    </LinearGradient>
                  )}
                </React.Fragment>
              );
            })}
          </View>

          <Text style={styles.sectionLabel}>MANDO DE CAMPO</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {[{ label: 'EM CASA', icon: 'home-outline', value: true }, { label: 'FORA', icon: 'bus-side', value: false }].map(opt => (
              <TouchableOpacity key={opt.label} style={[styles.mandoBtn, emCasa === opt.value && styles.mandoBtnAtivo]} onPress={() => setEmCasa(opt.value)} activeOpacity={0.8}>
                <MaterialCommunityIcons name={opt.icon as any} size={18} color={emCasa === opt.value ? colors.primary : colors.text_secondary} />
                <Text style={[styles.mandoTxt, emCasa === opt.value && styles.mandoTxtAtivo]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.rowDuplo}>
            <View style={styles.halfBlock}>
              <Text style={styles.sectionLabel}>DATA</Text>
              <View style={styles.inputRow}>
                <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.text_secondary} />
                <TextInput style={styles.inputText} placeholder="DD/MM" placeholderTextColor={colors.text_secondary} value={data} onChangeText={handleDataChange} keyboardType="numeric" maxLength={5} />
              </View>
            </View>
            <View style={styles.halfBlock}>
              <Text style={styles.sectionLabel}>HORÁRIO</Text>
              <View style={styles.inputRow}>
                <MaterialCommunityIcons name="clock-outline" size={18} color={colors.text_secondary} />
                <TextInput style={styles.inputText} placeholder="00:00" placeholderTextColor={colors.text_secondary} value={horario} onChangeText={handleHorarioChange} keyboardType="numeric" maxLength={5} />
              </View>
            </View>
          </View>

          <Text style={styles.sectionLabel}>LOCAL DA PARTIDA</Text>
          <View style={styles.inputRow}>
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.text_secondary} />
            <TextInput style={[styles.inputText, { flex: 1 }]} placeholder="Ginásio, quadra ou campo..." placeholderTextColor={colors.text_secondary} value={local} onChangeText={setLocal} />
          </View>

          {isValido && (
            <View style={styles.resumoCard}>
              <View style={styles.resumoRow}>
                <MaterialCommunityIcons name="check-circle" size={13} color="#6FCF97" />
                <Text style={styles.resumoTxt} numberOfLines={1}>{mandante?.nome} vs {visitante?.nome}</Text>
              </View>
              <View style={styles.resumoRow}>
                <MaterialCommunityIcons name="check-circle" size={13} color="#6FCF97" />
                <Text style={styles.resumoTxt}>{data} às {horario}{rodada ? ` • Rodada ${rodada}` : ''}{local ? ` • ${local}` : ''}</Text>
              </View>
            </View>
          )}

          {modoEdicao ? (
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={salvarEdicao}
              style={[styles.salvarBtn, { marginTop: isValido ? 16 : 32 }, !isValido && { opacity: 0.4 }]}
              disabled={!isValido || salvando}
            >
              <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                {salvando ? <ActivityIndicator color="#FFF" /> : (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <MaterialCommunityIcons name="content-save-edit-outline" size={18} color="#FFF" />
                    <Text style={styles.salvarText}>SALVAR ALTERAÇÕES</Text>
                  </View>
                )}
              </LinearGradient>
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: isValido ? 16 : 32, gap: 10 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={adicionarNaFila}
                style={[
                  {
                    borderRadius: 14, overflow: 'hidden',
                    borderWidth: 1.5, borderColor: isValido ? colors.primary + '55' : '#2a2a2a',
                    paddingVertical: 15, alignItems: 'center',
                    backgroundColor: isValido ? colors.primary + '10' : 'transparent',
                  },
                  !isValido && { opacity: 0.35 },
                ]}
                disabled={!isValido}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <MaterialCommunityIcons name="plus-circle-outline" size={18} color={isValido ? colors.primary : colors.text_secondary} />
                  <Text style={{ fontFamily: 'Creato-Bold', color: isValido ? colors.primary : colors.text_secondary, fontSize: 14, letterSpacing: 1 }}>
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
                  <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialCommunityIcons name="check-all" size={18} color="#FFF" />
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

      <Modal visible={modalTime !== null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setModalTime(null); setBuscaTime(''); }}>
          <Pressable style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.handle}><View style={styles.handleBar} /></View>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{modalTime === 'mandante' ? 'Selecionar Mandante' : 'Selecionar Visitante'}</Text>
                <Text style={styles.modalSub}>{categorias.find(c => c.id === categoriaId)?.nome ?? ''}</Text>
              </View>
              <TouchableOpacity onPress={() => { setModalTime(null); setBuscaTime(''); }}>
                <MaterialCommunityIcons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>
            <View style={[styles.inputRow, { marginBottom: 12 }]}>
              <MaterialCommunityIcons name="magnify" size={18} color={colors.text_secondary} />
              <TextInput style={[styles.inputText, { flex: 1 }]} placeholder="Buscar time..." placeholderTextColor={colors.text_secondary} value={buscaTime} onChangeText={setBuscaTime} autoFocus />
              {buscaTime.length > 0 && (
                <TouchableOpacity onPress={() => setBuscaTime('')}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={colors.text_secondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {timesFiltrados.length === 0 ? (
                <View style={{ alignItems: 'center', paddingVertical: 32, gap: 8 }}>
                  <MaterialCommunityIcons name="shield-off-outline" size={36} color="#2a2a2a" />
                  <Text style={{ fontFamily: 'Creato-Bold', color: '#333', fontSize: 13 }}>Nenhum time encontrado</Text>
                  <Text style={{ fontFamily: 'Creato-Bold', color: '#2a2a2a', fontSize: 11, textAlign: 'center' }}>Cadastre times para esta categoria em Equipes</Text>
                </View>
              ) : (
                timesFiltrados.map(time => {
                  const sel = modalTime === 'mandante' ? mandante?.id === time.id : visitante?.id === time.id;
                  return (
                    <TouchableOpacity key={time.id} style={[styles.modalItem, sel && styles.modalItemActive]} onPress={() => selecionarTime(time)} activeOpacity={0.7}>
                      <EscudoTime escudo={time.escudo} nome={time.nome} size={36} />
                      <Text style={[styles.modalItemText, sel && styles.modalItemTextActive, { flex: 1 }]}>{time.nome}</Text>
                      {sel && <View style={styles.checkBadge}><MaterialCommunityIcons name="check" size={14} color={colors.primary} /></View>}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={modalRevisao}
        transparent={false}
        animationType="slide"
        onRequestClose={() => { if (!enviandoTudo) { cancelarSelecao(); setModalRevisao(false); } }}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{
            paddingTop: 56, paddingBottom: 16,
            paddingHorizontal: 20,
            borderBottomWidth: 1, borderBottomColor: '#1e1e1e',
            flexDirection: 'row', alignItems: 'center', gap: 12,
          }}>
            {modoSelecao ? (
              <>
                <TouchableOpacity onPress={cancelarSelecao} style={{ padding: 4 }}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16, flex: 1 }}>
                  {selecionadas.size} selecionada{selecionadas.size !== 1 ? 's' : ''}
                </Text>
                <TouchableOpacity
                  onPress={removerSelecionadas}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 6,
                    backgroundColor: colors.vermelho + '15',
                    paddingHorizontal: 14, paddingVertical: 8,
                    borderRadius: 10, borderWidth: 1, borderColor: colors.vermelho + '30',
                  }}
                >
                  <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.vermelho} />
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.vermelho, fontSize: 12 }}>REMOVER</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity onPress={() => setModalRevisao(false)} style={{ padding: 4 }}>
                  <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 17 }}>
                    Revisar Partidas
                  </Text>
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11, marginTop: 1 }}>
                    {competicao.nome} • {partidasPendentes.length} partida{partidasPendentes.length !== 1 ? 's' : ''}
                  </Text>
                </View>
                <View style={{
                  backgroundColor: colors.primary + '18', paddingHorizontal: 10,
                  paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: colors.primary + '30',
                }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 11, letterSpacing: 0.5 }}>
                    SEGURAR = SELECIONAR
                  </Text>
                </View>
              </>
            )}
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 20, paddingBottom: 120 }}
          >
            {partidasPendentes.length === 0 ? (
              <View style={{ alignItems: 'center', marginTop: 60, gap: 12 }}>
                <MaterialCommunityIcons name="soccer" size={48} color="#222" />
                <Text style={{ fontFamily: 'Creato-Bold', color: '#333', fontSize: 14, letterSpacing: 1 }}>
                  NENHUMA PARTIDA NA FILA
                </Text>
              </View>
            ) : (
              partidasPendentes.map(p => (
                <CardPartidaPendente
                  key={p.uid}
                  partida={p}
                  selecionada={selecionadas.has(p.uid)}
                  modoSelecao={modoSelecao}
                  onLongPress={() => ativarModoSelecao(p.uid)}
                  onPress={() => {
                    if (modoSelecao) toggleSelecao(p.uid);
                  }}
                />
              ))
            )}
          </ScrollView>

          {!modoSelecao && partidasPendentes.length > 0 && (
            <View style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: 20, paddingBottom: 36,
              backgroundColor: colors.background,
              borderTopWidth: 1, borderTopColor: '#1e1e1e',
            }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={enviandoTudo ? undefined : enviarTudo}
                style={[styles.salvarBtn, { marginTop: 0 }]}
                disabled={enviandoTudo}
              >
                <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                  {enviandoTudo ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <MaterialCommunityIcons name="cloud-upload-outline" size={18} color="#FFF" />
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