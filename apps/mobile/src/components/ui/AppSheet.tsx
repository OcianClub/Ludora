import { useMemo, type ReactNode } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
  StyleSheet,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
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
export function AppSheet({
  title,
  subtitle,
  onClose,
  closeLabel,
  children,
  footer,
  contentStyle,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  closeLabel?: string;
  children: ReactNode;
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createControlStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={closeLabel || "Fechar janela"}
        />
        <SafeAreaView
          edges={["bottom"]}
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              maxHeight: Math.min(height - insets.top - 16, 760),
              backgroundColor: colors.fundo,
              borderColor: colors.borda,
            },
          ]}
        >
          <ModalHeader
            title={title}
            subtitle={subtitle}
            onClose={onClose}
            closeLabel={closeLabel}
          />
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            contentContainerStyle={[styles.body, contentStyle]}
          >
            {children}
          </ScrollView>
          {!!footer && <View style={s.modalFooter}>{footer}</View>}
        </SafeAreaView>
      </View>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0009" },
  sheet: {
    width: "100%",
    maxWidth: 600,
    alignSelf: "center",
    flexShrink: 1,
    borderWidth: 1,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: "hidden",
  },
  scroll: { flexGrow: 0, flexShrink: 1 },
  body: { padding: 16, paddingBottom: 24, gap: 18 },
});
