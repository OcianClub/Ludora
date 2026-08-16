// Caminho: app/index.tsx
//
// Essa é a PRIMEIRA tela que o Expo Router carrega ao abrir o app.
// Ela não renderiza nenhuma UI de verdade — só decide pra onde mandar
// o usuário, e some em seguida:
//
//   sem token salvo            -> /(auth)/login
//   com token, sem clube ativo -> /clubes            (escolher/seguir um clube)
//   com token e clube ativo    -> /(tabs)             (app normal, com navbar)
//
// Se esse arquivo não existir (ou se por engano tiver a tela Home aqui
// dentro), o app carrega a Home direto na raiz, SEM o grupo (tabs) por
// cima — por isso ela aparece sem a navbar de baixo, e com "CLUBE
// SELECIONADO" no header (fallback de quando não acha o clube ativo
// no cache do usuário).

import { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@ludora/design-tokens';

type Destino = '/(auth)/login' | '/clubes' | '/(tabs)';

export default function Index() {
  const [carregando, setCarregando] = useState(true);
  const [destino, setDestino] = useState<Destino | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const token = await SecureStore.getItemAsync('userToken');

        if (!token) {
          setDestino('/(auth)/login');
          return;
        }

        const clubeAtivoId = await SecureStore.getItemAsync('clubeAtivoId');
        setDestino(clubeAtivoId ? '/(tabs)' : '/clubes');
      } catch (error) {
        console.error('Erro ao decidir rota inicial:', error);
        setDestino('/(auth)/login');
      } finally {
        setCarregando(false);
      }
    })();
  }, []);

  if (carregando || !destino) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.fundo }}>
        <ActivityIndicator size="large" color={colors.primaria} />
      </View>
    );
  }

  return <Redirect href={destino} />;
}