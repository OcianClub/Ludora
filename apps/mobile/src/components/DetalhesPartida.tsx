import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal,
  ActivityIndicator, Alert, Image, FlatList, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

// ── Tipografia, Cores e Estilos ──
import { colors, typography } from '@ludora/design-tokens';
import { styles } from '@/src/styles/detalhesPartidaStyles';

// ── Componentes Compartilhados ──
import EscalacaoPartida, { JogadorEscalado } from '@/src/components/EscalacaoPartida';
import TeamSelectorCard from '@/src/components/TeamSelectorCard';
import MandoCampo from '@/src/components/mandoCampo';
import InputDataHora from '@/src/components/InputDataHora';
import EscudoTime from '@/src/components/EscudoTime';

// ── Serviços ──
import {
  atualizarStatusPartida, atualizarPlacarPartida, criarEvento,
  fetchEventosDaPartida, deletarEvento, atualizarPartida, fetchTimes, BASE_URL,
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

type TipoEvento = 'GOL' | 'CARTAO_AMARELO' | 'CARTAO_VERMELHO' | 'CARTAO_AZUL' | 'FALTA' | 'DEFESA' | 'ASSISTENCIA';

interface Evento {
  id: number; tipo: TipoEvento; minuto?: number | null; periodo?: number | null;
  jogador_id?: number | null; doOcian?: boolean; jogador?: { id: number; nome: string } | null;
}

interface Time { id: number; nome: string; escudo: string | null; categoria_id: number; }
interface Props { partida: Partida; isAdmin: boolean; onBack: () => void; }

// ── Helpers ───────────────────────────────────────────────────────────────────
function isHoje(dataStr: string): boolean {
  const hoje = new Date();
  const [ano, mes, dia] = dataStr.split('T')[0].split('-').map(Number);
  return hoje.getFullYear() === ano && hoje.getMonth() + 1 === mes && hoje.getDate() === dia;
}

function getPeriodos(nomeCategoria: string | undefined): string[] {
  const nome = (nomeCategoria ?? '').toLowerCase();
  if (nome.includes('18') || nome.includes('16')) return ['1º Tempo', '2º Tempo'];
  return ['1º Tempo', '2º Tempo', '3º Tempo', '4º Tempo'];
}

function LogoTime({ uri, size = 64 }: { uri: string | null; size?: number }) {
  if (uri) return <Image source={{ uri }} style={styles.logoTimeImg} />;
  return (
    <View style={styles.logoTimeWrap}>
      <MaterialCommunityIcons name="shield-outline" size={size * 0.5} color={colors.textoSecundario} />
    </View>
  );
}

function EventoIcon({ tipo, size = 16 }: { tipo: TipoEvento; size?: number }) {
  switch (tipo) {
    case 'GOL': return <MaterialCommunityIcons name="soccer" size={size} color={colors.primaria} />;
    case 'CARTAO_AMARELO': return <View style={{ width: size * 0.65, height: size, borderRadius: 2, backgroundColor: '#F5C518' }} />;
    case 'CARTAO_VERMELHO': return <View style={{ width: size * 0.65, height: size, borderRadius: 2, backgroundColor: colors.vermelho }} />;
    case 'CARTAO_AZUL': return <View style={{ width: size * 0.65, height: size, borderRadius: 2, backgroundColor: '#3A9EFF' }} />;
    case 'FALTA': return <MaterialCommunityIcons name="whistle" size={size} color={colors.textoSecundario} />;
    case 'DEFESA': return <MaterialCommunityIcons name="shield-check" size={size} color={colors.primaria} />;
    case 'ASSISTENCIA': return <MaterialCommunityIcons name="shoe-cleat" size={size} color={colors.primaria} />;
    default: return null;
  }
}

const EVENTO_LABEL: Record<TipoEvento, string> = {
  GOL: 'Gol', CARTAO_AMARELO: 'Cartão Amarelo', CARTAO_VERMELHO: 'Cartão Vermelho',
  CARTAO_AZUL: 'Cartão Azul', FALTA: 'Falta', DEFESA: 'Defesa', ASSISTENCIA: 'Assistência',
};

// ── Stats por jogador ──────────────────────────────────────────────────────────
function calcularStats(eventos: Evento[], jogador_id: number) {
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
    <View style={[styles.statBadgeWrap, { backgroundColor: color + '20', borderColor: color + '44' }]}>
      {icon}
      <Text style={[styles.statBadgeText, { color }]}>{value}</Text>
    </View>
  );
}

