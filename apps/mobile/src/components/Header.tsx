import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors, typography } from '@ludora/design-tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

interface HeaderProps {
  title: string;
  btnVoltar?: keyof typeof MaterialCommunityIcons.glyphMap;
  btnNotificacao?: keyof typeof MaterialCommunityIcons.glyphMap;
  showLogo?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onPressIcon?: () => void;
  showProfile?: boolean;
  onBtnVoltar?: () => void; 
  semSafeArea?: boolean; 
}

export function Header({ title, btnVoltar, btnNotificacao, showLogo, onPressIcon, icon, showProfile, onBtnVoltar, semSafeArea }: HeaderProps) {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <View style={[styles.container, { paddingTop: semSafeArea ? 20 : insets.top + 20 }]}>
      <View style={styles.leftContent}>
        {btnVoltar && (
          <TouchableOpacity 
            style={styles.actionButton} 
            activeOpacity={0.7} 
            onPress={() => onBtnVoltar ? onBtnVoltar() : router.back()}
          >
            <MaterialCommunityIcons name={btnVoltar} size={24} color={colors.texto} />
          </TouchableOpacity>
        )}
        {showLogo && (
          <LinearGradient
            colors={[colors.primaria, '#0055FF']} // Ajuste de gradiente usando a primária
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoContainer}
          >
            <Image 
              source={require('@/assets/images/SóPreto.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </LinearGradient>
        )} 
        {icon && (
          <TouchableOpacity onPress={onPressIcon} activeOpacity={0.6}>
            <MaterialCommunityIcons name={icon} size={44} color={colors.primaria} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.rightContent}>
        {btnNotificacao && (
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={onPressIcon}>
            <MaterialCommunityIcons name={btnNotificacao} size={24} color={colors.texto} />
          </TouchableOpacity>
        )}
        {showProfile && (
          <TouchableOpacity 
            style={styles.profileButton} 
            activeOpacity={0.7} 
            onPress={() => router.push('perfil/perfil')}
          >
            <MaterialCommunityIcons name="account" size={24} color={colors.primaria} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: colors.fundo,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoContainer: {
    width: 45,
    height: 45,
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.lmd,
    color: colors.texto,
    textTransform: 'uppercase',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14, 
  },
  actionButton: {
    width: 46,
    height: 46,
    backgroundColor: colors.card,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 46,
    height: 46,
    backgroundColor: colors.fundoBotao,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.bordaBotao,
    alignItems: 'center',
    justifyContent: 'center',
  },
});