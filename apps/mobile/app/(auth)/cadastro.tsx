import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  BackHandler,
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
import { useFocusEffect, useRouter } from 'expo-router';
import type { SvgProps } from 'react-native-svg';
import { Icon } from '@ludora/icons';

import LogoArquivo from '@/assets/logo.svg';
import { BASE_URL } from '@/src/services/api';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/cadastroStyles';
import {
  emailValido as validarEmail,
  enviarAutenticacao,
} from '@/src/utils/autenticacao';
import { solicitarCodigoCadastro } from '@/src/features/auth/cadastro.api';
import {
  codigoSenhaValido,
  normalizarCodigoSenha,
  senhaRecuperacaoValida,
} from '@/src/utils/recuperacaoSenha';

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
  const [etapa, setEtapa] = useState<1 | 2 | 3>(1);
  const [codigo, setCodigo] = useState('');
  const [cadastroId, setCadastroId] = useState('');
  const [emailDoCodigo, setEmailDoCodigo] = useState('');
  const [reenviarEm, setReenviarEm] = useState(0);
  const [segundosReenvio, setSegundosReenvio] = useState(0);
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const atualizar = () =>
      setSegundosReenvio(
        Math.max(0, Math.ceil((reenviarEm - Date.now()) / 1000))
      );
    atualizar();
    if (!reenviarEm) return;
    const intervalo = setInterval(atualizar, 1000);
    return () => clearInterval(intervalo);
  }, [reenviarEm]);
  const valoresCampos = {
    nome: nome.trim(),
    email: email.trim(),
    senha,
    confirmacao: confirmarSenha,
  };
  const mostrarErro = (campo: keyof typeof valoresCampos) =>
    tentouEnviar || (visitados[campo] && valoresCampos[campo].length > 0);
  const sairDoCampo = (campo: string) => {
    setCampoFocado(null);
    setVisitados((atuais) => ({ ...atuais, [campo]: true }));
  };

  const nomeValido = nome.trim().length >= 2 && nome.trim().length <= 100;
  const emailValido = validarEmail(email);
  const senhaValida = senhaRecuperacaoValida(senha);
  const senhasIguais = confirmarSenha.length > 0 && senha === confirmarSenha;
  const formularioValido =
    nomeValido && emailValido && senhaValida && senhasIguais && aceitouTermos;

  function limparErro() {
    if (erro) setErro('');
  }

  function mudarEtapa(proxima: 1 | 2 | 3) {
    Keyboard.dismiss();
    setCampoFocado(null);
    setErro('');
    setAviso('');
    setTentouEnviar(false);
    setEtapa(proxima);
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (envioEmAndamento.current) return true;
          if (etapa > 1) {
            mudarEtapa(etapa === 3 ? 2 : 1);
            return true;
          }
          return false;
        }
      );
      return () => subscription.remove();
    }, [etapa])
  );

  function continuar() {
    setTentouEnviar(true);
    if (!nomeValido) {
      nomeRef.current?.focus();
      return;
    }
    if (!emailValido) {
      emailRef.current?.focus();
      return;
    }
    mudarEtapa(2);
  }

  async function enviarCodigo() {
    if (envioEmAndamento.current) return;
    setTentouEnviar(true);
    if (!formularioValido) {
      if (!senhaValida) senhaRef.current?.focus();
      else if (!senhasIguais) confirmacaoRef.current?.focus();
      else scrollRef.current?.scrollToEnd({ animated: true });
      return;
    }
    if (
      etapa === 2 &&
      cadastroId &&
      emailDoCodigo === email.trim().toLowerCase()
    ) {
      mudarEtapa(3);
      return;
    }
    if (etapa === 3 && Date.now() < reenviarEm) return;
    envioEmAndamento.current = true;
    setCarregando(true);
    setErro('');
    setAviso('');
    Keyboard.dismiss();
    try {
      const id = await solicitarCodigoCadastro(email);
      setCadastroId(id);
      setEmailDoCodigo(email.trim().toLowerCase());
      setCodigo('');
      setReenviarEm(Date.now() + 60_000);
      mudarEtapa(3);
      setAviso('Código enviado. Confira também a caixa de spam.');
    } catch (error: any) {
      setErro(
        error.message || 'Não foi possível enviar o código. Tente novamente.'
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      envioEmAndamento.current = false;
      setCarregando(false);
    }
  }

  async function criarConta() {
    if (envioEmAndamento.current) return;
    setTentouEnviar(true);
    if (!codigoSenhaValido(codigo)) return;
    if (!formularioValido) {
      if (!nomeValido) nomeRef.current?.focus();
      else if (!emailValido) emailRef.current?.focus();
      else if (!senhaValida) senhaRef.current?.focus();
      else if (!senhasIguais) confirmacaoRef.current?.focus();
      else {
        Keyboard.dismiss();
        scrollRef.current?.scrollToEnd({ animated: true });
      }
      return;
    }

    envioEmAndamento.current = true;
    Keyboard.dismiss();
    setCarregando(true);
    setErro('');

    try {
      await enviarAutenticacao(
        `${BASE_URL}/auth/registrar`,
        {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          codigo: normalizarCodigoSenha(codigo),
          cadastro_id: cadastroId,
        },
        'cadastro'
      );

      setSenha('');
      setConfirmarSenha('');
      setCodigo('');
      setCadastroId('');
      router.replace({
        pathname: '/(auth)/login',
        params: { cadastro: 'sucesso', email: email.trim().toLowerCase() },
      });
    } catch (error: any) {
      setErro(
        error.message || 'Não foi possível criar sua conta. Tente novamente.'
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      envioEmAndamento.current = false;
      setCarregando(false);
    }
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.navigation}>
          <TouchableOpacity
            style={styles.backButton}
            disabled={carregando}
            onPress={() =>
              etapa > 1
                ? mudarEtapa(etapa === 3 ? 2 : 1)
                : router.canGoBack()
                  ? router.back()
                  : router.replace('/(auth)/login')
            }
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={
              etapa > 1 ? 'Voltar à etapa anterior' : 'Voltar'
            }
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
                <Text style={styles.brandCaption}>
                  SUA EXPERIÊNCIA NO FUTEBOL
                </Text>
              </View>
            </View>

            <View
              style={styles.stepRow}
              accessibilityLabel={`Etapa ${etapa} de 3: ${etapa === 1 ? 'Dados da conta' : etapa === 2 ? 'Segurança' : 'Confirmar e-mail'}`}
            >
              <Text style={styles.stepText}>ETAPA {etapa} DE 3</Text>
              <View style={styles.stepTracks}>
                <View style={[styles.stepTrack, styles.stepTrackActive]} />
                <View
                  style={[
                    styles.stepTrack,
                    etapa >= 2 && styles.stepTrackActive,
                  ]}
                />
                <View
                  style={[
                    styles.stepTrack,
                    etapa === 3 && styles.stepTrackActive,
                  ]}
                />
              </View>
            </View>
            <Text style={styles.title}>
              {etapa === 1
                ? 'Crie sua conta'
                : etapa === 2
                  ? 'Proteja sua conta'
                  : 'Confirme seu e-mail'}
            </Text>
            <Text style={styles.subtitle}>
              {etapa === 1
                ? 'Vamos começar pelo seu nome e e-mail.'
                : etapa === 2
                  ? 'Escolha uma senha para acessar o Ludora.'
                  : 'Informe os 8 caracteres recebidos por e-mail. O código vale por 15 minutos.'}
            </Text>
          </View>

          {!!erro && (
            <View
              style={styles.errorBox}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Icon
                name="alert-circle-outline"
                size={20}
                color={colors.tituloErro}
              />
              <Text style={styles.errorText}>{erro}</Text>
            </View>
          )}

          {!!aviso && (
            <Text style={styles.fieldError} accessibilityLiveRegion="polite">
              {aviso}
            </Text>
          )}

          <View style={styles.form}>
            {etapa === 1 ? (
              <>
                <View style={styles.field}>
                  <Text style={styles.label}>NOME COMPLETO</Text>
                  <View
                    style={[
                      styles.inputRow,
                      campoFocado === 'nome' && styles.inputRowFocused,
                      mostrarErro('nome') &&
                        !nomeValido &&
                        styles.inputRowError,
                    ]}
                  >
                    <Icon
                      name="account-outline"
                      size={20}
                      color={
                        campoFocado === 'nome'
                          ? colors.primaria
                          : colors.textoSecundario
                      }
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
                      onChangeText={(valor) => {
                        setNome(valor);
                        limparErro();
                      }}
                      onFocus={() => setCampoFocado('nome')}
                      onBlur={() => sairDoCampo('nome')}
                      autoCapitalize="words"
                      autoComplete="name"
                      textContentType="name"
                      returnKeyType="next"
                      onSubmitEditing={() => emailRef.current?.focus()}
                    />
                  </View>
                  {mostrarErro('nome') && !nomeValido && (
                    <Text
                      style={styles.fieldError}
                      accessibilityLiveRegion="polite"
                    >
                      {nome.trim()
                        ? 'Seu nome precisa ter pelo menos 2 caracteres.'
                        : 'Informe seu nome para continuar.'}
                    </Text>
                  )}
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>EMAIL</Text>
                  <View
                    style={[
                      styles.inputRow,
                      campoFocado === 'email' && styles.inputRowFocused,
                      mostrarErro('email') &&
                        !emailValido &&
                        styles.inputRowError,
                    ]}
                  >
                    <Icon
                      name="email-outline"
                      size={20}
                      color={
                        campoFocado === 'email'
                          ? colors.primaria
                          : colors.textoSecundario
                      }
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
                      onChangeText={(valor) => {
                        setEmail(valor);
                        limparErro();
                      }}
                      onFocus={() => setCampoFocado('email')}
                      onBlur={() => sairDoCampo('email')}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      returnKeyType="next"
                      onSubmitEditing={continuar}
                    />
                  </View>
                  {mostrarErro('email') && !emailValido && (
                    <Text
                      style={styles.fieldError}
                      accessibilityLiveRegion="polite"
                    >
                      {email.trim()
                        ? 'Digite um e-mail válido, como nome@exemplo.com.'
                        : 'Informe seu e-mail para continuar.'}
                    </Text>
                  )}
                </View>
              </>
            ) : etapa === 2 ? (
              <>
                <TouchableOpacity
                  style={styles.accountSummary}
                  onPress={() => mudarEtapa(1)}
                  disabled={carregando}
                  accessibilityRole="button"
                  accessibilityLabel={`Editar e-mail ${email.trim()}`}
                >
                  <View style={styles.inviteCopy}>
                    <Text style={styles.summaryLabel}>SUA CONTA</Text>
                    <Text style={styles.inviteTitle}>{email.trim()}</Text>
                  </View>
                  <Text style={styles.termsLink}>Editar</Text>
                </TouchableOpacity>
                <View style={styles.field}>
                  <Text style={styles.label}>SENHA</Text>
                  <View
                    style={[
                      styles.inputRow,
                      campoFocado === 'senha' && styles.inputRowFocused,
                      mostrarErro('senha') &&
                        !senhaValida &&
                        styles.inputRowError,
                    ]}
                  >
                    <Icon
                      name="lock-outline"
                      size={20}
                      color={
                        campoFocado === 'senha'
                          ? colors.primaria
                          : colors.textoSecundario
                      }
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
                      onChangeText={(valor) => {
                        setSenha(valor);
                        limparErro();
                      }}
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
                      onPress={() => setMostrarSenha((valor) => !valor)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'
                      }
                    >
                      <Icon
                        name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                        size={21}
                        color={colors.textoSecundario}
                      />
                    </TouchableOpacity>
                  </View>
                  <Text
                    style={[
                      styles.requirementText,
                      senhaValida && styles.requirementTextValid,
                    ]}
                    accessibilityLiveRegion="polite"
                  >
                    {mostrarErro('senha') && !senha
                      ? 'Crie uma senha para proteger sua conta.'
                      : senhaValida
                        ? 'Sua senha atende aos requisitos.'
                        : senha.length >= 8
                          ? 'Sua senha é muito longa. Use uma senha menor.'
                          : 'Use pelo menos 8 caracteres.'}
                  </Text>
                </View>

                <View style={styles.field}>
                  <Text style={styles.label}>CONFIRME A SENHA</Text>
                  <View
                    style={[
                      styles.inputRow,
                      campoFocado === 'confirmacao' && styles.inputRowFocused,
                      mostrarErro('confirmacao') &&
                        !senhasIguais &&
                        styles.inputRowError,
                    ]}
                  >
                    <Icon
                      name="lock-outline"
                      size={20}
                      color={
                        campoFocado === 'confirmacao'
                          ? colors.primaria
                          : colors.textoSecundario
                      }
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
                      onChangeText={(valor) => {
                        setConfirmarSenha(valor);
                        limparErro();
                      }}
                      onFocus={() => setCampoFocado('confirmacao')}
                      onBlur={() => sairDoCampo('confirmacao')}
                      secureTextEntry={!mostrarConfirmacao}
                      autoComplete="new-password"
                      textContentType="newPassword"
                      returnKeyType="done"
                      onSubmitEditing={() => {
                        Keyboard.dismiss();
                      }}
                    />
                    <TouchableOpacity
                      style={styles.eyeButton}
                      onPress={() => setMostrarConfirmacao((valor) => !valor)}
                      accessibilityRole="button"
                      accessibilityLabel={
                        mostrarConfirmacao
                          ? 'Ocultar confirmação'
                          : 'Mostrar confirmação'
                      }
                    >
                      <Icon
                        name={
                          mostrarConfirmacao ? 'eye-outline' : 'eye-off-outline'
                        }
                        size={21}
                        color={colors.textoSecundario}
                      />
                    </TouchableOpacity>
                  </View>
                  {mostrarErro('confirmacao') && !senhasIguais && (
                    <Text
                      style={styles.fieldError}
                      accessibilityLiveRegion="polite"
                    >
                      {confirmarSenha
                        ? 'As senhas não coincidem. Digite a mesma senha nos dois campos.'
                        : 'Digite sua senha novamente para confirmar.'}
                    </Text>
                  )}
                </View>

                <View style={styles.requirements}>
                  {senhasIguais && (
                    <View style={styles.requirementItem}>
                      <Icon
                        name="check-circle-outline"
                        size={16}
                        color={
                          senhasIguais
                            ? colors.primaria
                            : colors.textoSecundario
                        }
                      />
                      <Text
                        style={[
                          styles.requirementText,
                          senhasIguais && styles.requirementTextValid,
                        ]}
                      >
                        Senhas iguais
                      </Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.termsRow}
                  disabled={carregando}
                  onPress={() => {
                    setAceitouTermos((valor) => !valor);
                    limparErro();
                  }}
                  activeOpacity={0.75}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: aceitouTermos }}
                >
                  <Icon
                    name={
                      aceitouTermos
                        ? 'checkbox-marked'
                        : 'checkbox-blank-outline'
                    }
                    size={21}
                    color={
                      aceitouTermos ? colors.primaria : colors.textoSecundario
                    }
                  />
                  <Text style={styles.termsText}>
                    Li e aceito os{' '}
                    <Text style={styles.termsLink}>Termos de uso</Text> e a{' '}
                    <Text style={styles.termsLink}>
                      Política de privacidade
                    </Text>{' '}
                    do Ludora.
                  </Text>
                </TouchableOpacity>
                {tentouEnviar && !aceitouTermos && (
                  <Text
                    style={styles.fieldError}
                    accessibilityLiveRegion="polite"
                  >
                    Aceite os Termos de uso e a Política de privacidade para
                    criar sua conta.
                  </Text>
                )}
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={styles.accountSummary}
                  onPress={() => mudarEtapa(1)}
                  disabled={carregando}
                  accessibilityRole="button"
                  accessibilityLabel="Corrigir e-mail"
                >
                  <View style={styles.inviteCopy}>
                    <Text style={styles.summaryLabel}>ENVIADO PARA</Text>
                    <Text style={styles.inviteTitle}>{email.trim()}</Text>
                  </View>
                  <Text style={styles.termsLink}>Editar</Text>
                </TouchableOpacity>
                <View style={styles.field}>
                  <Text style={styles.label}>CÓDIGO DE CONFIRMAÇÃO</Text>
                  <View style={styles.inputRow}>
                    <Icon
                      name="shield-check"
                      size={20}
                      color={colors.primaria}
                    />
                    <TextInput
                      style={styles.input}
                      value={codigo}
                      onChangeText={(valor) => {
                        setCodigo(normalizarCodigoSenha(valor).slice(0, 8));
                        limparErro();
                      }}
                      editable={!carregando}
                      placeholder="ABCD2345"
                      placeholderTextColor={colors.textoSecundario}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      autoComplete="one-time-code"
                      textContentType="oneTimeCode"
                      accessibilityLabel="Código de confirmação recebido por e-mail"
                      returnKeyType="done"
                      onSubmitEditing={criarConta}
                    />
                  </View>
                  <Text
                    style={styles.fieldError}
                    accessibilityLiveRegion="polite"
                  >
                    {tentouEnviar && !codigoSenhaValido(codigo)
                      ? 'Informe os 8 caracteres do código recebido por e-mail.'
                      : 'Pode colar o código com ou sem o hífen.'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.resendButton}
                  onPress={enviarCodigo}
                  disabled={carregando || segundosReenvio > 0}
                  accessibilityRole="button"
                  accessibilityState={{
                    disabled: carregando || segundosReenvio > 0,
                  }}
                >
                  <Text
                    style={[
                      styles.termsLink,
                      (carregando || segundosReenvio > 0) && styles.fieldError,
                    ]}
                  >
                    {segundosReenvio > 0
                      ? `Reenviar código em ${segundosReenvio}s`
                      : 'Não recebi o código. Reenviar'}
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              carregando && styles.primaryButtonDisabled,
            ]}
            onPress={
              etapa === 1 ? continuar : etapa === 2 ? enviarCodigo : criarConta
            }
            disabled={carregando}
            accessibilityRole="button"
            accessibilityLabel={
              carregando
                ? 'Aguarde'
                : etapa === 1
                  ? 'Continuar para segurança'
                  : etapa === 2
                    ? 'Enviar código de confirmação'
                    : 'Confirmar e criar conta'
            }
            accessibilityState={{ disabled: carregando, busy: carregando }}
            activeOpacity={0.85}
          >
            {carregando ? (
              <ActivityIndicator color={colors.textoSobrePrimaria} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {etapa === 1
                  ? 'CONTINUAR'
                  : etapa === 2
                    ? 'ENVIAR CÓDIGO'
                    : 'CONFIRMAR E CRIAR CONTA'}
              </Text>
            )}
          </TouchableOpacity>

          {etapa === 1 && (
            <TouchableOpacity
              style={styles.inviteCard}
              disabled={carregando}
              onPress={() => router.push('/convite')}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Entrar com código de convite"
            >
              <Icon name="shield-check" size={20} color={colors.primaria} />
              <Text style={styles.inviteButtonText}>
                Entrar com código de convite
              </Text>
              <Icon name="chevron-right" size={18} color={colors.primaria} />
            </TouchableOpacity>
          )}

          <View style={styles.loginRow}>
            <Text style={styles.loginPrompt}>Já possui uma conta? </Text>
            <TouchableOpacity
              disabled={carregando}
              onPress={() => router.replace('/(auth)/login')}
              activeOpacity={0.7}
            >
              <Text style={styles.loginLink}>Entrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
