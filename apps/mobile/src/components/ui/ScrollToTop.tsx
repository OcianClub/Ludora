import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@ludora/icons';
import { useTheme } from '../../contexts/ThemeContext';
export function ScrollToTop({ visible, onPress }: { visible: boolean; onPress: () => void }) {
  const { colors } = useTheme(), insets = useSafeAreaInsets();
  if (!visible) return null;
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Voltar ao topo" onPress={onPress} style={{ position: 'absolute', bottom: Math.max(insets.bottom, 12) + 12, right: 16, minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.acaoPrimaria, borderRadius: 24 }}><Icon name="arrow-up-circle-outline" size={22} color={colors.textoSobrePrimaria} /></TouchableOpacity>;
}
