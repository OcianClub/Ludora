import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import type { EquipePaulista, JogoPaulista } from '../../../../../packages/shared-types/src/paulista';
import { estadoJogo, nomeOficial } from '../../utils/paulista';
import type { AvisoChaveamento } from '../../../../../packages/shared-types/src/paulistaPresentation/paulistaBracket';
import { useTheme } from '../../contexts/ThemeContext';
import { dataOficial, EscudoOficial, usePaulistaStyles } from './PaulistaUI';

export const PaulistaBracketCard = memo(function PaulistaBracketCard({ jogo, equipes, minhas, avancou, empate, avisos, onOpen }: {
  jogo: JogoPaulista; equipes: Map<number, EquipePaulista>; minhas: Set<number>;
  avancou?: number; empate?: boolean; avisos: AvisoChaveamento[]; onOpen: (jogo: JogoPaulista) => void;
}) {
  const { colors } = useTheme(), s = usePaulistaStyles();
  const own = minhas.has(jogo.mandanteId) || minhas.has(jogo.visitanteId);
  const nome = (id: number) => nomeOficial(equipes.get(id)?.nome || 'Equipe a confirmar');
  const conflito = avisos.some(a => a.tipo === 'conflito');
  const vencedor = !conflito && !jogo.ocorrencia && jogo.golsMandante != null && jogo.golsVisitante != null && jogo.golsMandante !== jogo.golsVisitante
    ? jogo.golsMandante > jogo.golsVisitante ? jogo.mandanteId : jogo.visitanteId : undefined;
  const estado = conflito ? 'Publicação em conferência' : avisos.some(a => a.tipo === 'agenda') ? 'Agenda a confirmar'
    : avancou ? `${nome(avancou)} avançou${empate ? ' após empate' : ''}` : estadoJogo(jogo);
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel={`Ver detalhes: ${nome(jogo.mandanteId)} contra ${nome(jogo.visitanteId)}`}
    accessibilityHint={estado} onPress={() => onOpen(jogo)} activeOpacity={0.85}
    style={{ backgroundColor: colors.card, borderWidth: 1, borderColor: own ? colors.primaria : colors.borda, borderLeftWidth: own ? 3 : 1, borderRadius: 8, padding: 12, gap: 7 }}>
    <View style={[s.between, { minHeight: 18 }]}>
      <Text style={[s.tiny, { fontSize: 10, flex: 1 }]}>{dataOficial(jogo.data)}{jogo.horario ? ` · ${jogo.horario}` : ''}</Text>
      {own && <Text style={[s.tiny, { fontSize: 9 }]}>Seu clube</Text>}
    </View>
    {[jogo.mandanteId, jogo.visitanteId].map((id, side) => <View key={`${side}:${id}`} style={[s.row, { gap: 8, minHeight: 40 }]}>
      <EscudoOficial equipe={equipes.get(id)} size={26} />
      <Text numberOfLines={2} style={[s.text, { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 18, fontFamily: minhas.has(id) || vencedor === id ? 'Inter_600SemiBold' : 'Inter_400Regular' }]}>{nome(id)}</Text>
      <Text style={[s.text, { fontSize: 18, fontFamily: 'Inter_600SemiBold', fontVariant: ['tabular-nums'] }]}>{jogo.ocorrencia === 'WO' ? '—' : (side ? jogo.golsVisitante : jogo.golsMandante) ?? '—'}</Text>
      <View style={{ width: 12 }}>{avancou === id && <Icon name="chevron-right" size={12} color={colors.textoSecundario} />}</View>
    </View>)}
    <View style={[s.row, { gap: 5, minHeight: 18 }]}>
      {avisos.length > 0 && <Icon name="alert-circle-outline" size={12} color={colors.textoSecundario} />}
      <Text style={[s.tiny, { fontSize: 10, flex: 1 }]}>{estado}</Text>
    </View>
  </TouchableOpacity>;
});
