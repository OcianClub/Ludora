import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
  FlatList,
  TextInput,
  Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { colors } from '@/src/theme/colors';
import { styles } from '@/src/styles/detalhesPartidaStyles';
import EscalacaoPartida, { JogadorEscalado } from '@/src/components/EscalacaoPartida';
import {
  atualizarStatusPartida,
  atualizarPlacarPartida,
  criarEvento,
  fetchEventosDaPartida,
  deletarEvento,
  atualizarPartida,
  fetchTimes,
  BASE_URL,
} from '@/src/services/api';

// ── Tipos ─────────────────────────────────────────────────────────────────────
export interface Partida {
  id: number;
  mandante: { id: number; nome: string; escudo: string | null };
  visitante: { id: number; nome: string; escudo: string | null };
  gols_mandante: number;
  gols_visitante: number;
  data: string;
  horario: string | null;
  local: string | null;
  status: 'AGENDADA' | 'AO_VIVO' | 'FINALIZADA';
  emCasa: boolean;
  categoria: { id: number; nome: string } | null;
  competicao?: { id: number; nome: string; ano?: number; tipo: 'INICIACAO' | 'BASE' } | null;
  competicao_id?: number | null;
  rodada?: number | null;
  grupo?: string | null;
}

type TipoEvento =
  | 'GOL'
  | 'CARTAO_AMARELO'
  | 'CARTAO_VERMELHO'
  | 'CARTAO_AZUL'
  | 'FALTA'
  | 'DEFESA'
  | 'ASSISTENCIA';

interface Evento {
  id: number;
  tipo: TipoEvento;
  minuto?: number | null;
  periodo?: number | null;
  jogador_id?: number | null;
  doOcian?: boolean;
  jogador?: { id: number; nome: string } | null;
}

interface Time {
  id: number;
  nome: string;
  escudo: string | null;
  categoria_id: number;
}

interface Props {
  partida: Partida;
  isAdmin: boolean;
  onBack: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isHoje(dataStr: string): boolean {
  const hoje = new Date();
  const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
  return (
    hoje.getFullYear() === ano &&
    hoje.getMonth() + 1 === mes &&
    hoje.getDate() === dia
  );
}

function getPeriodos(nomeCategoria: string | undefined): string[] {
  const nome = (nomeCategoria ?? '').toLowerCase();
  if (nome.includes('18') || nome.includes('16')) return ['1º Tempo', '2º Tempo'];
  return ['1º Tempo', '2º Tempo', '3º Tempo', '4º Tempo'];
}

function LogoTime({ uri, size = 56 }: { uri: string | null; size?: number }) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: 10, resizeMode: 'contain', backgroundColor: '#1e1e1e' }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: 10, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center' }}>
      <MaterialCommunityIcons name="shield-outline" size={size * 0.5} color="#333" />
    </View>
  );
}

function EscudoTime({ escudo, nome, size = 40 }: { escudo: string | null; nome: string; size?: number }) {
  if (escudo) {
    return (
      <Image
        source={{ uri: escudo }}
        style={{ width: size, height: size, resizeMode: 'contain', borderRadius: size * 0.2 }}
      />
    );
  }
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.25, backgroundColor: '#1e1e1e', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#2a2a2a' }}>
      <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: size * 0.28 }}>
        {nome.split(' ').map(p => p[0]).join('').slice(0, 3).toUpperCase()}
      </Text>
    </View>
  );
}

// ── Ícones por tipo de evento ──────────────────────────────────────────────────
function EventoIcon({ tipo, size = 16 }: { tipo: TipoEvento; size?: number }) {
  switch (tipo) {
    case 'GOL':
      return <MaterialCommunityIcons name="soccer" size={size} color={colors.primary} />;
    case 'CARTAO_AMARELO':
      return <View style={{ width: size * 0.65, height: size, borderRadius: 2, backgroundColor: '#F5C518' }} />;
    case 'CARTAO_VERMELHO':
      return <View style={{ width: size * 0.65, height: size, borderRadius: 2, backgroundColor: colors.vermelho }} />;
    case 'CARTAO_AZUL':
      return <View style={{ width: size * 0.65, height: size, borderRadius: 2, backgroundColor: '#3A9EFF' }} />;
    case 'FALTA':
      return <MaterialCommunityIcons name="whistle" size={size} color={colors.text_secondary} />;
    case 'DEFESA':
      return <MaterialCommunityIcons name="shield-check" size={size} color={colors.azulClaro} />;
    case 'ASSISTENCIA':
      return <MaterialCommunityIcons name="shoe-cleat" size={size} color={colors.primary} />;
    default:
      return null;
  }
}

const EVENTO_LABEL: Record<TipoEvento, string> = {
  GOL: 'Gol',
  CARTAO_AMARELO: 'Cartão Amarelo',
  CARTAO_VERMELHO: 'Cartão Vermelho',
  CARTAO_AZUL: 'Cartão Azul',
  FALTA: 'Falta',
  DEFESA: 'Defesa',
  ASSISTENCIA: 'Assistência',
};

// ── Stats por jogador ──────────────────────────────────────────────────────────
interface PlayerStats {
  gols: number;
  assistencias: number;
  faltas: number;
  amarelos: number;
  vermelhos: number;
  azuis: number;
  defesas: number;
}

function calcularStats(eventos: Evento[], jogador_id: number): PlayerStats {
  return eventos.filter(e => e.jogador_id === jogador_id).reduce((acc, e) => {
    if (e.tipo === 'GOL') acc.gols++;
    if (e.tipo === 'ASSISTENCIA') acc.assistencias++;
    if (e.tipo === 'FALTA') acc.faltas++;
    if (e.tipo === 'CARTAO_AMARELO') acc.amarelos++;
    if (e.tipo === 'CARTAO_VERMELHO') acc.vermelhos++;
    if (e.tipo === 'CARTAO_AZUL') acc.azuis++;
    if (e.tipo === 'DEFESA') acc.defesas++;
    return acc;
  }, { gols: 0, assistencias: 0, faltas: 0, amarelos: 0, vermelhos: 0, azuis: 0, defesas: 0 });
}

function StatBadge({ icon, value, color }: { icon: React.ReactNode; value: number; color: string }) {
  if (value === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: color + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, borderWidth: 1, borderColor: color + '44' }}>
      {icon}
      <Text style={{ fontFamily: 'Creato-Bold', color, fontSize: 11 }}>{value}</Text>
    </View>
  );
}

