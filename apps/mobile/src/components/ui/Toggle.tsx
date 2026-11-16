import { memo, type ComponentProps } from 'react';
import { Switch } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';
export const AppToggle = memo(function AppToggle(props: ComponentProps<typeof Switch>) {
  const { colors } = useTheme();
  return <Switch trackColor={{ false: colors.cardSecundario, true: colors.primaria }} thumbColor={colors.textoSobrePrimaria} ios_backgroundColor={colors.cardSecundario} {...props} />;
});
