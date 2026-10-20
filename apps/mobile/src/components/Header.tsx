import { Icon, type IconName } from '@ludora/icons';
import { Alert, View, Text, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { createStyles } from '@/src/styles/headerStyles';
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import {
  inicialHeader,
  NOMES_PAPEIS_HEADER,
  type PapelHeader,
} from '@/src/utils/identidadeHeader';

interface HeaderProps {
  title: string;
  btnVoltar?: IconName;
  btnNotificacao?: IconName;
  showLogo?: boolean;
  logoUrl?: string | null;
  icon?: IconName;
  onPressIcon?: () => void;
  onPressNotificacao?: () => void;
  showProfile?: boolean;
  onBtnVoltar?: () => void;
  semSafeArea?: boolean;
  papelUsuario?: PapelHeader;
}

export function Header({
  title,
  btnVoltar,
  btnNotificacao,
  showLogo,
  logoUrl,
  onPressIcon,
  onPressNotificacao,
  icon,
  showProfile,
  onBtnVoltar,
  semSafeArea,
  papelUsuario,
}: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { totalNaoLidas } = useNotificacoes();

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [escudoComErro, setEscudoComErro] = useState<string | null>(null);
  const mostrarIdentidade = () =>
    Alert.alert(
      'Clube atual',
      `${title}${papelUsuario ? `\n\nSeu papel: ${NOMES_PAPEIS_HEADER[papelUsuario]}` : '\n\nVisualização pública'}`,
      [{ text: 'Fechar' }]
    );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: semSafeArea ? 20 : insets.top + 20 },
      ]}
    >
      <View style={styles.leftContent}>
        {btnVoltar && (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={() => (onBtnVoltar ? onBtnVoltar() : router.back())}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name={btnVoltar} size={24} color={colors.texto} />
          </TouchableOpacity>
        )}
        {showLogo && (
          <View
            style={styles.logoContainerNeutro}
            accessible={false}
            importantForAccessibility="no-hide-descendants"
          >
            {logoUrl && escudoComErro !== logoUrl ? (
              <Image
                source={{ uri: logoUrl }}
                style={styles.logo}
                resizeMode="contain"
                onError={() => setEscudoComErro(logoUrl)}
              />
            ) : (
              <Text style={styles.logoInicial}>{inicialHeader(title)}</Text>
            )}
          </View>
        )}
        {icon && (
          <TouchableOpacity onPress={onPressIcon} activeOpacity={0.6}>
            <Icon name={icon} size={44} color={colors.primaria} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={styles.leftContainer}
          onPress={showLogo ? mostrarIdentidade : undefined}
          disabled={!showLogo}
          activeOpacity={0.75}
          accessible={!!showLogo}
          accessibilityRole={showLogo ? 'button' : undefined}
          accessibilityLabel={
            showLogo
              ? `${title}${papelUsuario ? `, ${NOMES_PAPEIS_HEADER[papelUsuario]}` : ''}`
              : undefined
          }
          accessibilityHint={
            showLogo ? 'Exibe o nome completo do clube e seu papel' : undefined
          }
        >
          <Text
            style={styles.title}
            numberOfLines={1}
            ellipsizeMode="tail"
            accessibilityRole="header"
          >
            {title}
          </Text>
          {papelUsuario && (
            <Text
              style={styles.papelTexto}
              numberOfLines={1}
              accessibilityLabel={`Seu papel no clube: ${NOMES_PAPEIS_HEADER[papelUsuario]}`}
            >
              {NOMES_PAPEIS_HEADER[papelUsuario]}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.rightContent}>
        {btnNotificacao && (
          <TouchableOpacity
            style={styles.actionButton}
            activeOpacity={0.7}
            onPress={
              onPressNotificacao ??
              (() => router.push('/(tabs)/perfil/notificacoes'))
            }
            accessibilityRole="button"
            accessibilityLabel={
              totalNaoLidas > 0
                ? `Notificações, ${totalNaoLidas} ${totalNaoLidas === 1 ? 'aviso não lido' : 'avisos não lidos'}`
                : 'Notificações, nenhum aviso não lido'
            }
          >
            <Icon name={btnNotificacao} size={24} color={colors.texto} />
            {totalNaoLidas > 0 && (
              <View
                style={styles.notificationDot}
                pointerEvents="none"
                accessible={false}
              />
            )}
          </TouchableOpacity>
        )}
        {showProfile && (
          <TouchableOpacity
            style={styles.profileButton}
            activeOpacity={0.7}
            onPress={() => router.push('perfil/perfil')}
          >
            <Icon name="account" size={24} color={colors.primaria} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
