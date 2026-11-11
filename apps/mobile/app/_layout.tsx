import { useEffect } from 'react';
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts } from 'expo-font';

// Importar apenas as variantes usadas evita incluir todas as fontes no bundle.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Oswald_500Medium } from '@expo-google-fonts/oswald/500Medium';
import { Oswald_600SemiBold } from '@expo-google-fonts/oswald/600SemiBold';
import { Oswald_700Bold } from '@expo-google-fonts/oswald/700Bold';

import { ClubeAtivoProvider } from '@/src/contexts/ClubeAtivoContext';
import { ThemeProvider } from '@/src/contexts/ThemeContext';
import { NotificacoesProvider } from '@/src/contexts/NotificacoesContext';
import { SessaoProvider } from '@/src/contexts/SessaoContext';

SplashScreen.preventAutoHideAsync();

SplashScreen.setOptions({
  duration: 400,
  fade: true,
});

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Oswald_500Medium,
    Oswald_600SemiBold,
    Oswald_700Bold,
  });

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}><ThemeProvider>
      <SessaoProvider><ClubeAtivoProvider>
        <NotificacoesProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="convite" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </NotificacoesProvider>
      </ClubeAtivoProvider></SessaoProvider>
    </ThemeProvider></GestureHandlerRootView>
  );
}
