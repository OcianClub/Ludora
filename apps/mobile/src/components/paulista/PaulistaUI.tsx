import { useMemo, useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon } from '@ludora/icons';
import { liveBadgeColors } from '@ludora/design-tokens';
import { useTheme, type ThemeColors } from '../../contexts/ThemeContext';
import { AnchoredMenu } from '../ui/AnchoredMenu';
import { nomeOficial, temResultado } from '../../utils/paulista';
import type { EstadoEtapa } from '../../utils/paulista';
import type { EquipePaulista, JogoPaulista, PosicaoPaulista } from '../../../../../packages/shared-types/src/paulista';

export const ERRO_PARTIDA = liveBadgeColors.indicador;
export const coresChave = { OURO: '#F0B84E', PRATA: '#BFC8D6', BRONZE: '#C58B59', RUBI: '#EC7294' };
export function usePaulistaStyles() { const { colors } = useTheme(); return useMemo(() => estilos(colors), [colors]); }
export function useDestaqueClube() {
  const { colors, tema } = useTheme();
  return {
    borda: colors.primaria,
    fundo: tema === 'light' ? '#E3EFFF' : '#141E2F',
    forte: tema === 'light' ? '#CEE4FF' : '#1B2C45',
  };
}

export function EscudoOficial({ equipe, size = 26, destaque = false }: {
  equipe?: Partial<EquipePaulista>; size?: number; destaque?: boolean;
}) {
  const { colors } = useTheme();
  const destaqueClube = useDestaqueClube();
  const [falhou, setFalhou] = useState<string>();
  return <View style={{ width: size, height: size, borderRadius: size * .22, backgroundColor: colors.cardSecundario, borderWidth: destaque ? 1.5 : 0, borderColor: destaqueClube.borda, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    {equipe?.escudo && falhou !== equipe.escudo ? <Image accessibilityIgnoresInvertColors source={{ uri: equipe.escudo }} onError={() => setFalhou(equipe.escudo!)} resizeMode="contain" style={{ width: size * .8, height: size * .8 }} /> : <Text style={{ color: colors.texto, fontFamily: 'Inter_600SemiBold', fontSize: Math.max(10, size * .4) }}>{equipe?.nome?.trim()[0]?.toUpperCase() || '?'}</Text>}
  </View>;
}
const chavesTemaClaro = { OURO: '#805000', PRATA: '#536174', BRONZE: '#8D502D', RUBI: '#A12C51' };
export function useCorChave() {
  const { colors, tema } = useTheme();
  const paleta = tema === 'light' ? chavesTemaClaro : coresChave;
  return (chave?: string | null) => paleta[chave as keyof typeof paleta] || colors.textoSecundario;
}
export function Medalha({ chave, filled = false }: { chave?: string | null; filled?: boolean }) {
  const s = usePaulistaStyles();
  const color = useCorChave()(chave);
  return <View style={[s.row, { gap: 7, alignSelf: 'flex-start' }, !filled && { paddingVertical: 5, paddingHorizontal: 8, borderWidth: 1, borderRadius: 4, borderColor: color }]}>{filled ? <Svg width={27} height={27} viewBox="0 0 24 24" fill={color}><Path d="M7 3h10v5a5 5 0 0 1-4 4.9V17h2a2 2 0 0 1 2 2v2H7v-2a2 2 0 0 1 2-2h2v-4.1A5 5 0 0 1 7 8V3Z" /><Path d="M7 4H2v4a6 6 0 0 0 6 6v-2a4 4 0 0 1-4-4V6h3V4Zm10 0h5v4a6 6 0 0 1-6 6v-2a4 4 0 0 0 4-4V6h-3V4Z" /></Svg> : <Icon name="trophy" size={14} color={color} />}<Text style={[s.tiny, { color, fontFamily: 'Inter_600SemiBold' }]}>{chave ? `Chave ${nomeOficial(chave)}` : 'Chave a confirmar'}</Text></View>;
}
export function Marcador({ estado }: { estado: EstadoEtapa }) {
  const { colors } = useTheme();
  return <View style={{ width: 25, height: 25, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: estado === 'advanced' ? colors.primaria : estado === 'ended' ? ERRO_PARTIDA : 'transparent', borderWidth: estado === 'advanced' || estado === 'ended' ? 0 : 1, borderStyle: 'dashed', borderColor: colors.textoSecundario }}>
    {estado === 'advanced' || estado === 'ended' ? <Icon name={estado === 'advanced' ? 'check' : 'close'} size={16} color="#fff" /> : estado === 'published' ? <Icon name="ball" size={14} color={colors.textoSecundario} /> : null}
  </View>;
}
export function LinkPaulista({ children, onPress }: { children: string; onPress: () => void }) {
  const s = usePaulistaStyles(), { colors } = useTheme();
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} style={[s.row, { minHeight: 36, gap: 5, flexShrink: 1 }]}><Text style={s.link}>{children}</Text><Icon name="chevron-right" size={14} color={colors.primaria} /></TouchableOpacity>;
}
export function MenuSelecao({ label, value, options, onChange, compact = false }: {
  label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void; compact?: boolean;
}) {
  const s = usePaulistaStyles(), { colors } = useTheme();
  return <AnchoredMenu label={compact ? `Selecionar temporada: ${value}` : `${label}: ${options.find(o => o.value === value)?.label || 'Selecionar'}`} width={compact ? 210 : 336}
    triggerStyle={compact ? { minHeight: 40, paddingHorizontal: 6, justifyContent: 'center' } : { width: '100%' }}
    trigger={open => <View style={[s.row, compact ? { gap: 6 } : s.select]}><Text numberOfLines={1} style={[s.text, { flexShrink: 1 }, !compact && { flex: 1 }]}>{compact ? value : options.find(o => o.value === value)?.label || label}</Text><Icon name={open ? 'chevron-up' : 'chevron-down'} size={compact ? 14 : 16} color={colors.textoSecundario} /></View>}
  >{close => <><Text style={[s.text, { padding: 10 }]}>{label}</Text>{options.map(o => <TouchableOpacity key={o.value} accessibilityRole="radio" accessibilityState={{ checked: o.value === value }} aria-checked={o.value === value} onPress={() => { onChange(o.value); close(); }} style={[s.row, { minHeight: 44, padding: 10, gap: 8, borderRadius: 5, backgroundColor: o.value === value ? colors.cardSecundario : 'transparent' }]}><Text style={[s.text, { flex: 1 }]}>{o.label}</Text>{o.value === value && <Icon name="check" size={17} color={colors.primaria} />}</TouchableOpacity>)}</>}</AnchoredMenu>;
}
export function AtualizarIcon() { const { colors } = useTheme(); return <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={colors.texto} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><Path d="M20 4v6h-6M4 20v-6h6M5.5 9a7 7 0 0 1 12-3L20 10M4 14l2.5 4a7 7 0 0 0 12-3" /></Svg>; }
export function Globo() { const { colors } = useTheme(); return <Svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke={colors.primaria} strokeWidth={1.7}><Circle cx={12} cy={12} r={9} /><Path d="M3 12h18M5 7h14M5 17h14M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" /></Svg>; }
export function BarraCampanha({ linha }: { linha: PosicaoPaulista }) {
  const { colors } = useTheme(); const total = linha.vitorias + linha.empates + linha.derrotas;
  return <View accessible accessibilityLabel={`${linha.vitorias} vitórias, ${linha.empates} empates e ${linha.derrotas} derrotas`} style={{ flexDirection: 'row', height: 5, width: '100%', borderRadius: 3, overflow: 'hidden', backgroundColor: colors.cardSecundario }}>
    {total > 0 && [linha.vitorias, linha.empates, linha.derrotas].map((n, i) => <View key={i} style={{ width: `${n / total * 100}%`, backgroundColor: [colors.primaria, colors.amarelo, ERRO_PARTIDA][i] }} />)}
  </View>;
}
export function ResultadoOficial({ jogo, minhas }: { jogo: JogoPaulista; minhas: Set<number> }) {
  const { colors } = useTheme(); const s = usePaulistaStyles();
  const emCasa = minhas.has(jogo.mandanteId);
  const comPerspectiva = emCasa !== minhas.has(jogo.visitanteId);
  const finalizada = temResultado(jogo);
  const saldo = finalizada && comPerspectiva
    ? (jogo.golsMandante! - jogo.golsVisitante!) * (emCasa ? 1 : -1)
    : null;
  let label = 'Sem resultado';
  if (saldo !== null) label = saldo > 0 ? 'Vitória' : saldo < 0 ? 'Derrota' : 'Empate';
  else if (finalizada) label = 'Finalizada';
  else if (jogo.ocorrencia === 'WO') label = 'W.O.';
  else if (jogo.ocorrencia === 'ADIADA') label = 'Adiada';
  return <View style={{ backgroundColor: saldo === null ? colors.cardSecundario : saldo > 0 ? colors.primaria : saldo < 0 ? ERRO_PARTIDA : colors.amarelo, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 5, alignSelf: 'center' }}><Text style={[s.tiny, { color: saldo === 0 ? '#171717' : saldo === null ? colors.texto : '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 10 }]}>{label}</Text></View>;
}
export function ConfrontoOficial({ jogo, equipes, minhas, onPress }: { jogo: JogoPaulista; equipes: Map<number, EquipePaulista>; minhas: Set<number>; onPress?: () => void }) {
  const s = usePaulistaStyles(), { colors } = useTheme();
  const team = (id: number, reverse = false) => <View style={[s.team, { flexDirection: reverse ? 'row-reverse' : 'row' }]}><EscudoOficial equipe={equipes.get(id)} size={24} /><Text numberOfLines={1} style={[s.tiny, { flexShrink: 1, color: minhas.has(id) ? colors.texto : colors.textoSecundario, fontFamily: minhas.has(id) ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>{nomeOficial(equipes.get(id)?.nome || 'A confirmar')}</Text></View>;
  const content = <>{team(jogo.mandanteId)}<Text style={s.score}>{temResultado(jogo) ? `${jogo.golsMandante} – ${jogo.golsVisitante}` : jogo.ocorrencia === 'WO' ? 'WO' : 'VS'}</Text>{team(jogo.visitanteId, true)}</>;
  if (!onPress) return <View style={s.contest}>{content}</View>;
  const mandante = equipes.get(jogo.mandanteId)?.nome || 'Equipe a confirmar';
  const visitante = equipes.get(jogo.visitanteId)?.nome || 'Equipe a confirmar';
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver partida: ${mandante} contra ${visitante}`} onPress={onPress} activeOpacity={.85} style={s.contest}>
    {content}<Icon name="chevron-right" size={12} color={colors.textoSecundario} />
  </TouchableOpacity>;
}
export function Panel({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) { const s = usePaulistaStyles(); return <View style={[s.panel, style]}>{children}</View>; }
export const dataOficial = (data?: string | null) => data ? data.slice(0, 10).split('-').reverse().join('/') : 'Data a confirmar';
export const saldoOficial = (saldo: number) => `${saldo > 0 ? '+' : ''}${saldo}`;
function estilos(c: ThemeColors) { return StyleSheet.create({
  panel: { backgroundColor: c.card, borderWidth: 1, borderColor: c.borda, borderRadius: 10, overflow: 'hidden' },
  body: { padding: 16, gap: 14 }, row: { flexDirection: 'row', alignItems: 'center' }, between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heading: { color: c.texto, fontSize: 15, fontFamily: 'Inter_600SemiBold' }, title: { color: c.texto, fontSize: 25, lineHeight: 33, fontFamily: 'Oswald_600SemiBold' },
  text: { color: c.texto, fontSize: 13, lineHeight: 20, fontFamily: 'Inter_400Regular' }, muted: { color: c.textoSecundario, fontSize: 12, lineHeight: 19, fontFamily: 'Inter_400Regular' }, tiny: { color: c.textoSecundario, fontSize: 11, lineHeight: 17, fontFamily: 'Inter_400Regular' },
  link: { color: c.primaria, fontSize: 12, lineHeight: 18, fontFamily: 'Inter_400Regular' }, number: { color: c.texto, fontSize: 30, lineHeight: 39, fontFamily: 'Oswald_600SemiBold' },
  team: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6 },
  contest: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 9, borderWidth: 1, borderColor: c.borda, backgroundColor: c.fundo, borderRadius: 7, minHeight: 48 },
  score: { color: c.texto, fontSize: 17, fontFamily: 'Inter_600SemiBold', textAlign: 'center', minWidth: 46, fontVariant: ['tabular-nums'] },
  select: { gap: 10, borderRadius: 8, borderWidth: 1, borderColor: c.borda, backgroundColor: c.card, minHeight: 44, paddingHorizontal: 12 },
  divider: { borderBottomWidth: 1, borderBottomColor: c.linha }, metric: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 7, minWidth: 0 },
  empty: { paddingVertical: 48, paddingHorizontal: 16, alignItems: 'center', gap: 12 },
}); }
