import React, { useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import type { SvgProps } from 'react-native-svg';
import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';

import LogoArquivo from '@/assets/logo.svg';
import { BASE_URL } from '@/src/services/api';
import { styles } from '@/src/styles/loginStyles';

const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

type CampoFocado = 'email' | 'senha' | null;

export default function Login() {
  const router = useRouter();
  const senhaRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [campoFocado, setCampoFocado] = useState<CampoFocado>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const emailValido = /^\S+@\S+\.\S+$/.test(email.trim());
  const formularioValido = emailValido && senha.length > 0;

  function limparErro() {
    if (erro) setErro('');
  }

  async function entrar() {
    if (!formularioValido || carregando) return;

    setCarregando(true);
    setErro('');

    try {
      const resposta = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.error || 'Não foi possível entrar. Confira seus dados.');
      }

      await Promise.all([
        SecureStore.setItemAsync('userToken', String(dados.token || '')),
        SecureStore.setItemAsync('userName', String(dados.nome || '')),
        SecureStore.setItemAsync('userCriadoEm', String(dados.criadoEm || '')),
        SecureStore.setItemAsync('userEmail', String(dados.email || '')),
      ]);

      if (dados.clubes) {
        await SecureStore.setItemAsync('userData', JSON.stringify({ clubes: dados.clubes }));
      }

      const convitePendente = await SecureStore.getItemAsync('convitePendente');
      if (convitePendente) {
        router.replace(`/convite/${convitePendente}`);
      } else {
        router.replace('/clubes');
      }
    } catch (error: any) {
      setErro(error.message || 'Não foi possível entrar. Tente novamente.');
    } finally {
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
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name="arrow-left" size={22} color={colors.texto} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.registerTopButton}
            onPress={() => router.push('/(auth)/cadastro')}
            activeOpacity={0.7}
          >
            <Text style={styles.registerTopText}>Criar conta</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
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

          {!!erro && (
            <View style={styles.errorBox}>
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
                email.length > 0 && !emailValido && styles.inputRowError,
              ]}>
                <Icon
                  name="email-outline"
                  size={20}
                  color={campoFocado === 'email' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  style={styles.input}
                  placeholder="email@exemplo.com"
                  placeholderTextColor={colors.textoSecundario}
                  value={email}
                  onChangeText={valor => { setEmail(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('email')}
                  onBlur={() => setCampoFocado(null)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => senhaRef.current?.focus()}
                />
              </View>
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
            </View>
          </View>

          <TouchableOpacity
            style={styles.inviteCard}
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
            style={[styles.primaryButton, (!formularioValido || carregando) && styles.primaryButtonDisabled]}
            onPress={entrar}
            disabled={!formularioValido || carregando}
            activeOpacity={0.85}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>ENTRAR</Text>
            )}
          </TouchableOpacity>

          <View style={styles.registerRow}>
            <Text style={styles.registerPrompt}>Ainda não tem uma conta? </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')} activeOpacity={0.7}>
              <Text style={styles.registerLink}>Cadastre-se</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