function MiniStats({ eventos, jogadorId }: { eventos: Evento[]; jogadorId: number }) {
  const s = calcularStats(eventos, jogadorId);
  const temStat = s.gols > 0 || s.assistencias > 0 || s.faltas > 0 || s.amarelos > 0 || s.vermelhos > 0 || s.azuis > 0 || s.defesas > 0;
  
  if (!temStat) return null;
  
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      <StatBadge icon={<MaterialCommunityIcons name="soccer" size={9} color={colors.primary} />} value={s.gols} color={colors.primary} />
      <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={9} color={colors.primary} />} value={s.assistencias} color={colors.primary} />
      <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={9} color={colors.azulClaro} />} value={s.defesas} color={colors.azulClaro} />
      <StatBadge icon={<MaterialCommunityIcons name="whistle" size={9} color="#aaa" />} value={s.faltas} color="#888" />
      <StatBadge icon={<View style={{ width: 6, height: 9, borderRadius: 1, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
      <StatBadge icon={<View style={{ width: 6, height: 9, borderRadius: 1, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
      <StatBadge icon={<View style={{ width: 6, height: 9, borderRadius: 1, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
    </View>
  );
}

// ── Componente ────────────────────────────────────────────────────────────────
export default function DetalhesPartida({ partida: partidaInicial, isAdmin, onBack }: Props) {
  const [partida, setPartida] = useState<Partida>(partidaInicial);
  const [golsMandante, setGolsMandante] = useState(partidaInicial.gols_mandante);
  const [golsVisitante, setGolsVisitante] = useState(partidaInicial.gols_visitante);
  const [periodoIdx, setPeriodoIdx] = useState(0);
  const [salvandoPlacar, setSalvandoPlacar] = useState(false);
  const [escalacao, setEscalacao] = useState<JogadorEscalado[]>([]);
  const [salvandoEvento, setSalvandoEvento] = useState(false);
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [modoEdicao, setModoEdicao] = useState(false);

  // ── Modal evento genérico (sem gol) ──
  const [modalEvento, setModalEvento] = useState<{ tipo: TipoEvento; label: string } | null>(null);
  const [jogadorEvento, setJogadorEvento] = useState<JogadorEscalado | null>(null);

  // ── Modal de gol: + ou - ──
  const [modalGol, setModalGol] = useState<{ lado: 'mandante' | 'visitante'; delta: 1 | -1 } | null>(null);
  const [jogadorGol, setJogadorGol] = useState<JogadorEscalado | null>(null);
  const [eventoGolRemover, setEventoGolRemover] = useState<Evento | null>(null);

  // ── Eventos ──
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [deletandoEvento, setDeletandoEvento] = useState<number | null>(null);

  // ── Editar partida (modal full-screen) ──
  const [modalEditar, setModalEditar] = useState(false);
  const [times, setTimes] = useState<Time[]>([]);
  const [carregandoTimes, setCarregandoTimes] = useState(false);
  const [editMandante, setEditMandante] = useState<Time | null>(null);
  const [editVisitante, setEditVisitante] = useState<Time | null>(null);
  const [editRodada, setEditRodada] = useState('');
  const [editData, setEditData] = useState('');
  const [editHorario, setEditHorario] = useState('');
  const [editLocal, setEditLocal] = useState('');
  const [editEmCasa, setEditEmCasa] = useState(true);
  const [modalTimeEdit, setModalTimeEdit] = useState<'mandante' | 'visitante' | null>(null);
  const [buscaTime, setBuscaTime] = useState('');
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);
  const [modalDeletar, setModalDeletar] = useState(false);
  const [deletandoPartida, setDeletandoPartida] = useState(false);

  const periodos = getPeriodos(partida.categoria?.nome);
  const isInterativo = isAdmin && (partida.status === 'AO_VIVO' || modoEdicao);

  // Ocian é mandante quando emCasa = true
  const ocianEhMandante = partida.emCasa;

  const timesFiltrados = times.filter(t =>
    t.categoria_id === (partida.categoria?.id ?? 0) &&
    t.nome.toLowerCase().includes(buscaTime.toLowerCase())
  );

  // ── Carregar eventos ───────────────────────────────────────────────────────
  const carregarEventos = useCallback(async () => {
    if (partida.status === 'AGENDADA') return;
    setCarregandoEventos(true);
    try {
      setEventos(await fetchEventosDaPartida(partida.id));
    } catch {
      /* silencioso */
    } finally {
      setCarregandoEventos(false);
    }
  }, [partida.id, partida.status]);

  useEffect(() => {
    carregarEventos();
  }, [carregarEventos]);

  // ── Salvar placar ──────────────────────────────────────────────────────────
  const salvarPlacar = async (m: number, v: number) => {
    setSalvandoPlacar(true);
    try {
      await atualizarPlacarPartida(partida.id, m, v);
    } catch {
      Alert.alert('Erro', 'Não foi possível atualizar o placar.');
    } finally {
      setSalvandoPlacar(false);
    }
  };

  // ── + / - no placar ───────────────────────────────────────────────────────
  const onPlusLado = (lado: 'mandante' | 'visitante') => {
    const ocianEsseLado = (lado === 'mandante' && ocianEhMandante) || (lado === 'visitante' && !ocianEhMandante);
    if (ocianEsseLado) {
      setModalGol({ lado, delta: 1 });
    } else {
      const novoM = lado === 'mandante' ? golsMandante + 1 : golsMandante;
      const novoV = lado === 'visitante' ? golsVisitante + 1 : golsVisitante;
      setGolsMandante(novoM);
      setGolsVisitante(novoV);
      salvarPlacar(novoM, novoV);
    }
  };

  const onMinusLado = (lado: 'mandante' | 'visitante') => {
    const ocianEsseLado = (lado === 'mandante' && ocianEhMandante) || (lado === 'visitante' && !ocianEhMandante);
    if (ocianEsseLado) {
      setModalGol({ lado, delta: -1 });
    } else {
      const novoM = lado === 'mandante' ? Math.max(0, golsMandante - 1) : golsMandante;
      const novoV = lado === 'visitante' ? Math.max(0, golsVisitante - 1) : golsVisitante;
      setGolsMandante(novoM);
      setGolsVisitante(novoV);
      salvarPlacar(novoM, novoV);
    }
  };

  // ── Confirmar gol (+ Ocian) ────────────────────────────────────────────────
  const confirmarGolOcian = async (jogador: JogadorEscalado | null, isGolContra: boolean) => {
    if (!modalGol) return;
    setSalvandoEvento(true);
    try {
      await criarEvento(partida.id, {
        tipo: 'GOL',
        minuto: null,
        periodo: periodoIdx + 1,
        jogador_id: isGolContra ? null : jogador?.jogador_id ?? null,
        doOcian: true,
      });
      const novoM = modalGol.lado === 'mandante' ? golsMandante + 1 : golsMandante;
      const novoV = modalGol.lado === 'visitante' ? golsVisitante + 1 : golsVisitante;
      
      setGolsMandante(novoM);
      setGolsVisitante(novoV);
      await atualizarPlacarPartida(partida.id, novoM, novoV);
      
      setModalGol(null);
      setJogadorGol(null);
      await carregarEventos();
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o gol.');
    } finally {
      setSalvandoEvento(false);
    }
  };

  // ── Remover gol (- Ocian) ──────────────────────────────────────────────────
  const confirmarRemoverGol = async (evento: Evento) => {
    if (!modalGol) return;
    setDeletandoEvento(evento.id);
    try {
      await deletarEvento(evento.id);
      const novoM = modalGol.lado === 'mandante' ? Math.max(0, golsMandante - 1) : golsMandante;
      const novoV = modalGol.lado === 'visitante' ? Math.max(0, golsVisitante - 1) : golsVisitante;
      
      setGolsMandante(novoM);
      setGolsVisitante(novoV);
      await atualizarPlacarPartida(partida.id, novoM, novoV);
      
      setModalGol(null);
      setEventoGolRemover(null);
      await carregarEventos();
    } catch {
      Alert.alert('Erro', 'Não foi possível remover o gol.');
    } finally {
      setDeletandoEvento(null);
    }
  };

  // ── Confirmar evento genérico (sem gol) ───────────────────────────────────
  const confirmarEvento = async () => {
    if (!modalEvento || !jogadorEvento) return;
    setSalvandoEvento(true);
    try {
      await criarEvento(partida.id, {
        tipo: modalEvento.tipo,
        minuto: null,
        periodo: periodoIdx + 1,
        jogador_id: jogadorEvento.jogador_id,
        doOcian: true,
      });
      setModalEvento(null);
      setJogadorEvento(null);
      await carregarEventos();
    } catch {
      Alert.alert('Erro', 'Não foi possível registrar o evento.');
    } finally {
      setSalvandoEvento(false);
    }
  };

  // ── Deletar evento avulso ──────────────────────────────────────────────────
  const handleDeletarEvento = (evento: Evento) => {
    Alert.alert(
      'Remover Evento',
      `Remover "${EVENTO_LABEL[evento.tipo]}"${evento.jogador ? ` de ${evento.jogador.nome}` : ''}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            setDeletandoEvento(evento.id);
            try {
              await deletarEvento(evento.id);
              await carregarEventos();
            } catch {
              Alert.alert('Erro', 'Não foi possível remover o evento.');
            } finally {
              setDeletandoEvento(null);
            }
          },
        },
      ]
    );
  };

  // ── Finalizar partida ──────────────────────────────────────────────────────
  const iniciarPartida = async () => {
    const qtde = escalacao.filter(e => e.titular).length;
    if (qtde !== 5) {
      Alert.alert('Atenção', `Para iniciar é obrigatório definir exatamente 5 titulares. Atualmente há ${qtde}.`);
      return;
    }
    try {
      await atualizarStatusPartida(partida.id, 'AO_VIVO');
      setPartida(p => ({ ...p, status: 'AO_VIVO' }));
    } catch {
      Alert.alert('Erro', 'Não foi possível iniciar a partida.');
    }
  };

  const finalizarPartida = async () => {
    setModalFinalizar(false);
    try {
      await atualizarStatusPartida(partida.id, 'FINALIZADA');
      setPartida(p => ({ ...p, status: 'FINALIZADA' }));
      setModoEdicao(false);
    } catch {
      Alert.alert('Erro', 'Não foi possível finalizar a partida.');
    }
  };

  // ── Editar partida — abrir modal ───────────────────────────────────────────
  const abrirEditar = async () => {
    const rawData = partida.data?.split('T')[0] ?? '';
    const [ano, mes, dia] = rawData.split('-');
    
    setEditData(rawData ? `${dia}/${mes}` : '');
    setEditHorario(partida.horario ?? '');
    setEditLocal(partida.local ?? '');
    setEditEmCasa(partida.emCasa);
    setEditRodada(partida.rodada ? String(partida.rodada) : '');
    setEditMandante(null);
    setEditVisitante(null);
    setModalEditar(true);

    if (times.length === 0) {
      setCarregandoTimes(true);
      try {
        const dados = await fetchTimes();
        setTimes(dados);
        setEditMandante(dados.find((t: Time) => t.id === partida.mandante.id) ?? null);
        setEditVisitante(dados.find((t: Time) => t.id === partida.visitante.id) ?? null);
      } catch {
        Alert.alert('Erro', 'Não foi possível carregar os times.');
      } finally {
        setCarregandoTimes(false);
      }
    } else {
      setEditMandante(times.find(t => t.id === partida.mandante.id) ?? null);
      setEditVisitante(times.find(t => t.id === partida.visitante.id) ?? null);
    }
  };

  const handleEditData = (text: string) => {
    const n = text.replace(/\D/g, '');
    setEditData(n.length > 2 ? `${n.slice(0, 2)}/${n.slice(2, 4)}` : n);
  };

  const handleEditHorario = (text: string) => {
    const n = text.replace(/\D/g, '');
    setEditHorario(n.length > 2 ? `${n.slice(0, 2)}:${n.slice(2, 4)}` : n);
  };

  const salvarEdicaoPartida = async () => {
    if (!editMandante || !editVisitante) return Alert.alert('Atenção', 'Selecione o mandante e o visitante.');
    if (editData.length < 5 || editHorario.length < 5) return Alert.alert('Atenção', 'Preencha data (DD/MM) e horário (HH:MM).');
    
    setSalvandoEdicao(true);
    try {
      const [dia, mes] = editData.split('/');
      const ano = new Date().getFullYear();
      const isoData = `${ano}-${mes}-${dia}`;
      
      await atualizarPartida(partida.id, {
        mandante_id: editMandante.id,
        visitante_id: editVisitante.id,
        data: isoData,
        horario: editHorario,
        local: editLocal || undefined,
        emCasa: editEmCasa,
        rodada: editRodada ? Number(editRodada) : undefined,
      });
      
      setPartida(prev => ({
        ...prev,
        mandante: { ...prev.mandante, id: editMandante.id, nome: editMandante.nome, escudo: editMandante.escudo },
        visitante: { ...prev.visitante, id: editVisitante.id, nome: editVisitante.nome, escudo: editVisitante.escudo },
        data: isoData,
        horario: editHorario,
        local: editLocal || prev.local,
        emCasa: editEmCasa,
        rodada: editRodada ? Number(editRodada) : prev.rodada,
      }));
      
      setModalEditar(false);
      Alert.alert('Sucesso', 'Partida atualizada!');
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível salvar.');
    } finally {
      setSalvandoEdicao(false);
    }
  };

  // ── Deletar partida ────────────────────────────────────────────────────────
  const deletarPartida = async () => {
    setModalDeletar(false);
    setDeletandoPartida(true);
    try {
      const res = await fetch(`${BASE_URL}/partidas/${partida.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }
      onBack();
    } catch (e: any) {
      Alert.alert('Erro', e.message || 'Não foi possível deletar a partida.');
    } finally {
      setDeletandoPartida(false);
    }
  };

  // ── Cards de evento (sem gol) ──────────────────────────────────────────────
  const EVENTO_CARDS: { tipo: TipoEvento; label: string; icon: React.ReactNode }[] = [
    { tipo: 'CARTAO_AMARELO', label: 'Amarelo', icon: <View style={{ width: 15, height: 22, borderRadius: 3, backgroundColor: '#F5C518' }} /> },
    { tipo: 'CARTAO_VERMELHO', label: 'Vermelho', icon: <View style={{ width: 15, height: 22, borderRadius: 3, backgroundColor: colors.vermelho }} /> },
    { tipo: 'CARTAO_AZUL', label: 'Azul', icon: <View style={{ width: 15, height: 22, borderRadius: 3, backgroundColor: '#3A9EFF' }} /> },
    { tipo: 'FALTA', label: 'Falta', icon: <MaterialCommunityIcons name="whistle" size={22} color={colors.text_secondary} /> },
    { tipo: 'DEFESA', label: 'Defesa', icon: <MaterialCommunityIcons name="shield-check" size={22} color={colors.azulClaro} /> },
    { tipo: 'ASSISTENCIA', label: 'Assistência', icon: <MaterialCommunityIcons name="shoe-cleat" size={22} color={colors.primary} /> },
  ];

  const golsOcian = eventos.filter(e => e.tipo === 'GOL');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DETALHES DA PARTIDA</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isAdmin && partida.status === 'FINALIZADA' && (
            <TouchableOpacity
              style={[styles.headerEditBtn, modoEdicao && { backgroundColor: colors.primary, borderColor: colors.primary }]}
              onPress={() => setModoEdicao(!modoEdicao)}
            >
              <Text style={[styles.headerEditBtnText, modoEdicao && { color: '#fff' }]}>
                {modoEdicao ? 'CONCLUIR' : 'SCOUT'}
              </Text>
            </TouchableOpacity>
          )}
          {isAdmin && !modoEdicao && partida.status === 'AGENDADA' && (
            <TouchableOpacity style={styles.headerEditBtn} onPress={abrirEditar}>
              <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.text_secondary} />
            </TouchableOpacity>
          )}
          {isAdmin && !modoEdicao && partida.status === 'FINALIZADA' && (
            <TouchableOpacity style={styles.headerEditBtn} onPress={abrirEditar}>
              <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.text_secondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <View style={styles.heroCatRow}>
            <Text style={styles.heroCatText}>{partida.categoria?.nome ?? '—'}</Text>
            <View style={styles.heroDot} />
            <Text style={styles.heroCatText}>
              {partida.data ? new Date(partida.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : '—'}
            </Text>
          </View>
          <View style={styles.heroTeamsRow}>
            <View style={styles.heroTeamCol}>
              <LogoTime uri={partida.mandante.escudo} size={64} />
              <Text style={styles.heroTeamName} numberOfLines={2}>{partida.mandante.nome}</Text>
            </View>

            <View style={styles.heroScoreBlock}>
              {partida.status === 'AGENDADA' ? (
                <Text style={styles.heroVs}>VS</Text>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isInterativo ? (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.stepBtn, { width: 32, height: 32, borderRadius: 8 }]}
                        onPress={() => onPlusLado('mandante')}
                      >
                        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.heroScoreText}>{golsMandante}</Text>
                      <TouchableOpacity
                        style={[styles.stepBtn, styles.stepBtnMinus, { width: 32, height: 32, borderRadius: 8, opacity: golsMandante === 0 ? 0.3 : 1 }]}
                        onPress={() => { if (golsMandante > 0) onMinusLado('mandante'); }}
                        disabled={golsMandante === 0}
                      >
                        <MaterialCommunityIcons name="minus" size={18} color={colors.text_secondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.heroScoreText}>{golsMandante}</Text>
                  )}
                  
                  <View style={styles.heroScoreSeparator} />

                  {isInterativo ? (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity
                        style={[styles.stepBtn, { width: 32, height: 32, borderRadius: 8 }]}
                        onPress={() => onPlusLado('visitante')}
                      >
                        <MaterialCommunityIcons name="plus" size={18} color="#fff" />
                      </TouchableOpacity>
                      <Text style={styles.heroScoreText}>{golsVisitante}</Text>
                      <TouchableOpacity
                        style={[styles.stepBtn, styles.stepBtnMinus, { width: 32, height: 32, borderRadius: 8, opacity: golsVisitante === 0 ? 0.3 : 1 }]}
                        onPress={() => { if (golsVisitante > 0) onMinusLado('visitante'); }}
                        disabled={golsVisitante === 0}
                      >
                        <MaterialCommunityIcons name="minus" size={18} color={colors.text_secondary} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <Text style={styles.heroScoreText}>{golsVisitante}</Text>
                  )}
                </View>
              )}
              
              {partida.status === 'AO_VIVO' && (
                <View style={styles.liveBadge}>
                  <View style={styles.liveDot} />
                  <Text style={styles.liveBadgeText}>AO VIVO</Text>
                </View>
              )}
              
              {partida.status === 'FINALIZADA' && (
                <View style={styles.finishedBadge}>
                  <Text style={styles.finishedBadgeText}>ENCERRADO</Text>
                </View>
              )}
              
              {partida.status === 'AGENDADA' && (
                <View style={styles.scheduledBadge}>
                  <Text style={styles.scheduledBadgeText}>{partida.horario ?? 'AGENDADO'}</Text>
                </View>
              )}
            </View>
            <View style={styles.heroTeamCol}>
              <LogoTime uri={partida.visitante.escudo} size={64} />
              <Text style={styles.heroTeamName} numberOfLines={2}>{partida.visitante.nome}</Text>
            </View>
          </View>
        </View>

        <View style={styles.infoBar}>
          <View style={styles.infoBarItem}>
            <MaterialCommunityIcons name="map-marker-outline" size={16} color={colors.text_secondary} />
            <Text style={styles.infoBarLabel}>Local</Text>
            <Text style={styles.infoBarValue} numberOfLines={1}>{partida.local ?? 'Não definido'}</Text>
          </View>
          <View style={styles.infoBarDivider} />
          <View style={styles.infoBarItem}>
            <MaterialCommunityIcons name="clock-outline" size={16} color={colors.text_secondary} />
            <Text style={styles.infoBarLabel}>Horário</Text>
            <Text style={styles.infoBarValue}>{partida.horario ?? '--:--'}</Text>
          </View>
          <View style={styles.infoBarDivider} />
          <View style={styles.infoBarItem}>
            <MaterialCommunityIcons name={partida.emCasa ? 'home-outline' : 'bus'} size={16} color={colors.text_secondary} />
            <Text style={styles.infoBarLabel}>Mando</Text>
            <Text style={styles.infoBarValue}>{partida.emCasa ? 'Casa' : 'Fora'}</Text>
          </View>
        </View>

        {partida.status === 'AGENDADA' && isAdmin && isHoje(partida.data) && (
          <View style={styles.section}>
            <TouchableOpacity
              style={[styles.finalizarBtn, { borderColor: colors.primary + '55', backgroundColor: colors.primary + '14' }]}
              onPress={iniciarPartida}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="play-circle-outline" size={22} color={colors.primary} />
                <Text style={[styles.finalizarBtnText, { color: colors.primary }]}>INICIAR PARTIDA</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {isInterativo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>PERÍODO (TEMPO)</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1a1a1a', borderRadius: 14, borderWidth: 1, borderColor: colors.primary + '44', paddingVertical: 14, paddingHorizontal: 16 }}>
              <TouchableOpacity
                onPress={() => setPeriodoIdx(i => Math.max(0, i - 1))}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: periodoIdx === 0 ? '#2a2a2a' : colors.primary + '22', borderWidth: 1, borderColor: periodoIdx === 0 ? '#333' : colors.primary + '66', alignItems: 'center', justifyContent: 'center' }}
                disabled={periodoIdx === 0}
              >
                <MaterialCommunityIcons name="chevron-left" size={22} color={periodoIdx === 0 ? '#444' : colors.primary} />
              </TouchableOpacity>
              <View style={{ alignItems: 'center', gap: 4 }}>
                <Text style={{ fontFamily: 'Creato-Bold', color: colors.primary, fontSize: 18, letterSpacing: 1 }}>{periodos[periodoIdx]?.toUpperCase()}</Text>
                <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>{periodoIdx + 1} / {periodos.length}</Text>
              </View>
              <TouchableOpacity
                onPress={() => setPeriodoIdx(i => Math.min(periodos.length - 1, i + 1))}
                style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: periodoIdx === periodos.length - 1 ? '#2a2a2a' : colors.primary + '22', borderWidth: 1, borderColor: periodoIdx === periodos.length - 1 ? '#333' : colors.primary + '66', alignItems: 'center', justifyContent: 'center' }}
                disabled={periodoIdx === periodos.length - 1}
              >
                <MaterialCommunityIcons name="chevron-right" size={22} color={periodoIdx === periodos.length - 1 ? '#444' : colors.primary} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {isInterativo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>REGISTRAR EVENTO</Text>
              </View>
            </View>
            <View style={styles.eventsGrid}>
              <View style={styles.eventsRow}>
                {EVENTO_CARDS.slice(0, 3).map(card => (
                  <TouchableOpacity key={card.tipo} style={styles.eventCard} activeOpacity={0.8} onPress={() => setModalEvento({ tipo: card.tipo, label: card.label })}>
                    <View style={styles.eventIconWrap}>{card.icon}</View>
                    <Text style={styles.eventLabel}>{card.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.eventsRow}>
                {EVENTO_CARDS.slice(3, 6).map(card => (
                  <TouchableOpacity key={card.tipo} style={styles.eventCard} activeOpacity={0.8} onPress={() => setModalEvento({ tipo: card.tipo, label: card.label })}>
                    <View style={styles.eventIconWrap}>{card.icon}</View>
                    <Text style={styles.eventLabel}>{card.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {partida.status !== 'AGENDADA' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>EVENTOS DA PARTIDA</Text>
              </View>
              {carregandoEventos && <ActivityIndicator size="small" color={colors.primary} />}
            </View>
            {eventos.length === 0 && !carregandoEventos ? (
              <View style={{ alignItems: 'center', paddingVertical: 20, gap: 6 }}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={32} color="#333" />
                <Text style={{ fontFamily: 'Creato-Regular', color: '#444', fontSize: 13 }}>Nenhum evento registrado</Text>
              </View>
            ) : eventos.map(evento => (
              <View key={evento.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: '#252525', gap: 10 }}>
                <View style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center' }}>
                  <EventoIcon tipo={evento.tipo} size={16} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 13 }}>{EVENTO_LABEL[evento.tipo]}</Text>
                  {evento.jogador
                    ? <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>{evento.jogador.nome}</Text>
                    : evento.tipo === 'GOL'
                      ? <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>Gol Contra</Text>
                      : null
                  }
                </View>
                {evento.periodo && (
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>{evento.periodo}º T</Text>
                )}
                {isInterativo && (
                  deletandoEvento === evento.id
                    ? <ActivityIndicator size="small" color={colors.vermelho} />
                    : <TouchableOpacity onPress={() => handleDeletarEvento(evento)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho + 'aa'} />
                      </TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {escalacao.length > 0 && eventos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <View style={styles.sectionBar} />
                <Text style={styles.sectionTitle}>DESEMPENHO</Text>
              </View>
            </View>
            {escalacao.map(j => {
              const s = calcularStats(eventos, j.jogador_id);
              const tem = s.gols > 0 || s.assistencias > 0 || s.faltas > 0 || s.amarelos > 0 || s.vermelhos > 0 || s.azuis > 0 || s.defesas > 0;
              if (!tem) return null;
              
              return (
                <View key={j.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 6, borderWidth: 1, borderColor: '#252525', gap: 10 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 7, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontFamily: 'Creato-Bold', color: '#fff', fontSize: 11 }}>{j.numCamisa}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 13 }} numberOfLines={1}>{j.jogador.nome}</Text>
                    <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>{j.titular ? 'Titular' : 'Banco'}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end', maxWidth: 160 }}>
                    <StatBadge icon={<MaterialCommunityIcons name="soccer" size={10} color={colors.primary} />} value={s.gols} color={colors.primary} />
                    <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={10} color={colors.primary} />} value={s.assistencias} color={colors.primary} />
                    <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={10} color={colors.azulClaro} />} value={s.defesas} color={colors.azulClaro} />
                    <StatBadge icon={<MaterialCommunityIcons name="whistle" size={10} color="#aaa" />} value={s.faltas} color="#888" />
                    <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
                    <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
                    <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        <EscalacaoPartida
          partidaId={partida.id}
          categoriaId={partida.categoria?.id ?? null}
          competicaoId={partida.competicao_id ?? partida.competicao?.id ?? null}
          isAdmin={isAdmin}
          partidaStatus={partida.status}
          onEscalacaoAtualizada={setEscalacao}
        />

        {partida.status === 'AO_VIVO' && isAdmin && (
          <View style={styles.finalizarSection}>
            <TouchableOpacity style={styles.finalizarBtn} onPress={() => setModalFinalizar(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.vermelho} />
                <Text style={styles.finalizarBtnText}>FINALIZAR PARTIDA</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={!!modalGol} transparent animationType="slide" onRequestClose={() => { setModalGol(null); setJogadorGol(null); setEventoGolRemover(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '88%' }]}>
            <View style={styles.modalHandle} />
            {modalGol?.delta === 1 ? (
              !jogadorGol ? (
                <>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16, marginBottom: 4 }}>
                    Quem marcou o gol?
                  </Text>
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.primary, fontSize: 12, marginBottom: 16 }}>{periodos[periodoIdx]}</Text>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.vermelho + '15', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 10, gap: 10, borderWidth: 1, borderColor: colors.vermelho + '30' }}
                    onPress={() => confirmarGolOcian(null, true)}
                    disabled={salvandoEvento}
                  >
                    <MaterialCommunityIcons name="soccer" size={20} color={colors.vermelho} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontFamily: 'Creato-Bold', color: colors.vermelho, fontSize: 13 }}>Gol Contra (adversário)</Text>
                      <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>Nenhum jogador envolvido</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={{ height: 1, backgroundColor: '#222', marginBottom: 12 }} />
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 12, marginBottom: 10 }}>Selecione o jogador que marcou:</Text>
                  
                  {escalacao.length === 0 ? (
                    <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                      <MaterialCommunityIcons name="account-off-outline" size={40} color="#333" />
                      <Text style={{ fontFamily: 'Creato-Regular', color: '#555', fontSize: 13, textAlign: 'center' }}>
                        Defina a escalação primeiro.
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={escalacao}
                      keyExtractor={item => String(item.id)}
                      style={{ maxHeight: 360 }}
                      renderItem={({ item }) => (
                        <TouchableOpacity
                          style={[styles.jogadorSelectRow, { marginBottom: 8 }]}
                          onPress={() => setJogadorGol(item)}
                        >
                          <View style={[styles.jogadorNumero, { width: 32, height: 32, borderRadius: 8 }]}>
                            <Text style={styles.jogadorNumeroText}>{item.numCamisa}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.jogadorSelectNome}>{item.jogador.nome}</Text>
                            <Text style={styles.jogadorSelectPos}>{item.jogador.posicao}{item.titular ? '' : ' (Banco)'}</Text>
                            <MiniStats eventos={eventos} jogadorId={item.jogador_id} />
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text_secondary} />
                        </TouchableOpacity>
                      )}
                    />
                  )}
                  <TouchableOpacity style={{ marginTop: 12, alignItems: 'center', paddingVertical: 12 }} onPress={() => setModalGol(null)}>
                    <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 }}>CANCELAR</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <View style={styles.modalJogadorHeader}>
                    <View style={styles.modalJogadorNum}><Text style={styles.modalJogadorNumText}>{jogadorGol.numCamisa}</Text></View>
                    <View>
                      <Text style={styles.modalJogadorNome}>{jogadorGol.jogador.nome}</Text>
                      <Text style={styles.modalJogadorPos}>{jogadorGol.jogador.posicao}</Text>
                    </View>
                  </View>
                  {(() => {
                    const s = calcularStats(eventos, jogadorGol.jogador_id);
                    return (
                      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 14, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10 }}>
                        <StatBadge icon={<MaterialCommunityIcons name="soccer" size={10} color={colors.primary} />} value={s.gols} color={colors.primary} />
                        <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={10} color={colors.primary} />} value={s.assistencias} color={colors.primary} />
                        <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={10} color={colors.azulClaro} />} value={s.defesas} color={colors.azulClaro} />
                        <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
                        <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
                        <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
                        {s.gols === 0 && s.assistencias === 0 && s.faltas === 0 && s.amarelos === 0 && s.vermelhos === 0 && s.azuis === 0 && s.defesas === 0 && (
                          <Text style={{ fontFamily: 'Creato-Regular', color: '#444', fontSize: 11 }}>Sem eventos ainda</Text>
                        )}
                      </View>
                    );
                  })()}
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13, marginBottom: 8 }}>
                    Registrar <Text style={{ fontFamily: 'Creato-Bold', color: '#fff' }}>Gol</Text> para este jogador?
                  </Text>
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.primary, fontSize: 12, marginBottom: 20 }}>{periodos[periodoIdx]}</Text>
                  
                  <TouchableOpacity
                    style={[styles.saveStatBtn, salvandoEvento && { opacity: 0.6 }]}
                    onPress={() => confirmarGolOcian(jogadorGol, false)}
                    disabled={salvandoEvento}
                  >
                    {salvandoEvento ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveStatBtnText}>CONFIRMAR GOL</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={{ marginTop: 10, alignItems: 'center', paddingVertical: 12 }} onPress={() => setJogadorGol(null)}>
                    <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 }}>← VOLTAR</Text>
                  </TouchableOpacity>
                </>
              )
            ) : (
              /* ── REMOVER GOL ── */
              <>
                <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16, marginBottom: 4 }}>
                  Remover qual gol?
                </Text>
                <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13, marginBottom: 16 }}>
                  Selecione o evento que deseja cancelar:
                </Text>
                {golsOcian.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                    <MaterialCommunityIcons name="soccer" size={36} color="#333" />
                    <Text style={{ fontFamily: 'Creato-Regular', color: '#555', fontSize: 13 }}>Nenhum gol registrado no scout.</Text>
                    <Text style={{ fontFamily: 'Creato-Regular', color: '#444', fontSize: 11, textAlign: 'center' }}>
                      Se o gol foi adicionado só no placar, use o botão – diretamente.
                    </Text>
                  </View>
                ) : (
                  <FlatList
                    data={golsOcian}
                    keyExtractor={item => String(item.id)}
                    style={{ maxHeight: 380 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: colors.vermelho + '30' }}
                        onPress={() => confirmarRemoverGol(item)}
                        disabled={deletandoEvento === item.id}
                      >
                        <MaterialCommunityIcons name="soccer" size={20} color={colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 13 }}>
                            {item.jogador ? item.jogador.nome : 'Gol Contra'}
                          </Text>
                          {item.periodo && <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11 }}>{item.periodo}º Tempo</Text>}
                        </View>
                        {deletandoEvento === item.id
                          ? <ActivityIndicator size="small" color={colors.vermelho} />
                          : <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} />
                        }
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity style={{ marginTop: 12, alignItems: 'center', paddingVertical: 12 }} onPress={() => setModalGol(null)}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 }}>CANCELAR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={!!modalEvento} transparent animationType="slide" onRequestClose={() => { setModalEvento(null); setJogadorEvento(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            {!jogadorEvento ? (
              <>
                <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16, marginBottom: 4 }}>{modalEvento?.label}</Text>
                <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13, marginBottom: 4 }}>Quem fez?</Text>
                <Text style={{ fontFamily: 'Creato-Regular', color: colors.primary, fontSize: 12, marginBottom: 16 }}>{periodos[periodoIdx]}</Text>
                
                {escalacao.length === 0 ? (
                  <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
                    <MaterialCommunityIcons name="account-off-outline" size={40} color="#333" />
                    <Text style={{ fontFamily: 'Creato-Regular', color: '#555', fontSize: 13, textAlign: 'center' }}>Nenhum jogador na súmula.{'\n'}Defina a escalação primeiro.</Text>
                  </View>
                ) : (
                  <FlatList
                    data={escalacao}
                    keyExtractor={item => String(item.id)}
                    style={{ maxHeight: 400 }}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={[styles.jogadorSelectRow, { marginBottom: 8 }]} onPress={() => setJogadorEvento(item)}>
                        <View style={[styles.jogadorNumero, { width: 32, height: 32, borderRadius: 8 }]}>
                          <Text style={styles.jogadorNumeroText}>{item.numCamisa}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.jogadorSelectNome}>{item.jogador.nome}</Text>
                          <Text style={styles.jogadorSelectPos}>{item.jogador.posicao}{item.titular ? '' : ' (Banco)'}</Text>
                          <MiniStats eventos={eventos} jogadorId={item.jogador_id} />
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.text_secondary} />
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity style={{ marginTop: 12, alignItems: 'center', paddingVertical: 12 }} onPress={() => setModalEvento(null)}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 }}>CANCELAR</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <View style={styles.modalJogadorHeader}>
                  <View style={styles.modalJogadorNum}><Text style={styles.modalJogadorNumText}>{jogadorEvento.numCamisa}</Text></View>
                  <View>
                    <Text style={styles.modalJogadorNome}>{jogadorEvento.jogador.nome}</Text>
                    <Text style={styles.modalJogadorPos}>{jogadorEvento.jogador.posicao}</Text>
                  </View>
                </View>
                {(() => {
                  const s = calcularStats(eventos, jogadorEvento.jogador_id);
                  const tem = s.gols > 0 || s.assistencias > 0 || s.faltas > 0 || s.amarelos > 0 || s.vermelhos > 0 || s.azuis > 0 || s.defesas > 0;
                  if (!tem) return null;
                  return (
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 12, backgroundColor: '#1a1a1a', borderRadius: 10, padding: 10 }}>
                      <StatBadge icon={<MaterialCommunityIcons name="soccer" size={10} color={colors.primary} />} value={s.gols} color={colors.primary} />
                      <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={10} color={colors.primary} />} value={s.assistencias} color={colors.primary} />
                      <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={10} color={colors.azulClaro} />} value={s.defesas} color={colors.azulClaro} />
                      <StatBadge icon={<MaterialCommunityIcons name="whistle" size={10} color="#aaa" />} value={s.faltas} color="#888" />
                      <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
                      <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
                      <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
                    </View>
                  );
                })()}
                <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13, marginBottom: 8 }}>
                  Registrar <Text style={{ fontFamily: 'Creato-Bold', color: colors.text }}>{modalEvento?.label}</Text> para este jogador?
                </Text>
                <Text style={{ fontFamily: 'Creato-Regular', color: colors.primary, fontSize: 12, marginBottom: 20 }}>{periodos[periodoIdx]}</Text>
                
                <TouchableOpacity style={[styles.saveStatBtn, salvandoEvento && { opacity: 0.6 }]} onPress={confirmarEvento} disabled={salvandoEvento}>
                  {salvandoEvento ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveStatBtnText}>CONFIRMAR</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={{ marginTop: 10, alignItems: 'center', paddingVertical: 12 }} onPress={() => setJogadorEvento(null)}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 13 }}>← VOLTAR</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      <Modal visible={modalFinalizar} transparent animationType="fade" onRequestClose={() => setModalFinalizar(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}><MaterialCommunityIcons name="flag-checkered" size={28} color={colors.vermelho} /></View>
            <Text style={styles.confirmTitle}>Finalizar Partida?</Text>
            <Text style={styles.confirmDesc}>Os dados serão salvos e o Scout de IA será atualizado com os eventos desta partida.</Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setModalFinalizar(false)}>
                <Text style={styles.confirmCancelText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmOk} onPress={finalizarPartida}>
                <Text style={styles.confirmOkText}>FINALIZAR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalEditar} transparent={false} animationType="slide" onRequestClose={() => setModalEditar(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1e1e1e', gap: 12 }}>
            <TouchableOpacity onPress={() => setModalEditar(false)} style={{ padding: 4 }}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 17, letterSpacing: 0.5 }}>EDITAR PARTIDA</Text>
              <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 11, marginTop: 1 }}>
                {partida.categoria?.nome}{partida.rodada ? ` • Rodada ${partida.rodada}` : ''}
              </Text>
            </View>
          </View>
          
          {carregandoTimes ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 13 }}>Carregando times...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>CONFRONTO</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                {(['mandante', 'visitante'] as const).map((tipo, idx) => {
                  const time = tipo === 'mandante' ? editMandante : editVisitante;
                  return (
                    <React.Fragment key={tipo}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: time ? colors.primary + '12' : '#1a1a1a', borderRadius: 14, padding: 14, alignItems: 'center', gap: 8, borderWidth: 1.5, borderColor: time ? colors.primary + '44' : '#2a2a2a' }}
                        onPress={() => setModalTimeEdit(tipo)}
                        activeOpacity={0.8}
                      >
                        {time
                          ? <EscudoTime escudo={time.escudo} nome={time.nome} size={44} />
                          : <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#252525', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialCommunityIcons name="plus" size={22} color={colors.primary} />
                            </View>
                        }
                        <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 10, letterSpacing: 0.5 }}>
                          {tipo === 'mandante' ? 'MANDANTE' : 'VISITANTE'}
                        </Text>
                        <Text style={{ fontFamily: 'Creato-Bold', color: time ? colors.text : colors.primary, fontSize: 12, textAlign: 'center' }} numberOfLines={2}>
                          {time ? time.nome : 'Selecionar'}
                        </Text>
                      </TouchableOpacity>
                      {idx === 0 && (
                        <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                          style={{ width: 36, height: 36, borderRadius: 18, alignSelf: 'center', alignItems: 'center', justifyContent: 'center', marginTop: 16 }}>
                          <Text style={{ fontFamily: 'Creato-Bold', color: '#fff', fontSize: 12 }}>VS</Text>
                        </LinearGradient>
                      )}
                    </React.Fragment>
                  );
                })}
              </View>

              <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>MANDO DE CAMPO</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {[{ label: 'EM CASA', icon: 'home-outline' as const, value: true }, { label: 'FORA', icon: 'bus-side' as const, value: false }].map(opt => (
                  <TouchableOpacity
                    key={opt.label}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: editEmCasa === opt.value ? colors.primary : '#2a2a2a', backgroundColor: editEmCasa === opt.value ? colors.primary + '15' : '#1a1a1a' }}
                    onPress={() => setEditEmCasa(opt.value)}
                    activeOpacity={0.8}
                  >
                    <MaterialCommunityIcons name={opt.icon} size={18} color={editEmCasa === opt.value ? colors.primary : colors.text_secondary} />
                    <Text style={{ fontFamily: 'Creato-Bold', color: editEmCasa === opt.value ? colors.primary : colors.text_secondary, fontSize: 12 }}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 10 }}>RODADA</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', overflow: 'hidden', marginBottom: 20 }}>
                <TouchableOpacity
                  style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center', opacity: Number(editRodada) <= 1 ? 0.3 : 1 }}
                  onPress={() => setEditRodada(r => String(Math.max(1, Number(r || 1) - 1)))}
                  disabled={Number(editRodada) <= 1}
                >
                  <MaterialCommunityIcons name="minus" size={18} color={colors.primary} />
                </TouchableOpacity>
                <View style={{ flex: 1, alignItems: 'center' }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 18 }}>{editRodada || '—'}</Text>
                </View>
                <TouchableOpacity
                  style={{ width: 50, height: 50, alignItems: 'center', justifyContent: 'center' }}
                  onPress={() => setEditRodada(r => String(Number(r || 0) + 1))}
                >
                  <MaterialCommunityIcons name="plus" size={18} color={colors.primary} />
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>DATA</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 13, gap: 8 }}>
                    <MaterialCommunityIcons name="calendar-outline" size={17} color={colors.text_secondary} />
                    <TextInput style={{ flex: 1, fontFamily: 'Creato-Regular', color: colors.text, fontSize: 14 }} value={editData} onChangeText={handleEditData} placeholder="DD/MM" placeholderTextColor={colors.text_secondary} keyboardType="numeric" maxLength={5} />
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>HORÁRIO</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 13, gap: 8 }}>
                    <MaterialCommunityIcons name="clock-outline" size={17} color={colors.text_secondary} />
                    <TextInput style={{ flex: 1, fontFamily: 'Creato-Regular', color: colors.text, fontSize: 14 }} value={editHorario} onChangeText={handleEditHorario} placeholder="HH:MM" placeholderTextColor={colors.text_secondary} keyboardType="numeric" maxLength={5} />
                  </View>
                </View>
              </View>

              <Text style={{ fontFamily: 'Creato-Bold', color: colors.text_secondary, fontSize: 11, letterSpacing: 1, marginBottom: 8 }}>LOCAL DA PARTIDA</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 12, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 13, gap: 8, marginBottom: 28 }}>
                <MaterialCommunityIcons name="map-marker-outline" size={17} color={colors.text_secondary} />
                <TextInput style={{ flex: 1, fontFamily: 'Creato-Regular', color: colors.text, fontSize: 14 }} value={editLocal} onChangeText={setEditLocal} placeholder="Ginásio, quadra ou campo..." placeholderTextColor={colors.text_secondary} />
              </View>

              <TouchableOpacity
                onPress={salvarEdicaoPartida}
                disabled={salvandoEdicao}
                style={{ borderRadius: 14, overflow: 'hidden', opacity: salvandoEdicao ? 0.6 : 1, marginBottom: 12 }}
                activeOpacity={0.85}
              >
                <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                  {salvandoEdicao
                    ? <ActivityIndicator color="#FFF" />
                    : <>
                        <MaterialCommunityIcons name="content-save-edit-outline" size={18} color="#FFF" />
                        <Text style={{ fontFamily: 'Creato-Bold', color: '#FFF', fontSize: 14, letterSpacing: 1 }}>SALVAR ALTERAÇÕES</Text>
                      </>
                  }
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: colors.vermelho + '40', backgroundColor: colors.vermelho + '10' }}
                onPress={() => { setModalEditar(false); setTimeout(() => setModalDeletar(true), 300); }}
              >
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} />
                <Text style={{ fontFamily: 'Creato-Bold', color: colors.vermelho, fontSize: 13, letterSpacing: 0.5 }}>DELETAR PARTIDA</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>

        <Modal visible={modalTimeEdit !== null} transparent animationType="slide">
          <Pressable style={{ flex: 1, backgroundColor: '#000a', justifyContent: 'flex-end' }} onPress={() => { setModalTimeEdit(null); setBuscaTime(''); }}>
            <Pressable style={{ backgroundColor: colors.background, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '80%', padding: 20 }}>
              <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: '#333', alignSelf: 'center', marginBottom: 16 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: 'Creato-Bold', color: colors.text, fontSize: 16 }}>
                    {modalTimeEdit === 'mandante' ? 'Selecionar Mandante' : 'Selecionar Visitante'}
                  </Text>
                  <Text style={{ fontFamily: 'Creato-Regular', color: colors.text_secondary, fontSize: 12 }}>{partida.categoria?.nome}</Text>
                </View>
                <TouchableOpacity onPress={() => { setModalTimeEdit(null); setBuscaTime(''); }}>
                  <MaterialCommunityIcons name="close" size={22} color={colors.text} />
                </TouchableOpacity>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#1a1a1a', borderRadius: 10, borderWidth: 1, borderColor: '#2a2a2a', paddingHorizontal: 12, paddingVertical: 10, gap: 8, marginBottom: 12 }}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.text_secondary} />
                <TextInput style={{ flex: 1, fontFamily: 'Creato-Regular', color: colors.text, fontSize: 14 }} value={buscaTime} onChangeText={setBuscaTime} placeholder="Buscar time..." placeholderTextColor={colors.text_secondary} autoFocus />
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
                  </View>
                ) : timesFiltrados.map(time => {
                  const sel = modalTimeEdit === 'mandante' ? editMandante?.id === time.id : editVisitante?.id === time.id;
                  return (
                    <TouchableOpacity
                      key={time.id}
                      style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: sel ? colors.primary + '12' : '#1a1a1a', borderRadius: 10, padding: 12, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: sel ? colors.primary + '44' : '#2a2a2a' }}
                      onPress={() => {
                        if (modalTimeEdit === 'mandante') setEditMandante(time); else setEditVisitante(time);
                        setModalTimeEdit(null); setBuscaTime('');
                      }}
                    >
                      <EscudoTime escudo={time.escudo} nome={time.nome} size={36} />
                      <Text style={{ flex: 1, fontFamily: 'Creato-Bold', color: colors.text, fontSize: 13 }}>{time.nome}</Text>
                      {sel && <MaterialCommunityIcons name="check" size={18} color={colors.primary} />}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Pressable>
          </Pressable>
        </Modal>
      </Modal>

      <Modal visible={modalDeletar} transparent animationType="fade" onRequestClose={() => setModalDeletar(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={[styles.confirmIcon, { backgroundColor: colors.vermelho + '20' }]}>
              <MaterialCommunityIcons name="trash-can-outline" size={28} color={colors.vermelho} />
            </View>
            <Text style={styles.confirmTitle}>Deletar Partida?</Text>
            <Text style={styles.confirmDesc}>Esta ação é irreversível. Todos os eventos e a escalação desta partida serão apagados permanentemente.</Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setModalDeletar(false)} disabled={deletandoPartida}>
                <Text style={styles.confirmCancelText}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmOk, { backgroundColor: colors.vermelho }]} onPress={deletarPartida} disabled={deletandoPartida}>
                {deletandoPartida
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.confirmOkText}>DELETAR</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}