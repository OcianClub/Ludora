import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Icon } from '@ludora/icons';
import { validPoll, type PollChoice } from '../../../../packages/shared-types/src/matchPoll';
import { consultarPalpite, observarPalpite, votarPartida, type MatchPollData } from '../services/palpitePartida';
import { useSessao } from '../contexts/SessaoContext';
import { useTheme } from '../contexts/ThemeContext';
import type { GestaoPartida } from '../services/partidasCompartilhadas';
import { createStyles } from '../styles/sumulaPartidaStyles';
import { MiniEscudo } from './AnalisePartida';

export default function PalpitePartida({ data }: { data: GestaoPartida }) {
  const { colors } = useTheme(), { autenticado } = useSessao(), router = useRouter();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [poll, setPoll] = useState<MatchPollData | null>(null), [erro, setErro] = useState(''), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const write = useRef(false), atual = useRef(poll); atual.current = poll;
  const requisicao = useRef<AbortController | null>(null);
  const id = data.partida.id;
  function aplicar(value: MatchPollData, proprio: boolean) {
    setPoll(current => current && current.revisao > value.revisao ? current : { ...value, meuVoto: proprio ? value.meuVoto : current?.meuVoto ?? null });
  }
  useEffect(() => {
    const controller = new AbortController(); requisicao.current = controller;
    let lendo = false;
    setPoll(null); setErro(''); setNotice(''); setBusy(false); write.current = false;
    async function carregar() {
      if (lendo || write.current || controller.signal.aborted) return;
      lendo = true;
      try { const value = await consultarPalpite(id, autenticado, controller.signal); if (!controller.signal.aborted) { aplicar(value, true); setErro(''); } }
      catch { if (!controller.signal.aborted && !atual.current) setErro('Não foi possível atualizar a votação.'); }
      finally { lendo = false; }
    }
    void carregar();
    const parar = observarPalpite(value => { if (validPoll(value, id)) aplicar(value, false); });
    const timer = setInterval(() => { if (AppState.currentState === 'active' && data.partida.status === 'AO_VIVO') void carregar(); }, 30000);
    const state = AppState.addEventListener('change', value => { if (value === 'active') void carregar(); });
    return () => { controller.abort(); parar(); clearInterval(timer); state.remove(); };
  }, [id, autenticado, data.partida.status]);
  async function votar(escolha: PollChoice) {
    if (!autenticado || write.current || !poll?.aberta || data.partida.status !== 'AO_VIVO') return;
    write.current = true; setBusy(true); setErro(''); setNotice('');
    const controller = requisicao.current!;
    try { const value = await votarPartida(id, escolha, controller.signal); if (!controller.signal.aborted) { aplicar(value, true); setNotice('Palpite salvo. Você pode trocar até o encerramento.'); } }
    catch {
      try { const value = await consultarPalpite(id, true, controller.signal); if (!controller.signal.aborted) { aplicar(value, true); setNotice(value.meuVoto === escolha ? 'Seu palpite foi confirmado.' : 'Confira seu palpite antes de tentar novamente.'); } }
      catch { if (!controller.signal.aborted) setErro('Confirmação pendente. Repetir a mesma escolha não duplica o voto.'); }
    } finally { if (!controller.signal.aborted) { write.current = false; setBusy(false); } }
  }
  const choices = [{ key: 'MANDANTE', team: data.partida.mandante }, { key: 'EMPATE', team: { nome: 'Empate', escudo: undefined } }, { key: 'VISITANTE', team: data.partida.visitante }] as const;
  return <View style={s.panel}><View style={s.between}><View><Text style={s.heading}>Quem você acha que vence?</Text><Text style={s.tiny}>{poll ? `${poll.total} palpite${poll.total === 1 ? '' : 's'}` : 'Carregando votação…'}</Text></View><Icon name="trophy" size={18} color={colors.textoSecundario} /></View>
    <View style={[s.row, { alignItems: 'stretch' }]}>{choices.map(({ key, team }) => <TouchableOpacity key={key} accessibilityRole="radio" accessibilityState={{ checked: poll?.meuVoto === key, disabled: busy || !autenticado || !poll?.aberta }} accessibilityLabel={`${team.nome}, ${poll?.percentuais[key] ?? 0}% dos votos`} disabled={busy || !autenticado || !poll?.aberta || data.partida.status !== 'AO_VIVO'} onPress={() => void votar(key)} style={{ flex: 1, minWidth: 0, minHeight: 108, gap: 6, alignItems: 'center', justifyContent: 'center', padding: 9, overflow: 'hidden', borderWidth: 1, borderRadius: 8, borderColor: poll?.meuVoto === key ? colors.primaria : colors.borda, backgroundColor: colors.fundo }}>
      <View pointerEvents="none" style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${poll?.percentuais[key] ?? 0}%`, backgroundColor: colors.primaria, opacity: poll?.meuVoto === key ? 0.24 : 0.09 }} />
      {key === 'EMPATE' ? <Text style={[s.heading, { height: 28 }]}>X</Text> : <MiniEscudo nome={team.nome} url={team.escudo} />}<Text numberOfLines={1} style={s.name}>{team.nome}</Text><Text style={s.resultNumber}>{poll?.total ? `${poll.percentuais[key]}%` : '—'}</Text>
    </TouchableOpacity>)}</View>
    {busy && <ActivityIndicator color={colors.primaria} />}
    {!autenticado && data.partida.status === 'AO_VIVO' ? <TouchableOpacity accessibilityRole="button" onPress={() => router.push('/(auth)/login')}><Text style={s.link}>Entrar para dar um palpite →</Text></TouchableOpacity> : <Text style={s.tiny}>{data.partida.status !== 'AO_VIVO' ? 'Votação encerrada.' : notice || 'Um palpite por conta. Você pode trocar até o fim do jogo.'}</Text>}
    {!!erro && <Text accessibilityRole="alert" style={s.error}>{erro}</Text>}<Text style={s.tiny}>Opinião do público, não uma previsão do Scout.</Text>
  </View>;
}
