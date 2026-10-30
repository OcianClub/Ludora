import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '@/src/services/api';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { requisicaoPartida, type PropostaPartida } from '@/src/services/partidasCompartilhadas';

export default function SolicitacoesPartidas() {
  const { colors } = useTheme();
  const { clubeAtivo } = useClubeAtivo();
  const router = useRouter();
  const [items, setItems] = useState<PropostaPartida[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [all, setAll] = useState(false);
  const [editing, setEditing] = useState<PropostaPartida | null>(null);
  const [date, setDate] = useState(''), [time, setTime] = useState(''), [local, setLocal] = useState('');
  const text = { color: colors.texto };
  const muted = { color: colors.textoSecundario };
  const clubId = clubeAtivo?.id;
  async function load() {
    if (!clubId) return;
    const list = await requisicaoPartida<PropostaPartida[]>('/partidas/solicitacoes', clubId);
    setItems(list);
  }
  useFocusEffect(useCallback(() => {
    let active = true;
    let socket: ReturnType<typeof io> | undefined;
    async function refresh() {
      try {
        if (!clubId) return;
        const list = await requisicaoPartida<PropostaPartida[]>('/partidas/solicitacoes', clubId);
        if (active) { setItems(list); setError(''); }
      } catch (e) { if (active) setError((e as Error).message); }
      finally { if (active) setLoading(false); }
    }
    void refresh();
    void SecureStore.getItemAsync('userToken').then(token => {
      if (!active || !clubId || !token) return;
      socket = io(BASE_URL, { auth: { token, clubeId: clubId } });
      socket.on('solicitacao_partida', () => { void refresh(); });
      socket.on('connect', () => { void refresh(); });
    }).catch(() => undefined);
    const timer = setInterval(() => { if (!socket?.connected) void refresh(); }, 12000);
    return () => { active = false; clearInterval(timer); socket?.disconnect(); };
  }, [clubId]));
  async function respond(p: PropostaPartida, acao: string, extra = {}) {
    if (!clubId || busy) return;
    setBusy(true); setError('');
    try {
      const result = await requisicaoPartida<{ partidaId?: number }>(`/partidas/solicitacoes/${p.id}/responder`, clubId, { versao: p.versao, acao, ...extra });
      setEditing(null);
      await load();
      if (acao === 'ACEITAR' && result.partidaId) router.push(`/partida-compartilhada/${result.partidaId}` as never);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  function button(label: string, onPress: () => void, primary = false) {
    return <TouchableOpacity accessibilityRole="button" disabled={busy} onPress={onPress} style={[styles.button, { backgroundColor: primary ? colors.primaria : colors.cardSecundario, opacity: busy ? .5 : 1 }]}><Text style={{ color: primary ? '#fff' : colors.texto }}>{label}</Text></TouchableOpacity>;
  }
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.fundo }]}>
    <View style={styles.header}>{button('Voltar', () => router.back())}<Text style={[styles.title, text]}>Solicitações de partidas</Text></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={muted}>Confira os dados antes de aceitar. Uma única partida será compartilhada pelos clubes.</Text>
      <View style={styles.actions}>{button('Pendentes', () => setAll(false), !all)}{button('Todas', () => setAll(true), all)}</View>
      {loading && <ActivityIndicator color={colors.primaria}/>}
      {!!error && <Text accessibilityRole="alert" style={{ color: colors.tituloErro }}>{error}</Text>}
      {!loading && !items.some(p => all || p.status === 'PENDENTE') && <Text style={muted}>Nenhuma solicitação por aqui.</Text>}
      {items.filter(p => all || p.status === 'PENDENTE').map(p => <View key={p.id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borda }]}>
        <Text style={[styles.title, text]}>{p.origem.nome} × {p.destino.nome}</Text>
        <Text style={muted}>{p.categoria_nome?.toUpperCase()} · {p.tipo === 'SUMULA' ? 'Transferência da súmula' : p.tipo === 'ALTERACAO' ? 'Alteração da partida' : 'Proposta de confronto'} · {p.status.toLowerCase()}</Text>
        {p.dados.data && <Text style={text}>{p.dados.data.split('-').reverse().join('/')} · {p.dados.horario}</Text>}
        {!!p.dados.local && <Text style={muted}>{p.dados.local}</Text>}
        {p.status === 'PENDENTE' && <View style={styles.actions}>
          {p.respondente_id === clubId && <>{button('Aceitar', () => Alert.alert('Aceitar proposta?', 'Confirme a data, o horário e a responsabilidade pela súmula.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Aceitar', onPress: () => { void respond(p, 'ACEITAR'); } }]), true)}{button('Recusar', () => { void respond(p, 'RECUSAR'); })}{p.tipo !== 'SUMULA' && button('Sugerir alteração', () => { setEditing(p); setDate(p.dados.data?.split('-').reverse().join('/') || ''); setTime(p.dados.horario || ''); setLocal(p.dados.local || ''); })}</>}
          {p.origem_id === clubId && button('Cancelar proposta', () => Alert.alert('Cancelar proposta?', 'O outro clube será informado.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Cancelar proposta', onPress: () => { void respond(p, 'CANCELAR'); } }]))}
          {p.respondente_id !== clubId && <Text style={muted}>Aguardando a resposta do outro clube.</Text>}
        </View>}
        {!!p.partida_id && button('Abrir partida', () => router.push(`/partida-compartilhada/${p.partida_id}` as never))}
      </View>)}
    </ScrollView>
    <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => { if (!busy) setEditing(null); }}>
      <View style={styles.overlay}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[styles.content, { backgroundColor: colors.card }]}>
        <Text style={[text, styles.title]}>Sugerir outra data</Text>
        {[['Data · DD/MM/AAAA', date, setDate], ['Horário · HH:MM', time, setTime], ['Local', local, setLocal]].map(([label, value, change]) => <TextInput key={String(label)} accessibilityLabel={String(label)} placeholder={String(label)} placeholderTextColor={colors.textoSecundario} value={String(value)} onChangeText={change as (v: string) => void} style={[styles.input, text, { borderColor: colors.borda, backgroundColor: colors.fundo }]}/>)}
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.tituloErro }}>{error}</Text>}
        {button('Enviar sugestão', () => { if (editing) void respond(editing, 'SUGERIR', { data: date.split('/').reverse().join('-'), horario: time, local }); }, true)}
        {button('Voltar', () => setEditing(null))}
      </ScrollView></View>
    </Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 16 },
  title: { fontSize: 17, fontWeight: '600', flexShrink: 1 }, content: { padding: 16, gap: 14 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  button: { minHeight: 42, paddingVertical: 11, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center' },
  card: { padding: 16, borderRadius: 9, borderWidth: 1, gap: 12 }, input: { minHeight: 46, borderWidth: 1, borderRadius: 8, padding: 12 },
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end', paddingTop: '35%' },
});
