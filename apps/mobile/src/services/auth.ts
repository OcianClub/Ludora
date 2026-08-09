import * as SecureStore from 'expo-secure-store';

export async function isAdmin(): Promise<boolean> {
  const role = await SecureStore.getItemAsync('userRole');
  return role === 'ADMIN';
}