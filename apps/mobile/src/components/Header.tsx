import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
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
            <MaterialCommunityIcons name={btnVoltar} size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        {showLogo && (
          <LinearGradient
            colors={[colors.primary, colors.secondary]}
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
            <MaterialCommunityIcons name={icon} size={44} color={colors.primary} />
          </TouchableOpacity>
        )}
        <Text style={styles.title}>{title}</Text>
      </View>

      <View style={styles.rightContent}>
        {btnNotificacao && (
          <TouchableOpacity style={styles.actionButton} activeOpacity={0.7} onPress={onPressIcon}>
            <MaterialCommunityIcons name={btnNotificacao} size={24} color="#FFF" />
          </TouchableOpacity>
        )}
        {showProfile && (
          <TouchableOpacity 
            style={styles.profileButton} 
            activeOpacity={0.7} 
            onPress={() => router.push('perfil/perfil')}
          >
            <MaterialCommunityIcons name="account" size={24} color={colors.primary} />
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
    backgroundColor: colors.background,
  },
  leftContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  logoContainer: {
    width: 50,
    height: 50,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 40,
    height: 40,
  },
  title: {
    fontFamily: 'Creato-Bold',
    fontSize: 20,
    color: '#FFF',
    textTransform: 'uppercase',
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20, 
  },
  actionButton: {
    width: 45,
    height: 45,
    backgroundColor: '#333',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButton: {
    width: 45,
    height: 45,
    backgroundColor: 'rgba(0, 159, 255, 0.1)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});