import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';

import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import {
  aceitarConviteContaExistente,
  consultarConvite,
} from '@/src/features/convites/api';
import { ConviteClubeCard } from '@/src/features/convites/components/ConviteClubeCard';
import type { ConviteConsultado, ResultadoConvite } from '@/src/features/convites/types';
import { conviteStyles as styles } from '@/src/styles/conviteStyles';

function primeiroParametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? '' : valor ?? '';
}

export default function ConfirmarConvite() {
  const router = useRouter();
  const { codigo: codigoParam } = useLocalSearchParams<{ codigo?: string | string[] }>();
  const { definirClubeAtivo } = useClubeAtivo();
  const codigo = primeiroParametro(codigoParam).toUpperCase();

  const [convite, setConvite] = useState<ConviteConsultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState('');

  const carregar = useCallback(async () => {
    if (!codigo) {
      setErro('Código de convite inválido.');
      setCarregando(false);
      return;
    }

    setCarregando(true);
    setErro('');

    try {
      setConvite(await consultarConvite(codigo));
    } catch (error: any) {
      setErro(error.message || 'Não foi possível consultar este convite.');
    } finally {
      setCarregando(false);
    }
  }, [codigo]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function irParaSucesso(resultado: ResultadoConvite) {
    router.replace({
      pathname: '/convite/sucesso',
      params: {
        clube: resultado.clube.nome,
        escudo: resultado.clube.escudo ?? '',
        papel: resultado.clube.papel,
        categorias: resultado.clube.categorias.map(item => item.nome).join(','),
        acessoTotal: resultado.clube.acesso_todas_categorias ? '1' : '0',
      },
    });
  }

  async function continuar() {
    if (!convite || processando) return;

    if (!convite.possui_conta) {
      router.push({ pathname: '/convite/cadastro', params: { codigo } });
      return;
    }

    const token = await SecureStore.getItemAsync('userToken');
    if (!token) {
      await SecureStore.setItemAsync('convitePendente', codigo);
      router.push('/(auth)/login');
      return;
    }

    setProcessando(true);
    setErro('');

    try {
      const resultado = await aceitarConviteContaExistente(codigo);
      await Promise.all([
        SecureStore.setItemAsync('userName', resultado.usuario.nome),
        SecureStore.setItemAsync('userEmail', resultado.usuario.email),
        SecureStore.deleteItemAsync('convitePendente'),
        definirClubeAtivo({
          id: resultado.clube.id,
          nome: resultado.clube.nome,
          escudo: resultado.clube.escudo,
          papel: resultado.clube.papel,
        }),
      ]);
      irParaSucesso(resultado);
    } catch (error: any) {
      setErro(error.message || 'Não foi possível aceitar este convite.');
    } finally {
      setProcessando(false);
    }
  }

  function recusar() {
    Alert.alert(
      'Sair deste convite?',
      'Você poderá usar o mesmo código novamente enquanto ele continuar válido.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Sair',
          style: 'destructive',
          onPress: async () => {
            await SecureStore.deleteItemAsync('convitePendente');
            router.back();
          },
        },
      ],
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
          <Icon name="arrow-left" size={22} color={colors.texto} />
        </TouchableOpacity>
      </View>

      {carregando ? (
        <View style={styles.centeredContent}>
          <ActivityIndicator size="large" color={colors.primaria} />
          <Text style={styles.loadingText}>Consultando convite...</Text>
        </View>
      ) : erro && !convite ? (
        <View style={styles.centeredContent}>
          <View style={styles.feedbackBox}>
            <Icon name="alert-circle-outline" size={20} color={colors.tituloErro} />
            <Text style={styles.feedbackText}>{erro}</Text>
          </View>
          <TouchableOpacity style={styles.primaryButton} onPress={carregar} activeOpacity={0.8}>
            <Text style={styles.primaryButtonText}>TENTAR NOVAMENTE</Text>
          </TouchableOpacity>
        </View>
      ) : convite ? (
        <>
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <View style={styles.intro}>
              <Text style={styles.title}>Convite recebido</Text>
              <Text style={styles.subtitle}>
                Confira os detalhes antes de entrar para o time.
              </Text>
            </View>

            {!!erro && (
              <View style={styles.feedbackBox}>
                <Icon name="alert-circle-outline" size={20} color={colors.tituloErro} />
                <Text style={styles.feedbackText}>{erro}</Text>
              </View>
            )}

            <ConviteClubeCard
              clube={convite.clube}
              papel={convite.papel}
              categorias={convite.categorias}
              acessoTodasCategorias={convite.acesso_todas_categorias}
              convidadoPor={convite.convidado_por}
            />

            <Text style={[styles.subtitle, { marginTop: 18 }]}>
              Este convite foi enviado para <Text style={styles.emailHint}>{convite.email}</Text>.
            </Text>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.primaryButton, processando && styles.buttonDisabled]}
              onPress={continuar}
              disabled={processando}
              activeOpacity={0.8}
            >
              {processando ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {convite.possui_conta ? 'ACEITAR CONVITE' : 'CONTINUAR'}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={recusar} activeOpacity={0.7}>
              <Text style={styles.secondaryButtonText}>Agora não</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : null}
    </SafeAreaView>
  );
}
