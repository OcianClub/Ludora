import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, Image, ActivityIndicator, Alert, FlatList } from 'react-native';
import React, { useState, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { styles } from '@/src/styles/equipesStyles';
import { Header } from '@/src/components/Header';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import ElencoSub from '@/src/components/ElencoSub';
import OrganizarPartidaCampeonato from '@/src/components/organizarPartidaCampeonato';
import DetalhesCompeticao from '@/src/components/detalhesCompeticao';
import * as SecureStore from 'expo-secure-store';
import { atualizarIdadesJogadores } from '@/src/services/api';


import {
  BASE_URL,
  fetchTimes, fetchCompeticoes, fetchCategorias, fetchJogadores, fetchPartidas,
  criarTime, atualizarTime, deletarTime,
  criarCompeticao, atualizarCompeticao, deletarCompeticao,
  fetchJogadoresPorCompeticao, salvarElencoCompeticao
} from '@/src/services/api';

interface Categoria { id: number; nome: string; }
interface Time { id: number; nome: string; escudo: string | null; categoria_id: number; }
interface Partida { id: number; categoria_id: number | null; mandante: Time; visitante: Time; }
interface Competicao { id: number; nome: string; ano: number; tipo: 'INICIACAO' | 'BASE'; }
interface Jogador { id: number; nome: string; posicao: string; numCamisa: number | null; categoria_id: number; }
interface EquipesProps { onFechar: () => void; noModal?: boolean; }

const NOME_CLUBE = 'OCIAN';

const ORDEM_SUBS: Record<string, number> = {
  'SUB 7': 1, 'SUB-7': 1, 'SUB 8': 2, 'SUB-8': 2, 'SUB 9': 3, 'SUB-9': 3,
  'SUB 10': 4, 'SUB-10': 4, 'SUB 12': 5, 'SUB-12': 5, 'SUB 14': 6, 'SUB-14': 6,
  'SUB 16': 7, 'SUB-16': 7, 'SUB 18': 8, 'SUB-18': 8,
};

const getTipoCategoria = (nome: string) => {
  const iniciacao = ['SUB 7', 'SUB-7', 'SUB 8', 'SUB-8', 'SUB 9', 'SUB-9', 'SUB 10', 'SUB-10'];
  return iniciacao.includes(nome.toUpperCase()) ? 'INICIACAO' : 'BASE';
};

function EmptyState({ icone, mensagem, onAction, labelAction }: any) {
  return (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons name={icone} size={56} color="#2a2a2a" />
      <Text style={styles.emptyText}>{mensagem}</Text>
      {onAction && (
        <TouchableOpacity style={styles.emptyBtn} onPress={onAction} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={16} color={colors.text} />
          <Text style={styles.emptyBtnText}>{labelAction}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function Equipes({ onFechar, noModal }: EquipesProps) {
  const [abaAtiva, setAbaAtiva] = useState<'ocian' | 'adversarios' | 'campeonatos'>('ocian');
  const [tipoOcian, setTipoOcian] = useState<'INICIACAO' | 'BASE'>('INICIACAO');
  const [subSelecionadoId, setSubSelecionadoId] = useState<number | null>(null);
  const [busca, setBusca] = useState('');
  
  const [times, setTimes] = useState<Time[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [competicoes, setCompeticoes] = useState<Competicao[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [jogadores, setJogadores] = useState<Jogador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [detalhesComp, setDetalhesComp] = useState<Competicao | null>(null);
  const [modalFormAdversario, setModalFormAdversario] = useState(false);
  const [modalConfirmar, setModalConfirmar] = useState(false);
  const [modalElenco, setModalElenco] = useState(false);
  
  const [itemSelecionado, setItemSelecionado] = useState<Time | Competicao | Categoria | null>(null);
  
  const [salvando, setSalvando] = useState(false);
  const [nomeForm, setNomeForm] = useState('');
  const [anoForm, setAnoForm] = useState('');
  const [escudoUri, setEscudoUri] = useState<string | null>(null);
  const [escudoUrl, setEscudoUrl] = useState<string | null>(null);
  const [categoriaFormId, setCategoriaFormId] = useState<number | null>(null);
  const [tipoForm, setTipoForm] = useState<'INICIACAO' | 'BASE'>('INICIACAO');

  // ── ESTADO DA TELA DE ELENCO DO SUB ──
  const [elencoSubVisivel, setElencoSubVisivel] = useState(false);
  const [categoriaElenco, setCategoriaElenco] = useState<Categoria | null>(null);

  // ── ESTADOS DO WIZARD DE CAMPEONATOS ──
  const [wizardVisivel, setWizardVisivel] = useState(false);
  const [wizardStep, setWizardStep] = useState<'INFO' | 'SUBS' | 'ELENCO' | 'JOGOS'>('INFO');
  const [wizardSubAtivo, setWizardSubAtivo] = useState<Categoria | null>(null);
  const [elencoSelecionado, setElencoSelecionado] = useState<Record<number, number[]>>({});

  // ── ESTADOS DA IMPORTAÇÃO IA ──
  const [importando, setImportando] = useState(false);
  const [resultadoImport, setResultadoImport] = useState<{ criados: number; pulados: number } | null>(null);
  const [modalOrganizarCamp, setModalOrganizarCamp] = useState(false);

  const carregarDados = useCallback(async (silencioso = false) => {
    if (!silencioso) setCarregando(true);
    // dentro de carregarDados, antes do try:
    const anoAtual = String(new Date().getFullYear());
    const ultimaAtualizacao = await SecureStore.getItemAsync('ultimaAtualizacaoIdades');
    if (ultimaAtualizacao !== anoAtual) {
      try {
        await atualizarIdadesJogadores();
        await SecureStore.setItemAsync('ultimaAtualizacaoIdades', anoAtual);
      } catch { /* silencioso — não bloqueia o carregamento */ }
    }
    try {
      const [t, c, cat, jog, p] = await Promise.all([
        fetchTimes(), fetchCompeticoes(), fetchCategorias(), fetchJogadores(), fetchPartidas()
      ]);
      setTimes(t); setCompeticoes(c); setJogadores(jog); setPartidas(p);
      setCategorias(cat.sort((a: Categoria, b: Categoria) => (ORDEM_SUBS[a.nome.toUpperCase()] ?? 99) - (ORDEM_SUBS[b.nome.toUpperCase()] ?? 99)));
    } catch (e) {
      console.error(e);
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { carregarDados(); }, [carregarDados]));

  const isOcian = (nome: string) => nome.toUpperCase().includes(NOME_CLUBE);
  const categoriasOcian = categorias.filter(c => getTipoCategoria(c.nome) === tipoOcian);
  const competicoesFiltradas = competicoes.filter(c => c.nome.toLowerCase().includes(busca.toLowerCase()));

  const getAdversariosPorSub = (catId: number) => {
    const mapaTimes = new Map<number, Time>();
    partidas.forEach(p => {
      if (p.categoria_id === catId) {
        if (p.mandante && !isOcian(p.mandante.nome)) mapaTimes.set(p.mandante.id, p.mandante);
        if (p.visitante && !isOcian(p.visitante.nome)) mapaTimes.set(p.visitante.id, p.visitante);
      }
    });
    times.forEach(t => {
      if (!isOcian(t.nome) && t.categoria_id === catId) mapaTimes.set(t.id, t);
    });
    return Array.from(mapaTimes.values());
  };

  // ── FUNÇÕES DO WIZARD DE CAMPEONATOS ──
  const iniciarWizardCampeonato = async (comp?: Competicao) => {
    setItemSelecionado(comp || null);
    setNomeForm(comp?.nome || '');
    setAnoForm(comp ? String(comp.ano) : String(new Date().getFullYear()));
    setTipoForm(comp?.tipo || 'INICIACAO');
    setWizardStep('INFO');
    setResultadoImport(null);
    setWizardVisivel(true);
    if (comp) {
      try {
        const jogadoresDaComp = await fetchJogadoresPorCompeticao(comp.id);
        const mapa: Record<number, number[]> = {};
        jogadoresDaComp.forEach((j: any) => {
          // API retorna id_jogador; categoria_id vem do cadastro do jogador local
          const jogId  = j.id_jogador ?? j.id;
          const catId  = j.categoria_id ?? jogadores.find(jl => jl.id === jogId)?.categoria_id;
          if (!jogId || !catId) return;
          if (!mapa[catId]) mapa[catId] = [];
          if (!mapa[catId].includes(jogId)) mapa[catId].push(jogId);
        });
        setElencoSelecionado(mapa);
      } catch { setElencoSelecionado({}); }
    } else {
      setElencoSelecionado({});
    }
  };

  const avancarWizardParaSubs = async () => {
    if (!nomeForm.trim()) return Alert.alert('Atenção', 'O nome não pode ser vazio.');
    if (!anoForm.trim()) return Alert.alert('Atenção', 'Informe o ano.');
    setSalvando(true);
    try {
      const dados = { nome: nomeForm, ano: Number(anoForm), tipo: tipoForm };
      let comp;
      if (itemSelecionado && 'ano' in itemSelecionado) {
        comp = await atualizarCompeticao(itemSelecionado.id, dados);
      } else {
        comp = await criarCompeticao(dados);
      }
      setItemSelecionado(comp);
      setWizardStep('SUBS');
      carregarDados();
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSalvando(false);
    }
  };

  // Salva o elenco no banco e avança para a tabela de jogos
  const avancarParaJogos = async () => {
    setSalvando(true);
    try {
      if (itemSelecionado && 'ano' in itemSelecionado) {
        const todosJogadores = (Object.values(elencoSelecionado).flat() as any[])
          .filter((id): id is number => id != null && typeof id === 'number');
        await salvarElencoCompeticao(itemSelecionado.id, todosJogadores);
      }
      setWizardStep('JOGOS');
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally {
      setSalvando(false);
    }
  };

  const abrirSelecaoElenco = (sub: Categoria) => {
    setWizardSubAtivo(sub);
    setWizardStep('ELENCO');
  };

  const toggleJogadorElenco = (jogadorId: number) => {
    if (!wizardSubAtivo) return;
    setElencoSelecionado(prev => {
      const atual = prev[wizardSubAtivo.id] || [];
      const novoArray = atual.includes(jogadorId)
        ? atual.filter(id => id !== jogadorId)
        : [...atual, jogadorId];
      return { ...prev, [wizardSubAtivo.id]: novoArray };
    });
  };

  // ── IMPORTAÇÃO VIA IA ──
const importarArquivo = async (tipo: 'documento' | 'imagem') => {
  if (!itemSelecionado || !('ano' in itemSelecionado)) {
    return Alert.alert('Atenção', 'Salve o campeonato antes de importar.');
  }
 
  let uri: string, nome: string, mimeType: string;
 
  if (tipo === 'imagem') {
    // ── Imagem (foto da tabela) ──────────────────────────────────────────────
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;
    uri      = result.assets[0].uri;
    nome     = result.assets[0].fileName ?? 'foto.jpg';
    mimeType = result.assets[0].mimeType ?? 'image/jpeg';
 
  } else {
    // ── Documento: PDF, CSV, TXT, XLS, XLSX ────────────────────────────────
    const result = await DocumentPicker.getDocumentAsync({
      // Lista explícita + '*/*' como fallback para Android/iOS que mapeiam
      // arquivos xlsx como application/octet-stream
      type: [
        'application/pdf',
        'text/csv',
        'text/plain',
        'application/vnd.ms-excel',                                           
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',  
        'application/octet-stream',  
        '*/*',                       
      ],
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
 
    uri      = result.assets[0].uri;
    nome     = result.assets[0].name;
    mimeType = result.assets[0].mimeType ?? 'application/octet-stream';
 
    // Corrige o mime quando o sistema retorna genérico mas a extensão é xlsx/xls
    const ext = nome.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx') mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (ext === 'xls')  mimeType = 'application/vnd.ms-excel';
    if (ext === 'csv')  mimeType = 'text/csv';
  }
 
  setImportando(true);
  setResultadoImport(null);
 
  try {
    const formData = new FormData();
    formData.append('competicaoId', String((itemSelecionado as Competicao).id));
    formData.append('arquivo', { uri, name: nome, type: mimeType } as any);
 
    const resposta = await fetch(`${BASE_URL}/partidas/importar`, {
      method: 'POST',
      body: formData,
    });
 
    if (!resposta.ok) {
      const erro = await resposta.json();
      throw new Error(erro.error || 'Erro no servidor.');
    }
 
    const data = await resposta.json();
    setResultadoImport({ criados: data.criados, pulados: data.pulados });
    carregarDados(true);
 
  } catch (err: any) {
    Alert.alert('Erro na Importação', err.message);
  } finally {
    setImportando(false);
  }
};

  // ── FUNÇÕES ADVERSÁRIOS ──
  const abrirFormAdversario = (time?: Time) => {
    setItemSelecionado(time || null);
    setNomeForm(time?.nome || '');
    setEscudoUrl(time?.escudo || null);
    setEscudoUri(null);
    setCategoriaFormId(time?.categoria_id || subSelecionadoId || null);
    setModalFormAdversario(true);
  };

  const escolherImagem = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled) setEscudoUri(result.assets[0].uri);
  };

  const salvarAdversario = async () => {
    if (!nomeForm.trim()) return Alert.alert('Atenção', 'O nome não pode ser vazio.');
    if (!categoriaFormId) return Alert.alert('Atenção', 'Selecione o Sub a qual este time pertence.');
    setSalvando(true);
    try {
      const dados = { nome: nomeForm, escudo: escudoUrl ?? undefined, categoria_id: categoriaFormId };
      if (itemSelecionado && 'escudo' in itemSelecionado) await atualizarTime(itemSelecionado.id, dados);
      else await criarTime(dados);
      setModalFormAdversario(false);
      carregarDados();
    } catch (err: any) {
      Alert.alert('Erro', err.message);
    } finally { setSalvando(false); }
  };

  const excluir = async () => {
    if (!itemSelecionado) return;
    try {
      if (abaAtiva === 'adversarios') await deletarTime(itemSelecionado.id);
      else await deletarCompeticao(itemSelecionado.id);
      setModalConfirmar(false);
      carregarDados();
    } catch (err: any) {
      setModalConfirmar(false); Alert.alert('Erro', err.message);
    }
  };

  // ── RENDERIZADORES DE ABAS ──
  const renderCFAOcian = () => (
    <View>
      <View style={styles.tipoSwitchContainer}>
        {(['INICIACAO', 'BASE'] as const).map(tipo => (
          <TouchableOpacity key={tipo} style={[styles.tipoSwitchBtn, tipoOcian === tipo && styles.tipoSwitchBtnAtivo]} onPress={() => setTipoOcian(tipo)}>
            <Text style={[styles.tipoSwitchTxt, tipoOcian === tipo && styles.tipoSwitchTxtAtivo]}>{tipo === 'INICIACAO' ? 'INICIAÇÃO' : 'BASE'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={styles.gridCategorias}>
        {categoriasOcian.map(cat => (
          <TouchableOpacity key={cat.id} style={styles.cardCategoriaOcian} onPress={() => { setCategoriaElenco(cat); setElencoSubVisivel(true); }}>
            <View style={styles.iconCircleOcian}><MaterialCommunityIcons name="shield-star" size={32} color={colors.primary} /></View>
            <Text style={styles.catOcianNome}>{cat.nome}</Text>
            <Text style={styles.catOcianBadgeTxt}>{jogadores.filter(j => j.categoria_id === cat.id).length} atletas</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const renderAdversarios = () => {
    if (subSelecionadoId !== null) {
      const adversariosDesseSub = getAdversariosPorSub(subSelecionadoId).filter(t => t.nome.toLowerCase().includes(busca.toLowerCase()));
      return (
        <View>
          <View style={styles.buscaContainer}>
            <MaterialCommunityIcons name="magnify" size={18} color={colors.text_secondary} />
            <TextInput style={styles.buscaInput} placeholder="Buscar time..." placeholderTextColor={colors.text_secondary} value={busca} onChangeText={setBusca} />
          </View>
          <TouchableOpacity style={styles.btnVoltarCategorias} onPress={() => { setSubSelecionadoId(null); setBusca(''); }}>
            <MaterialCommunityIcons name="chevron-left" size={20} color={colors.azulClaro} />
            <Text style={styles.txtVoltarCategorias}>VOLTAR PARA CATEGORIAS</Text>
          </TouchableOpacity>
          {adversariosDesseSub.length === 0 ? (
            <EmptyState icone="shield-off-outline" mensagem="Nenhum adversário neste Sub." onAction={() => abrirFormAdversario()} labelAction="Adicionar Time" />
          ) : (
            adversariosDesseSub.map(time => (
              <View key={time.id} style={styles.cardLista}>
                <View style={styles.cardLeft}>
                  {time.escudo ? <Image source={{ uri: time.escudo }} style={styles.escudoLista} /> : (
                    <View style={styles.escudoPlaceholder}><Text style={styles.escudoIniciais}>{time.nome.substring(0, 2).toUpperCase()}</Text></View>
                  )}
                  <View style={{ flexShrink: 1 }}>
                    <Text style={styles.cardNome}>{time.nome}</Text>
                  </View>
                </View>
                <View style={styles.cardAcoes}>
                  <TouchableOpacity style={styles.btnAcao} onPress={() => abrirFormAdversario(time)}><MaterialCommunityIcons name="pencil-outline" size={18} color={colors.azulClaro} /></TouchableOpacity>
                  <TouchableOpacity style={[styles.btnAcao, styles.btnAcaoDanger]} onPress={() => { setItemSelecionado(time); setModalConfirmar(true); }}><MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} /></TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      );
    }
    return (
      <View>
        <Text style={styles.sectionLabel}>SELECIONE A CATEGORIA PARA VER OS ADVERSÁRIOS</Text>
        <View style={styles.gridCategorias}>
          {categorias.map(cat => {
            const qtdEquipes = getAdversariosPorSub(cat.id).length;
            return (
              <TouchableOpacity key={cat.id} style={styles.cardCategoriaOcian} onPress={() => setSubSelecionadoId(cat.id)}>
                <View style={[styles.iconCircleOcian, { backgroundColor: '#2a2a2a' }]}><MaterialCommunityIcons name="shield-outline" size={28} color={colors.azulClaro} /></View>
                <Text style={styles.catOcianNome}>{cat.nome}</Text>
                <Text style={styles.catOcianBadgeTxt}>{qtdEquipes} equipes</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    );
  };

  if (elencoSubVisivel && categoriaElenco) {
    return (
      <ElencoSub
        categoria={categoriaElenco}
        jogadores={jogadores.filter(j => Number(j.categoria_id) === Number(categoriaElenco.id))}
        onFechar={() => setElencoSubVisivel(false)}
        onRecarregar={() => carregarDados(true)}
      />
    );
  }

  return (
    <View style={styles.container}>
      <Header title="EQUIPES" showLogo={false} showProfile={false} btnVoltar="arrow-left" onBtnVoltar={onFechar} semSafeArea={noModal} />

      <View style={styles.segmentedControl}>
        {(['ocian', 'adversarios', 'campeonatos'] as const).map(aba => (
          <TouchableOpacity key={aba} style={[styles.segmentBtn, abaAtiva === aba && styles.segmentBtnAtivo]} onPress={() => { setAbaAtiva(aba); setSubSelecionadoId(null); setBusca(''); }}>
            <Text style={[styles.segmentTxt, abaAtiva === aba && styles.segmentTxtAtivo]}>
              {aba === 'ocian' ? 'CFA OCIAN' : aba === 'adversarios' ? 'ADVERSÁRIOS' : 'CAMPEONATOS'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {carregando ? <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} /> : (
          abaAtiva === 'ocian' ? renderCFAOcian() :
          abaAtiva === 'adversarios' ? renderAdversarios() : (
            <View>
              <View style={styles.buscaContainer}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.text_secondary} />
                <TextInput style={styles.buscaInput} placeholder="Buscar campeonato..." placeholderTextColor={colors.text_secondary} value={busca} onChangeText={setBusca} />
              </View>
              {competicoesFiltradas.length === 0 ? (
                <EmptyState icone="trophy-outline" mensagem="Nenhum campeonato" onAction={() => iniciarWizardCampeonato()} labelAction="Criar Campeonato" />
              ) : (
                competicoesFiltradas.map(comp => (
                    <TouchableOpacity
                      key={comp.id}
                      style={styles.cardLista}
                      onPress={() => setDetalhesComp(comp)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.cardLeft}>
                        <View style={styles.escudoPlaceholder}>
                          <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.azulClaro} />
                        </View>
                        <View style={{ flexShrink: 1 }}>
                          <Text style={styles.cardNome} numberOfLines={2}>{comp.nome}</Text>
                          <Text style={styles.cardSub}>{comp.ano} • {comp.tipo}</Text>
                        </View>
                      </View>
                      <View style={styles.cardAcoes}>
                        <TouchableOpacity 
                          style={styles.btnAcao}
                          onPress={(e) => { e.stopPropagation(); iniciarWizardCampeonato(comp); }}
                        >
                          <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.azulClaro} />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.btnAcao, styles.btnAcaoDanger]}
                          onPress={(e) => { e.stopPropagation(); setItemSelecionado(comp); setModalConfirmar(true); }}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  ))
              )}
            </View>
          )
        )}
        <View style={{ height: 100 }} />
      </ScrollView>

      {abaAtiva !== 'ocian' && (abaAtiva === 'campeonatos' || (abaAtiva === 'adversarios' && subSelecionadoId !== null)) && (
        <TouchableOpacity style={styles.fab} onPress={() => abaAtiva === 'campeonatos' ? iniciarWizardCampeonato() : abrirFormAdversario()} activeOpacity={0.8}>
          <MaterialCommunityIcons name="plus" size={30} color="#FFF" />
        </TouchableOpacity>
      )}

      {/* ── MODAL ELENCO OCIAN (SOMENTE LEITURA) ── */}
      <Modal visible={modalElenco} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setModalElenco(false)}>
          <View style={[styles.modalCard, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>Elenco {itemSelecionado?.nome}</Text>
              <TouchableOpacity onPress={() => setModalElenco(false)}><MaterialCommunityIcons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            {jogadores.filter(j => j.categoria_id === itemSelecionado?.id).length === 0 ? (
              <EmptyState icone="account-group-outline" mensagem="Nenhum atleta cadastrado neste sub." />
            ) : (
              <FlatList
                data={jogadores.filter(j => j.categoria_id === itemSelecionado?.id)}
                keyExtractor={item => item.id.toString()}
                renderItem={({ item }) => (
                  <View style={styles.cardJogadorModal}>
                    <View style={styles.jogadorCamisa}><Text style={styles.jogadorCamisaTxt}>{item.numCamisa ?? '-'}</Text></View>
                    <View><Text style={styles.jogadorNome}>{item.nome}</Text><Text style={styles.jogadorPosicao}>{item.posicao}</Text></View>
                  </View>
                )}
              />
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ── MODAL FORM ADVERSÁRIOS ── */}
      <Modal visible={modalFormAdversario} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setModalFormAdversario(false)}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitulo}>{itemSelecionado ? 'Editar' : 'Novo'} Adversário</Text>
              <TouchableOpacity onPress={() => setModalFormAdversario(false)}><MaterialCommunityIcons name="close" size={22} color={colors.text} /></TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.escudoPicker} onPress={escolherImagem}>
              {escudoUri || escudoUrl ? <Image source={{ uri: escudoUri || escudoUrl || '' }} style={styles.escudoPickerImg} /> : (
                <><MaterialCommunityIcons name="camera-plus-outline" size={28} color={colors.text_secondary} /><Text style={styles.escudoPickerTxt}>Adicionar escudo</Text></>
              )}
            </TouchableOpacity>
            <Text style={styles.modalSubtitulo}>Selecione a categoria do adversário:</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {categorias.map(cat => (
                <TouchableOpacity key={cat.id} style={[styles.pill, categoriaFormId === cat.id && styles.pillActive]} onPress={() => setCategoriaFormId(cat.id)}>
                  <Text style={[styles.pillText, categoriaFormId === cat.id && styles.pillTextActive]}>{cat.nome}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.inputRow}>
              <MaterialCommunityIcons name="shield-outline" size={18} color={colors.text_secondary} />
              <TextInput style={styles.input} placeholder="Nome do Time" placeholderTextColor={colors.text_secondary} value={nomeForm} onChangeText={setNomeForm} />
            </View>
            <TouchableOpacity style={styles.btnSalvar} onPress={salvarAdversario} disabled={salvando}>
              {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSalvarTxt}>SALVAR</Text>}
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      {/* ── WIZARD DE CAMPEONATOS ── */}
      <Modal visible={wizardVisivel} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          {/* Trocado Pressable para View para não fechar clicando fora */}
          <Pressable style={[styles.modalCard, { maxHeight: '90%' }]}>

            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => {
                  if (wizardStep === 'INFO') setWizardVisivel(false);
                  else if (wizardStep === 'SUBS') setWizardStep('INFO');
                  else if (wizardStep === 'ELENCO') setWizardStep('SUBS');
                  else if (wizardStep === 'JOGOS') setWizardStep('SUBS');
                }}
                style={{ padding: 4 }}
              >
                <MaterialCommunityIcons name={wizardStep === 'INFO' ? 'close' : 'arrow-left'} size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitulo}>
                {wizardStep === 'INFO' ? 'Dados do Torneio' :
                 wizardStep === 'SUBS' ? 'Escalar Categorias' :
                 wizardStep === 'ELENCO' ? `Súmula: ${wizardSubAtivo?.nome}` : 'Tabela de Jogos'}
              </Text>
              <View style={{ width: 32 }} />
            </View>

            <View style={styles.wizardProgress}>
              {['INFO', 'SUBS', 'JOGOS'].map((step) => (
                <View key={step} style={[styles.wizardDot, (wizardStep === step || (wizardStep === 'ELENCO' && step === 'SUBS')) && styles.wizardDotActive]} />
              ))}
            </View>

            {/* PASSO 1 - INFO */}
            {wizardStep === 'INFO' && (
              <View>
                <Text style={styles.modalSubtitulo}>Qual a faixa etária do campeonato?</Text>
                <View style={[styles.tipoSwitchContainer, { marginBottom: 16 }]}>
                  <TouchableOpacity style={[styles.tipoSwitchBtn, tipoForm === 'INICIACAO' && styles.tipoSwitchBtnAtivo]} onPress={() => setTipoForm('INICIACAO')}>
                    <Text style={[styles.tipoSwitchTxt, tipoForm === 'INICIACAO' && styles.tipoSwitchTxtAtivo]}>INICIAÇÃO</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.tipoSwitchBtn, tipoForm === 'BASE' && styles.tipoSwitchBtnAtivo]} onPress={() => setTipoForm('BASE')}>
                    <Text style={[styles.tipoSwitchTxt, tipoForm === 'BASE' && styles.tipoSwitchTxtAtivo]}>BASE</Text>
                  </TouchableOpacity>
                </View>
                <View style={[styles.inputRow, { marginBottom: 12 }]}>
                  <MaterialCommunityIcons name="trophy-outline" size={18} color={colors.text_secondary} />
                  <TextInput style={styles.input} placeholder="Nome do Campeonato" placeholderTextColor={colors.text_secondary} value={nomeForm} onChangeText={setNomeForm} />
                </View>
                <View style={[styles.inputRow, { marginBottom: 24 }]}>
                  <MaterialCommunityIcons name="calendar-outline" size={18} color={colors.text_secondary} />
                  <TextInput style={styles.input} placeholder="Ano" placeholderTextColor={colors.text_secondary} value={anoForm} onChangeText={setAnoForm} keyboardType="numeric" maxLength={4} />
                </View>
                <TouchableOpacity style={styles.btnSalvar} onPress={avancarWizardParaSubs} disabled={salvando}>
                  {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSalvarTxt}>SALVAR E AVANÇAR</Text>}
                </TouchableOpacity>
              </View>
            )}

            {/* PASSO 2 - SUBS */}
            {wizardStep === 'SUBS' && (
              <View>
                <Text style={[styles.sectionLabel, { marginBottom: 16 }]}>QUAIS SUBS IRÃO COMPETIR?</Text>
                <View style={styles.gridCategorias}>
                  {categorias.filter(c => getTipoCategoria(c.nome) === tipoForm).map(cat => {
                    const totalSelecionados = elencoSelecionado[cat.id]?.length || 0;
                    const vazio = totalSelecionados === 0;
                    return (
                      <TouchableOpacity key={cat.id} style={styles.cardCategoriaOcian} onPress={() => abrirSelecaoElenco(cat)}>
                        <View style={[styles.iconCircleOcian, {
                          backgroundColor: vazio ? '#1e1e1e' : colors.primary + '22',
                        }]}>
                          <MaterialCommunityIcons
                            name={vazio ? 'account-plus-outline' : 'check-all'}
                            size={28}
                            color={vazio ? colors.text_secondary : colors.primary}
                          />
                        </View>
                        <Text style={styles.catOcianNome}>{cat.nome}</Text>
                        <Text style={[styles.catOcianBadgeTxt, { color: vazio ? colors.text_secondary : colors.primary }]}>
                          {vazio ? 'Nenhum selecionado' : `${totalSelecionados} selecionados`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <TouchableOpacity style={[styles.btnSalvar, { marginTop: 24 }]} onPress={avancarParaJogos} disabled={salvando}>
                  {salvando ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnSalvarTxt}>IR PARA TABELA DE JOGOS</Text>}
                </TouchableOpacity>
              </View>
            )}

           {/* PASSO 3 - ELENCO */}
            {wizardStep === 'ELENCO' && wizardSubAtivo && (() => {
              const jogadoresDoCat = jogadores.filter(j => Number(j.categoria_id) === Number(wizardSubAtivo.id));
              
              // ── Lógica do Selecionar Todos ──
              const selecionadosDestaCategoria = elencoSelecionado[wizardSubAtivo.id] || [];
              const todosSelecionados = jogadoresDoCat.length > 0 && jogadoresDoCat.every(j => selecionadosDestaCategoria.includes(j.id));

              const toggleSelecionarTodos = () => {
                setElencoSelecionado(prev => {
                  if (todosSelecionados) {
                    // Se já estão todos marcados, desmarca tudo
                    return { ...prev, [wizardSubAtivo.id]: [] };
                  } else {
                    // Se não, marca o ID de todos os jogadores da tela
                    const todosIds = jogadoresDoCat.map(j => j.id);
                    return { ...prev, [wizardSubAtivo.id]: todosIds };
                  }
                });
              };

              return (
                <View>
                  <Text style={[styles.modalSubtitulo, { marginBottom: 12 }]}>
                    {jogadoresDoCat.length} atleta{jogadoresDoCat.length !== 1 ? 's' : ''} no {wizardSubAtivo.nome}
                  </Text>
                  {jogadoresDoCat.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 32 }}>
                      <MaterialCommunityIcons name="account-off-outline" size={44} color="#333" />
                      <Text style={{ color: '#555', marginTop: 8, textAlign: 'center' }}>Nenhum atleta cadastrado neste sub.</Text>
                    </View>
                  ) : (
                    <View>
                      {/* BOTÃO SELECIONAR TODOS */}
                      <TouchableOpacity
                        style={[styles.cardJogadorModal, { marginBottom: 12, backgroundColor: '#1a1a1a', borderColor: '#444' }]}
                        onPress={toggleSelecionarTodos}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons 
                          name={todosSelecionados ? 'checkbox-marked' : 'checkbox-blank-outline'} 
                          size={24} 
                          color={todosSelecionados ? colors.primary : colors.text_secondary} 
                        />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                          <Text style={[styles.jogadorNome, { color: colors.azulClaro }]}>Selecionar Todos</Text>
                          <Text style={styles.jogadorPosicao}>
                            {todosSelecionados ? 'Desmarcar todos os atletas' : 'Convocar todo o elenco'}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <ScrollView style={{ maxHeight: 450 }} showsVerticalScrollIndicator={false}>
                        {jogadoresDoCat.map(item => {
                          const selecionado = !!(elencoSelecionado[wizardSubAtivo.id]?.includes(item.id));
                          return (
                            <TouchableOpacity
                              key={item.id.toString()}
                              style={[styles.cardJogadorModal, selecionado && { borderColor: colors.primary, backgroundColor: colors.primary + '11' }]}
                              onPress={() => toggleJogadorElenco(item.id)}
                              activeOpacity={0.7}
                            >
                              <MaterialCommunityIcons name={selecionado ? 'checkbox-marked' : 'checkbox-blank-outline'} size={24} color={selecionado ? colors.primary : colors.text_secondary} />
                              <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={styles.jogadorNome}>{item.nome}</Text>
                                <Text style={styles.jogadorPosicao}>{item.posicao} • #{item.numCamisa ?? '—'}</Text>
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}
                  <TouchableOpacity style={[styles.btnSalvar, { marginTop: 16 }]} onPress={() => setWizardStep('SUBS')}>
                    <Text style={styles.btnSalvarTxt}>CONFIRMAR ELENCO</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}

            {/* PASSO 4 - JOGOS */}
            {wizardStep === 'JOGOS' && (
              <View style={{ gap: 16, paddingVertical: 10 }}>

                {/* Resultado da última importação */}
                {resultadoImport && (
                  <View style={{ backgroundColor: '#1a1a1a', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: resultadoImport.criados > 0 ? colors.primary : colors.vermelho }}>
                    <Text style={{ color: colors.text, fontWeight: '700', marginBottom: 4 }}>Importação concluída</Text>
                    <Text style={{ color: colors.text_secondary, fontSize: 13 }}>
                      {resultadoImport.criados} partidas criadas • {resultadoImport.pulados} ignoradas
                    </Text>
                    <TouchableOpacity onPress={() => setResultadoImport(null)} style={{ marginTop: 8, alignSelf: 'flex-end' }}>
                      <Text style={{ color: colors.text_secondary, fontSize: 12 }}>Limpar</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* Criação Manual */}
                <TouchableOpacity
                  style={styles.wizardOptionCard}
                  onPress={() => { setWizardVisivel(false); setModalOrganizarCamp(true); }}
                  activeOpacity={0.8}
                >
                  <View style={styles.wizardOptionIcon}>
                    <MaterialCommunityIcons name="calendar-edit" size={32} color={colors.azulClaro} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.wizardOptionTitle}>Criação Manual</Text>
                    <Text style={styles.wizardOptionSub}>Adicione os jogos da rodada um por um, definindo adversário, rodada e horário.</Text>
                  </View>
                </TouchableOpacity>

                {/* Importar CSV / PDF */}
                <TouchableOpacity
                  style={[styles.wizardOptionCard, { borderColor: colors.primary, opacity: importando ? 0.6 : 1 }]}
                  onPress={() => !importando && importarArquivo('documento')}
                  activeOpacity={0.8}
                  disabled={importando}
                >
                  <View style={[styles.wizardOptionIcon, { backgroundColor: colors.primary + '22' }]}>
                    {importando
                      ? <ActivityIndicator color={colors.primary} size={28} />
                      : <MaterialCommunityIcons name="file-upload-outline" size={32} color={colors.primary} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.wizardOptionTitle, { color: colors.primary }]}>Importar CSV / PDF</Text>
                    <Text style={styles.wizardOptionSub}>Envie a tabela da federação e a IA cria todos os jogos automaticamente.</Text>
                  </View>
                </TouchableOpacity>

                {importando && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary + '11', borderRadius: 8, padding: 12 }}>
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={{ color: colors.primary, fontSize: 13, flex: 1 }}>Analisando o arquivo com IA...</Text>
                  </View>
                )}

                <TouchableOpacity 
                  style={{ paddingVertical: 14, alignItems: 'center', marginTop: 12, borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', backgroundColor: '#1a1a1a' }} 
                  onPress={() => { setWizardVisivel(false); carregarDados(); }} 
                  disabled={importando}
                >
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 }}>FINALIZAR CRIAÇÃO</Text>
                </TouchableOpacity>
              </View>
            )}

          </Pressable>
        </View>
      </Modal>

      {/* ── MODAL ORGANIZAR PARTIDA (CAMPEONATO) ── */}
      <Modal visible={modalOrganizarCamp} transparent={false} animationType="slide">
        {itemSelecionado && 'ano' in itemSelecionado && (
          <OrganizarPartidaCampeonato
            competicao={itemSelecionado as Competicao}
            onFechar={() => setModalOrganizarCamp(false)}
            onSalvo={() => { setModalOrganizarCamp(false); carregarDados(true); }}
          />
        )}
      </Modal>

      {/* ── TELA DETALHES CAMPEONATO ── */}
      <Modal visible={!!detalhesComp} transparent={false} animationType="slide">
        {detalhesComp && (
          <DetalhesCompeticao
            competicao={detalhesComp}
            onFechar={() => setDetalhesComp(null)}
          />
        )}
      </Modal>

      {/* ── MODAL CONFIRMAR EXCLUSÃO ── */}
      <Modal visible={modalConfirmar} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setModalConfirmar(false)}>
          <View style={[styles.modalCard, { alignItems: 'center' }]}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color={colors.vermelho} style={{ marginBottom: 8 }} />
            <Text style={styles.modalTitulo}>Excluir</Text>
            <Text style={styles.modalSubtitulo}>Tem certeza que deseja excluir "{itemSelecionado?.nome}"?</Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.btnNao} onPress={() => setModalConfirmar(false)}><Text style={styles.txtNao}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.btnSim} onPress={excluir}><Text style={styles.txtSim}>EXCLUIR</Text></TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}