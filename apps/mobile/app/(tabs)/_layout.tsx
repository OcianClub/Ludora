import { Tabs } from 'expo-router';
import { View, Text } from 'react-native';
import { colors } from '@/src/theme/colors'
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.text, 
          tabBarInactiveTintColor: '#888888',
          tabBarActiveBackgroundColor: 'transparent',
          tabBarInactiveBackgroundColor: 'transparent',
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopWidth: 0,
            elevation: 0,
            height: 80 + insets.bottom,
            paddingBottom: 10 + insets.bottom,
            paddingTop: 10,
          },
          tabBarItemStyle: {
            borderRadius: 10,
            marginHorizontal: 10,
            marginVertical: 4, 
          },
          tabBarLabel: ({ focused, color, children }) => (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ 
                fontFamily: 'Creato-Bold', 
                fontSize: 11.5, 
                color: color 
              }}>
                {children}
              </Text>
              <View 
                style={{
                  position: 'absolute',
                  bottom: -10,
                  height: 3,
                  width: '80%',
                  backgroundColor: focused ? colors.primary : 'transparent',
                  borderRadius: 2
                }} 
              />
            </View>
          )
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="home" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="jogos/jogos"
        options={{
          title: 'Jogos',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="soccer" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="placar/placar"
        options={{
          title: 'Placar',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="trophy-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="estatisticas/estatisticas"
        options={{
          title: 'Scout',
          tabBarIcon: ({ color, size }) => (
            <MaterialCommunityIcons name="radar" size={size} color={color} />
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