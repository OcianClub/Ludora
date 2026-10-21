import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useMemo } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { IconeAba } from '@/src/components/IconeAba';
import { createStyles } from '@/src/styles/tabBarStyles';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';

import { useTheme } from '@/src/contexts/ThemeContext';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { podeGerenciar, carregandoClubeAtivo } = useClubeAtivo();

  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarActiveTintColor: colors.primaria,
        tabBarInactiveTintColor: colors.textoSecundario,
        tabBarActiveBackgroundColor: 'transparent',
        tabBarInactiveBackgroundColor: 'transparent',
        tabBarStyle: [styles.barra, { height: 56 + insets.bottom }],
        tabBarItemStyle: styles.item,
        tabBarIconStyle: styles.areaIcone,
        tabBarLabelPosition: 'below-icon',
        tabBarLabel: ({ focused, color, children }) => (
          <Text
            style={[
              styles.label,
              focused && styles.labelSelecionado,
              { color },
            ]}
          >
            {children}
          </Text>
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba inicio cor={color} selecionado={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="jogos/jogos"
        options={{
          title: 'Jogos',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="soccer" cor={color} selecionado={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="clubes/clubes"
        options={{
          title: 'Clubes',
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="shield-outline" cor={color} selecionado={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="estatisticas/estatisticas"
        options={{
          title: 'Scout',
          href: !carregandoClubeAtivo && podeGerenciar ? undefined : null,
          tabBarIcon: ({ color, focused }) => (
            <IconeAba nome="radar" cor={color} selecionado={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="perfil/perfil"
        options={{
          title: 'Perfil',
          href: null,
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
        name="perfil/notificacoes"
        options={{
          href: null,
          title: 'Notificações',
        }}
      />
    </Tabs>
  );
}
