import { memo, type ReactNode } from 'react';
import { StyleSheet, Text, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';
import { radius, spacing, touchTarget } from '@ludora/design-tokens';
import { Icon } from '@ludora/icons';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
  agenda: ReactNode;
  context?: ReactNode;
  badges: ReactNode;
  badgesBelow?: boolean;
  home: ReactNode;
  score: ReactNode;
  away: ReactNode;
  live?: boolean;
  local: string;
  action: string;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

export const MatchCardLayout = memo(function MatchCardLayout({
  agenda, context, badges, badgesBelow = false, home, score, away,
  live = false, local, action, label, onPress, style,
}: Props) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={action}
      onPress={onPress}
      style={({ pressed }) => [styles.card, { backgroundColor: colors.card, borderColor: live ? colors.primaria : colors.linha }, style, pressed && { backgroundColor: colors.superficieNeutra }]}>
      <View style={styles.header}>
        <View style={styles.agenda}>{agenda}</View>
        {!badgesBelow && <View style={styles.badges}>{badges}</View>}
      </View>
      {context}
      <View style={styles.teams}>
        <View style={styles.team}>{home}</View>
        <View style={styles.score}>{score}</View>
        <View style={styles.team}>{away}</View>
      </View>
      {badgesBelow && <View style={styles.result}>{badges}</View>}
      <View style={[styles.footer, live && styles.liveFooter, { borderTopColor: colors.linha }]}>
        <View style={[styles.location, live && styles.liveLocation]}>
          <Icon name="map-marker-outline" size={16} color={colors.textoSecundario}/>
          <Text numberOfLines={1} style={[styles.locationText, { color: colors.textoSecundario }]}>{local}</Text>
        </View>
        <View style={[styles.action, live && styles.liveAction, live && { backgroundColor: colors.acaoPrimaria }]}>
          <Text style={[styles.actionText, { color: live ? colors.textoSobrePrimaria : colors.primaria }]}>{action}</Text>
          <Icon name={live ? 'live' : 'chevron-right'} size={16} color={live ? colors.textoSobrePrimaria : colors.primaria}/>
        </View>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { minWidth: 0, padding: 14, paddingBottom: spacing.sm, borderWidth: 1, borderRadius: radius.card, marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  agenda: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  teams: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 16, paddingBottom: 10 },
  team: { flex: 1, minWidth: 0, alignItems: 'center' },
  score: { flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
  result: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 6, paddingBottom: 12 },
  footer: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, borderTopWidth: 1, paddingTop: 8 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 6, flexBasis: 120, flexGrow: 1, flexShrink: 1, minWidth: 0 },
  locationText: { flexShrink: 1, fontFamily: 'Inter_400Regular', fontSize: 12, lineHeight: 18 },
  action: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, minHeight: touchTarget, paddingLeft: 8 },
  actionText: { fontFamily: 'Inter_600SemiBold', fontSize: 12, flexShrink: 1 },
  liveFooter: { gap: 12 },
  liveLocation: { flexBasis: '100%', flexGrow: 0 },
  liveAction: { width: '100%', borderRadius: radius.control, paddingHorizontal: 12 },
});
