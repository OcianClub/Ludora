import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useRootNavigationState } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { colors } from '@/src/theme/colors';

export default function Index() {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return;

    async function checkLogin() {
      const token = await SecureStore.getItemAsync('userToken');
      
      if (token) {
        router.replace('/(tabs)');
      } else {
        router.replace('/(auth)/login'); 
      }
    }

    checkLogin();
  }, [rootNavigationState?.key]);

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}