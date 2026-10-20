import { Icon } from '@ludora/icons';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, Image, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

// ── Tipografia, Cores e Estilos Globais ──
import { typography } from '@ludora/design-tokens';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/organizarPartidasStyles';

// ── Componentes e Serviços ──
import { Header } from '@/src/components/Header';
import TeamSelectorCard from '@/src/components/TeamSelectorCard';
import MandoCampo from '@/src/components/mandoCampo';
import InputDataHora from '@/src/components/InputDataHora';
import { fetchTimes, fetchCompeticoes, fetchCategorias, criarPartida } from '@/src/services/api';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { criarControleRequisicoes } from '@/src/utils/request';
import { dataPartidaISO, erroFormularioPartida } from '@/src/utils/validarPartida';

const ORDEM_SUBS: Record<string, number> = {
  'SUB 7': 1, 'SUB-7': 1, 'SUB 8': 2, 'SUB-8': 2, 'SUB 9': 3, 'SUB-9': 3,
  'SUB 10': 4, 'SUB-10': 4, 'SUB 12': 5, 'SUB-12': 5, 'SUB 14': 6, 'SUB-14': 6,
  'SUB 16': 7, 'SUB-16': 7, 'SUB 18': 8, 'SUB-18': 8,
};

interface Categoria { id: number; nome: string; tipo: 'INICIACAO' | 'BASE'; }
interface Time { id: number; nome: string; escudo: string | null; categoria_id: number; }
interface Competicao { id: number; nome: string; ano: number; }
interface OrganizarPartidasProps { onFechar?: () => void; noModal?: boolean; }

