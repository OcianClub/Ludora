import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { colors, typography } from '@ludora/design-tokens'
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { HomeIcon, Icon } from '@ludora/icons';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { podeGerenciar, carregandoClubeAtivo } = useClubeAtivo();

  return (
    <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.primaria, 
          tabBarInactiveTintColor: colors.textoSecundario,
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveBackgroundColor: 'transparent',
          tabBarStyle: {
            backgroundColor: colors.fundo,
            borderTopWidth: 1,
            borderColor: colors.card,
            height: 64 + insets.bottom,
          },
          tabBarItemStyle: {
            borderRadius: 10,
            marginHorizontal: 10,
            marginVertical: 4, 
          },
          tabBarLabel: ({ focused, color, children }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ 
                fontFamily: typography.fontFamily.corpo.semiBold, 
                fontSize: 12, 
                color: color 
              }}>
                {children}
              </Text>
            </View>
          )
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <HomeIcon size={size} color={color}/>
          ),
        }}
      />
      <Tabs.Screen
        name="jogos/jogos"
        options={{
          title: 'Jogos',
          tabBarIcon: ({ color, size }) => (
            <Icon name="soccer" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="clubes/clubes"
        options={{
          title: 'Clubes',
          tabBarIcon: ({ color, size }) => (
            <Icon name="shield-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="estatisticas/estatisticas"
        options={{
          title: 'Scout',
          href: !carregandoClubeAtivo && podeGerenciar ? undefined : null,
          tabBarIcon: ({ color, size }) => (
            <Icon name="radar" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil/perfil"
        options={{
          title: 'Perfil',
          href: null
        }}
      />
        <Tabs.Screen
        name="organizarPartidas/organizarPartidas"
        options={{
          href: null,
          title: 'Detalhes',
        }}
      />
        <Tabs.Screen
        name="perfil/dadosPessoais/dadosPessoais"
        options={{
          href: null,
          title: 'dadosPessoais',
        }}
      />
        <Tabs.Screen
        name="perfil/equipes/equipes"
        options={{
          href: null,
          title: 'equipes',
        }}
      />
    </Tabs>
  );
}
