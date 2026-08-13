import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

// ── Tipografia, Cores e Estilos Globais ──
import { colors, typography } from '@ludora/design-tokens';
import { styles } from '@/src/styles/organizarPartidasStyles';

// ── Componentes e Serviços ──
import { Header } from '@/src/components/Header';
import TeamSelectorCard from '@/src/components/TeamSelectorCard';
import MandoCampo from '@/src/components/mandoCampo';
import InputDataHora from '@/src/components/InputDataHora';
import { fetchTimes, fetchCompeticoes, fetchCategorias, criarPartida } from '@/src/services/api';

const ORDEM_SUBS: Record<string, number> = {
  'SUB 7': 1, 'SUB-7': 1, 'SUB 8': 2, 'SUB-8': 2, 'SUB 9': 3, 'SUB-9': 3,
  'SUB 10': 4, 'SUB-10': 4, 'SUB 12': 5, 'SUB-12': 5, 'SUB 14': 6, 'SUB-14': 6,
  'SUB 16': 7, 'SUB-16': 7, 'SUB 18': 8, 'SUB-18': 8,
};

interface Categoria { id: number; nome: string; tipo: 'INICIACAO' | 'BASE'; }
interface Time { id: number; nome: string; escudo: string | null; categoria_id: number; }
interface Competicao { id: number; nome: string; ano: number; }
interface OrganizarPartidasProps { onFechar: () => void; noModal?: boolean; }

export default function OrganizarPartidas({ onFechar, noModal }: OrganizarPartidasProps) {
  const router = useRouter();
  
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

  // ── Efeitos ──
  useEffect(() => {
    Promise.all([fetchTimes(), fetchCompeticoes(), fetchCategorias()]).then(([timesData, competicoesData, categoriasData]) => {
      setTimes(timesData);
      setCompeticoes(competicoesData);
      const catOrdenadas = categoriasData.sort((a: Categoria, b: Categoria) => (ORDEM_SUBS[a.nome.toUpperCase()] ?? 99) - (ORDEM_SUBS[b.nome.toUpperCase()] ?? 99));
      setCategorias(catOrdenadas);
      if (competicoesData.length > 0) setCompeticaoSelecionada(competicoesData[0]);
      if (catOrdenadas.length > 0) setCategoriaId(catOrdenadas[0].id);
    }).finally(() => setCarregandoDados(false));
  }, []);

  // ── Variáveis Computadas ──
  const timesFiltrados = times.filter(t => t.nome.toLowerCase().includes(buscaTime.toLowerCase()) && t.categoria_id === categoriaId);
  const categoriaAtual = categorias.find(c => c.id === categoriaId);
  const isFormValido = mandante && visitante && data.length === 5 && horario.length === 5 && categoriaId !== null;

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
    if (!isFormValido) return;
    setSalvando(true);
    try {
      const [dia, mes] = data.split('/');
      await criarPartida({
        mandante_id: mandante.id,
        visitante_id: visitante.id,
        data: `${new Date().getFullYear()}-${mes}-${dia}`,
        horario,
        local: "Local não definido",
        emCasa,
        categoria_id: categoriaId,
        competicao_id: competicaoSelecionada?.id,
      });
      onFechar();
    } catch (e) {
      console.error(e);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header title="ORGANIZAR PARTIDA" showLogo={false} showProfile={false} btnVoltar="arrow-left" onBtnVoltar={onFechar} semSafeArea={noModal} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* ── SEÇÃO: COMPETIÇÃO ── */}
        <Text style={styles.sectionLabel}>COMPETIÇÃO</Text>
        <TouchableOpacity style={[styles.dropdownBtn, competicoes.length === 0 && { opacity: 0.5 }]} activeOpacity={0.8} onPress={() => competicoes.length > 0 && setModalCompeticao(true)}>
          <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.primaria} />
          <Text style={styles.dropdownText}>{carregandoDados ? 'Carregando...' : competicaoSelecionada ? competicaoSelecionada.nome : 'Nenhuma competição cadastrada'}</Text>
          <MaterialCommunityIcons name="chevron-down" size={20} color={colors.textoSecundario} />
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
        <TouchableOpacity activeOpacity={0.85} onPress={salvar} style={[styles.salvarBtn, !isFormValido && { opacity: 0.4 }]} disabled={!isFormValido || salvando}>
          <LinearGradient colors={[colors.primaria, '#0055FF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
            {salvando ? <ActivityIndicator color="#FFF" /> : (
              <View style={styles.salvarBtnInner}>
                <MaterialCommunityIcons name="check" size={18} color="#FFF" />
                <Text style={styles.salvarText}>CRIAR PARTIDA</Text>
              </View>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </ScrollView>

      {/* ── MODAL COMPETICAO (MANTIDO) ── */}
      <Modal visible={modalCompeticao} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalCompeticao(false)}>
          {/* O conteúdo do modal pode virar um <ModalCompeticao /> futuramente */}
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Selecionar competição</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setModalCompeticao(false)}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            {competicoes.map((c, index) => (
              <TouchableOpacity key={c.id} style={[styles.modalItem, competicaoSelecionada?.id === c.id && styles.modalItemActive]} onPress={() => { setCompeticaoSelecionada(c); setModalCompeticao(false); }}>
                <View style={[styles.modalIconCircle, { backgroundColor: competicaoSelecionada?.id === c.id ? colors.primaria : colors.cardSecundario }]}>
                    <MaterialCommunityIcons name="trophy-outline" size={20} color={competicaoSelecionada?.id === c.id ? '#FFF' : colors.primaria} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.modalItemText}>{c.nome}</Text>
                    <Text style={styles.modalItemSub}>{'Base · ' + (Math.floor(Math.random() * 20) + 5) + ' partidas cadastradas'}</Text>
                </View>
                {competicaoSelecionada?.id === c.id ? (
                    <MaterialCommunityIcons name="check-circle" size={24} color={colors.primaria} />
                ) : (
                    <MaterialCommunityIcons name="circle-outline" size={24} color={colors.borda} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ── MODAL TIMES (MANTIDO) ── */}
      <Modal visible={modalTime !== null} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setModalTime(null); setBuscaTime(''); }}>
          {/* O conteúdo do modal pode virar um <ModalBuscaTime /> futuramente */}
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTime === 'mandante' ? 'Selecionar mandante' : 'Selecionar visitante'}</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => { setModalTime(null); setBuscaTime(''); }}>
                <MaterialCommunityIcons name="close" size={18} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <View style={styles.buscaContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={colors.textoSecundario} />
              <TextInput style={styles.buscaText} placeholder="Buscar time..." placeholderTextColor={colors.textoSecundario} value={buscaTime} onChangeText={setBuscaTime} autoFocus />
            </View>
            {categoriaAtual && (
                <Text style={styles.subCategoriaText}>{categoriaAtual.nome} · {categoriaAtual.tipo}</Text>
            )}
            <ScrollView showsVerticalScrollIndicator={false}>
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
                            <MaterialCommunityIcons name={sel ? "shield-check" : "shield"} size={20} color={sel ? '#FFF' : timeColor} />
                        )}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.modalItemText}>{time.nome}</Text>
                        <Text style={styles.modalItemSub}>{sel ? (modalTime === 'mandante' ? 'Mandante de casa' : 'Visitante convidado') : ((Math.floor(Math.random() * 8) + 2) + ' partidas na competição')}</Text>
                    </View>
                    {sel ? (
                        <MaterialCommunityIcons name="check-circle" size={24} color={colors.primaria} />
                    ) : (
                        <MaterialCommunityIcons name="circle-outline" size={24} color={colors.borda} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}