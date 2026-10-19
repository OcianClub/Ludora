import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
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
import type { SvgProps } from 'react-native-svg';
import { Icon } from '@ludora/icons';

import LogoArquivo from '@/assets/logo.svg';
import { BASE_URL } from '@/src/services/api';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/loginStyles';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { emailValido as validarEmail, enviarAutenticacao } from '@/src/utils/autenticacao';

const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

type CampoFocado = 'email' | 'senha' | null;

export default function Login() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const params = useLocalSearchParams<{ cadastro?: string; email?: string }>();
  const { limparClubeAtivo } = useClubeAtivo();
  const senhaRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const envioEmAndamento = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const [email, setEmail] = useState(params.email ?? '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [campoFocado, setCampoFocado] = useState<CampoFocado>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [emailVisitado, setEmailVisitado] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);

  const emailValido = validarEmail(email);
  const formularioValido = emailValido && senha.length > 0;

  function limparErro() {
    if (erro) setErro('');
  }

  async function entrar() {
    if (envioEmAndamento.current) return;
    setTentouEnviar(true);
    if (!formularioValido) {
      if (!emailValido) emailRef.current?.focus();
      else senhaRef.current?.focus();
      return;
    }

    envioEmAndamento.current = true;
    Keyboard.dismiss();
    setCarregando(true);
    setErro('');

    let autenticado = false;
    try {
      const dados = await enviarAutenticacao(`${BASE_URL}/auth/login`, { email: email.trim().toLowerCase(), senha }, 'login');
      autenticado = true;

      await SecureStore.deleteItemAsync('userToken');
      await limparClubeAtivo();
      await Promise.all([
        SecureStore.setItemAsync('userName', String(dados.nome || '')),
        SecureStore.setItemAsync('userCriadoEm', String(dados.criadoEm || '')),
        SecureStore.setItemAsync('userEmail', String(dados.email || '')),
      ]);

      await SecureStore.setItemAsync('userData', JSON.stringify({ clubes: Array.isArray(dados.clubes) ? dados.clubes : [] }));
      // Publica a sessão apenas depois de persistir o perfil com sucesso.
      await SecureStore.setItemAsync('userToken', dados.token);

      const convitePendente = await SecureStore.getItemAsync('convitePendente');
      if (convitePendente) {
        router.replace(`/convite/${convitePendente}`);
      } else {
        router.replace('/clubes');
      }
    } catch (error: any) {
      setErro(autenticado
        ? 'Seus dados foram confirmados, mas não conseguimos concluir o acesso neste aparelho. Tente entrar novamente.'
        : error.message || 'Não foi possível entrar. Tente novamente.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      envioEmAndamento.current = false;
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.navigation}>
          <TouchableOpacity
            style={styles.registerTopButton}
            disabled={carregando}
            onPress={() => router.push('/(auth)/cadastro')}
            activeOpacity={0.7}
          >
            <Text style={styles.registerTopText}>Criar conta</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.intro}>
            <View style={styles.brandRow}>
              <View style={styles.logoContainer}>
                <Logo width={42} height={42} />
              </View>
              <View>
                <Text style={styles.brandName}>LUDORA</Text>
                <Text style={styles.brandCaption}>SUA EXPERIÊNCIA NO FUTEBOL</Text>
              </View>
            </View>

            <Text style={styles.title}>Bem-vindo de volta</Text>
            <Text style={styles.subtitle}>
              Entre para acompanhar seus clubes, partidas e estatísticas.
            </Text>
          </View>

          {params.cadastro === 'sucesso' && !erro && (
            <View style={[styles.errorBox, { backgroundColor: colors.fundoBotao, borderColor: colors.bordaBotao }]} accessibilityRole="alert">
              <Icon name="check-circle-outline" size={20} color={colors.primaria} />
              <Text style={[styles.errorText, { color: colors.texto }]}>Conta criada! Entre com seu e-mail e senha para continuar.</Text>
            </View>
          )}
          {!!erro && (
            <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
              <Icon name="alert-circle-outline" size={20} color={colors.tituloErro} />
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          )}

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'email' && styles.inputRowFocused,
                ((emailVisitado && !!email.trim()) || tentouEnviar) && !emailValido && styles.inputRowError,
              ]}>
                <Icon
                  name="email-outline"
                  size={20}
                  color={campoFocado === 'email' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  ref={emailRef}
                  editable={!carregando}
                  maxLength={254}
                  accessibilityLabel="E-mail"
                  style={styles.input}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={colors.textoSecundario}
                  value={email}
                  onChangeText={valor => { setEmail(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('email')}
                  onBlur={() => { setCampoFocado(null); setEmailVisitado(true); }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => senhaRef.current?.focus()}
                />
              </View>
              {((emailVisitado && !!email.trim()) || tentouEnviar) && !emailValido && <Text style={styles.fieldError} accessibilityLiveRegion="polite">{email.trim() ? 'Digite um e-mail válido, como nome@exemplo.com.' : 'Informe seu e-mail para entrar.'}</Text>}
            </View>

            <View style={styles.field}>
              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>SENHA</Text>
              </View>
              <View style={[
                styles.inputRow,
                campoFocado === 'senha' && styles.inputRowFocused,
              ]}>
                <Icon
                  name="lock-outline"
                  size={20}
                  color={campoFocado === 'senha' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  ref={senhaRef}
                  editable={!carregando}
                  maxLength={128}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Senha"
                  style={styles.input}
                  placeholder="Digite sua senha"
                  placeholderTextColor={colors.textoSecundario}
                  value={senha}
                  onChangeText={valor => { setSenha(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('senha')}
                  onBlur={() => setCampoFocado(null)}
                  secureTextEntry={!mostrarSenha}
                  autoComplete="current-password"
                  textContentType="password"
                  returnKeyType="done"
                  onSubmitEditing={entrar}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setMostrarSenha(valor => !valor)}
                  accessibilityRole="button"
                  accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  <Icon
                    name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                    size={21}
                    color={colors.textoSecundario}
                  />
                </TouchableOpacity>
              </View>
              {tentouEnviar && !senha && <Text style={styles.fieldError}>Informe sua senha para entrar.</Text>}
            </View>
          </View>

          <TouchableOpacity
            style={styles.inviteCard}
            disabled={carregando}
            onPress={() => router.push('/convite')}
            activeOpacity={0.75}
          >
            <View style={styles.inviteIcon}>
              <Icon name="shield-check" size={22} color={colors.primaria} />
            </View>
            <View style={styles.inviteCopy}>
              <Text style={styles.inviteTitle}>Tem um código de convite?</Text>
              <Text style={styles.inviteSubtitle}>Consulte o convite e entre para a equipe do clube.</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textoSecundario} />
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, carregando && styles.primaryButtonDisabled]}
            onPress={entrar}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel={carregando ? 'Entrando na sua conta' : 'Entrar'}
            accessibilityState={{ disabled: carregando, busy: carregando }}
            activeOpacity={0.85}
          >
            {carregando ? (
              <ActivityIndicator color={colors.textoSobrePrimaria} />
            ) : (
              <Text style={styles.primaryButtonText}>ENTRAR</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>Ainda não tem uma conta? </Text>
            <TouchableOpacity disabled={carregando} onPress={() => router.push('/(auth)/cadastro')} activeOpacity={0.7}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
