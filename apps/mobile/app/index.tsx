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
import { BASE_URL } from '@/src/services/api';
import { fetchComTimeout } from '@/src/utils/request';

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
  const { clubeAtivo, limparClubeAtivo } = useClubeAtivo();

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

      // A presença de um token no aparelho não garante que ele ainda esteja
      // válido: a API expira JWTs após um período. Só encerramos a sessão
      // automaticamente quando a própria API confirmar um 401.
      try {
        const sessao = await fetchComTimeout(`${BASE_URL}/usuarios/me`, {
          headers: { Authorization: `Bearer ${token}` },
        }, 8_000);

        if (sessao.status === 401) {
          await limparClubeAtivo();
          await Promise.all([
            SecureStore.deleteItemAsync('userToken'),
            SecureStore.deleteItemAsync('userName'),
            SecureStore.deleteItemAsync('userCriadoEm'),
            SecureStore.deleteItemAsync('userEmail'),
            SecureStore.deleteItemAsync('userData'),
            SecureStore.deleteItemAsync('userRole'),
            SecureStore.deleteItemAsync('clubeAtivoId'),
          ]);
          setDestino('/(auth)/login');
          return;
        }
      } catch {
        // Em caso de indisponibilidade momentânea da rede/API, preservamos a
        // sessão local em vez de desconectar o usuário sem necessidade.
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
