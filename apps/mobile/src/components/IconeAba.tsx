import { View } from 'react-native';
import { HomeIcon, Icon, type IconName } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/tabBarStyles';

interface Props {
  nome?: IconName;
  inicio?: boolean;
  selecionado: boolean;
  cor: string;
}

export function IconeAba({ nome, inicio, selecionado, cor }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);

  return (
    <View
      style={[styles.icone, selecionado && styles.iconeSelecionado]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {inicio ? (
        <HomeIcon size={23} color={cor} />
      ) : nome ? (
        <Icon name={nome} size={23} color={cor} />
      ) : null}
    </View>
  );
}
