import { Stack } from 'expo-router';

export default function ConviteLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="[codigo]" />
      <Stack.Screen name="cadastro" />
      <Stack.Screen name="sucesso" />
    </Stack>
  );
}
