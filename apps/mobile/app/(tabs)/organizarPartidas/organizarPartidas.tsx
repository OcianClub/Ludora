import { Redirect } from 'expo-router';

// Preserve old links without exposing match creation in the mobile app.
export default function OrganizarPartidasRedirect() {
  return <Redirect href="/(tabs)/jogos/jogos" />;
}
