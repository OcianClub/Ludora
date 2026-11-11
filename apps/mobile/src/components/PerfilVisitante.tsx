import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@ludora/icons';
import { useTheme } from '../contexts/ThemeContext';

export function HeaderPublico() {
  const { colors } = useTheme();
  const router = useRouter(), insets = useSafeAreaInsets();
  return <View style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.fundo }}>
    <Image source={require('../../assets/icon.png')} style={{ width: 34, height: 34, borderRadius: 8 }} />
    <Text style={{ flex: 1, color: colors.texto, fontFamily: 'Oswald_600SemiBold', fontSize: 24 }}>LUDORA</Text>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Perfil e opções de acesso" onPress={() => router.navigate('/(tabs)/perfil/perfil')} style={{ padding: 10, borderRadius: 10, backgroundColor: colors.card }}>
      <Icon name="account" size={22} color={colors.texto} />
    </TouchableOpacity>
  </View>;
}

export default function PerfilVisitante() {
  const { colors, preferenciaTema, definirPreferenciaTema } = useTheme();
  const router = useRouter(), pathname = usePathname();
  const entrar = async (cadastro = false) => {
    await SecureStore.setItemAsync('retornoLogin', pathname);
    router.push(cadastro ? '/(auth)/cadastro' : '/(auth)/login');
  };
  return <View style={{ flex: 1, backgroundColor: colors.fundo }}>
    <HeaderPublico />
    <ScrollView contentContainerStyle={{ padding: 20, gap: 22 }}>
      <View style={{ gap: 10 }}>
        <Icon name="account" size={38} color={colors.primaria} />
        <Text accessibilityRole="header" style={{ color: colors.texto, fontSize: 28, fontFamily: 'Oswald_600SemiBold' }}>O Ludora também é para quem acompanha</Text>
        <Text style={{ color: colors.textoSecundario, lineHeight: 22 }}>Explore clubes, acompanhe partidas e consulte resultados sem precisar de uma conta.</Text>
      </View>
      <View style={{ padding: 18, backgroundColor: colors.card, borderRadius: 12, gap: 14 }}>
        <Text style={{ color: colors.texto, fontWeight: '600', fontSize: 16 }}>Entre para acompanhar do seu jeito</Text>
        <Text style={{ color: colors.textoSecundario, lineHeight: 22 }}>Salve os clubes que você segue e escolha os avisos que deseja receber. Se você faz parte da equipe do clube, entre para acessar suas funções.</Text>
        <TouchableOpacity accessibilityRole="button" onPress={() => void entrar()} style={{ padding: 14, borderRadius: 10, backgroundColor: colors.primaria, alignItems: 'center' }}><Text style={{ color: colors.textoSobrePrimaria, fontWeight: '600' }}>Entrar</Text></TouchableOpacity>
        <TouchableOpacity accessibilityRole="button" onPress={() => void entrar(true)} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: colors.primaria }}>Criar conta</Text></TouchableOpacity>
      </View>
      <Text style={{ color: colors.texto, fontWeight: '600' }}>Aparência</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {(['system', 'light', 'dark'] as const).map((tema, i) => <TouchableOpacity key={tema} accessibilityRole="radio" accessibilityState={{ checked: preferenciaTema === tema }} onPress={() => void definirPreferenciaTema(tema)} style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8, backgroundColor: preferenciaTema === tema ? colors.primaria : colors.card }}><Text style={{ color: preferenciaTema === tema ? colors.textoSobrePrimaria : colors.texto }}>{['Sistema', 'Claro', 'Escuro'][i]}</Text></TouchableOpacity>)}
      </View>
      <TouchableOpacity accessibilityRole="button" onPress={() => router.navigate('/(tabs)/clubes/clubes')} style={{ padding: 12, alignItems: 'center' }}><Text style={{ color: colors.primaria }}>Continuar explorando clubes</Text></TouchableOpacity>
    </ScrollView>
  </View>;
}
