import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';

import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { aceitarConviteNovaConta, consultarConvite } from '@/src/features/convites/api';
import { ConviteClubeCard } from '@/src/features/convites/components/ConviteClubeCard';
import type { ConviteConsultado, ResultadoConvite } from '@/src/features/convites/types';
import { conviteStyles as styles } from '@/src/styles/conviteStyles';

function primeiroParametro(valor: string | string[] | undefined): string {
  return Array.isArray(valor) ? valor[0] ?? '' : valor ?? '';
}

export default function CadastroConvite() {
  const router = useRouter();
  const { definirClubeAtivo } = useClubeAtivo();
  const { codigo: codigoParam } = useLocalSearchParams<{ codigo?: string | string[] }>();
  const codigo = primeiroParametro(codigoParam).toUpperCase();

  const [convite, setConvite] = useState<ConviteConsultado | null>(null);
  const [nome, setNome] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [campoFocado, setCampoFocado] = useState<'nome' | 'senha' | 'confirmacao' | null>(null);
  const [carregandoConvite, setCarregandoConvite] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const senhaValida = senha.length >= 8;
  const senhasIguais = confirmacao.length > 0 && senha === confirmacao;
  const formularioValido = nome.trim().length >= 2 && senhaValida && senhasIguais && aceitouTermos;

  useEffect(() => {
    let ativo = true;

    (async () => {
      try {
        const dados = await consultarConvite(codigo);
        if (ativo) setConvite(dados);
      } catch (error: any) {
        if (ativo) setErro(error.message || 'Não foi possível consultar este convite.');
      } finally {
        if (ativo) setCarregandoConvite(false);
      }
    })();

    return () => {
      ativo = false;
    };
  }, [codigo]);

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

  async function criarConta() {
    if (!formularioValido || salvando) return;

    setSalvando(true);
    setErro('');

    try {
      const resultado = await aceitarConviteNovaConta(codigo, {
        nome: nome.trim(),
        senha,
      });

      if (!resultado.token) {
        throw new Error('A conta foi criada, mas a sessão não pôde ser iniciada.');
      }

      await Promise.all([
        SecureStore.setItemAsync('userToken', resultado.token),
        SecureStore.setItemAsync('userName', resultado.usuario.nome),
        SecureStore.setItemAsync('userEmail', resultado.usuario.email),
        SecureStore.setItemAsync('userCriadoEm', String(resultado.usuario.criadoEm ?? '')),
        SecureStore.setItemAsync('userData', JSON.stringify({ clubes: [resultado.clube] })),
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
      setErro(error.message || 'Não foi possível criar sua conta.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()} activeOpacity={0.7}>
            <Icon name="arrow-left" size={22} color={colors.texto} />
          </TouchableOpacity>
        </View>

        {carregandoConvite ? (
          <View style={styles.centeredContent}>
            <ActivityIndicator size="large" color={colors.primaria} />
            <Text style={styles.loadingText}>Preparando seu cadastro...</Text>
          </View>
        ) : (
          <>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.intro}>
                <Text style={styles.title}>Falta pouco</Text>
                <Text style={styles.subtitle}>
                  Para entrar no clube, precisamos de algumas informações.
                </Text>
              </View>

              {convite && (
                <ConviteClubeCard
                  clube={convite.clube}
                  papel={convite.papel}
                  categorias={convite.categorias}
                  acessoTodasCategorias={convite.acesso_todas_categorias}
                  compacto
                />
              )}

              {!!erro && (
                <View style={styles.feedbackBox}>
                  <Icon name="alert-circle-outline" size={20} color={colors.tituloErro} />
                  <Text style={styles.feedbackText}>{erro}</Text>
                </View>
              )}

              <View style={styles.form}>
                <View style={styles.field}>
                  <Text style={styles.inputLabel}>NOME COMPLETO</Text>
                  <View style={[styles.inputRow, campoFocado === 'nome' && styles.inputRowFocused]}>
                    <Icon name="account-outline" size={20} color={campoFocado === 'nome' ? colors.primaria : colors.textoSecundario} />
                    <TextInput
                      style={styles.input}
                      placeholder="Digite seu nome completo"
                      placeholderTextColor={colors.textoSecundario}
                      value={nome}
                      onChangeText={valor => { setNome(valor); setErro(''); }}
                      onFocus={() => setCampoFocado('nome')}
                      onBlur={() => setCampoFocado(null)}
                      autoCapitalize="words"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                <View style={styles.field}>
                  <Text style={styles.inputLabel}>SENHA</Text>
                  <View style={[
                    styles.inputRow,
                    campoFocado === 'senha' && styles.inputRowFocused,
                    senha.length > 0 && !senhaValida && styles.inputRowError,
                  ]}>
                    <Icon name="lock-outline" size={20} color={campoFocado === 'senha' ? colors.primaria : colors.textoSecundario} />
                    <TextInput
                      style={styles.input}
                      placeholder="Digite sua senha"
                      placeholderTextColor={colors.textoSecundario}
                      value={senha}
                      onChangeText={valor => { setSenha(valor); setErro(''); }}
                      onFocus={() => setCampoFocado('senha')}
                      onBlur={() => setCampoFocado(null)}
                      secureTextEntry={!mostrarSenha}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setMostrarSenha(valor => !valor)}>
                      <Icon name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.textoSecundario} />
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.passwordHint}>Use pelo menos 8 caracteres.</Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.inputLabel}>CONFIRME A SENHA</Text>
                  <View style={[
                    styles.inputRow,
                    campoFocado === 'confirmacao' && styles.inputRowFocused,
                    confirmacao.length > 0 && !senhasIguais && styles.inputRowError,
                  ]}>
                    <Icon name="lock-outline" size={20} color={campoFocado === 'confirmacao' ? colors.primaria : colors.textoSecundario} />
                    <TextInput
                      style={styles.input}
                      placeholder="Digite a senha novamente"
                      placeholderTextColor={colors.textoSecundario}
                      value={confirmacao}
                      onChangeText={valor => { setConfirmacao(valor); setErro(''); }}
                      onFocus={() => setCampoFocado('confirmacao')}
                      onBlur={() => setCampoFocado(null)}
                      secureTextEntry={!mostrarConfirmacao}
                    />
                    <TouchableOpacity style={styles.eyeButton} onPress={() => setMostrarConfirmacao(valor => !valor)}>
                      <Icon name={mostrarConfirmacao ? 'eye-outline' : 'eye-off-outline'} size={21} color={colors.textoSecundario} />
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.termsRow} onPress={() => setAceitouTermos(valor => !valor)} activeOpacity={0.75}>
                  <Icon
                    name={aceitouTermos ? 'checkbox-marked' : 'checkbox-blank-outline'}
                    size={21}
                    color={aceitouTermos ? colors.primaria : colors.textoSecundario}
                  />
                  <Text style={styles.termsText}>
                    Li e aceito os <Text style={styles.termsLink}>Termos de uso</Text> e a <Text style={styles.termsLink}>Política de privacidade</Text> do Ludora.
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.footer}>
              <TouchableOpacity
                style={[styles.primaryButton, (!formularioValido || salvando) && styles.buttonDisabled]}
                onPress={criarConta}
                disabled={!formularioValido || salvando}
                activeOpacity={0.8}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>CRIAR CONTA</Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
