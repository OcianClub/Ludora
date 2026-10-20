import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Icon } from '@ludora/icons';

import { useTheme } from '@/src/contexts/ThemeContext';
import {
  redefinirSenha,
  solicitarCodigoSenha,
} from '@/src/features/auth/recuperacao.api';
import { createStyles } from '@/src/styles/recuperarSenhaStyles';
import { emailValido } from '@/src/utils/autenticacao';
import {
  codigoSenhaValido,
  senhaRecuperacaoValida,
} from '@/src/utils/recuperacaoSenha';

type Etapa = 'email' | 'senha' | 'sucesso';

export default function RecuperarSenha() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [etapa, setEtapa] = useState<Etapa>('email');
  const [email, setEmail] = useState(params.email ?? '');
  const [codigo, setCodigo] = useState('');
  const [senha, setSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [tentouEnviar, setTentouEnviar] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [mostrarConfirmacao, setMostrarConfirmacao] = useState(false);
  const [focado, setFocado] = useState('');
  const [reenvioEm, setReenvioEm] = useState(0);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  const enviando = useRef(false);
  const scrollRef = useRef<ScrollView>(null);
  const emailRef = useRef<TextInput>(null);
  const codigoRef = useRef<TextInput>(null);
  const senhaRef = useRef<TextInput>(null);
  const confirmacaoRef = useRef<TextInput>(null);

  const senhaValida = senhaRecuperacaoValida(senha);
  const senhasIguais = Boolean(confirmacao) && senha === confirmacao;

  useEffect(() => {
    if (!reenvioEm) return;
    const atualizar = () => {
      const restante = Math.max(0, Math.ceil((reenvioEm - Date.now()) / 1000));
      setSegundosRestantes(restante);
      return restante;
    };
    atualizar();
    const timer = setInterval(() => {
      if (!atualizar()) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [reenvioEm]);

  function irParaEmail() {
    Keyboard.dismiss();
    setEtapa('email');
    setErro('');
    setTentouEnviar(false);
  }

  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener(
        'hardwareBackPress',
        () => {
          if (enviando.current) return true;
          if (etapa === 'senha') {
            irParaEmail();
            return true;
          }
          return false;
        }
      );
      return () => subscription.remove();
    }, [etapa])
  );

  function voltar() {
    if (etapa === 'senha') return irParaEmail();
    if (router.canGoBack()) router.back();
    else router.replace('/(auth)/login');
  }

  async function solicitar(reenvio = false) {
    if (enviando.current || (reenvio && Date.now() < reenvioEm)) return;
    setTentouEnviar(true);
    if (!emailValido(email)) {
      emailRef.current?.focus();
      return;
    }

    enviando.current = true;
    setCarregando(true);
    setErro('');
    Keyboard.dismiss();
    try {
      await solicitarCodigoSenha(email);
      setEmail(email.trim().toLowerCase());
      setEtapa('senha');
      setCodigo('');
      if (!reenvio) {
        setSenha('');
        setConfirmacao('');
      }
      setReenvioEm(Date.now() + 60_000);
      setSegundosRestantes(60);
      setTentouEnviar(false);
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível solicitar o código.'
      );
    } finally {
      enviando.current = false;
      setCarregando(false);
    }
  }

  async function salvar() {
    if (enviando.current) return;
    setTentouEnviar(true);
    if (!codigoSenhaValido(codigo)) {
      codigoRef.current?.focus();
      return;
    }
    if (!senhaValida) {
      senhaRef.current?.focus();
      return;
    }
    if (!senhasIguais) {
      confirmacaoRef.current?.focus();
      return;
    }

    enviando.current = true;
    setCarregando(true);
    setErro('');
    Keyboard.dismiss();
    try {
      await redefinirSenha(email, codigo, senha);
      setSenha('');
      setConfirmacao('');
      setCodigo('');
      setEtapa('sucesso');
    } catch (error) {
      setErro(
        error instanceof Error
          ? error.message
          : 'Não foi possível alterar sua senha.'
      );
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      enviando.current = false;
      setCarregando(false);
    }
  }

  function entrar() {
    router.replace({
      pathname: '/(auth)/login',
      params: etapa === 'sucesso' ? { email, senha: 'redefinida' } : { email },
    });
  }

  const titulos = {
    email: 'Esqueceu sua senha?',
    senha: 'Defina uma nova senha',
    sucesso: 'Acesso recuperado',
  };

  return (
    <SafeAreaView
      style={styles.container}
      edges={['top', 'bottom', 'left', 'right']}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.navigation}>
          {etapa !== 'sucesso' && (
            <TouchableOpacity
              style={styles.backButton}
              disabled={carregando}
              onPress={voltar}
              accessibilityRole="button"
              accessibilityLabel="Voltar"
            >
              <Icon name="arrow-left" size={22} color={colors.texto} />
            </TouchableOpacity>
          )}
        </View>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View>
            <View style={styles.heroIcon}>
              <Icon
                name={
                  etapa === 'sucesso' ? 'check-circle-outline' : 'lock-outline'
                }
                size={28}
                color={colors.primaria}
              />
            </View>
            <Text style={styles.title}>{titulos[etapa]}</Text>
            <Text style={styles.subtitle}>
              {etapa === 'email'
                ? 'Informe o e-mail da sua conta. Você poderá redefinir a senha com um código recebido por e-mail.'
                : etapa === 'senha'
                  ? 'Se houver uma conta com este e-mail, enviaremos um código válido por 15 minutos. Confira também a pasta de spam.'
                  : 'Sua senha foi alterada e as sessões anteriores foram encerradas. Entre com a nova senha para continuar.'}
            </Text>
          </View>

          {!!erro && (
            <View
              style={styles.feedback}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite"
            >
              <Icon
                name="alert-circle-outline"
                size={20}
                color={colors.tituloErro}
              />
              <Text style={styles.feedbackText}>{erro}</Text>
            </View>
          )}

          {etapa === 'email' && (
            <View style={styles.field}>
              <Text style={styles.label}>E-MAIL DA CONTA</Text>
              <View
                style={[
                  styles.inputRow,
                  focado === 'email' && styles.inputFocused,
                ]}
              >
                <Icon
                  name="email-outline"
                  size={20}
                  color={colors.textoSecundario}
                />
                <TextInput
                  ref={emailRef}
                  style={styles.input}
                  value={email}
                  editable={!carregando}
                  maxLength={254}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                  placeholder="email@exemplo.com"
                  placeholderTextColor={colors.textoSecundario}
                  accessibilityLabel="E-mail da conta"
                  onChangeText={(valor) => {
                    setEmail(valor);
                    setErro('');
                  }}
                  onFocus={() => setFocado('email')}
                  onBlur={() => setFocado('')}
                  returnKeyType="send"
                  onSubmitEditing={() => void solicitar()}
                />
              </View>
              {tentouEnviar && !emailValido(email) && (
                <Text style={styles.hint}>
                  {email.trim()
                    ? 'Digite um e-mail válido, como nome@exemplo.com.'
                    : 'Informe o e-mail da sua conta.'}
                </Text>
              )}
            </View>
          )}

          {etapa === 'senha' && (
            <View style={styles.form}>
              <View style={styles.emailRow}>
                <Text style={styles.emailText}>{email}</Text>
                <TouchableOpacity
                  style={styles.smallButton}
                  onPress={irParaEmail}
                  disabled={carregando}
                  accessibilityRole="button"
                  accessibilityLabel="Alterar e-mail"
                >
                  <Text style={styles.link}>Alterar</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>CÓDIGO RECEBIDO</Text>
                <View
                  style={[
                    styles.inputRow,
                    focado === 'codigo' && styles.inputFocused,
                  ]}
                >
                  <TextInput
                    ref={codigoRef}
                    style={[styles.input, styles.codeInput]}
                    value={codigo}
                    editable={!carregando}
                    placeholder="ABCD-2345"
                    placeholderTextColor={colors.textoSecundario}
                    maxLength={9}
                    autoCorrect={false}
                    autoCapitalize="characters"
                    autoComplete="one-time-code"
                    textContentType="oneTimeCode"
                    accessibilityLabel="Código de recuperação com 8 caracteres"
                    onChangeText={(valor) => {
                      setCodigo(valor.toUpperCase().replace(/[^A-Z0-9-]/g, ''));
                      setErro('');
                    }}
                    onFocus={() => setFocado('codigo')}
                    onBlur={() => setFocado('')}
                    returnKeyType="next"
                    onSubmitEditing={() => senhaRef.current?.focus()}
                  />
                </View>
                {tentouEnviar && !codigoSenhaValido(codigo) && (
                  <Text style={styles.hint}>
                    Confira os 8 caracteres do código recebido por e-mail.
                  </Text>
                )}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>NOVA SENHA</Text>
                <View
                  style={[
                    styles.inputRow,
                    focado === 'senha' && styles.inputFocused,
                  ]}
                >
                  <Icon
                    name="lock-outline"
                    size={20}
                    color={colors.textoSecundario}
                  />
                  <TextInput
                    ref={senhaRef}
                    style={styles.input}
                    value={senha}
                    editable={!carregando}
                    placeholder="Crie uma nova senha"
                    placeholderTextColor={colors.textoSecundario}
                    maxLength={72}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    secureTextEntry={!mostrarSenha}
                    accessibilityLabel="Nova senha"
                    onChangeText={(valor) => {
                      setSenha(valor);
                      setErro('');
                    }}
                    onFocus={() => setFocado('senha')}
                    onBlur={() => setFocado('')}
                    returnKeyType="next"
                    onSubmitEditing={() => confirmacaoRef.current?.focus()}
                  />
                  <TouchableOpacity
                    style={styles.smallButton}
                    disabled={carregando}
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
                <Text style={styles.hint}>
                  {tentouEnviar && !senhaValida && senha.length >= 8
                    ? 'Sua senha é muito longa. Use uma senha menor.'
                    : 'Use pelo menos 8 caracteres.'}
                </Text>
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>CONFIRME A NOVA SENHA</Text>
                <View
                  style={[
                    styles.inputRow,
                    focado === 'confirmacao' && styles.inputFocused,
                  ]}
                >
                  <Icon
                    name="lock-outline"
                    size={20}
                    color={colors.textoSecundario}
                  />
                  <TextInput
                    ref={confirmacaoRef}
                    style={styles.input}
                    value={confirmacao}
                    editable={!carregando}
                    placeholder="Digite a senha novamente"
                    placeholderTextColor={colors.textoSecundario}
                    maxLength={72}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="new-password"
                    textContentType="newPassword"
                    secureTextEntry={!mostrarConfirmacao}
                    accessibilityLabel="Confirme a nova senha"
                    onChangeText={(valor) => {
                      setConfirmacao(valor);
                      setErro('');
                    }}
                    onFocus={() => setFocado('confirmacao')}
                    onBlur={() => setFocado('')}
                    returnKeyType="done"
                    onSubmitEditing={() => void salvar()}
                  />
                  <TouchableOpacity
                    style={styles.smallButton}
                    disabled={carregando}
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
                {tentouEnviar && !senhasIguais && (
                  <Text style={styles.hint}>
                    {confirmacao
                      ? 'As senhas não coincidem.'
                      : 'Digite a nova senha novamente.'}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={() => void solicitar(true)}
                disabled={carregando || segundosRestantes > 0}
                accessibilityRole="button"
              >
                <Text
                  style={[styles.link, segundosRestantes > 0 && styles.hint]}
                >
                  {segundosRestantes > 0
                    ? `Reenviar código em ${segundosRestantes}s`
                    : 'Não recebeu? Reenviar código'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.smallButton}
                onPress={entrar}
                disabled={carregando}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Voltar para o login</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.primaryButton, carregando && styles.disabled]}
            disabled={carregando}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{ disabled: carregando, busy: carregando }}
            onPress={() =>
              etapa === 'email'
                ? void solicitar()
                : etapa === 'senha'
                  ? void salvar()
                  : entrar()
            }
          >
            {carregando ? (
              <ActivityIndicator color={colors.textoSobrePrimaria} />
            ) : (
              <Text style={styles.primaryText}>
                {etapa === 'email'
                  ? 'ENVIAR CÓDIGO'
                  : etapa === 'senha'
                    ? 'ALTERAR SENHA'
                    : 'ENTRAR NA MINHA CONTA'}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
