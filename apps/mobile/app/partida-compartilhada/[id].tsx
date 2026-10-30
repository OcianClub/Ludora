import { useLocalSearchParams, useRouter } from 'expo-router';
import PartidaCompartilhada from '@/src/components/PartidaCompartilhada';
export default function PartidaRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  return <PartidaCompartilhada id={Number(id)} onBack={() => router.back()}/>;
}