function MiniStats({ eventos, jogadorId }: { eventos: Evento[]; jogadorId: number }) {
  const s = calcularStats(eventos, jogadorId);
  const temStat = s.gols > 0 || s.assistencias > 0 || s.faltas > 0 || s.amarelos > 0 || s.vermelhos > 0 || s.azuis > 0 || s.defesas > 0;
  if (!temStat) return null;
  
  return (
    <View style={{ flexDirection: 'row', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
      <StatBadge icon={<MaterialCommunityIcons name="soccer" size={9} color={colors.primaria} />} value={s.gols} color={colors.primaria} />
      <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={9} color={colors.primaria} />} value={s.assistencias} color={colors.primaria} />
      <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={9} color={colors.primaria} />} value={s.defesas} color={colors.primaria} />
      <StatBadge icon={<MaterialCommunityIcons name="whistle" size={9} color="#aaa" />} value={s.faltas} color="#888" />
      <StatBadge icon={<View style={{ width: 6, height: 9, borderRadius: 1, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
      <StatBadge icon={<View style={{ width: 6, height: 9, borderRadius: 1, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
      <StatBadge icon={<View style={{ width: 6, height: 9, borderRadius: 1, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
    </View>
  );
}

// ── Componente Principal ──────────────────────────────────────────────────────
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

  // Modais de Scout
  const [modalEvento, setModalEvento] = useState<{ tipo: TipoEvento; label: string } | null>(null);
  const [jogadorEvento, setJogadorEvento] = useState<JogadorEscalado | null>(null);
  const [modalGol, setModalGol] = useState<{ lado: 'mandante' | 'visitante'; delta: 1 | -1 } | null>(null);
  const [jogadorGol, setJogadorGol] = useState<JogadorEscalado | null>(null);
  const [eventoGolRemover, setEventoGolRemover] = useState<Evento | null>(null);

  // Eventos
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [carregandoEventos, setCarregandoEventos] = useState(false);
  const [deletandoEvento, setDeletandoEvento] = useState<number | null>(null);

  // Editar Partida
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
  const ocianEhMandante = partida.emCasa;

  const timesFiltrados = times.filter(t =>
    t.categoria_id === (partida.categoria?.id ?? 0) &&
    t.nome.toLowerCase().includes(buscaTime.toLowerCase())
  );

  // ── Handlers ───────────────────────────────────────────────────────────────
  const carregarEventos = useCallback(async () => {
    if (partida.status === 'AGENDADA') return;
    setCarregandoEventos(true);
    try { setEventos(await fetchEventosDaPartida(partida.id)); } catch {} finally { setCarregandoEventos(false); }
  }, [partida.id, partida.status]);

  useEffect(() => { carregarEventos(); }, [carregarEventos]);

  const salvarPlacar = async (m: number, v: number) => {
    setSalvandoPlacar(true);
    try { await atualizarPlacarPartida(partida.id, m, v); } catch { Alert.alert('Erro', 'Não foi possível atualizar o placar.'); } finally { setSalvandoPlacar(false); }
  };

  const onPlusLado = (lado: 'mandante' | 'visitante') => {
    const ocianEsseLado = (lado === 'mandante' && ocianEhMandante) || (lado === 'visitante' && !ocianEhMandante);
    if (ocianEsseLado) { setModalGol({ lado, delta: 1 }); } 
    else {
      const novoM = lado === 'mandante' ? golsMandante + 1 : golsMandante;
      const novoV = lado === 'visitante' ? golsVisitante + 1 : golsVisitante;
      setGolsMandante(novoM); setGolsVisitante(novoV); salvarPlacar(novoM, novoV);
    }
  };

  const onMinusLado = (lado: 'mandante' | 'visitante') => {
    const ocianEsseLado = (lado === 'mandante' && ocianEhMandante) || (lado === 'visitante' && !ocianEhMandante);
    if (ocianEsseLado) { setModalGol({ lado, delta: -1 }); } 
    else {
      const novoM = lado === 'mandante' ? Math.max(0, golsMandante - 1) : golsMandante;
      const novoV = lado === 'visitante' ? Math.max(0, golsVisitante - 1) : golsVisitante;
      setGolsMandante(novoM); setGolsVisitante(novoV); salvarPlacar(novoM, novoV);
    }
  };

  const confirmarGolOcian = async (jogador: JogadorEscalado | null, isGolContra: boolean) => {
    if (!modalGol) return;
    setSalvandoEvento(true);
    try {
      await criarEvento(partida.id, { tipo: 'GOL', minuto: null, periodo: periodoIdx + 1, jogador_id: isGolContra ? null : jogador?.jogador_id ?? null, doOcian: true });
      const novoM = modalGol.lado === 'mandante' ? golsMandante + 1 : golsMandante;
      const novoV = modalGol.lado === 'visitante' ? golsVisitante + 1 : golsVisitante;
      setGolsMandante(novoM); setGolsVisitante(novoV); await atualizarPlacarPartida(partida.id, novoM, novoV);
      setModalGol(null); setJogadorGol(null); await carregarEventos();
    } catch { Alert.alert('Erro', 'Não foi possível registrar o gol.'); } finally { setSalvandoEvento(false); }
  };

  const confirmarRemoverGol = async (evento: Evento) => {
    if (!modalGol) return;
    setDeletandoEvento(evento.id);
    try {
      await deletarEvento(evento.id);
      const novoM = modalGol.lado === 'mandante' ? Math.max(0, golsMandante - 1) : golsMandante;
      const novoV = modalGol.lado === 'visitante' ? Math.max(0, golsVisitante - 1) : golsVisitante;
      setGolsMandante(novoM); setGolsVisitante(novoV); await atualizarPlacarPartida(partida.id, novoM, novoV);
      setModalGol(null); setEventoGolRemover(null); await carregarEventos();
    } catch { Alert.alert('Erro', 'Não foi possível remover o gol.'); } finally { setDeletandoEvento(null); }
  };

  const confirmarEvento = async () => {
    if (!modalEvento || !jogadorEvento) return;
    setSalvandoEvento(true);
    try {
      await criarEvento(partida.id, { tipo: modalEvento.tipo, minuto: null, periodo: periodoIdx + 1, jogador_id: jogadorEvento.jogador_id, doOcian: true });
      setModalEvento(null); setJogadorEvento(null); await carregarEventos();
    } catch { Alert.alert('Erro', 'Não foi possível registrar o evento.'); } finally { setSalvandoEvento(false); }
  };

  const handleDeletarEvento = (evento: Evento) => {
    Alert.alert('Remover Evento', `Remover "${EVENTO_LABEL[evento.tipo]}"${evento.jogador ? ` de ${evento.jogador.nome}` : ''}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: async () => {
          setDeletandoEvento(evento.id);
          try { await deletarEvento(evento.id); await carregarEventos(); } catch { Alert.alert('Erro', 'Não foi possível remover o evento.'); } finally { setDeletandoEvento(null); }
        },
      }
    ]);
  };

  const iniciarPartida = async () => {
    const qtde = escalacao.filter(e => e.titular).length;
    if (qtde !== 5) return Alert.alert('Atenção', `Para iniciar é obrigatório definir exatamente 5 titulares. Atualmente há ${qtde}.`);
    try { await atualizarStatusPartida(partida.id, 'AO_VIVO'); setPartida(p => ({ ...p, status: 'AO_VIVO' })); } catch { Alert.alert('Erro', 'Não foi possível iniciar a partida.'); }
  };

  const finalizarPartida = async () => {
    setModalFinalizar(false);
    try { await atualizarStatusPartida(partida.id, 'FINALIZADA'); setPartida(p => ({ ...p, status: 'FINALIZADA' })); setModoEdicao(false); } catch { Alert.alert('Erro', 'Não foi possível finalizar a partida.'); }
  };

  // ── Editar Partida Modal ──
  const abrirEditar = async () => {
    const rawData = partida.data?.split('T')[0] ?? '';
    const [ano, mes, dia] = rawData.split('-');
    setEditData(rawData ? `${dia}/${mes}` : ''); setEditHorario(partida.horario ?? '');
    setEditLocal(partida.local ?? ''); setEditEmCasa(partida.emCasa); setEditRodada(partida.rodada ? String(partida.rodada) : '');
    setEditMandante(null); setEditVisitante(null); setModalEditar(true);

    if (times.length === 0) {
      setCarregandoTimes(true);
      try {
        const dados = await fetchTimes();
        setTimes(dados);
        setEditMandante(dados.find((t: Time) => t.id === partida.mandante.id) ?? null);
        setEditVisitante(dados.find((t: Time) => t.id === partida.visitante.id) ?? null);
      } catch { Alert.alert('Erro', 'Não foi possível carregar os times.'); } finally { setCarregandoTimes(false); }
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
      const [dia, mes] = editData.split('/'); const ano = new Date().getFullYear(); const isoData = `${ano}-${mes}-${dia}`;
      await atualizarPartida(partida.id, { mandante_id: editMandante.id, visitante_id: editVisitante.id, data: isoData, horario: editHorario, local: editLocal || undefined, emCasa: editEmCasa, rodada: editRodada ? Number(editRodada) : undefined });
      
      setPartida(prev => ({
        ...prev,
        mandante: { ...prev.mandante, id: editMandante.id, nome: editMandante.nome, escudo: editMandante.escudo },
        visitante: { ...prev.visitante, id: editVisitante.id, nome: editVisitante.nome, escudo: editVisitante.escudo },
        data: isoData, horario: editHorario, local: editLocal || prev.local, emCasa: editEmCasa, rodada: editRodada ? Number(editRodada) : prev.rodada,
      }));
      setModalEditar(false); Alert.alert('Sucesso', 'Partida atualizada!');
    } catch (e: any) { Alert.alert('Erro', e.message || 'Não foi possível salvar.'); } finally { setSalvandoEdicao(false); }
  };

  const deletarPartida = async () => {
    setModalDeletar(false); setDeletandoPartida(true);
    try {
      const res = await fetch(`${BASE_URL}/partidas/${partida.id}`, { method: 'DELETE' });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `Erro ${res.status}`); }
      onBack();
    } catch (e: any) { Alert.alert('Erro', e.message || 'Não foi possível deletar a partida.'); } finally { setDeletandoPartida(false); }
  };

  const EVENTO_CARDS: { tipo: TipoEvento; label: string; icon: React.ReactNode }[] = [
    { tipo: 'CARTAO_AMARELO', label: 'Amarelo', icon: <View style={{ width: 15, height: 22, borderRadius: 3, backgroundColor: '#F5C518' }} /> },
    { tipo: 'CARTAO_VERMELHO', label: 'Vermelho', icon: <View style={{ width: 15, height: 22, borderRadius: 3, backgroundColor: colors.vermelho }} /> },
    { tipo: 'CARTAO_AZUL', label: 'Azul', icon: <View style={{ width: 15, height: 22, borderRadius: 3, backgroundColor: '#3A9EFF' }} /> },
    { tipo: 'FALTA', label: 'Falta', icon: <MaterialCommunityIcons name="whistle" size={22} color={colors.textoSecundario} /> },
    { tipo: 'DEFESA', label: 'Defesa', icon: <MaterialCommunityIcons name="shield-check" size={22} color={colors.primaria} /> },
    { tipo: 'ASSISTENCIA', label: 'Assistência', icon: <MaterialCommunityIcons name="shoe-cleat" size={22} color={colors.primaria} /> },
  ];

  const golsOcian = eventos.filter(e => e.tipo === 'GOL');

  // ── Render Principal ────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.root}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackBtn} onPress={onBack}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={colors.texto} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>DETALHES DA PARTIDA</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {isAdmin && partida.status === 'FINALIZADA' && (
            <TouchableOpacity style={[styles.headerActionBtn, modoEdicao && { backgroundColor: colors.primaria, borderColor: colors.primaria }]} onPress={() => setModoEdicao(!modoEdicao)}>
              <Text style={[styles.headerEditBtnText, modoEdicao && { color: '#FFF' }]}>{modoEdicao ? 'CONCLUIR' : 'SCOUT'}</Text>
            </TouchableOpacity>
          )}
          {isAdmin && !modoEdicao && (partida.status === 'AGENDADA' || partida.status === 'FINALIZADA') && (
            <TouchableOpacity style={styles.headerEditBtn} onPress={abrirEditar}>
              <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.textoSecundario} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HERO SECTION */}
        <View style={styles.hero}>
          <View style={styles.heroCatRow}>
            <Text style={styles.heroCatText}>{partida.categoria?.nome ?? '—'}</Text>
            <View style={styles.heroDot} />
            <Text style={styles.heroCatText}>
              {partida.data ? new Date(partida.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace(' de ', ' DE ').toUpperCase() + '.' : '—'}
            </Text>
          </View>
          <View style={styles.heroTeamsRow}>
            <View style={styles.heroTeamCol}>
              <LogoTime uri={partida.mandante.escudo} size={64} />
              <Text style={styles.heroTeamName} numberOfLines={2}>{partida.mandante.nome}</Text>
            </View>

            <View style={styles.heroScoreBlock}>
              {partida.status === 'AGENDADA' ? (
                <>
                  <Text style={styles.heroVs}>VS</Text>
                  <View style={styles.scheduledBadge}><Text style={styles.scheduledBadgeText}>{partida.horario ?? 'AGENDADO'}</Text></View>
                </>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  {isInterativo ? (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => onPlusLado('mandante')}><MaterialCommunityIcons name="plus" size={18} color={colors.texto} /></TouchableOpacity>
                      <Text style={styles.heroScoreText}>{golsMandante}</Text>
                      <TouchableOpacity style={[styles.stepBtn, styles.stepBtnMinus, { opacity: golsMandante === 0 ? 0.3 : 1 }]} onPress={() => { if (golsMandante > 0) onMinusLado('mandante'); }} disabled={golsMandante === 0}><MaterialCommunityIcons name="minus" size={18} color={colors.textoSecundario} /></TouchableOpacity>
                    </View>
                  ) : ( <Text style={styles.heroScoreText}>{golsMandante}</Text> )}
                  
                  <View style={styles.heroScoreSeparator} />

                  {isInterativo ? (
                    <View style={{ alignItems: 'center', gap: 6 }}>
                      <TouchableOpacity style={styles.stepBtn} onPress={() => onPlusLado('visitante')}><MaterialCommunityIcons name="plus" size={18} color={colors.texto} /></TouchableOpacity>
                      <Text style={styles.heroScoreText}>{golsVisitante}</Text>
                      <TouchableOpacity style={[styles.stepBtn, styles.stepBtnMinus, { opacity: golsVisitante === 0 ? 0.3 : 1 }]} onPress={() => { if (golsVisitante > 0) onMinusLado('visitante'); }} disabled={golsVisitante === 0}><MaterialCommunityIcons name="minus" size={18} color={colors.textoSecundario} /></TouchableOpacity>
                    </View>
                  ) : ( <Text style={styles.heroScoreText}>{golsVisitante}</Text> )}
                </View>
              )}
            </View>
            <View style={styles.heroTeamCol}>
              <LogoTime uri={partida.visitante.escudo} size={64} />
              <Text style={styles.heroTeamName} numberOfLines={2}>{partida.visitante.nome}</Text>
            </View>
          </View>
        </View>

        {/* INFO BAR */}
        <View style={styles.infoBar}>
          <View style={styles.infoBarItem}>
            <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.textoSecundario} />
            <Text style={styles.infoBarLabel}>Local</Text>
            <Text style={styles.infoBarValue} numberOfLines={1}>{partida.local ?? 'Não definido'}</Text>
          </View>
          <View style={styles.infoBarDivider} />
          <View style={styles.infoBarItem}>
            <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textoSecundario} />
            <Text style={styles.infoBarLabel}>Horário</Text>
            <Text style={styles.infoBarValue}>{partida.horario ?? '--:--'}</Text>
          </View>
          <View style={styles.infoBarDivider} />
          <View style={styles.infoBarItem}>
            <MaterialCommunityIcons name={partida.emCasa ? 'home-outline' : 'bus'} size={18} color={colors.textoSecundario} />
            <Text style={styles.infoBarLabel}>Mando</Text>
            <Text style={styles.infoBarValue}>{partida.emCasa ? 'Casa' : 'Fora'}</Text>
          </View>
        </View>

        {/* BOTÃO INICIAR PARTIDA */}
        {partida.status === 'AGENDADA' && isAdmin && isHoje(partida.data) && (
          <View style={styles.section}>
            <TouchableOpacity style={styles.finalizarBtn} onPress={iniciarPartida}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={styles.finalizarBtnText}>INICIAR PARTIDA</Text>
                <MaterialCommunityIcons name="play-circle-outline" size={20} color="#FFF" />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* ESCALAÇÃO (Espaçamento horizontal arrumado) */}
        <View style={{ marginBottom: 24 }}>
          <EscalacaoPartida partidaId={partida.id} categoriaId={partida.categoria?.id ?? null} competicaoId={partida.competicao_id ?? partida.competicao?.id ?? null} isAdmin={isAdmin} partidaStatus={partida.status} onEscalacaoAtualizada={setEscalacao} />
        </View>

        {/* CONTROLE DE PERIODO */}
        {isInterativo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionBar} /><Text style={styles.sectionTitle}>PERÍODO (TEMPO)</Text></View>
            </View>
            <View style={styles.periodWrap}>
              <TouchableOpacity style={[styles.periodBtn, periodoIdx === 0 && styles.periodBtnDisabled]} onPress={() => setPeriodoIdx(i => Math.max(0, i - 1))} disabled={periodoIdx === 0}>
                <MaterialCommunityIcons name="chevron-left" size={22} color={periodoIdx === 0 ? colors.textoSecundario : colors.primaria} />
              </TouchableOpacity>
              <View style={styles.periodCenter}>
                <Text style={styles.periodTitle}>{periodos[periodoIdx]?.toUpperCase()}</Text>
                <Text style={styles.periodSub}>{periodoIdx + 1} / {periodos.length}</Text>
              </View>
              <TouchableOpacity style={[styles.periodBtn, periodoIdx === periodos.length - 1 && styles.periodBtnDisabled]} onPress={() => setPeriodoIdx(i => Math.min(periodos.length - 1, i + 1))} disabled={periodoIdx === periodos.length - 1}>
                <MaterialCommunityIcons name="chevron-right" size={22} color={periodoIdx === periodos.length - 1 ? colors.textoSecundario : colors.primaria} />
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* REGISTRO EVENTOS */}
        {isInterativo && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionBar} /><Text style={styles.sectionTitle}>REGISTRAR EVENTO</Text></View>
            </View>
            <View style={styles.eventsGrid}>
              <View style={styles.eventsRow}>
                {EVENTO_CARDS.slice(0, 3).map(card => (
                  <TouchableOpacity key={card.tipo} style={styles.eventCard} activeOpacity={0.8} onPress={() => setModalEvento({ tipo: card.tipo, label: card.label })}>
                    <View style={styles.eventIconWrap}>{card.icon}</View><Text style={styles.eventLabel}>{card.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.eventsRow}>
                {EVENTO_CARDS.slice(3, 6).map(card => (
                  <TouchableOpacity key={card.tipo} style={styles.eventCard} activeOpacity={0.8} onPress={() => setModalEvento({ tipo: card.tipo, label: card.label })}>
                    <View style={styles.eventIconWrap}>{card.icon}</View><Text style={styles.eventLabel}>{card.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        )}

        {/* LISTA DE EVENTOS */}
        {partida.status !== 'AGENDADA' && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionBar} /><Text style={styles.sectionTitle}>EVENTOS DA PARTIDA</Text></View>
              {carregandoEventos && <ActivityIndicator size="small" color={colors.primaria} />}
            </View>
            {eventos.length === 0 && !carregandoEventos ? (
              <View style={styles.emptyStateBox}>
                <MaterialCommunityIcons name="clipboard-text-outline" size={32} color={colors.textoSecundario} />
                <Text style={styles.emptyStateText}>Nenhum evento registrado</Text>
              </View>
            ) : eventos.map(evento => (
              <View key={evento.id} style={styles.rowCard}>
                <View style={styles.rowIconBox}><EventoIcon tipo={evento.tipo} size={16} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{EVENTO_LABEL[evento.tipo]}</Text>
                  {evento.jogador ? <Text style={styles.rowSub}>{evento.jogador.nome}</Text> : evento.tipo === 'GOL' ? <Text style={styles.rowSub}>Gol Contra</Text> : null}
                </View>
                {evento.periodo && <Text style={styles.rowSub}>{evento.periodo}º T</Text>}
                {isInterativo && (
                  deletandoEvento === evento.id ? <ActivityIndicator size="small" color={colors.vermelho} />
                  : <TouchableOpacity onPress={() => handleDeletarEvento(evento)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}><MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} /></TouchableOpacity>
                )}
              </View>
            ))}
          </View>
        )}

        {/* DESEMPENHO JOGADORES */}
        {escalacao.length > 0 && eventos.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}><View style={styles.sectionBar} /><Text style={styles.sectionTitle}>DESEMPENHO</Text></View>
            </View>
            {escalacao.map(j => {
              const s = calcularStats(eventos, j.jogador_id);
              const tem = s.gols > 0 || s.assistencias > 0 || s.faltas > 0 || s.amarelos > 0 || s.vermelhos > 0 || s.azuis > 0 || s.defesas > 0;
              if (!tem) return null;
              return (
                <View key={j.id} style={styles.rowCard}>
                  <View style={[styles.rowIconBox, { borderRadius: 7 }]}>
                    <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto, fontSize: 11 }}>{j.numCamisa}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{j.jogador.nome}</Text>
                    <Text style={styles.rowSub}>{j.titular ? 'Titular' : 'Banco'}</Text>
                  </View>
                  <View style={styles.statsBadgesWrap}>
                    <StatBadge icon={<MaterialCommunityIcons name="soccer" size={10} color={colors.primaria} />} value={s.gols} color={colors.primaria} />
                    <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={10} color={colors.primaria} />} value={s.assistencias} color={colors.primaria} />
                    <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={10} color={colors.primaria} />} value={s.defesas} color={colors.primaria} />
                    <StatBadge icon={<MaterialCommunityIcons name="whistle" size={10} color={colors.textoSecundario} />} value={s.faltas} color={colors.textoSecundario} />
                    <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
                    <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
                    <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {partida.status === 'AO_VIVO' && isAdmin && (
          <View style={styles.finalizarSection}>
            <TouchableOpacity style={[styles.finalizarBtn, {backgroundColor: colors.fundoErro, borderColor: colors.bordaErro, borderWidth: 1}]} onPress={() => setModalFinalizar(true)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.vermelho} />
                <Text style={[styles.finalizarBtnText, {color: colors.vermelho}]}>FINALIZAR PARTIDA</Text>
              </View>
            </TouchableOpacity>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* ── MODAIS (GOL / EVENTO / FINALIZAR / EDITAR) ── */}
      
      {/* MODAL GOL */}
      <Modal visible={!!modalGol} transparent animationType="slide" onRequestClose={() => { setModalGol(null); setJogadorGol(null); setEventoGolRemover(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '88%' }]}>
            <View style={styles.modalHandle} />
            {modalGol?.delta === 1 ? (
              !jogadorGol ? (
                <>
                  <Text style={styles.modalTitleText}>Quem marcou o gol?</Text>
                  <Text style={styles.modalPeriodText}>{periodos[periodoIdx]}</Text>

                  <TouchableOpacity style={styles.deletePartidaBtn} onPress={() => confirmarGolOcian(null, true)} disabled={salvandoEvento}>
                    <MaterialCommunityIcons name="soccer" size={20} color={colors.vermelho} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.deletePartidaTxt}>Gol Contra (adversário)</Text>
                      <Text style={styles.rowSub}>Nenhum jogador envolvido</Text>
                    </View>
                  </TouchableOpacity>
                  
                  <View style={styles.divider} />
                  <Text style={[styles.modalSubText, { marginBottom: 10 }]}>Selecione o jogador que marcou:</Text>
                  
                  {escalacao.length === 0 ? (
                    <View style={styles.emptyStateBox}>
                      <MaterialCommunityIcons name="account-off-outline" size={40} color={colors.textoSecundario} />
                      <Text style={styles.emptyStateText}>Defina a escalação primeiro.</Text>
                    </View>
                  ) : (
                    <FlatList data={escalacao} keyExtractor={item => String(item.id)} style={{ maxHeight: 360 }} renderItem={({ item }) => (
                        <TouchableOpacity style={styles.jogadorSelectRow} onPress={() => setJogadorGol(item)}>
                          <View style={[styles.jogadorNumero, { width: 32, height: 32, borderRadius: 8 }]}><Text style={styles.jogadorNumeroText}>{item.numCamisa}</Text></View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.jogadorSelectNome}>{item.jogador.nome}</Text>
                            <Text style={styles.jogadorSelectPos}>{item.jogador.posicao}{item.titular ? '' : ' (Banco)'}</Text>
                            <MiniStats eventos={eventos} jogadorId={item.jogador_id} />
                          </View>
                          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textoSecundario} />
                        </TouchableOpacity>
                      )}
                    />
                  )}
                  <TouchableOpacity style={styles.cancelLinkBtn} onPress={() => setModalGol(null)}><Text style={styles.cancelLinkText}>CANCELAR</Text></TouchableOpacity>
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
                      <View style={[styles.statsBadgesWrap, { width: '100%', maxWidth: '100%', marginBottom: 14, backgroundColor: colors.card, borderRadius: 10, padding: 10, justifyContent: 'flex-start' }]}>
                        <StatBadge icon={<MaterialCommunityIcons name="soccer" size={10} color={colors.primaria} />} value={s.gols} color={colors.primaria} />
                        <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={10} color={colors.primaria} />} value={s.assistencias} color={colors.primaria} />
                        <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={10} color={colors.primaria} />} value={s.defesas} color={colors.primaria} />
                        <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
                        <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
                        <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
                        {s.gols === 0 && s.assistencias === 0 && s.faltas === 0 && s.amarelos === 0 && s.vermelhos === 0 && s.azuis === 0 && s.defesas === 0 && (<Text style={styles.rowSub}>Sem eventos ainda</Text>)}
                      </View>
                    );
                  })()}
                  <Text style={[styles.modalSubText, { marginBottom: 8 }]}>Registrar <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto }}>Gol</Text> para este jogador?</Text>
                  <Text style={styles.modalPeriodText}>{periodos[periodoIdx]}</Text>
                  
                  <TouchableOpacity style={[styles.saveStatBtn, salvandoEvento && { opacity: 0.6 }]} onPress={() => confirmarGolOcian(jogadorGol, false)} disabled={salvandoEvento}>
                    {salvandoEvento ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveStatBtnText}>CONFIRMAR GOL</Text>}
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.cancelLinkBtn} onPress={() => setJogadorGol(null)}><Text style={styles.cancelLinkText}>← VOLTAR</Text></TouchableOpacity>
                </>
              )
            ) : (
              /* REMOVER GOL */
              <>
                <Text style={styles.modalTitleText}>Remover qual gol?</Text>
                <Text style={styles.modalSubText}>Selecione o evento que deseja cancelar:</Text>
                {golsOcian.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <MaterialCommunityIcons name="soccer" size={36} color={colors.textoSecundario} />
                    <Text style={styles.emptyStateText}>Nenhum gol registrado no scout.</Text>
                    <Text style={[styles.rowSub, { textAlign: 'center' }]}>Se o gol foi adicionado só no placar, use o botão – diretamente.</Text>
                  </View>
                ) : (
                  <FlatList data={golsOcian} keyExtractor={item => String(item.id)} style={{ maxHeight: 380 }} renderItem={({ item }) => (
                      <TouchableOpacity style={[styles.rowCard, { borderColor: colors.bordaErro }]} onPress={() => confirmarRemoverGol(item)} disabled={deletandoEvento === item.id}>
                        <MaterialCommunityIcons name="soccer" size={20} color={colors.primaria} />
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{item.jogador ? item.jogador.nome : 'Gol Contra'}</Text>
                          {item.periodo && <Text style={styles.rowSub}>{item.periodo}º Tempo</Text>}
                        </View>
                        {deletandoEvento === item.id ? <ActivityIndicator size="small" color={colors.vermelho} /> : <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.vermelho} />}
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity style={styles.cancelLinkBtn} onPress={() => setModalGol(null)}><Text style={styles.cancelLinkText}>CANCELAR</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL EVENTO GENERICO */}
      <Modal visible={!!modalEvento} transparent animationType="slide" onRequestClose={() => { setModalEvento(null); setJogadorEvento(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '85%' }]}>
            <View style={styles.modalHandle} />
            {!jogadorEvento ? (
              <>
                <Text style={styles.modalTitleText}>{modalEvento?.label}</Text>
                <Text style={[styles.modalSubText, { marginBottom: 4 }]}>Quem fez?</Text>
                <Text style={styles.modalPeriodText}>{periodos[periodoIdx]}</Text>
                
                {escalacao.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <MaterialCommunityIcons name="account-off-outline" size={40} color={colors.textoSecundario} />
                    <Text style={styles.emptyStateText}>Nenhum jogador na súmula.{'\n'}Defina a escalação primeiro.</Text>
                  </View>
                ) : (
                  <FlatList data={escalacao} keyExtractor={item => String(item.id)} style={{ maxHeight: 400 }} renderItem={({ item }) => (
                      <TouchableOpacity style={styles.jogadorSelectRow} onPress={() => setJogadorEvento(item)}>
                        <View style={[styles.jogadorNumero, { width: 32, height: 32, borderRadius: 8 }]}><Text style={styles.jogadorNumeroText}>{item.numCamisa}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.jogadorSelectNome}>{item.jogador.nome}</Text>
                          <Text style={styles.jogadorSelectPos}>{item.jogador.posicao}{item.titular ? '' : ' (Banco)'}</Text>
                          <MiniStats eventos={eventos} jogadorId={item.jogador_id} />
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textoSecundario} />
                      </TouchableOpacity>
                    )}
                  />
                )}
                <TouchableOpacity style={styles.cancelLinkBtn} onPress={() => setModalEvento(null)}><Text style={styles.cancelLinkText}>CANCELAR</Text></TouchableOpacity>
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
                    <View style={[styles.statsBadgesWrap, { width: '100%', maxWidth: '100%', marginBottom: 12, backgroundColor: colors.card, borderRadius: 10, padding: 10, justifyContent: 'flex-start' }]}>
                      <StatBadge icon={<MaterialCommunityIcons name="soccer" size={10} color={colors.primaria} />} value={s.gols} color={colors.primaria} />
                      <StatBadge icon={<MaterialCommunityIcons name="shoe-cleat" size={10} color={colors.primaria} />} value={s.assistencias} color={colors.primaria} />
                      <StatBadge icon={<MaterialCommunityIcons name="shield-check" size={10} color={colors.primaria} />} value={s.defesas} color={colors.primaria} />
                      <StatBadge icon={<MaterialCommunityIcons name="whistle" size={10} color="#aaa" />} value={s.faltas} color="#888" />
                      <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#F5C518' }} />} value={s.amarelos} color="#F5C518" />
                      <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: '#3A9EFF' }} />} value={s.azuis} color="#3A9EFF" />
                      <StatBadge icon={<View style={{ width: 7, height: 10, borderRadius: 1.5, backgroundColor: colors.vermelho }} />} value={s.vermelhos} color={colors.vermelho} />
                    </View>
                  );
                })()}
                <Text style={[styles.modalSubText, { marginBottom: 8 }]}>Registrar <Text style={{ fontFamily: typography.fontFamily.corpo.semiBold, color: colors.texto }}>{modalEvento?.label}</Text> para este jogador?</Text>
                <Text style={styles.modalPeriodText}>{periodos[periodoIdx]}</Text>
                
                <TouchableOpacity style={[styles.saveStatBtn, salvandoEvento && { opacity: 0.6 }]} onPress={confirmarEvento} disabled={salvandoEvento}>
                  {salvandoEvento ? <ActivityIndicator color="#FFF" /> : <Text style={styles.saveStatBtnText}>CONFIRMAR</Text>}
                </TouchableOpacity>
                <TouchableOpacity style={styles.cancelLinkBtn} onPress={() => setJogadorEvento(null)}><Text style={styles.cancelLinkText}>← VOLTAR</Text></TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL CONFIRMAR FINALIZACAO */}
      <Modal visible={modalFinalizar} transparent animationType="fade" onRequestClose={() => setModalFinalizar(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}><MaterialCommunityIcons name="flag-checkered" size={28} color={colors.vermelho} /></View>
            <Text style={styles.confirmTitle}>Finalizar Partida?</Text>
            <Text style={styles.confirmDesc}>Os dados serão salvos e o Scout de IA será atualizado com os eventos desta partida.</Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setModalFinalizar(false)}><Text style={styles.confirmCancelText}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmOk} onPress={finalizarPartida}><Text style={styles.confirmOkText}>FINALIZAR</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── MODAL EDITAR PARTIDA (REFATORADO E PADRONIZADO) ── */}
      <Modal visible={modalEditar} transparent={false} animationType="slide" onRequestClose={() => setModalEditar(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.fundo }}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setModalEditar(false)} style={styles.headerBackBtn}>
              <MaterialCommunityIcons name="arrow-left" size={20} color={colors.texto} />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.editModalTitle}>EDITAR PARTIDA</Text>
              <Text style={styles.editModalSub}>{partida.categoria?.nome}{partida.rodada ? ` • Rodada ${partida.rodada}` : ''}</Text>
            </View>
          </View>
          
          {carregandoTimes ? (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
              <ActivityIndicator size="large" color={colors.primaria} />
              <Text style={styles.emptyStateText}>Carregando times...</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
              
              <Text style={styles.sectionLabel}>CONFRONTO</Text>
              <View style={styles.confrontoContainer}>
                <TeamSelectorCard time={editMandante} tipo="MANDANTE" onPress={() => setModalTimeEdit('mandante')} />
                <View style={styles.vsBadgeContainer}><Text style={styles.vsText}>VS</Text></View>
                <TeamSelectorCard time={editVisitante} tipo="VISITANTE" onPress={() => setModalTimeEdit('visitante')} />
              </View>

              <Text style={styles.sectionLabel}>MANDO DE CAMPO</Text>
              <MandoCampo emCasa={editEmCasa} onChange={setEditEmCasa} />

              <Text style={styles.sectionLabel}>RODADA</Text>
              <View style={styles.stepperContainer}>
                <TouchableOpacity style={[styles.stepperBtn, Number(editRodada) <= 1 && styles.stepperBtnDisabled]} onPress={() => setEditRodada(r => String(Math.max(1, Number(r || 1) - 1)))} disabled={Number(editRodada) <= 1}>
                  <MaterialCommunityIcons name="minus" size={18} color={colors.primaria} />
                </TouchableOpacity>
                <View style={styles.stepperValue}><Text style={styles.stepperValueTxt}>{editRodada || '—'}</Text></View>
                <TouchableOpacity style={styles.stepperBtn} onPress={() => setEditRodada(r => String(Number(r || 0) + 1))}>
                  <MaterialCommunityIcons name="plus" size={18} color={colors.primaria} />
                </TouchableOpacity>
              </View>

              <InputDataHora data={editData} horario={editHorario} onChangeData={handleEditData} onChangeHorario={handleEditHorario} />

              <Text style={styles.sectionLabel}>LOCAL DA PARTIDA</Text>
              <View style={styles.localInputRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={17} color={colors.textoSecundario} />
                <TextInput style={styles.localInputText} value={editLocal} onChangeText={setEditLocal} placeholder="Ginásio, quadra ou campo..." placeholderTextColor={colors.textoSecundario} />
              </View>

              <TouchableOpacity onPress={salvarEdicaoPartida} disabled={salvandoEdicao} style={[styles.salvarBtn, salvandoEdicao && { opacity: 0.6 }, { marginBottom: 12 }]} activeOpacity={0.85}>
                <LinearGradient colors={['#006AFF', '#009FFF']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.salvarGradient}>
                  {salvandoEdicao ? <ActivityIndicator color="#FFF" /> : (
                    <View style={styles.salvarBtnInner}>
                      <MaterialCommunityIcons name="content-save-edit-outline" size={18} color="#FFF" />
                      <Text style={styles.salvarText}>SALVAR ALTERAÇÕES</Text>
                    </View>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deletePartidaBtn} onPress={() => { setModalEditar(false); setTimeout(() => setModalDeletar(true), 300); }}>
                <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.tituloErro} />
                <Text style={styles.deletePartidaTxt}>DELETAR PARTIDA</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
        </SafeAreaView>

        {/* MODAL SELECAO DE TIME EDIT */}
        <Modal visible={modalTimeEdit !== null} transparent animationType="slide">
          <Pressable style={styles.modalOverlay} onPress={() => { setModalTimeEdit(null); setBuscaTime(''); }}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeaderTime}>
                <Text style={styles.modalTitleTime}>{modalTimeEdit === 'mandante' ? 'Selecionar mandante' : 'Selecionar visitante'}</Text>
                <TouchableOpacity style={styles.closeBtnTime} onPress={() => { setModalTimeEdit(null); setBuscaTime(''); }}>
                  <MaterialCommunityIcons name="close" size={18} color={colors.textoSecundario} />
                </TouchableOpacity>
              </View>
              <View style={styles.buscaContainerTime}>
                <MaterialCommunityIcons name="magnify" size={20} color={colors.textoSecundario} />
                <TextInput style={styles.buscaTextTime} placeholder="Buscar time..." placeholderTextColor={colors.textoSecundario} value={buscaTime} onChangeText={setBuscaTime} autoFocus />
              </View>
              <Text style={styles.subCategoriaText}>{partida.categoria?.nome}</Text>
              
              <ScrollView showsVerticalScrollIndicator={false}>
                {timesFiltrados.length === 0 ? (
                  <View style={styles.emptyStateBox}>
                    <MaterialCommunityIcons name="shield-off-outline" size={36} color={colors.textoSecundario} />
                    <Text style={styles.emptyStateText}>Nenhum time encontrado</Text>
                  </View>
                ) : (
                  timesFiltrados.map((time, index) => {
                    const sel = modalTimeEdit === 'mandante' ? editMandante?.id === time.id : editVisitante?.id === time.id;
                    const iconColors = ['#0E78FF', '#F0B84E', '#FF4D00', '#2E7D32'];
                    const timeColor = sel ? colors.primaria : iconColors[index % iconColors.length];

                    return (
                      <TouchableOpacity key={time.id} style={[styles.modalItemTime, sel && styles.modalItemTimeActive]} onPress={() => { if (modalTimeEdit === 'mandante') setEditMandante(time); else setEditVisitante(time); setModalTimeEdit(null); setBuscaTime(''); }} activeOpacity={0.7}>
                        <View style={[styles.modalIconCircleTime, { backgroundColor: sel ? colors.primaria : colors.cardSecundario }]}>
                            {time.escudo ? (
                                 <Image source={{ uri: time.escudo }} style={{ width: 24, height: 24, borderRadius: 12 }} />
                            ) : (
                                <MaterialCommunityIcons name={sel ? "shield-check" : "shield"} size={20} color={sel ? '#FFF' : timeColor} />
                            )}
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.modalItemTextTime}>{time.nome}</Text>
                            <Text style={styles.modalItemSubTime}>{sel ? (modalTimeEdit === 'mandante' ? 'Mandante de casa' : 'Visitante convidado') : 'Na competição'}</Text>
                        </View>
                        {sel ? <MaterialCommunityIcons name="check-circle" size={24} color={colors.primaria} /> : <MaterialCommunityIcons name="circle-outline" size={24} color={colors.borda} />}
                      </TouchableOpacity>
                    );
                  })
                )}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </Modal>

      {/* MODAL DELETAR PARTIDA */}
      <Modal visible={modalDeletar} transparent animationType="fade" onRequestClose={() => setModalDeletar(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}><MaterialCommunityIcons name="trash-can-outline" size={28} color={colors.vermelho} /></View>
            <Text style={styles.confirmTitle}>Deletar Partida?</Text>
            <Text style={styles.confirmDesc}>Esta ação é irreversível. Todos os eventos e a escalação desta partida serão apagados permanentemente.</Text>
            <View style={styles.confirmBtnRow}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setModalDeletar(false)} disabled={deletandoPartida}><Text style={styles.confirmCancelText}>CANCELAR</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmOk} onPress={deletarPartida} disabled={deletandoPartida}>
                {deletandoPartida ? <ActivityIndicator color="#FFF" size="small" /> : <Text style={styles.confirmOkText}>DELETAR</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}