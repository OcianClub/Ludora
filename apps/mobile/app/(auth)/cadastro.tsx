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
import type { SvgProps } from 'react-native-svg';
import { Icon } from '@ludora/icons';
import { colors } from '@ludora/design-tokens';

import LogoArquivo from '@/assets/logo.svg';
import { BASE_URL } from '@/src/services/api';
import { styles } from '@/src/styles/cadastroStyles';

const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

type CampoFocado = 'nome' | 'email' | 'senha' | 'confirmacao' | null;

export default function Cadastro() {
  const router = useRouter();
  const emailRef = useRef<TextInput>(null);
  const senhaRef = useRef<TextInput>(null);
  const confirmacaoRef = useRef<TextInput>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [aceitouTermos, setAceitouTermos] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [campoFocado, setCampoFocado] = useState<CampoFocado>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const nomeValido = nome.trim().length >= 2;
  const emailValido = /^\S+@\S+\.\S+$/.test(email.trim());
  const senhaValida = senha.length >= 8;
  const senhasIguais = confirmarSenha.length > 0 && senha === confirmarSenha;
  const formularioValido = nomeValido && emailValido && senhaValida && senhasIguais && aceitouTermos;

  function limparErro() {
    if (erro) setErro('');
  }

  async function criarConta() {
    if (!formularioValido || carregando) return;

    setCarregando(true);
    setErro('');

    try {
      const resposta = await fetch(`${BASE_URL}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          role: 'USER',
        }),
      });
      const dados = await resposta.json();

      if (!resposta.ok) {
        throw new Error(dados.error || 'Não foi possível criar sua conta.');
      }

      router.replace('/(auth)/login');
    } catch (error: any) {
      setErro(error.message || 'Não foi possível criar sua conta. Tente novamente.');
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
            style={styles.loginTopButton}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginTopText}>Já tenho conta</Text>
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

            <Text style={styles.title}>Crie sua conta</Text>
            <Text style={styles.subtitle}>
              Acompanhe seus clubes, partidas e tudo o que acontece dentro de campo.
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
              <Text style={styles.label}>NOME COMPLETO</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'nome' && styles.inputRowFocused,
                nome.length > 0 && !nomeValido && styles.inputRowError,
              ]}>
                <Icon
                  name="account-outline"
                  size={20}
                  color={campoFocado === 'nome' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Como você quer ser chamado?"
                  placeholderTextColor={colors.textoSecundario}
                  value={nome}
                  onChangeText={valor => { setNome(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('nome')}
                  onBlur={() => setCampoFocado(null)}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
            </View>

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
                  ref={emailRef}
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
              <Text style={styles.label}>SENHA</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'senha' && styles.inputRowFocused,
                senha.length > 0 && !senhaValida && styles.inputRowError,
              ]}>
                <Icon
                  name="lock-outline"
                  size={20}
                  color={campoFocado === 'senha' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  ref={senhaRef}
                  style={styles.input}
                  placeholder="Crie uma senha"
                  placeholderTextColor={colors.textoSecundario}
                  value={senha}
                  onChangeText={valor => { setSenha(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('senha')}
                  onBlur={() => setCampoFocado(null)}
                  secureTextEntry={!mostrarSenha}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="next"
                  onSubmitEditing={() => confirmacaoRef.current?.focus()}
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

            <View style={styles.field}>
              <Text style={styles.label}>CONFIRME A SENHA</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'confirmacao' && styles.inputRowFocused,
                confirmarSenha.length > 0 && !senhasIguais && styles.inputRowError,
              ]}>
                <Icon
                  name="lock-outline"
                  size={20}
                  color={campoFocado === 'confirmacao' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  ref={confirmacaoRef}
                  style={styles.input}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor={colors.textoSecundario}
                  value={confirmarSenha}
                  onChangeText={valor => { setConfirmarSenha(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('confirmacao')}
                  onBlur={() => setCampoFocado(null)}
                  secureTextEntry={!mostrarConfirmacao}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setMostrarConfirmacao(valor => !valor)}
                  accessibilityRole="button"
                  accessibilityLabel={mostrarConfirmacao ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                >
                  <Icon
                    name={mostrarConfirmacao ? 'eye-outline' : 'eye-off-outline'}
                    size={21}
                    color={colors.textoSecundario}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.requirements}>
              <View style={styles.requirementItem}>
                <Icon
                  name="check-circle-outline"
                  size={16}
                  color={senhaValida ? colors.primaria : colors.textoSecundario}
                />
                <Text style={[styles.requirementText, senhaValida && styles.requirementTextValid]}>
                  Mínimo de 8 caracteres
                </Text>
              </View>
              <View style={styles.requirementItem}>
                <Icon
                  name="check-circle-outline"
                  size={16}
                  color={senhasIguais ? colors.primaria : colors.textoSecundario}
                />
                <Text style={[styles.requirementText, senhasIguais && styles.requirementTextValid]}>
                  Senhas iguais
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => setAceitouTermos(valor => !valor)}
              activeOpacity={0.75}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: aceitouTermos }}
            >
              <Icon
                name={aceitouTermos ? 'checkbox-marked' : 'checkbox-blank-outline'}
                size={21}
                color={aceitouTermos ? colors.primaria : colors.textoSecundario}
              />
              <Text style={styles.termsText}>
                Li e aceito os <Text style={styles.termsLink}>Termos de uso</Text> e a{' '}
                <Text style={styles.termsLink}>Política de privacidade</Text> do Ludora.
              </Text>
            </TouchableOpacity>
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
              <Text style={styles.inviteTitle}>Recebeu um convite de um clube?</Text>
              <Text style={styles.inviteSubtitle}>Use o código para entrar como gestor ou técnico.</Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textoSecundario} />
          </TouchableOpacity>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, (!formularioValido || carregando) && styles.primaryButtonDisabled]}
            onPress={criarConta}
            disabled={!formularioValido || carregando}
            activeOpacity={0.85}
          >
            {carregando ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>CRIAR CONTA</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Já possui uma conta? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
