import { View, Text, TouchableOpacity, TextInput, Alert } from 'react-native'
import { styles } from '@/src/styles/indexConviteStyles'
import { Icon } from '@ludora/icons';
import { useRouter } from 'expo-router';
import { colors } from '@ludora/design-tokens'
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';

export default function Index() {
  const router = useRouter();

  const [codigo, setCodigo] = useState('');

  function mostrarAjudaConvite() {
  Alert.alert(
    'Como receber um convite?',
    'O convite precisa ser enviado por um administrador do clube.\n\nVerifique sua caixa de entrada e a pasta de spam. Se ainda não recebeu, confirme se o administrador usou o e-mail correto e peça um novo envio.',
    [
      {
        text: 'Entendi',
        style: 'default',
      },
    ],
  );
}

function formatarCodigoConvite(valor: string) {
  const limpo = valor
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (limpo.length <= 4) {
    return limpo;
  }
  return `${limpo.slice(0, 4)}-${limpo.slice(4)}`;
}

async function colarCodigo() {
  try {
    const textoCopiado =
      await Clipboard.getStringAsync();

    if (!textoCopiado.trim()) {
      Alert.alert(
        'Área de transferência vazia',
        'Copie o código e tente novamente.',
      );
      return;
    }

    setCodigo(
      formatarCodigoConvite(textoCopiado),
    );
  } catch {
    Alert.alert(
      'Não foi possível colar',
      'Digite o código manualmente.',
    );
  }
}

function continuar() {
  const quantidadeCaracteres = codigo.replace(/[^A-Z0-9]/g, '').length;

  if (quantidadeCaracteres !== 8) {
    Alert.alert(
      'Código incompleto',
      'Digite ou cole os oito caracteres do convite.',
    );
    return;
  }

  router.push(`/convite/${codigo}`);
}

  return (
    <SafeAreaView
    style={styles.container}
    edges={['top', 'bottom', 'left', 'right']}
    >
    <View style={styles.header}>
        <TouchableOpacity
        style={styles.btnVoltar}
        onPress={() => router.back()}
        >
        <Icon
            name="arrow-left"
            size={22}
            color={colors.texto}
        />
        </TouchableOpacity>
    </View>

    <View style={styles.content}>
        <View>
        <Text style={styles.title}>
            Entrar em um clube
        </Text>

        <Text style={styles.subtitle}>
            Alguém te chamou pro time?{'\n'}
            Cola o código ou o link do convite aqui embaixo.
        </Text>
        </View>

        <View style={styles.inputRow}>
        <TextInput
            style={styles.input}
            placeholder="Código ou link do convite"
            placeholderTextColor={colors.textoSecundario}
            value={codigo}
            onChangeText={(texto) =>
            setCodigo(formatarCodigoConvite(texto))}
            autoCapitalize="characters"
            maxLength={9}
        />

        <TouchableOpacity style={styles.iconColar} onPress={colarCodigo}>
            <Icon
            name="clipboard-text-outline"
            size={24}
            color={colors.textoSecundario}
            />
        </TouchableOpacity>
        </View>
    </View>

    <View style={styles.rodape}>
        <TouchableOpacity style={styles.btnContinuar} activeOpacity={0.8} onPress={continuar}>
            <Text style={styles.txtBtn}>
                CONTINUAR
            </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={mostrarAjudaConvite}>
            <Text style={styles.semConviteTxt}>
                Ainda não recebi nenhum convite
            </Text>
        </TouchableOpacity>
    </View>
    </SafeAreaView>
  );
}
