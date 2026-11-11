import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, View, useWindowDimensions, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

/** Dropdown em sobreposição: não muda altura ou rolagem da página. */
export function AnchoredMenu({ label, trigger, children, width = 248, triggerStyle }: {
  label: string; trigger: (open: boolean) => ReactNode; children: (close: () => void) => ReactNode; width?: number; triggerStyle?: ViewStyle;
}) {
  const { colors } = useTheme(), insets = useSafeAreaInsets(), viewport = useWindowDimensions();
  const anchor = useRef<View>(null);
  const [rect, setRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  useEffect(() => setRect(null), [viewport.width, viewport.height]);
  const menuWidth = Math.min(width, viewport.width - 24);
  const left = Math.max(12, Math.min((rect?.x || 0) + (rect?.width || 0) - menuWidth, viewport.width - menuWidth - 12));
  const below = (rect?.y || 0) + (rect?.height || 0) + 6;
  const available = viewport.height - insets.bottom - below - 12;
  const above = !!rect && available < 140;
  const height = Math.max(90, Math.min(360, above ? rect.y - insets.top - 18 : available));
  const close = () => setRect(null);
  return <>
    <Pressable ref={anchor} collapsable={false} accessibilityRole="button" accessibilityLabel={label}
      accessibilityState={{ expanded: !!rect }} onPress={() => anchor.current?.measureInWindow((x, y, width, height) => setRect({ x, y, width, height }))}
      style={triggerStyle}>{trigger(!!rect)}</Pressable>
    <Modal visible={!!rect} transparent animationType="none" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar menu" style={{ flex: 1 }} onPress={close} />
      {!!rect && <View accessibilityViewIsModal style={{ position: 'absolute', left, width: menuWidth, ...(above ? { bottom: viewport.height - rect.y + 6 } : { top: below }), maxHeight: height, borderRadius: 9, borderWidth: 1, borderColor: colors.borda, backgroundColor: colors.card, padding: 5, elevation: 16, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12 }}>
        <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={{ maxHeight: height - 12 }} contentContainerStyle={{ gap: 3 }}>{children(close)}</ScrollView>
      </View>}
    </Modal>
  </>;
}
