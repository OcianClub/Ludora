import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  Modal,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useSheetKeyboard } from "../../hooks/useSheetKeyboard";
import { useTheme } from "../../contexts/ThemeContext";
import { IconButton } from "./Controls";
import { createControlStyles } from "./styles";

export function ModalHeader({
  title,
  subtitle,
  onClose,
  disabled = false,
  closeLabel = "Fechar janela",
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  disabled?: boolean;
  closeLabel?: string;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createControlStyles(colors), [colors]);
  return (
    <View style={s.modalHeader}>
      <View style={s.modalHeading}>
        <Text style={s.modalTitle} accessibilityRole="header">
          {title}
        </Text>
        {!!subtitle && <Text style={s.modalSubtitle}>{subtitle}</Text>}
      </View>
      <IconButton
        icon="close"
        label={closeLabel}
        onPress={onClose}
        disabled={disabled}
        variant="ghost"
      />
    </View>
  );
}
/** Shared safe-area and keyboard boundary for bottom sheets. No stored keyboard height. */
export function SheetFrame({ title, subtitle, onClose, closeLabel, children, expanded = false, disabled = false }: {
  title: string; subtitle?: string; onClose: () => void; closeLabel?: string;
  children: ReactNode; expanded?: boolean; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboardVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  const close = () => { if (!disabled) onClose(); };
  return <Modal visible transparent animationType="slide" onRequestClose={close} statusBarTranslucent navigationBarTranslucent>
    <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel={closeLabel || 'Fechar janela'} />
      <View style={{ flex: 1, justifyContent: 'flex-end', paddingTop: insets.top + 12 }} pointerEvents="box-none">
        <View accessibilityViewIsModal style={[styles.sheet, {
          backgroundColor: colors.fundo, borderColor: colors.borda,
          paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 12),
          ...(expanded ? { height: '100%' } : {}),
        }]}>
          <ModalHeader title={title} subtitle={subtitle} onClose={close} closeLabel={closeLabel} disabled={disabled} />
          {children}
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

export function AppSheet({ title, subtitle, onClose, closeLabel, children, footer, contentStyle }: {
  title: string; subtitle?: string; onClose: () => void; closeLabel?: string;
  children: ReactNode; footer?: ReactNode; contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createControlStyles(colors), [colors]);
  const scroll = useRef<ScrollView>(null);
  const reveal = useSheetKeyboard(scroll);
  return <SheetFrame title={title} subtitle={subtitle} onClose={onClose} closeLabel={closeLabel}>
    <ScrollView ref={scroll} onTouchEnd={reveal} style={styles.scroll} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" bounces={false} contentContainerStyle={[styles.body, contentStyle]}>
      {children}
    </ScrollView>
    {!!footer && <View style={s.modalFooter}>{footer}</View>}
  </SheetFrame>;
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0009" },
  sheet: {
    width: "100%", maxWidth: 640, maxHeight: '100%', alignSelf: "center", flexShrink: 1,
    borderWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { padding: 16, paddingBottom: 24, gap: 18 },
});
