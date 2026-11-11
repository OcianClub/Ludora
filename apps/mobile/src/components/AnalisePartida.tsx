import React, { useMemo, useState } from 'react';
import { Image, Linking, Text, TouchableOpacity, View } from 'react-native';
import { Icon, type IconName } from '@ludora/icons';
import { matchInsights, MATCH_METRICS } from '../../../../packages/shared-types/src/matchInsights';
import type { GestaoPartida } from '../services/partidasCompartilhadas';
import { useTheme } from '../contexts/ThemeContext';
import { createStyles } from '../styles/sumulaPartidaStyles';
import { AppSheet } from './ui/AppSheet';
import { IconButton } from './ui/Controls';
import { ultimoPeriodoIniciado } from '../utils/validacaoSumula';

export const EXPLICACAO_REGISTROS = [
  'Participação em gols: gols + (assistências × 0,6). É um critério do Ludora para destacar contribuições registradas, sem dar nota ou definir o melhor jogador.',
  'Defesas: maior quantidade registrada, analisada separadamente. Todos os empates são preservados. Gols contra entram no placar do adversário e não pontuam o autor.',
  'Usamos apenas eventos publicados e atletas da escalação publicada. Lances sem jogador não contam para os destaques. Zero significa nenhum registro; não mede habilidade, minutos em campo ou eficiência.',
  'Em “Todos”, gols seguem o placar da súmula, inclusive correções. Por tempo, mostram os eventos de gol registrados. O filtro é apenas para consulta; não altera a partida.',
  'Durante o jogo, os destaques são provisórios. Os lances aparecem depois dos cinco segundos de cancelamento e da confirmação do servidor.',
  'Fórmula própria, sem homologação de federação. Referência de ponderação: exemplo configurável do SportsLab.',
];
export function MiniEscudo({ nome, url }: { nome: string; url?: string | null }) {
  const { colors } = useTheme();
  const [falhou, setFalhou] = useState(false);
  return <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: colors.cardSecundario, justifyContent: 'center', alignItems: 'center' }}>
    {url && !falhou ? <Image source={{ uri: url }} onError={() => setFalhou(true)} resizeMode="contain" style={{ width: 23, height: 23 }} /> : <Text style={{ color: colors.texto, fontWeight: '600' }}>{nome.slice(0, 1)}</Text>}
  </View>;
}
export default function AnalisePartida({ data, periodo: controlado, onPeriodoChange }: { data: GestaoPartida; periodo?: number | null; onPeriodoChange?: (periodo: number | null) => void }) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [interno, setInterno] = useState<number | null>(null), [info, setInfo] = useState(false);
  const periodo = controlado === undefined ? interno : controlado;
  const setPeriodo = onPeriodoChange || setInterno;
  const [empate, setEmpate] = useState<'attack' | 'saves' | null>(null);
  const ultimo = ultimoPeriodoIniciado(data);
  const selecionado = periodo !== null && periodo <= ultimo ? periodo : null;
  const times = useMemo(() => matchInsights(data, selecionado), [data, selecionado]);
  const leaders = (key: 'attack' | 'saves') => {
    const all = times.flatMap(time => time[key].map(player => ({ ...player, team: time.name })));
    const max = Math.max(0, ...all.map(player => player[key]));
    return all.filter(player => player[key] === max);
  };
  const cores = [colors.primaria, '#A58AD7'];
  const grupos = [['attack', 'Participação em gols', 'ball'], ['saves', 'Mais defesas', 'shield-check']] as const;
  return <View style={s.section}>
    <View style={s.between}><View style={s.flex}><Text style={s.heading}>Raio-X da partida</Text><Text style={s.muted}>{selecionado ? `${selecionado}º tempo` : 'Partida inteira'} · {data.partida.status === 'AO_VIVO' ? 'destaques provisórios' : 'registros consolidados'}</Text></View><IconButton icon="info" label="Como são calculados os destaques" onPress={() => setInfo(true)} /></View>
    {controlado === undefined && <View style={[s.row, { flexWrap: 'wrap' }]}>{[null, ...Array.from({ length: ultimo }, (_, i) => i + 1)].map(value => <TouchableOpacity key={value ?? 'todos'} accessibilityRole="tab" accessibilityState={{ selected: value === selecionado }} onPress={() => setPeriodo(value)} style={[s.button, value === selecionado && { borderColor: colors.primaria, backgroundColor: colors.cardSecundario }]}><Text style={s.text}>{value ? `${value}º tempo` : 'Todos'}</Text></TouchableOpacity>)}</View>}
    <View style={s.panel}>
      <View style={s.between}>{times.map((time, i) => <View key={time.id} style={[s.row, s.flex, { justifyContent: i ? 'flex-end' : 'flex-start' }]}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: cores[i] }} /><MiniEscudo nome={time.name} url={time.badge} /><Text numberOfLines={1} style={s.name}>{time.name}</Text></View>)}</View>
      <View style={s.divider} />
      {MATCH_METRICS.slice(0, 4).map(([key, label]) => {
        const valores = times.map(time => time.totals[key]), maximo = Math.max(1, ...valores);
        return <View key={key} style={{ gap: 8 }}><Text style={[s.muted, { textAlign: 'center' }]}>{label}</Text><View style={s.row}><Text style={[s.name, { width: 24 }]}>{valores[0]}</Text><View style={[s.row, s.flex, { gap: 4 }]}>{valores.map((value, i) => <View key={i} style={{ flex: 1, height: 5, borderRadius: 3, backgroundColor: colors.cardSecundario, alignItems: i === 0 ? 'flex-end' : 'flex-start' }}><View style={{ width: `${value / maximo * 100}%`, height: 5, borderRadius: 3, backgroundColor: cores[i] }} /></View>)}</View><Text style={[s.name, { width: 24, textAlign: 'right' }]}>{valores[1]}</Text></View></View>;
      })}
      <View style={s.divider} /><View style={s.row}>{MATCH_METRICS.slice(4).map(([key, label], i) => <View key={key} style={{ flex: 1, alignItems: 'center', gap: 8 }}><View style={s.row}><View style={{ width: 7, height: 11, borderRadius: 2, backgroundColor: [colors.amarelo, colors.vermelho, colors.primaria][i] }} /><Text style={s.tiny}>{label}</Text></View><Text style={s.text}>{times[0].totals[key]}  –  {times[1].totals[key]}</Text></View>)}</View>
    </View>
    <View style={s.panel}><View style={s.between}><Text style={s.heading}>Destaques da partida</Text>{data.partida.status === 'AO_VIVO' && <Text style={s.tiny}>Provisórios</Text>}</View><Text style={s.tiny}>{selecionado ? `${selecionado}º tempo` : 'Partida inteira'} · Registros do Ludora</Text>
      {grupos.map(([key, label, icon]) => {
        const lista = leaders(key), player = lista[0];
        return <View key={key} style={{ gap: 10, borderTopWidth: 1, borderTopColor: colors.linha, paddingTop: 14 }}><View style={s.row}><Icon name={icon as IconName} size={17} color={colors.primaria} /><Text style={s.name}>{label}</Text></View>{player ? <><View style={s.row}><View style={s.shirt}><Text style={s.heading}>{String(player.shirt).padStart(2, '0')}</Text></View><View style={s.flex}><Text style={s.name}>{player.name}</Text><Text style={s.muted}>{player.team}</Text></View><Text style={s.heading}>{key === 'attack' ? `${player.goals} gols · ${player.assists} assist.` : `${player.saves} defesas`}</Text></View>{lista.length > 1 && <TouchableOpacity accessibilityRole="button" onPress={() => setEmpate(key)}><Text style={s.link}>Ver +{lista.length - 1} atleta{lista.length > 2 ? 's' : ''} empatado{lista.length > 2 ? 's' : ''} ›</Text></TouchableOpacity>}</> : <Text style={s.muted}>Nenhum registro com autoria neste recorte.</Text>}</View>;
      })}
    </View>
    {info && <AppSheet title="Como interpretar os registros" onClose={() => setInfo(false)}>{EXPLICACAO_REGISTROS.map(text => <Text key={text} style={s.text}>{text}</Text>)}<TouchableOpacity accessibilityRole="link" onPress={() => void Linking.openURL('https://sportslabtools.com/en/futsal/stats/')}><Text style={s.link}>Referência de ponderação · SportsLab ↗</Text></TouchableOpacity></AppSheet>}
    {empate && <AppSheet title="Atletas empatados" onClose={() => setEmpate(null)}>{leaders(empate).map(player => <View key={player.id} style={s.player}><View style={s.shirt}><Text style={s.name}>{String(player.shirt).padStart(2, '0')}</Text></View><View style={s.flex}><Text style={s.name}>{player.name}</Text><Text style={s.muted}>{player.team}</Text></View><Text style={s.text}>{empate === 'attack' ? `${player.goals} gols · ${player.assists} assist.` : `${player.saves} defesas`}</Text></View>)}</AppSheet>}
  </View>;
}
