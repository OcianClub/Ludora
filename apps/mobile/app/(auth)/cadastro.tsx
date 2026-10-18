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
import { useRouter } from 'expo-router';
import type { SvgProps } from 'react-native-svg';
import { Icon } from '@ludora/icons';

import LogoArquivo from '@/assets/logo.svg';
import { BASE_URL } from '@/src/services/api';
import { fetchComTimeout } from '@/src/utils/request';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/cadastroStyles';
import { emailValido as validarEmail, lerRespostaAuth } from '@/src/utils/autenticacao';

const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

type CampoFocado = 'nome' | 'email' | 'senha' | 'confirmacao' | null;

export default function Cadastro() {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const router = useRouter();
  const emailRef = useRef<TextInput>(null);
  const senhaRef = useRef<TextInput>(null);
  const confirmacaoRef = useRef<TextInput>(null);
  const nomeRef = useRef<TextInput>(null);
  const scrollRef = useRef<ScrollView>(null);
  const envioEmAndamento = useRef(false);

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
  const [visitados, setVisitados] = useState<Record<string, boolean>>({});
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const mostrarErro = (campo: string) => tentouEnviar || visitados[campo];
  const sairDoCampo = (campo: string) => {
    setCampoFocado(null);
    setVisitados(atuais => ({ ...atuais, [campo]: true }));
  };

  const nomeValido = nome.trim().length >= 2 && nome.trim().length <= 100;
  const emailValido = validarEmail(email);
  const senhaValida = senha.length >= 8 && senha.length <= 128;
  const senhasIguais = confirmarSenha.length > 0 && senha === confirmarSenha;
  const formularioValido = nomeValido && emailValido && senhaValida && senhasIguais && aceitouTermos;

  function limparErro() {
    if (erro) setErro('');
  }

  async function criarConta() {
    if (envioEmAndamento.current) return;
    setTentouEnviar(true);
    if (!formularioValido) {
      if (!nomeValido) nomeRef.current?.focus();
      else if (!emailValido) emailRef.current?.focus();
      else if (!senhaValida) senhaRef.current?.focus();
      else if (!senhasIguais) confirmacaoRef.current?.focus();
      else setErro('Confirme o aceite dos termos para continuar.');
      return;
    }

    envioEmAndamento.current = true;
    Keyboard.dismiss();
    setCarregando(true);
    setErro('');

    try {
      const resposta = await fetchComTimeout(`${BASE_URL}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
        }),
      });
      await lerRespostaAuth(resposta, 'cadastro');

      router.replace({ pathname: '/(auth)/login', params: { cadastro: 'sucesso', email: email.trim().toLowerCase() } });
    } catch (error: any) {
      setErro(error.message || 'Não foi possível criar sua conta. Tente novamente.');
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
            style={styles.backButton}
            disabled={carregando}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Voltar"
          >
            <Icon name="arrow-left" size={22} color={colors.texto} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginTopButton}
            disabled={carregando}
            onPress={() => router.replace('/(auth)/login')}
            activeOpacity={0.7}
          >
            <Text style={styles.loginTopText}>Já tenho conta</Text>
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

            <Text style={styles.title}>Crie sua conta</Text>
            <Text style={styles.subtitle}>
              Acompanhe seus clubes, partidas e tudo o que acontece dentro de campo.
            </Text>
          </View>

          {!!erro && (
            <View style={styles.errorBox} accessibilityRole="alert" accessibilityLiveRegion="polite">
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
                mostrarErro('nome') && !nomeValido && styles.inputRowError,
              ]}>
                <Icon
                  name="account-outline"
                  size={20}
                  color={campoFocado === 'nome' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  ref={nomeRef}
                  editable={!carregando}
                  maxLength={100}
                  accessibilityLabel="Nome"
                  style={styles.input}
                  placeholder="Como você quer ser chamado?"
                  placeholderTextColor={colors.textoSecundario}
                  value={nome}
                  onChangeText={valor => { setNome(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('nome')}
                  onBlur={() => sairDoCampo('nome')}
                  autoCapitalize="words"
                  autoComplete="name"
                  textContentType="name"
                  returnKeyType="next"
                  onSubmitEditing={() => emailRef.current?.focus()}
                />
              </View>
              {mostrarErro('nome') && !nomeValido && <Text style={styles.fieldError}>Informe um nome com pelo menos 2 caracteres.</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>EMAIL</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'email' && styles.inputRowFocused,
                mostrarErro('email') && !emailValido && styles.inputRowError,
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
                  onBlur={() => sairDoCampo('email')}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="email"
                  textContentType="emailAddress"
                  returnKeyType="next"
                  onSubmitEditing={() => senhaRef.current?.focus()}
                />
              </View>
              {mostrarErro('email') && !emailValido && <Text style={styles.fieldError}>Informe um e-mail válido, como nome@exemplo.com.</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>SENHA</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'senha' && styles.inputRowFocused,
                mostrarErro('senha') && !senhaValida && styles.inputRowError,
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
                  accessibilityLabel="Crie uma senha"
                  style={styles.input}
                  placeholder="Crie uma senha"
                  placeholderTextColor={colors.textoSecundario}
                  value={senha}
                  onChangeText={valor => { setSenha(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('senha')}
                  onBlur={() => sairDoCampo('senha')}
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
              {mostrarErro('senha') && !senhaValida && <Text style={styles.fieldError}>Sua senha precisa ter pelo menos 8 caracteres.</Text>}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>CONFIRME A SENHA</Text>
              <View style={[
                styles.inputRow,
                campoFocado === 'confirmacao' && styles.inputRowFocused,
                mostrarErro('confirmacao') && !senhasIguais && styles.inputRowError,
              ]}>
                <Icon
                  name="lock-outline"
                  size={20}
                  color={campoFocado === 'confirmacao' ? colors.primaria : colors.textoSecundario}
                />
                <TextInput
                  ref={confirmacaoRef}
                  editable={!carregando}
                  maxLength={128}
                  autoCapitalize="none"
                  autoCorrect={false}
                  accessibilityLabel="Confirme a senha"
                  style={styles.input}
                  placeholder="Digite a senha novamente"
                  placeholderTextColor={colors.textoSecundario}
                  value={confirmarSenha}
                  onChangeText={valor => { setConfirmarSenha(valor); limparErro(); }}
                  onFocus={() => setCampoFocado('confirmacao')}
                  onBlur={() => sairDoCampo('confirmacao')}
                  secureTextEntry={!mostrarConfirmacao}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  returnKeyType="done"
                  onSubmitEditing={() => { Keyboard.dismiss(); }}
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
              {mostrarErro('confirmacao') && !senhasIguais && <Text style={styles.fieldError}>Digite a mesma senha nos dois campos.</Text>}
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
              disabled={carregando}
              onPress={() => { setAceitouTermos(valor => !valor); limparErro(); }}
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
            disabled={carregando}
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
            style={[styles.primaryButton, carregando && styles.primaryButtonDisabled]}
            onPress={criarConta}
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel={carregando ? 'Criando sua conta' : 'Criar conta'}
            accessibilityState={{ disabled: carregando, busy: carregando }}
            activeOpacity={0.85}
          >
            {carregando ? (
              <ActivityIndicator color={colors.textoSobrePrimaria} />
            ) : (
              <Text style={styles.primaryButtonText}>CRIAR CONTA</Text>
            )}
          </TouchableOpacity>

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Já possui uma conta? </Text>
            <TouchableOpacity disabled={carregando} onPress={() => router.replace('/(auth)/login')} activeOpacity={0.7}>
              <Text style={styles.loginLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
