import { useEffect, useState } from 'react';
import {
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SecureStore from 'expo-secure-store';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';

type Destino = '/(auth)/login' | '/clubes' | '/(tabs)';

function StartupScreen() {
  return (
    <View style={styles.splashContainer}>
      <StatusBar style="light" />

      <Image
        source={require('../assets/icon.png')}
        style={styles.splashLogo}
        resizeMode="contain"
      />

      <Text style={styles.splashTitle}>
        LUDORA
      </Text>

      <Text style={styles.splashSubtitle}>
        GESTÃO E ESTATÍSTICAS DE CLUBES
      </Text>
    </View>
  );
}

export default function Index() {
  const [carregando, setCarregando] = useState(true);
  const [destino, setDestino] = useState<Destino | null>(null);
  const { clubeAtivo } = useClubeAtivo();

  useEffect(() => {
  async function verificarSessao() {
    const inicio = Date.now();
    const tempoMinimo = 800;

    try {
      const token = await SecureStore.getItemAsync('userToken');

      if (!token) {
        setDestino('/(auth)/login');
        return;
      }

      const clubeAtivoId =
        await SecureStore.getItemAsync('clubeAtivoId');

      setDestino(
        clubeAtivoId
          ? '/(tabs)'
          : '/clubes',
      );
    } catch (error) {
      console.error(
        'Erro ao decidir rota inicial:',
        error,
      );

      setDestino('/(auth)/login');
    } finally {
      const tempoDecorrido = Date.now() - inicio;
      const tempoRestante = tempoMinimo - tempoDecorrido;

      if (tempoRestante > 0) {
        await new Promise<void>((resolve) => {
          setTimeout(resolve, tempoRestante);
        });
      }

      setCarregando(false);
    }
  }

  verificarSessao();
}, []);

  if (carregando || !destino) {
    return <StartupScreen />;
  }

  return <Redirect href={destino} />;
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#0B0D12',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },

  splashLogo: {
    width: 74,
    height: 74,
    marginBottom: 14,
  },

  splashTitle: {
    color: '#F5EBDD',
    fontFamily: 'Oswald_700Bold',
    fontSize: 38,
    lineHeight: 44,
  },

  splashSubtitle: {
    color: '#F4F4F4',
    fontFamily: 'Inter_400Regular',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
});