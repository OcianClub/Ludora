import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';

import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { ConviteClubeCard } from '@/src/features/convites/components/ConviteClubeCard';
import type { PapelConvite } from '@/src/features/convites/types';
import { conviteStyles as styles } from '@/src/styles/conviteStyles';

function primeiroParametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? '' : valor ?? '';
}

export default function ConviteSucesso() {
  const router = useRouter();
  const { clubeAtivo } = useClubeAtivo();
  const params = useLocalSearchParams<{
    clube?: string | string[];
    escudo?: string | string[];
    papel?: string | string[];
    categorias?: string | string[];
    acessoTotal?: string | string[];
  }>();

  const nomeClube = primeiroParametro(params.clube) || clubeAtivo?.nome || 'Seu novo clube';
  const escudo = primeiroParametro(params.escudo) || clubeAtivo?.escudo || null;
  const papel = (primeiroParametro(params.papel) || clubeAtivo?.papel || 'TECNICO') as PapelConvite;
  const acessoTodasCategorias = primeiroParametro(params.acessoTotal) === '1';
  const nomesCategorias = primeiroParametro(params.categorias)
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
  const categorias = nomesCategorias.map((nome, index) => ({ id: index + 1, nome }));

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.successContent}>
        <View style={styles.successIntro}>
          <View style={styles.successIcon}>
            <Icon name="check" size={36} color="#FFFFFF" />
          </View>

          <Text style={styles.successTitle}>BEM-VINDO AO TIME!</Text>
          <Text style={styles.successSubtitle}>
            Seu acesso foi criado com sucesso.{`\n`}Agora você já faz parte do clube.
          </Text>
        </View>

        <ConviteClubeCard
          clube={{ id: clubeAtivo?.id ?? 0, nome: nomeClube, escudo }}
          papel={papel}
          categorias={categorias}
          acessoTodasCategorias={acessoTodasCategorias}
        />
      </View>

      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.replace('/(tabs)')}
          activeOpacity={0.8}
        >
          <Text style={styles.primaryButtonText}>IR PARA O CLUBE</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
