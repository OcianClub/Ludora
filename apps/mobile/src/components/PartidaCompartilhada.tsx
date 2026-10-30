import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { io } from 'socket.io-client';
import * as SecureStore from 'expo-secure-store';
import { useTheme } from '../contexts/ThemeContext';
import { useClubeAtivo } from '../contexts/ClubeAtivoContext';
import { BASE_URL } from '../services/api';
import { gestaoPartida, requisicaoPartida, type GestaoPartida } from '../services/partidasCompartilhadas';
import { PositionLabel } from './PositionIcon';
import { Icon } from '@ludora/icons';

type Row = { jogador_id: number; numCamisa: number; titular: boolean; jogador?: { nome: string; posicao: string } };
type Player = { id: number; nome: string; posicao: string; numCamisa?: number };
const eventos = [['GOL', 'Gol'], ['ASSISTENCIA', 'Assistência'], ['DEFESA', 'Defesa'], ['FALTA', 'Falta'], ['CARTAO_AMARELO', 'Amarelo'], ['CARTAO_VERMELHO', 'Vermelho'], ['CARTAO_AZUL', 'Azul']];
export default function PartidaCompartilhada({ id, onBack }: { id: number; onBack: () => void }) {
  const { colors } = useTheme();
  const { clubeAtivo } = useClubeAtivo();
  const router = useRouter();
  const [data, setData] = useState<GestaoPartida | null>(null), [rows, setRows] = useState<Row[]>([]), [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState(''), [dirty, setDirty] = useState(false);
  const mounted = useRef(true);
  const dirtyRef = useRef(false); dirtyRef.current = dirty;
  const [etapa, setEtapa] = useState(0), [available, setAvailable] = useState(false), [search, setSearch] = useState(''), [selectedTeam, setSelectedTeam] = useState<number>();
  const [connected, setConnected] = useState(false), [published, setPublished] = useState(false);
  const [dialog, setDialog] = useState<string | null>(null), [reason, setReason] = useState(''), [shirt, setShirt] = useState(''), [shirtPlayer, setShirtPlayer] = useState<Player | null>(null);
  const [event, setEvent] = useState('GOL'), [teamId, setTeamId] = useState<number>(), [actor, setActor] = useState<number>(), [contra, setContra] = useState(false);
  const [out, setOut] = useState<number>(), [into, setInto] = useState<number>(), [swap, setSwap] = useState<number>();
  const [editDate, setEditDate] = useState(''), [editTime, setEditTime] = useState(''), [editLocal, setEditLocal] = useState('');
  const clubId = clubeAtivo?.id;
  const scope = useRef('');
  scope.current = `${clubId}:${id}`;
  async function refresh(keep = dirtyRef.current) {
    if (!clubId) return;
    const source = `${clubId}:${id}`;
    const next = await gestaoPartida(id, clubId);
    if (!mounted.current || source !== scope.current) return;
    setData(next);
    const mine = next.equipes.find(e => e.id === next.minhaEquipeId);
    if (!keep) setRows(mine?.escalacao || []);
  }
  function back() {
    if (dirtyRef.current) Alert.alert('Alterações não salvas', 'Deseja sair sem salvar a escalação?', [{ text: 'Continuar editando', style: 'cancel' }, { text: 'Sair', onPress: onBack }]);
    else onBack();
  }
  useEffect(() => {
    mounted.current = true;
    setLoading(true); setData(null); setPlayers([]); setError(''); setDirty(false);
    let active = true, socket: ReturnType<typeof io> | undefined;
    let timer: ReturnType<typeof setTimeout>;
    async function load() {
      try {
        if (!clubId) return;
        const d = await gestaoPartida(id, clubId);
        if (!active) return;
        setData(d); const mine = d.equipes.find(e => e.id === d.minhaEquipeId); setRows(mine?.escalacao || []);
        if (d.podePreparar && mine) {
          const list = await requisicaoPartida<any[]>(`/jogadores/perfis?categoria_id=${mine.categoria_id}`, clubId);
          if (active) setPlayers(list.map(j => ({ id: j.id || j.id_jogador, nome: j.nome, posicao: j.posicao, numCamisa: j.numCamisa })));
        }
        const token = await SecureStore.getItemAsync('userToken');
        if (!active) return;
        socket = io(BASE_URL, { auth: { token, clubeId: clubId } });
        const sync = () => { clearTimeout(timer); timer = setTimeout(() => { if (active) void refresh().catch(e => { if (active) setError(e.message); }); }, 150); };
        socket.on('partida_atualizada', (p: { id: number }) => { if (p.id === id) sync(); });
        socket.on('connect', () => { if (active) setConnected(true); sync(); });
        socket.on('disconnect', () => { if (active) setConnected(false); });
        socket.on('connect_error', () => { if (active) setConnected(false); });
      } catch (e) { if (active) setError((e as Error).message); } finally { if (active) setLoading(false); }
    }
    void load();
    const interval = setInterval(() => { if (active && socket && !socket.connected) void refresh().catch(() => undefined); }, 12000);
    const appState = AppState.addEventListener('change', state => { if (state === 'active' && active) void refresh().catch(() => undefined); });
    const listener = BackHandler.addEventListener('hardwareBackPress', () => { back(); return true; });
    return () => { active = false; mounted.current = false; clearTimeout(timer); clearInterval(interval); socket?.disconnect(); listener.remove(); appState.remove(); };
  }, [id, clubId]);
  async function run(endpoint: string, payload: object, method = 'POST', keep = false) {
    if (!clubId || busy) return false;
    setBusy(true); setError('');
    try { await requisicaoPartida(`/partidas/${id}${endpoint ? `/${endpoint}` : ''}`, clubId, { ...payload, versao: data?.partida.versao }, method); await refresh(keep); return true; }
    catch (e) { setError((e as Error).message); return false; } finally { setBusy(false); }
  }
  const text = { color: colors.texto };
  const secondary = { color: colors.textoSecundario };
  const card = { backgroundColor: colors.card, borderColor: colors.linha };
  const input = { color: colors.texto, borderColor: colors.borda, backgroundColor: colors.fundo };
  function action(label: string, onPress: () => void, primary = false, disabled = false) {
    return <TouchableOpacity key={label} accessibilityRole="button" accessibilityLabel={label} disabled={disabled || busy} onPress={onPress} style={[styles.button, { backgroundColor: primary ? colors.primaria : colors.cardSecundario, opacity: disabled || busy ? .5 : 1 }]}><Text style={[styles.buttonText, { color: primary ? '#fff' : colors.texto }]}>{label}</Text></TouchableOpacity>;
  }
  if (loading) return <SafeAreaView style={[styles.root, { backgroundColor: colors.fundo }]}><ActivityIndicator color={colors.primaria}/></SafeAreaView>;
  if (!data) return <SafeAreaView style={[styles.root, { backgroundColor: colors.fundo }]}><Text style={text}>{error || 'Partida não encontrada.'}</Text>{action('Voltar', onBack)}</SafeAreaView>;
  const p = data.partida, mine = data.equipes.find(e => e.id === data.minhaEquipeId);
  const preparing = data.podePreparar && ['AGENDADA', 'PREPARADA'].includes(p.status);
  const required = p.titulares_necessarios;
  const starters = rows.filter(r => r.titular), reserves = rows.filter(r => !r.titular);
  const visibleTeam = data.equipes.find(e => e.id === selectedTeam) || data.equipes[0];
  const actorTeamId = contra ? teamId === p.mandante_id ? p.visitante_id : p.mandante_id : teamId;
  const actorTeam = data.equipes.find(e => e.time_id === actorTeamId);
  async function save(exit = false) {
    if (await run('escalacao', { jogadores: rows.map(({ jogador_id, numCamisa, titular }) => ({ jogador_id, numCamisa, titular })) }, 'PUT', true)) { setDirty(false); if (exit) onBack(); return true; }
    return false;
  }
  function select(player: Player) {
    if (!rows.some(r => r.jogador_id === player.id) && !player.numCamisa) { setShirtPlayer(player); setShirt(''); setDialog('shirt'); return; }
    const next = rows.some(r => r.jogador_id === player.id) ? rows.filter(r => r.jogador_id !== player.id) : [...rows, { jogador_id: player.id, numCamisa: player.numCamisa!, titular: false, jogador: player }];
    setRows(next.map((r, i) => ({ ...r, titular: i < required }))); setDirty(true);
  }
  function playerRow(r: Row, index: number, editable: boolean) {
    const player = players.find(j => j.id === r.jogador_id) || r.jogador;
    return <View key={r.jogador_id} style={[styles.playerRow, card]}><Text style={secondary}>{index + 1}</Text><TouchableOpacity disabled={!editable} onPress={() => { setShirtPlayer({ id: r.jogador_id, nome: player?.nome || 'Jogador', posicao: player?.posicao || '', numCamisa: r.numCamisa || undefined }); setShirt(String(r.numCamisa || '')); setDialog('shirt'); }} style={[styles.shirt, { backgroundColor: colors.cardSecundario }]}><Text style={[text, styles.bold]}>{r.numCamisa || '?'}</Text></TouchableOpacity><View style={styles.flex}><Text style={[text, styles.bold]}>{player?.nome}</Text><PositionLabel position={player?.posicao || ''} textStyle={[styles.small, secondary]}/></View>{editable && <View style={styles.inline}>{action(swap === r.jogador_id ? 'Escolhido' : 'Trocar', () => {
      if (!swap) setSwap(r.jogador_id); else { const a = rows.find(j => j.jogador_id === swap)!; setRows(rows.map(j => j.jogador_id === swap ? { ...r, titular: a.titular } : j.jogador_id === r.jogador_id ? { ...a, titular: r.titular } : j)); setSwap(undefined); setDirty(true); }
    })}<TouchableOpacity accessibilityLabel={`Remover ${player?.nome}`} onPress={() => select({ id: r.jogador_id, nome: player?.nome || '', posicao: player?.posicao || '', numCamisa: r.numCamisa })}><Text style={[text, styles.title]}>×</Text></TouchableOpacity></View>}</View>;
  }
  function openEvent(tipo: string, time: number) { if (tipo === 'GOL' && p.status === 'AO_VIVO' && !data!.equipes.some(e => e.time_id === time)) { void run('eventos', { tipo, time_id: time }); return; } setEvent(tipo); setTeamId(time); setActor(undefined); setContra(false); setReason(''); setError(''); setDialog('event'); }
  return <SafeAreaView style={[styles.root, { backgroundColor: colors.fundo }]}>
    <View style={styles.header}><TouchableOpacity accessibilityLabel="Voltar" onPress={back}><Text style={[text, styles.title]}>‹</Text></TouchableOpacity><Text style={[text, styles.heading, styles.flex]}>{preparing ? 'Preparação da partida' : 'Detalhes da partida'}</Text>{preparing && action('•••', () => Alert.alert('Ações da partida', '', [
      { text: 'Editar dados', onPress: () => { setEditDate(p.data.slice(0, 10).split('-').reverse().join('/')); setEditTime(p.horario || ''); setEditLocal(p.local || ''); setDialog('edit'); } },
      ...(data.podeSumula && preparing && data.equipes.length > 1 ? [{ text: 'Transferir súmula', onPress: () => { void run('sumula', {}).then(ok => { if (ok) Alert.alert('Solicitação enviada', 'O outro clube precisa aceitar para assumir a súmula.'); }); } }] : []),
      { text: 'Solicitações', onPress: () => { onBack(); router.push('/solicitacoes-partidas' as never); } },
      { text: 'Cancelar partida', style: 'destructive', onPress: () => { setReason(''); setDialog('cancel'); } }, { text: 'Voltar', style: 'cancel' },
    ]))}</View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {!preparing && <Text style={[styles.small, secondary]}>{connected ? 'Atualizando em tempo real' : 'Reconectando. Consultando o servidor periodicamente.'}</Text>}
      <Text style={[styles.small, secondary]}>Organizada pelo {data.organizador?.nome}</Text>
      {preparing && <><View style={styles.inline}>{['Dados', 'Escalação', 'Revisão'].map((label, index) => <TouchableOpacity key={label} style={[styles.step, { borderBottomColor: index === etapa ? colors.primaria : colors.linha }]} onPress={() => { if (index < etapa) setEtapa(index); }}><Text style={index === etapa ? text : secondary}>{index + 1} · {label}</Text></TouchableOpacity>)}</View><Text style={[text, styles.title]}>{['Dados da partida', 'Monte sua equipe', 'Revise antes de confirmar'][etapa]}</Text></>}
      {(!preparing || etapa !== 1) && <View style={[styles.match, card]}><View style={styles.inline}><Text style={[secondary, styles.flex]}>{p.data.slice(0, 10).split('-').reverse().join('/')} · {p.categoria?.nome?.toUpperCase()}</Text><Text style={[text, styles.small]}>{p.status}</Text></View><View style={styles.teams}>{[p.mandante, null, p.visitante].map((t, i) => i === 1 ? <View key="score" style={styles.team}><Text style={[text, styles.score]}>{['AO_VIVO', 'FINALIZADA'].includes(p.status) ? `${p.gols_mandante} · ${p.gols_visitante}` : 'VS'}</Text><Text style={[text, styles.time, { backgroundColor: colors.cardSecundario }]}>{p.horario}</Text></View> : <View key={i} style={[styles.team, styles.flex]}>{t?.escudo ? <Image source={{ uri: t.escudo }} style={styles.crest} resizeMode="contain"/> : <View style={[styles.crest, styles.center, { backgroundColor: colors.cardSecundario }]}><Text style={[text, styles.title]}>{t?.nome?.slice(0, 1)}</Text></View>}<Text style={[text, styles.bold]}>{t?.nome}</Text><Text style={[secondary, styles.small]}>{i === 0 ? 'Mandante' : 'Visitante'}</Text></View>)}</View><View style={[styles.location, { borderTopColor: colors.borda }]}><Icon name="location" size={18} color={colors.textoSecundario}/><Text style={[secondary, styles.flex]}>{p.local || 'Local a definir'}</Text></View></View>}
      <View style={styles.status}>{data.equipes.map(e => <Text key={e.id} style={secondary}>{e.clube.nome} · {e.pronta ? 'Equipe pronta' : 'Preparação pendente'}</Text>)}</View>
      {preparing && etapa === 1 && <><Text style={secondary}>Os primeiros {required} convocados são titulares. Use Trocar para alternar dois jogadores.</Text><Text style={[text, styles.heading]}>Titulares · {starters.length}/{required}</Text>{starters.map((r, i) => playerRow(r, i, true))}<Text style={[text, styles.heading]}>Reservas · {reserves.length}</Text>{reserves.map((r, i) => playerRow(r, starters.length + i, true))}{action(`Adicionar jogadores ${available ? '−' : '+'}`, () => setAvailable(v => !v))}{available && <><TextInput accessibilityLabel="Buscar jogador" value={search} onChangeText={setSearch} placeholder="Nome, camisa ou posição" placeholderTextColor={colors.textoSecundario} style={[styles.input, input]}/>{players.filter(j => !rows.some(r => r.jogador_id === j.id) && `${j.nome} ${j.posicao} ${j.numCamisa || ''}`.toLowerCase().includes(search.toLowerCase())).map(j => <TouchableOpacity key={j.id} onPress={() => select(j)} style={[styles.playerRow, card]}><View style={[styles.shirt, { backgroundColor: colors.cardSecundario }]}>{j.numCamisa ? <Text style={text}>{j.numCamisa}</Text> : <Icon name="tshirt-crew-outline" size={22} color={colors.texto}/>}</View><View style={styles.flex}><Text style={[text, styles.bold]}>{j.nome}</Text><PositionLabel position={j.posicao} textStyle={[secondary, styles.small]}/></View><Text style={[text, styles.title]}>+</Text></TouchableOpacity>)}</>}</>}
      {preparing && etapa === 2 && <><Text style={[text, styles.heading]}>Equipe convocada</Text><Text style={secondary}>Titulares · {starters.length}</Text>{starters.map((r, i) => playerRow(r, i, false))}<Text style={secondary}>Reservas · {reserves.length}</Text>{reserves.map((r, i) => playerRow(r, starters.length + i, false))}</>}
      {preparing && data.equipes.some(e => e.publicada_em) && action(published ? 'Ocultar escalações publicadas' : 'Ver escalações publicadas', () => setPublished(v => !v))}
      {(!preparing || published) && <><View style={styles.inline}>{data.equipes.map(e => action(e.clube.nome, () => setSelectedTeam(e.id), e.id === visibleTeam?.id))}</View>{!visibleTeam?.publicada_em ? <Text style={secondary}>Escalação ainda não divulgada.</Text> : visibleTeam.escalacao.map((r, i) => playerRow(r, i, false))}</>}
      {data.podeSumula && ['AO_VIVO', 'FINALIZADA'].includes(p.status) && <><Text style={[text, styles.heading]}>Registrar evento</Text><View style={styles.inline}>{action(`Gol · ${p.mandante?.nome}`, () => openEvent('GOL', p.mandante_id), true)}{action(`Gol · ${p.visitante?.nome}`, () => openEvent('GOL', p.visitante_id), true)}</View><View style={styles.inline}>{eventos.filter(e => e[0] !== 'GOL').map(([tipo, label]) => action(label, () => openEvent(tipo, mine?.time_id || p.mandante_id)))}</View>{p.status === 'AO_VIVO' && <>{action(`Período ${p.periodo_atual} · Avançar`, () => { void run('periodo', { periodo: p.periodo_atual + 1 }, 'PATCH'); }, false, p.periodo_atual >= 10)}{action('Finalizar partida', () => Alert.alert('Finalizar partida?', 'Confira o placar e os eventos.', [{ text: 'Voltar', style: 'cancel' }, { text: 'Finalizar', onPress: () => { void run('status', { status: 'FINALIZADA' }, 'PATCH'); } }]))}</>}</>}
      {p.status === 'AO_VIVO' && data.podePreparar && action('Substituição da minha equipe', () => { setOut(undefined); setInto(undefined); setDialog('sub'); })}
      {['AO_VIVO', 'FINALIZADA'].includes(p.status) && <><Text style={[text, styles.heading]}>Eventos da partida</Text>{data.eventos.map(e => <View key={e.id} style={[styles.playerRow, card]}><View style={styles.flex}><Text style={[text, styles.bold]}>{eventos.find(t => t[0] === e.tipo)?.[1] || e.tipo}{e.gol_contra ? ' contra' : ''}</Text><Text style={secondary}>{e.jogador?.nome || 'Sem atleta identificado'} · {e.periodo}º período</Text></View></View>)}{!data.eventos.length && <Text style={secondary}>Nenhum evento registrado.</Text>}</>}
      {p.status === 'FINALIZADA' && action('Compartilhar resultado', () => { void Share.share({ message: `${p.mandante?.nome} ${p.gols_mandante} × ${p.gols_visitante} ${p.visitante?.nome} · Ludora` }).catch(() => setError('Não foi possível compartilhar agora.')); })}
      {error && <><Text accessibilityRole="alert" style={{ color: colors.tituloErro }}>{error}</Text>{action('Atualizar dados', () => { void refresh().then(() => setError('')).catch(e => setError(e.message)); })}</>}
    </ScrollView>
    {preparing && <View style={[styles.footer, { backgroundColor: colors.fundo, borderTopColor: colors.linha }]}>{busy && <ActivityIndicator color={colors.primaria}/>}<View style={styles.inline}>{etapa > 0 && action('Voltar', () => setEtapa(v => v - 1))}{etapa === 1 && action('Salvar e sair', () => { void save(true); })}{etapa < 2 ? action(etapa === 0 ? 'Montar escalação' : 'Revisar partida', () => {
      if (etapa === 1 && starters.length !== required) { setError(`Selecione ${required} titulares.`); return; }
      if (etapa === 1 && dirty) void save().then(ok => { if (ok) setEtapa(2); }); else setEtapa(v => v + 1);
    }, true) : !mine?.pronta ? action('Confirmar equipe', () => { void run('preparacao', {}).then(ok => { if (ok) setDirty(false); }); }, true) : p.status === 'PREPARADA' && data.podeSumula ? action('Iniciar partida', () => { void run('status', { status: 'AO_VIVO' }, 'PATCH'); }, true) : <Text style={secondary}>Aguardando a outra equipe ou o responsável iniciar.</Text>}</View></View>}
    <Modal visible={!!dialog} animationType="slide" transparent onRequestClose={() => { if (!busy) setDialog(null); }}><View style={styles.overlay}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}><View style={[styles.sheet, { backgroundColor: colors.card }]}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}><Text style={[text, styles.title]}>{dialog === 'shirt' ? 'Número da camisa' : dialog === 'event' ? 'Registrar evento' : dialog === 'sub' ? 'Substituição' : dialog === 'edit' ? 'Alterar dados' : 'Cancelar partida'}</Text>
      {dialog === 'shirt' && <><Text style={text}>{shirtPlayer?.nome}</Text><TextInput accessibilityLabel="Número da camisa" keyboardType="number-pad" value={shirt} onChangeText={setShirt} placeholder="De 1 a 99" placeholderTextColor={colors.textoSecundario} style={[styles.input, input]}/></>}
      {dialog === 'edit' && <><Text style={secondary}>Em confrontos compartilhados, o outro clube precisa aceitar a alteração.</Text><TextInput accessibilityLabel="Data" placeholder="DD/MM/AAAA" value={editDate} onChangeText={setEditDate} style={[styles.input, input]}/><TextInput accessibilityLabel="Horário" placeholder="HH:MM" value={editTime} onChangeText={setEditTime} style={[styles.input, input]}/><TextInput accessibilityLabel="Local" value={editLocal} onChangeText={setEditLocal} style={[styles.input, input]}/></>}
      {dialog === 'event' && <><View style={styles.inline}>{action(p.mandante?.nome || 'Mandante', () => { setTeamId(p.mandante_id); setActor(undefined); }, teamId === p.mandante_id)}{action(p.visitante?.nome || 'Visitante', () => { setTeamId(p.visitante_id); setActor(undefined); }, teamId === p.visitante_id)}</View>{event === 'GOL' && action(contra ? '✓ Gol contra' : 'Gol contra', () => { setContra(v => !v); setActor(undefined); }, contra)}{actorTeam?.escalacao.filter(j => j.titular || p.status === 'FINALIZADA').map(j => action(`#${j.numCamisa} · ${j.jogador?.nome}`, () => setActor(j.jogador_id), actor === j.jogador_id))}{p.status === 'FINALIZADA' && <TextInput accessibilityLabel="Motivo da correção" placeholder="Motivo da correção" value={reason} onChangeText={setReason} style={[styles.input, input]}/>}</>}
      {dialog === 'sub' && <><Text style={secondary}>Quem sai?</Text>{mine?.escalacao.filter(j => j.titular).map(j => action(`#${j.numCamisa} · ${j.jogador?.nome}`, () => setOut(j.jogador_id), out === j.jogador_id))}<Text style={secondary}>Quem entra?</Text>{mine?.escalacao.filter(j => !j.titular).map(j => action(`#${j.numCamisa} · ${j.jogador?.nome}`, () => setInto(j.jogador_id), into === j.jogador_id))}</>}
      {dialog === 'cancel' && <TextInput accessibilityLabel="Motivo do cancelamento" placeholder="Motivo do cancelamento" value={reason} onChangeText={setReason} style={[styles.input, input]}/>}
      {error && <Text accessibilityRole="alert" style={{ color: colors.tituloErro }}>{error}</Text>}
      {action(busy ? 'Salvando…' : 'Confirmar', () => {
        if (dialog === 'shirt') {
          const number = Number(shirt);
          if (!shirtPlayer || !Number.isInteger(number) || number < 1 || number > 99) { setError('Informe um número de 1 a 99.'); return; }
          async function assign(confirmation?: any) {
            setBusy(true); setError('');
            try {
              const response = await (await import('../services/api')).apiFetch(`/jogadores/${shirtPlayer!.id}`, { method: 'PATCH', body: JSON.stringify({ numCamisa: number, ...(confirmation ? { confirmar_camisa: { jogador_id: confirmation.jogador_id, camisa_anterior: confirmation.camisa_anterior } } : {}) }) });
              const body = await response.json();
              if (response.status === 409 && body.conflito_camisa) { const c = body.conflito_camisa; Alert.alert('Camisa já utilizada', `${c.nome} usa a camisa ${number}. Confirmar a troca? ${c.camisa_anterior == null ? 'O outro jogador ficará sem número.' : ''}`, [{ text: 'Voltar', style: 'cancel' }, { text: 'Trocar', onPress: () => { void assign(c); } }]); return; }
              if (!response.ok) throw new Error(body.error || 'Não foi possível salvar.');
              const updateNumber = (playerId: number, old: number | undefined) => playerId === shirtPlayer!.id ? number : playerId === confirmation?.jogador_id ? confirmation.camisa_anterior || undefined : old;
              setPlayers(list => list.map(j => ({ ...j, numCamisa: updateNumber(j.id, j.numCamisa) })));
              setRows(list => list.map(j => ({ ...j, numCamisa: updateNumber(j.jogador_id, j.numCamisa) || 0 }))); setDirty(true); setDialog(null);
            } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
          }
          void assign();
        } else if (dialog === 'edit') {
          const date = editDate.includes('/') ? editDate.split('/').reverse().join('-') : editDate;
          void run('', { data: date, horario: editTime, local: editLocal }, 'PATCH').then(ok => { if (ok) { setDialog(null); if (data.equipes.length > 1) { onBack(); router.push('/solicitacoes-partidas' as never); } } });
        } else if (dialog === 'event') void run('eventos', { tipo: event, time_id: teamId, jogador_id: actor, gol_contra: contra, periodo: p.periodo_atual, motivo: reason }).then(ok => { if (ok) setDialog(null); });
        else if (dialog === 'sub') void run('substituicoes', { sai: out, entra: into }).then(ok => { if (ok) setDialog(null); });
        else void run('status', { status: 'CANCELADA', motivo: reason }, 'PATCH').then(ok => { if (ok) setDialog(null); });
      }, true)}{action('Voltar', () => { setDialog(null); setError(''); })}
    </ScrollView></View></KeyboardAvoidingView></View></Modal>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  root: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 18, paddingVertical: 12 },
  content: { padding: 18, gap: 14, paddingBottom: 30 }, flex: { flex: 1, minWidth: 0 }, inline: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  heading: { fontSize: 16, fontWeight: '600' }, title: { fontSize: 21, fontWeight: '600' }, small: { fontSize: 12 }, bold: { fontWeight: '600', fontSize: 14 },
  button: { minHeight: 42, paddingHorizontal: 13, paddingVertical: 11, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }, buttonText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  match: { borderWidth: 1, borderRadius: 9, padding: 14, gap: 16 }, teams: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', justifyContent: 'space-around' }, team: { alignItems: 'center', gap: 8 },
  crest: { width: 58, height: 58, borderRadius: 8 }, center: { alignItems: 'center', justifyContent: 'center' }, score: { fontSize: 30, fontWeight: '700', paddingTop: 10, minHeight: 58 }, time: { borderRadius: 6, paddingVertical: 5, paddingHorizontal: 9 },
  location: { borderTopWidth: 1, paddingTop: 14, flexDirection: 'row', gap: 8, alignItems: 'center' }, status: { gap: 6 },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: 9, padding: 10, borderRadius: 8, borderWidth: 1, minHeight: 68 }, shirt: { width: 36, height: 38, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  input: { borderWidth: 1, minHeight: 44, borderRadius: 8, padding: 12, fontSize: 14 }, step: { flex: 1, paddingVertical: 12, borderBottomWidth: 3 }, footer: { padding: 14, borderTopWidth: 1, gap: 6 },
  overlay: { flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }, sheetWrap: { maxHeight: '90%' }, sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, overflow: 'hidden' },
});
