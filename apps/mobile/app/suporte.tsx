import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { Redirect, useRouter, useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSheetKeyboard } from '../src/hooks/useSheetKeyboard';
import Constants from 'expo-constants';
import { useSessao } from '../src/contexts/SessaoContext';
import { useClubeAtivo } from '../src/contexts/ClubeAtivoContext';
import { useTheme } from '../src/contexts/ThemeContext';
import { useAssistance } from '../src/contexts/AssistanceContext';
import { useLocalDraft } from '../src/hooks/useLocalDraft';
import { apiFetch } from '../src/services/api';
import { AppButton } from '../src/components/ui/Controls';
import { SelectField } from '../src/components/ui/SelectField';
import { Header } from '../src/components/Header';
import { Skeleton } from '../src/components/Skeleton';
const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const n = Math.floor(Math.random() * 16); return (c === 'x' ? n : (n & 3) | 8).toString(16); });
const statuses: Record<string, string> = { NOVO: 'Novo', EM_TRIAGEM: 'Em triagem', EM_ANDAMENTO: 'Em andamento', AGUARDANDO_CLIENTE: 'Aguardando sua resposta', RESOLVIDO: 'Resolvido', REABERTO: 'Reaberto', ENCAMINHADO_DEVS: 'Com os desenvolvedores' };
type Ticket = { id: string; assunto: string; descricao: string; status: string; ultimaResposta?: { motivo: string }; historico?: { id: number; motivo: string; acao: string; criadoEm: string }[] };
export default function SupportScreen() {
  const { autenticado, carregando } = useSessao(); const [identity, setIdentity] = useState(''), [identityError, setIdentityError] = useState(false), [attempt, setAttempt] = useState(0);
  useEffect(() => { let active = true; void SecureStore.getItemAsync('userEmail').then(email => { if (!active) return; if (email) setIdentity(Array.from(email).map(c => c.charCodeAt(0).toString(16)).join('')); else setIdentityError(true); }).catch(() => { if (active) setIdentityError(true); }); return () => { active = false; }; }, [attempt]);
  if (carregando) return <ActivityIndicator />;
  if (!autenticado) return <Redirect href="/(auth)/login" />;
  if (identityError && !identity) return <View style={{ padding: 24, gap: 16 }}><Text>Não foi possível identificar sua conta. Tente novamente ou entre na conta novamente.</Text><AppButton label="Tentar novamente" onPress={() => { setIdentityError(false); setAttempt(n => n + 1); }} /></View>;
  if (!identity) return <ActivityIndicator accessibilityLabel="Carregando suporte" />;
  return <Support key={identity} identity={identity} />;
}
function Support({ identity }: { identity: string }) {
  const { colors: c } = useTheme(), { clubeAtivo } = useClubeAtivo(), { seen, version } = useAssistance();
  const { tela } = useLocalSearchParams<{ tela?: string }>(); const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollView>(null);
  const reveal = useSheetKeyboard(scroll);
  const initial = useRef({ assunto: '', descricao: '', tipo: 'OUTRO', impacto: 'DIFICULDADE', requestId: uuid() }).current;
  const draft = useLocalDraft(`support-${identity}-${clubeAtivo?.id ?? 0}`, initial);
  const [tab, setTab] = useState('novo'), [selected, setSelected] = useState(''), [tickets, setTickets] = useState<Ticket[]>([]), [ticket, setTicket] = useState<Ticket>();
  const [error, setError] = useState(''), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [refreshKey, setRefreshKey] = useState(0);
  const lock = useRef(false);
  const reply = useLocalDraft(`reply-${identity}-${selected || 'none'}`, { mensagem: '' });
  useEffect(() => {
    if (tab === 'novo') { setLoading(false); return; }
    const controller = new AbortController(); let running = false;
    async function load() {
      if (running || (AppState.currentState === 'background' || AppState.currentState === 'inactive')) return;
      running = true;
      try {
        const r = await apiFetch(selected ? `/suporte/${encodeURIComponent(selected)}` : '/suporte', { signal: controller.signal, revalidar: true });
        const data = await r.json(); if (!r.ok) throw Error(data.error || 'Não foi possível consultar os chamados.');
        if (controller.signal.aborted) return;
        if (selected) setTicket(data); else setTickets(data);
        setError(''); if (selected) seen(selected);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Verifique sua conexão.'); }
      finally { running = false; if (!controller.signal.aborted) setLoading(false); }
    }
    setLoading(true); setTicket(undefined); void load(); const timer = setInterval(load, 15000);
    const listener = AppState.addEventListener('change', s => { if (s === 'active') void load(); });
    return () => { controller.abort(); clearInterval(timer); listener.remove(); };
  }, [tab, selected, refreshKey, seen, version]);
  const change = (field: string, value: string) => draft.setValue(old => ({ ...old, [field]: value, requestId: uuid() }));
  async function submit(answer = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const r = await apiFetch(answer ? `/suporte/${encodeURIComponent(selected)}/responder` : '/suporte', { method: 'POST', headers: { 'x-clube-id': clubeAtivo?.papel ? String(clubeAtivo.id) : '' }, body: JSON.stringify(answer ? reply.value : { ...draft.value, servico: Platform.OS === 'web' ? 'web' : 'mobile', versao: Constants.expoConfig?.version || 'mobile', rota: typeof tela === 'string' && tela.startsWith('/') ? tela.split('?')[0] : '/suporte' }) });
      const data = await r.json(); if (!r.ok) throw Error(data.error || 'Não foi possível enviar. Seu texto foi mantido.');
      if (answer) reply.setValue({ mensagem: '' }); else { draft.setValue({ ...initial, requestId: uuid() }); setSelected(data.id); setTab('historico'); }
      setRefreshKey(n => n + 1);
    } catch (e) { setError(e instanceof Error ? e.message : 'Verifique sua conexão. Seu texto foi mantido.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const input = { color: c.texto, backgroundColor: c.card, borderColor: c.borda, borderWidth: 1, borderRadius: 8, padding: 12, fontFamily: 'Inter_400Regular', fontSize: 14 };
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1, backgroundColor: c.fundo }}>
    <Header title="Suporte e ajuda" btnVoltar="arrow-left" onBtnVoltar={() => router.back()} />
    <ScrollView ref={scroll} onTouchEnd={reveal} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: Math.max(insets.bottom, 16) + 24 }}>
      <View style={{ flexDirection: 'row', gap: 8 }}><AppButton label="Novo chamado" onPress={() => { setSelected(''); setTab('novo'); }} style={{ flex: 1 }} /><AppButton label="Meus chamados" onPress={() => { setSelected(''); setTab('historico'); }} style={{ flex: 1 }} /></View>
      {!!error && <View accessibilityRole="alert" style={{ gap: 8 }}><Text style={{ color: c.tituloErro }}>{error}</Text><AppButton label="Tentar novamente" onPress={() => setRefreshKey(n => n + 1)} /></View>}
      {tab === 'novo' ? <>
        <SelectField label="Tipo de ajuda" value={draft.value.tipo} options={Object.entries({ ERRO: 'Erro ou lentidão', CONVITE: 'Convite', RECUPERACAO: 'Acesso à conta', CONFIGURACAO: 'Configuração', DUVIDA: 'Dúvida', SEGURANCA: 'Segurança', OUTRO: 'Outro' }).map(([value, label]) => ({ value, label }))} onChange={v => change('tipo', v)} />
        <SelectField label="Como isso afeta seu uso?" value={draft.value.impacto} options={[{ value: 'DUVIDA', label: 'Tenho uma dúvida' }, { value: 'DIFICULDADE', label: 'Consigo usar com dificuldade' }, { value: 'OPERACAO_BLOQUEADA', label: 'Não consigo concluir a ação' }]} onChange={v => change('impacto', v)} />
        <Text style={{ color: c.texto }}>Assunto</Text><TextInput accessibilityLabel="Assunto" placeholder="Resumo do que você precisa" placeholderTextColor={c.textoSecundario} editable={draft.ready && !busy} maxLength={120} value={draft.value.assunto} onChangeText={v => change('assunto', v)} style={input} />
        <Text style={{ color: c.texto }}>O que aconteceu?</Text><TextInput accessibilityLabel="Descrição do chamado" placeholder="Conte o que tentou fazer, o que aconteceu e o que esperava." placeholderTextColor={c.textoSecundario} editable={draft.ready && !busy} multiline textAlignVertical="top" maxLength={4000} value={draft.value.descricao} onChangeText={v => change('descricao', v)} style={[input, { minHeight: 150 }]} />
        <Text style={{ color: c.textoSecundario, fontSize: 12 }}>{draft.saved ? 'Rascunho salvo neste dispositivo. ' : ''}Não envie senhas, documentos ou códigos de acesso.</Text>
        <Text style={{ color: c.textoSecundario, fontSize: 12 }}>Origem: {Platform.OS === 'web' ? 'Web' : 'App mobile'} · {clubeAtivo?.nome || 'Minha conta'}</Text>
        <AppButton label="Enviar chamado" variant="primary" busy={busy} disabled={!draft.ready || draft.value.assunto.trim().length < 3 || draft.value.descricao.trim().length < 10} onPress={() => void submit()} />
      </> : loading && !ticket && !tickets.length ? <>{[1, 2, 3].map(n => <Skeleton key={n} width="100%" height={90} />)}</> : selected ? <>
        <AppButton label="Voltar aos chamados" onPress={() => setSelected('')} />
        {ticket && <><Text style={{ color: c.texto, fontFamily: 'Inter_600SemiBold', fontSize: 18 }}>{ticket.assunto}</Text><Text style={{ color: c.primaria }}>{statuses[ticket.status] || ticket.status}</Text><Text selectable style={{ color: c.texto }}>{ticket.descricao}</Text>
          {ticket.historico?.map(h => <View key={h.id} style={{ padding: 12, gap: 6, backgroundColor: c.card, borderRadius: 8 }}><Text style={{ color: c.textoSecundario, fontSize: 12 }}>{h.acao === 'RESPOSTA_CLIENTE' ? 'Você' : 'Equipe Ludora'} · {new Date(h.criadoEm).toLocaleString('pt-BR')}</Text><Text selectable style={{ color: c.texto }}>{h.motivo}</Text></View>)}
          <TextInput accessibilityLabel="Responder ao suporte" placeholder="Adicionar informações" placeholderTextColor={c.textoSecundario} editable={reply.ready && !busy} multiline maxLength={4000} value={reply.value.mensagem} onChangeText={v => reply.setValue({ mensagem: v })} style={[input, { minHeight: 100 }]} />
          <AppButton label="Enviar resposta" busy={busy} disabled={!reply.ready || reply.value.mensagem.trim().length < 5} onPress={() => void submit(true)} />
        </>}
      </> : <>{!tickets.length && <Text style={{ color: c.textoSecundario }}>Você ainda não abriu chamados.</Text>}{tickets.map(t => <AppButton key={t.id} label={`${t.assunto} · ${statuses[t.status] || t.status}${t.ultimaResposta ? ' · Resposta da equipe' : ''}`} onPress={() => setSelected(t.id)} />)}</>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
