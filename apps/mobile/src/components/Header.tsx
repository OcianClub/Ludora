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
  logoUrl?: string | null;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  onPressIcon?: () => void;
  showProfile?: boolean;
  onBtnVoltar?: () => void; 
  semSafeArea?: boolean; 
}

export function Header({ 
  title, 
  btnVoltar, 
  btnNotificacao, 
  showLogo, 
  logoUrl, // RECEBENDO AQUI
  onPressIcon, 
  icon, 
  showProfile, 
  onBtnVoltar, 
  semSafeArea 
}: HeaderProps) {
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
          logoUrl ? (
            // Tem escudo de clube de verdade: fundo NEUTRO — evita o
            // choque de cor entre o azul do app e a paleta do time
            // (ex: Corinthians preto/branco/vermelho em cima de azul).
            <View style={styles.logoContainerNeutro}>
              <Image source={{ uri: logoUrl }} style={styles.logo} resizeMode="contain" />
            </View>
          ) : (
            // Sem escudo ainda (placeholder do app): mantém o gradiente
            // azul, que é o que dá contraste pro mark preto do app.
            <LinearGradient
              colors={[colors.primaria, '#0055FF']}
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
          )
        )} 
        {icon && (
          <TouchableOpacity onPress={onPressIcon} activeOpacity={0.6}>
            <MaterialCommunityIcons name={icon} size={44} color={colors.primaria} />
          </TouchableOpacity>
        )}
        {/* O TITLE JÁ ERA DINÂMICO E CONTINUA AQUI — agora com numberOfLines pra truncar
            em vez de empurrar os botões da direita pra fora da tela */}
        <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
          {title}
        </Text>
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
    flex: 1,
    minWidth: 0,
    maxWidth: '65%',
  },
  logoContainer: {
    width: 45,
    height: 45,
    borderRadius: 10,
    padding: 6,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainerNeutro: {
    width: 45,
    height: 45,
    borderRadius: 10,
    padding: 6,
    backgroundColor: colors.cardSecundario,
    borderWidth: 1,
    borderColor: colors.borda,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontFamily: typography.fontFamily.corpo.semiBold,
    fontSize: typography.fontSize.lmd,
    color: colors.texto,
    textTransform: 'uppercase',
    flexShrink: 1,
    flex: 1,
  },
  rightContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flexShrink: 0,
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