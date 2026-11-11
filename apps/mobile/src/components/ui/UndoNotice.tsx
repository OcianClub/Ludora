import { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '../../contexts/ThemeContext';

export function UndoNotice({ onUndo }: { onUndo: () => void }) {
  const { colors } = useTheme();
  const progress = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.timing(progress, { toValue: 0, duration: 5000, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [progress]);
  return <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5, margin: 12, borderRadius: 9, overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.borda }}>
    <Animated.View accessible={false} style={{ height: 3, backgroundColor: colors.primaria, transform: [{ scaleX: progress }], transformOrigin: 'left' }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', padding: 10, gap: 9 }} accessibilityLiveRegion="polite">
      <Icon name="trash" size={18} color={colors.texto} />
      <Text style={{ flex: 1, color: colors.texto, fontSize: 12, lineHeight: 18 }}>Notificação removida</Text>
      <TouchableOpacity accessibilityRole="button" accessibilityLabel="Desfazer remoção da notificação" onPress={onUndo}
        style={{ minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, borderRadius: 7, backgroundColor: colors.cardSecundario }}>
        <Icon name="undo" size={16} color={colors.texto} /><Text style={{ color: colors.texto, fontSize: 12, fontFamily: 'Inter_600SemiBold' }}>Desfazer</Text>
      </TouchableOpacity>
    </View>
  </View>;
}
