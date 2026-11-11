import { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import Svg, { Path } from 'react-native-svg';
import { Icon, type IconName } from '@ludora/icons';
import { useTheme } from '../contexts/ThemeContext';
import { useSessao } from '../contexts/SessaoContext';
import { AppSheet } from './ui/AppSheet';
import { AppButton } from './ui/Controls';

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const { colors, preferenciaTema, definirPreferenciaTema } = useTheme();
  const { autenticado } = useSessao();
  const router = useRouter();
  const pathname = usePathname();
  async function entrar(cadastro = false) {
    try {
      await SecureStore.setItemAsync('retornoLogin', pathname);
      setOpen(false);
      router.push(cadastro ? '/(auth)/cadastro' : '/(auth)/login');
    } catch { Alert.alert('Não foi possível abrir', 'Tente novamente.'); }
  }
  function navegar(rota: '/(tabs)/perfil/perfil' | '/(tabs)/clubes/clubes') {
    setOpen(false);
    router.navigate(rota);
  }
  return <>
    <TouchableOpacity accessibilityRole="button" accessibilityLabel="Conta e preferências" accessibilityState={{ expanded: open }}
      onPress={() => autenticado ? navegar("/(tabs)/perfil/perfil") : setOpen(true)} activeOpacity={0.75} hitSlop={4}
      style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.cardSecundario }}>
      <Icon name="user" size={21} color={colors.texto} />
    </TouchableOpacity>
    {open && !autenticado && <AppSheet title="Seu Ludora, do seu jeito" onClose={() => setOpen(false)}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Aparência" style={{ flexDirection: 'row', alignSelf: 'flex-start', padding: 4, gap: 4, borderRadius: 9, backgroundColor: colors.card }}>
        {(['system', 'light', 'dark'] as const).map((tema, index) => <TouchableOpacity key={tema}
          accessibilityRole="radio" accessibilityLabel={['Tema do sistema', 'Tema claro', 'Tema escuro'][index]} accessibilityState={{ checked: preferenciaTema === tema }}
          onPress={() => void definirPreferenciaTema(tema).catch(() => Alert.alert('Não foi possível salvar o tema', 'Tente novamente.'))}
          style={{ width: 40, height: 40, borderRadius: 7, alignItems: 'center', justifyContent: 'center', backgroundColor: preferenciaTema === tema ? colors.cardSecundario : 'transparent' }}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke={preferenciaTema === tema ? colors.primaria : colors.textoSecundario} strokeWidth={1.6}>
            <Path d={['M8 3h8v18H8z M11 18h2', 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8 M12 2v3 M12 19v3 M2 12h3 M19 12h3 M5 5l2 2 M17 17l2 2 M5 19l2-2 M17 7l2-2', 'M20 15a8 8 0 0 1-11-11a8 8 0 1 0 11 11Z'][index]} />
          </Svg>
        </TouchableOpacity>)}
      </View>
      <>
        <View style={{ borderTopWidth: 1, borderTopColor: colors.linha, paddingTop: 18, gap: 10 }}>
          <Text style={{ color: colors.texto, fontSize: 17, fontFamily: 'Inter_600SemiBold' }}>Acompanhe ainda mais de perto</Text>
          <Text style={{ color: colors.textoSecundario, fontSize: 13, lineHeight: 20 }}>Explore os clubes e jogos livremente. Entre para salvar suas preferências.</Text>
        </View>
        {([
          ['shield', 'Siga seus clubes favoritos'],
          ['bell', 'Receba avisos de partidas e resultados'],
          ['group', 'Acesse sua equipe com um convite'],
        ] as [IconName, string][]).map(([icon, label]) => <View key={icon} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Icon name={icon} size={20} color={colors.textoSecundario} /><Text style={{ flex: 1, color: colors.texto, fontSize: 14, lineHeight: 21 }}>{label}</Text>
        </View>)}
        <AppButton label="Entrar na conta" icon="user" variant="primary" onPress={() => void entrar()} />
        <TouchableOpacity accessibilityRole="button" onPress={() => void entrar(true)} style={{ minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.primaria, fontSize: 14 }}>Criar uma conta</Text></TouchableOpacity>
      </>
    </AppSheet>}
  </>;
}
