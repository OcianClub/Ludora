import { useMemo, type ReactNode } from 'react';
import {
  Modal,
  Pressable,
  Text,
  TouchableOpacity,
  View,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/organizarPartidasStyles';

export function PainelOrganizarPartida({
  titulo,
  subtitulo,
  onFechar,
  children,
}: {
  titulo: string;
  subtitulo?: string;
  onFechar: () => void;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFechar}>
      <KeyboardAvoidingView
        style={styles.scroll}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.sheetOverlay, { paddingTop: insets.top + 16 }]}>
          <Pressable
            style={styles.backdrop}
            onPress={onFechar}
            accessibilityRole="button"
            accessibilityLabel="Fechar seleção"
          />
          <View
            style={[
              styles.sheet,
              {
                maxHeight: height - insets.top - 16,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
            accessibilityViewIsModal
          >
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeading}>
                <Text style={styles.sheetTitle} accessibilityRole="header">
                  {titulo}
                </Text>
                {!!subtitulo && <Text style={styles.muted}>{subtitulo}</Text>}
              </View>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={onFechar}
                accessibilityRole="button"
                accessibilityLabel="Fechar seleção"
              >
                <Icon name="close" size={22} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <View style={styles.sheetBody}>{children}</View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