export default function OrganizarPartidas({ onFechar, noModal }: OrganizarPartidasProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const fechar = onFechar ?? (() => router.back());
  const { clubeAtivo } = useClubeAtivo();
  
  // ── Estados ──
  const [times, setTimes] = useState<Time[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [carregandoDados, setCarregandoDados] = useState(true);

  const [competicaoSelecionada, setCompeticaoSelecionada] = useState<Competicao | null>(null);
  const [modalCompeticao, setModalCompeticao] = useState(false);
  const [modalTime, setModalTime] = useState<'mandante' | 'visitante' | null>(null);
  const [buscaTime, setBuscaTime] = useState('');

  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [mandante, setMandante] = useState<Time | null>(null);
  const [visitante, setVisitante] = useState<Time | null>(null);
  const [data, setData] = useState('');
  const [horario, setHorario] = useState('');
  const [emCasa, setEmCasa] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroDados, setErroDados] = useState('');
  const [erroSalvar, setErroSalvar] = useState('');
  const envioEmAndamento = useRef(false);
  const controle = useRef(criarControleRequisicoes()).current;

  // ── Efeitos ──
  const carregarDados = useCallback(async () => {
    const id = controle.iniciar();
    setCarregandoDados(true);
    setErroDados('');
    try {
      const [timesData, competicoesData, categoriasData] = await Promise.all([fetchTimes(), fetchCompeticoes(), fetchCategorias()]);
      if (!controle.atual(id)) return;
      setTimes(timesData);
      setCompeticoes(competicoesData);
      const catOrdenadas = categoriasData.sort((a: Categoria, b: Categoria) => (ORDEM_SUBS[a.nome.toUpperCase()] ?? 99) - (ORDEM_SUBS[b.nome.toUpperCase()] ?? 99));
      setCategorias(catOrdenadas);
      if (competicoesData.length > 0) setCompeticaoSelecionada(competicoesData[0]);
      if (catOrdenadas.length > 0) setCategoriaId(catOrdenadas[0].id);
    } catch (error) {
      if (controle.atual(id)) setErroDados(error instanceof Error ? error.message : 'Não foi possível carregar os dados da partida.');
    } finally {
      if (controle.atual(id)) setCarregandoDados(false);
    }
  }, [controle, clubeAtivo?.id]);

  useEffect(() => {
    setTimes([]); setCategorias([]); setCompeticoes([]);
    setMandante(null); setVisitante(null); setCategoriaId(null); setCompeticaoSelecionada(null);
    void carregarDados();
    return () => controle.invalidar();
  }, [carregarDados, controle]);

  // ── Variáveis Computadas ──
  const timesFiltrados = useMemo(() => times.filter(t =>
    t.nome.toLowerCase().includes(buscaTime.trim().toLowerCase()) && t.categoria_id === categoriaId
    && t.id !== (modalTime === 'mandante' ? visitante?.id : mandante?.id)
  ), [times, buscaTime, categoriaId, modalTime, mandante?.id, visitante?.id]);
  const categoriaAtual = categorias.find(c => c.id === categoriaId);
  const erroFormulario = erroFormularioPartida({ mandanteId: mandante?.id, visitanteId: visitante?.id, categoriaId, data, horario });
  const isFormValido = !carregandoDados && !erroDados && !erroFormulario;

  // ── Handlers ──
  const selecionarTime = (time: Time) => {
    if (modalTime === 'mandante') setMandante(mandante?.id === time.id ? null : time);
    else setVisitante(visitante?.id === time.id ? null : time);
    setModalTime(null);
    setBuscaTime('');
  };

  const handleDataChange = (text: string) => {
    const n = text.replace(/\D/g, '');
    setData(n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2, 4)}` : n);
  };

  const handleHorarioChange = (text: string) => {
    const n = text.replace(/\D/g, '');
    setHorario(n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2, 4)}` : n);
  };

  const salvar = async () => {
    if (!isFormValido || !mandante || !visitante || !categoriaId || envioEmAndamento.current) return;
    envioEmAndamento.current = true;
    setSalvando(true);
    setErroSalvar('');
    try {
      await criarPartida({
        mandante_id: mandante.id,
        visitante_id: visitante.id,
        data: dataPartidaISO(data)!,
        horario,
        local: "Local não definido",
        emCasa,
        categoria_id: categoriaId,
        competicao_id: competicaoSelecionada?.id,
      });
      fechar();
    } catch (e) {
      setErroSalvar(e instanceof Error ? e.message : 'Não foi possível criar a partida. Tente novamente.');
    } finally {
      envioEmAndamento.current = false;
      setSalvando(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={noModal ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title="Organizar partida"
        showLogo={false}
        showProfile={false}
        btnVoltar="arrow-left"
        onBtnVoltar={fechar}
        semSafeArea
        papelUsuario={clubeAtivo?.papel ?? undefined}
      />

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        {!!erroDados && <View accessibilityRole="alert">
          <Text style={[styles.emptyText, { color: colors.tituloErro }]}>{erroDados}</Text>
          <TouchableOpacity onPress={() => void carregarDados()} style={styles.dropdownBtn}><Text style={styles.dropdownText}>Tentar novamente</Text></TouchableOpacity>
        </View>}

        {/* ── SEÇÃO: COMPETIÇÃO ── */}
        <Text style={styles.sectionLabel}>COMPETIÇÃO</Text>
        <TouchableOpacity style={[styles.dropdownBtn, competicoes.length === 0 && { opacity: 0.5 }]} activeOpacity={0.8} onPress={() => competicoes.length > 0 && setModalCompeticao(true)}>
          <Icon name="trophy-outline" size={20} color={colors.primaria} />
          <Text style={styles.dropdownText}>{carregandoDados ? 'Carregando...' : competicaoSelecionada ? competicaoSelecionada.nome : 'Nenhuma competição cadastrada'}</Text>
          <Icon name="chevron-down" size={20} color={colors.textoSecundario} />
        </TouchableOpacity>

        {/* ── SEÇÃO: CATEGORIA ── */}
        <Text style={styles.sectionLabel}>CATEGORIA</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRow}>
          {categorias.map(cat => (
            <TouchableOpacity key={cat.id} style={[styles.pill, categoriaId === cat.id && styles.pillActive]} onPress={() => { setCategoriaId(cat.id); setMandante(null); setVisitante(null); }} activeOpacity={0.8}>
              <Text style={[styles.pillText, categoriaId === cat.id && styles.pillTextActive]}>{cat.nome.replace('SUB', 'Sub')}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* ── SEÇÃO: CONFRONTO (Refatorado) ── */}
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

        {/* ── SEÇÃO: MANDO DE CAMPO (Refatorado) ── */}
        <Text style={styles.sectionLabel}>MANDO DE CAMPO</Text>
        <MandoCampo 
          emCasa={emCasa} 
          onChange={setEmCasa} 
        />

        {/* ── SEÇÃO: DATA E HORÁRIO (Refatorado) ── */}
        <InputDataHora 
          data={data} 
          horario={horario} 
          onChangeData={handleDataChange} 
          onChangeHorario={handleHorarioChange} 
        />

        {/* ── BOTAO SALVAR ── */}
        {!!erroSalvar && <Text accessibilityRole="alert" style={[styles.emptyText, { color: colors.tituloErro }]}>{erroSalvar}</Text>}
        {!carregandoDados && !erroDados && !!erroFormulario && <Text style={styles.emptyText}>{erroFormulario}</Text>}
        <TouchableOpacity activeOpacity={0.85} onPress={salvar} style={[styles.salvarBtn, !isFormValido && { opacity: 0.4 }]} disabled={!isFormValido || salvando}>
          <LinearGradient colors={[colors.primaria, '#0055FF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
            {salvando ? <ActivityIndicator color={colors.textoSobrePrimaria} /> : (
              <View style={styles.salvarBtnInner}>
                <Icon name="check" size={18} color={colors.textoSobrePrimaria} />
                <Text style={styles.salvarText}>CRIAR PARTIDA</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ── MODAL COMPETICAO (MANTIDO) ── */}
      <Modal visible={modalCompeticao} transparent animationType="fade" onRequestClose={() => setModalCompeticao(false)}>
        <Pressable style={[styles.modalOverlay, { paddingTop: insets.top + 12 }]} onPress={() => setModalCompeticao(false)}>
          {/* O conteúdo do modal pode virar um <ModalCompeticao /> futuramente */}
          <Pressable style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar competição</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalCompeticao(false)}>
                <Icon name="close" size={18} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.selectorList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {competicoes.map((c) => (
              <TouchableOpacity key={c.id} style={[styles.modalItem, competicaoSelecionada?.id === c.id && styles.modalItemActive]} onPress={() => { setCompeticaoSelecionada(c); setModalCompeticao(false); }}>
                <View style={[styles.modalIconCircle, { backgroundColor: competicaoSelecionada?.id === c.id ? colors.primaria : colors.cardSecundario }]}>
                    <Icon name="trophy-outline" size={20} color={competicaoSelecionada?.id === c.id ? colors.textoSobrePrimaria : colors.primaria} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{c.nome}</Text>
                    <Text style={styles.modalItemSub}>{c.ano ? `Temporada ${c.ano}` : 'Competição do clube'}</Text>
                </View>
                {competicaoSelecionada?.id === c.id ? (
                    <Icon name="check-circle" size={24} color={colors.primaria} />
                ) : (
                    <Icon name="circle-outline" size={24} color={colors.borda} />
                )}
              </TouchableOpacity>
            ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── MODAL TIMES (MANTIDO) ── */}
      <Modal visible={modalTime !== null} transparent animationType="slide" onRequestClose={() => { setModalTime(null); setBuscaTime(''); }}>
        <KeyboardAvoidingView style={styles.scroll} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable style={[styles.modalOverlay, { paddingTop: insets.top + 12 }]} onPress={() => { setModalTime(null); setBuscaTime(''); }}>
          {/* O conteúdo do modal pode virar um <ModalBuscaTime /> futuramente */}
          <Pressable style={[styles.modalContent, { paddingBottom: Math.max(insets.bottom, 16) + 16 }]} onPress={(event) => event.stopPropagation()}>
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
            <ScrollView style={styles.selectorList} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
              {timesFiltrados.length === 0 && <Text style={styles.emptyText}>Nenhum time encontrado nesta categoria.</Text>}
              {timesFiltrados.map((time, index) => {
                const sel = modalTime === 'mandante' ? mandante?.id === time.id : visitante?.id === time.id;
                const iconColors = ['#0E78FF', '#F0B84E', '#FF4D00', '#2E7D32'];
                const timeColor = sel ? colors.primaria : iconColors[index % iconColors.length];

                return (
                  <TouchableOpacity key={time.id} style={[styles.modalItem, sel && styles.modalItemActive]} onPress={() => selecionarTime(time)} activeOpacity={0.7}>
                    <View style={[styles.modalIconCircle, { backgroundColor: sel ? colors.primaria : colors.cardSecundario }]}>
                        {time.escudo ? (
                             <Image source={{ uri: time.escudo }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                        ) : (
                            <Icon name={sel ? "shield-check" : "shield"} size={20} color={sel ? colors.textoSobrePrimaria : timeColor} />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemText}>{time.nome}</Text>
                        <Text style={styles.modalItemSub}>{sel ? 'Time selecionado' : categoriaAtual?.nome}</Text>
                    </View>
                    {sel ? (
                        <Icon name="check-circle" size={24} color={colors.primaria} />
                    ) : (
                        <Icon name="circle-outline" size={24} color={colors.borda} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
