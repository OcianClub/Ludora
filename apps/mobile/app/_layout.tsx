import { useEffect } from 'react';
import { SplashScreen, Stack } from 'expo-router';
import { useFonts } from 'expo-font';

import { 
  Inter_400Regular, 
  Inter_500Medium, 
  Inter_600SemiBold 
} from '@expo-google-fonts/inter';
import { 
  Oswald_500Medium, 
  Oswald_600SemiBold, 
  Oswald_700Bold 
} from '@expo-google-fonts/oswald';

SplashScreen.preventAutoHideAsync();

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
    <Stack screenOptions={{ headerShown: false }}>
      {/* O index decide pra onde o cara vai */}
      <Stack.Screen name="index" /> 
      {/* Telas de login/cadastro */}
      <Stack.Screen name="(auth)" />
      {/* Telas principais do app */}
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}