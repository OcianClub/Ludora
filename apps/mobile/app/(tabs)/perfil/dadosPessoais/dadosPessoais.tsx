import { Icon, type IconName } from '@ludora/icons';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

import { useState, useEffect, useRef } from "react";

import { createStyles } from "@/src/styles/dadosPessoaisStyles";
import { Header } from "@/src/components/Header";
import { ConfirmacaoConta } from '@/src/components/ConfirmacaoConta';
import { useTheme } from '@/src/contexts/ThemeContext';
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { limparCacheConsultas } from '@/src/services/cacheConsultas';
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";

import {
  atualizarUsuario,
  excluirConta as excluirContaAPI,
} from "@/src/services/api";

interface DadosPessoaisProps {
  onFechar?: () => void;
  noModal?: boolean;
  onAlteracoesPendentes?: (pendentes: boolean) => void;
  onOperacaoEmAndamento?: (ocupado: boolean) => void;
}

interface CampoProps {
  label: string;
  valor: string;
  icone: IconName;
  editando: boolean;
  onChangeText: (text: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  mostrarSenha?: boolean;
  onToggleSenha?: () => void;
  keyboardType?: "default" | "email-address";
  disabled?: boolean;
}

function Campo({
  label,
  valor,
  icone,
  editando,
  onChangeText,
  placeholder,
  secureTextEntry,
  mostrarSenha,
  onToggleSenha,
  keyboardType = "default",
  disabled,
}: CampoProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [focado, setFocado] = useState(false);
  if (!editando) {
    return (
      <View style={styles.infoItem}>
        <View style={styles.infoIcon}>
          <Icon
            name={icone}
            size={19}
            color={colors.textoSecundario}
          />
        </View>

        <View style={styles.infoContent}>
          <Text style={styles.infoLabel}>
            {label}
          </Text>

          <Text
            style={[
              styles.infoValue,
              !valor && styles.infoValueEmpty,
            ]}
            selectable
          >
            {valor || placeholder || "Não informado"}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.editField}>
      <Text style={styles.editLabel}>
        {label}
      </Text>

      <View style={[styles.inputWrapper, focado && styles.inputFocused]}>
        <Icon
          name={icone}
          size={19}
          color={colors.primaria}
        />

        <TextInput
          style={styles.input}
          value={valor}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textoSecundario}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={keyboardType === 'email-address' || secureTextEntry !== undefined ? 'none' : 'words'}
          autoCorrect={false}
          editable={!disabled}
          onFocus={() => setFocado(true)}
          onBlur={() => setFocado(false)}
          accessibilityLabel={label}
          autoComplete={secureTextEntry !== undefined ? 'new-password' : keyboardType === 'email-address' ? 'email' : 'name'}
          selectionColor={colors.primaria}
        />

        {secureTextEntry !== undefined && (
          <TouchableOpacity
            onPress={onToggleSenha}
            disabled={disabled}
            style={styles.eyeButton}
            accessibilityRole="button"
            accessibilityLabel={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
            activeOpacity={0.7}
          >
            <Icon
              name={
                mostrarSenha
                  ? "eye-off-outline"
                  : "eye-outline"
              }
              size={20}
              color={colors.textoSecundario}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function DadosPessoais({
  onFechar,
  noModal,
  onAlteracoesPendentes,
  onOperacaoEmAndamento,
}: DadosPessoaisProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { limparClubeAtivo } = useClubeAtivo();
  const fechar = onFechar ?? (() => router.back());
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [membroDesde, setMembroDesde] = useState("");

  const [editando, setEditando] = useState(false);
  const [mostrarSenha, setMostrarSenha] =
    useState(false);

  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [originais, setOriginais] = useState({ nome: '', email: '' });
  const operacao = useRef(false);
  const timerSucesso = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendentes = editando && (nome !== originais.nome || email !== originais.email || senha.length > 0);

  const [modalExcluir, setModalExcluir] =
    useState(false);

  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    void carregarDados().catch(() => setErro('Não foi possível carregar seus dados. Tente abrir a tela novamente.')).finally(() => setCarregando(false));
    return () => { if (timerSucesso.current) clearTimeout(timerSucesso.current); };
  }, []);
  useEffect(() => { onAlteracoesPendentes?.(pendentes || salvando || excluindo); }, [pendentes, salvando, excluindo, onAlteracoesPendentes]);
  useEffect(() => { onOperacaoEmAndamento?.(salvando || excluindo); }, [salvando, excluindo, onOperacaoEmAndamento]);

  const carregarDados = async () => {
    const [nomeSalvo, emailSalvo, dataSalva] = await Promise.all([
      SecureStore.getItemAsync('userName'),
      SecureStore.getItemAsync('userEmail'),
      SecureStore.getItemAsync('userCriadoEm'),
    ]);
    setOriginais({ nome: nomeSalvo ?? '', email: emailSalvo ?? '' });

    if (nomeSalvo) {
      setNome(nomeSalvo);
    }

    if (emailSalvo) {
      setEmail(emailSalvo);
    }

    if (dataSalva) {
      const data = new Date(dataSalva);

      const formatada = data.toLocaleDateString(
        "pt-BR",
        {
          day: "2-digit",
          month: "long",
          year: "numeric",
        }
      );

      setMembroDesde(formatada);
    }
  };

  const salvar = async () => {
    if (operacao.current || !pendentes) return;
    setErro('');
    if (nome.trim().length < 2) {
      setErro('Informe seu nome com pelo menos 2 caracteres.');
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setErro('Informe um e-mail válido, como nome@exemplo.com.');
      return;
    }
    if (senha.length > 0 && senha.length < 8) {
      setErro('A nova senha deve ter pelo menos 8 caracteres.');
      return;
    }

    operacao.current = true;
    setSalvando(true);
    const nomeNormalizado = nome.trim();
    const emailNormalizado = email.trim().toLowerCase();

    try {
      await atualizarUsuario({
        nome: nomeNormalizado,
        email: emailNormalizado,
        ...(senha.length >= 8 && {
          senha,
        }),
      });

      await Promise.all([
        SecureStore.setItemAsync('userName', nomeNormalizado),
        SecureStore.setItemAsync('userEmail', emailNormalizado),
      ]);
      setNome(nomeNormalizado); setEmail(emailNormalizado);
      setOriginais({ nome: nomeNormalizado, email: emailNormalizado });

      setSenha("");
      setMostrarSenha(false);
      setEditando(false);
      setSucesso(true);

      if (timerSucesso.current) clearTimeout(timerSucesso.current);
      timerSucesso.current = setTimeout(() => {
        setSucesso(false);
      }, 3000);
    } catch (err: any) {
      setErro(err.message || 'Não foi possível salvar as alterações. Seus dados continuam disponíveis para tentar novamente.');
    } finally {
      operacao.current = false;
      setSalvando(false);
    }
  };

  const cancelarEdicao = async () => {
    if (operacao.current) return;
    setNome(originais.nome); setEmail(originais.email); setErro('');

    setSenha("");
    setMostrarSenha(false);
    setEditando(false);
  };

  const excluirConta = async () => {
    if (operacao.current) return;
    operacao.current = true;
    setExcluindo(true);
    try {
      await excluirContaAPI();
      await limparCacheConsultas();
      await limparClubeAtivo();
      await Promise.all(['userToken', 'userRole', 'userName', 'userEmail', 'userCriadoEm', 'userData', 'expoPushToken'].map(chave => SecureStore.deleteItemAsync(chave)));

      setModalExcluir(false);

      fechar();

      router.replace("/(auth)/login");
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message ||
          "Não foi possível excluir a conta."
      );
    } finally {
      operacao.current = false;
      setExcluindo(false);
    }
  };

  const solicitarFechamento = () => {
    if (operacao.current) return;
    if (!pendentes) { fechar(); return; }
    Alert.alert('Descartar alterações?', 'As mudanças que você fez ainda não foram salvas.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: fechar },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={noModal ? ['top', 'bottom', 'left', 'right'] : ['top', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Header
        title="Dados pessoais"
        showLogo={false}
        showProfile={false}
        btnVoltar="arrow-left"
        onBtnVoltar={solicitarFechamento}
        semSafeArea
      />

      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        {/* PERFIL */}
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetra}>
                {nome
                  ? nome.charAt(0).toUpperCase()
                  : "?"}
              </Text>
            </View>

          </View>

          <View style={styles.profileIdentity}>
          <Text style={styles.nomeUsuario}>
            {originais.nome || "Sua conta"}
          </Text>

          {membroDesde ? (
            <Text style={styles.membroDesde}>
              Membro desde {membroDesde}
            </Text>
          ) : null}
          </View>
        </View>

        {/* INFORMAÇÕES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {editando ? 'EDITAR INFORMAÇÕES' : 'INFORMAÇÕES DA CONTA'}
            </Text>
          </View>
          <Text style={styles.sectionDescription}>{editando ? 'Atualize seus dados. A nova senha é opcional.' : 'Seus dados de acesso ao Ludora.'}</Text>
          {carregando && <ActivityIndicator style={{ paddingVertical: 12 }} color={colors.primaria} />}

          <View style={styles.infoCard}>
            <Campo
              label="Nome completo"
              valor={nome}
              icone="account-outline"
              editando={editando}
              onChangeText={setNome}
              disabled={salvando}
            />

            <View style={styles.divider} />

            <Campo
              label="E-mail"
              valor={email}
              icone="email-outline"
              editando={editando}
              onChangeText={setEmail}
              keyboardType="email-address"
              disabled={salvando}
            />

            <View style={styles.divider} />

            <Campo
              label={editando ? 'Nova senha (opcional)' : 'Senha'}
              valor={editando ? senha : ''}
              placeholder={editando ? 'Deixe em branco para manter a atual' : '••••••••'}
              icone="lock-outline"
              editando={editando}
              onChangeText={setSenha}
              secureTextEntry={!mostrarSenha}
              disabled={salvando}
              mostrarSenha={mostrarSenha}
              onToggleSenha={() =>
                setMostrarSenha(
                  (prev) => !prev
                )
              }
            />
          </View>
          {editando && <Text style={styles.fieldHint}>Use pelo menos 8 caracteres para trocar a senha.</Text>}
        </View>

        {/* AÇÕES */}
        <View style={styles.actions}>
          {!!erro && <View style={styles.errorBox} accessibilityRole="alert"><Text style={styles.errorText}>{erro}</Text></View>}
          {!editando ? (
            <TouchableOpacity
              style={styles.editButton}
              activeOpacity={0.8}
              onPress={() => setEditando(true)}
              disabled={carregando}
            >
              <Icon
                name="pencil-outline"
                size={20}
                color={colors.primaria}
              />

              <Text style={styles.editButtonText}>
                EDITAR DADOS
              </Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={salvar}
                disabled={salvando || !pendentes}
                style={[styles.saveButton, !pendentes && styles.disabledButton]}
              >
                {salvando ? (
                  <ActivityIndicator color={colors.textoSobrePrimaria} />
                ) : (
                  <>
                    <Icon
                      name="check"
                      size={20}
                      color={colors.textoSobrePrimaria}
                    />

                    <Text style={styles.saveButtonText}>
                      SALVAR ALTERAÇÕES
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.cancelButton}
                activeOpacity={0.7}
                onPress={cancelarEdicao}
                disabled={salvando}
              >
                <Text style={styles.cancelButtonText}>
                  CANCELAR
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* ZONA DE PERIGO */}
        {!editando && (
          <View style={styles.dangerSection}>
            <Text style={styles.sectionTitle}>GERENCIAR CONTA</Text>

            <TouchableOpacity
              style={styles.deleteButton}
              activeOpacity={0.8}
              onPress={() =>
                setModalExcluir(true)
              }
            >
              <View style={styles.deleteIcon}>
                <Icon
                  name="trash-can-outline"
                  size={20}
                  color={colors.tituloErro}
                />
              </View>

              <View style={styles.deleteContent}>
                <Text style={styles.deleteTitle}>
                  Excluir minha conta
                </Text>

                <Text style={styles.deleteSubtitle}>
                  Essa ação não pode ser desfeita
                </Text>
              </View>

              <Icon
                name="chevron-right"
                size={22}
                color={colors.tituloErro}
              />
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* SUCESSO */}
      {sucesso && (
        <View style={styles.successToast}>
          <Icon
            name="check-circle"
            size={20}
            color={colors.textoSobrePrimaria}
          />

          <Text style={styles.successText}>
            Dados atualizados com sucesso!
          </Text>
        </View>
      )}

      {/* MODAL EXCLUSÃO */}
      <ConfirmacaoConta
        visible={modalExcluir}
        titulo="Excluir sua conta?"
        descricao="Sua conta será excluída permanentemente e você perderá o acesso a ela. Confirme apenas se deseja encerrar sua conta no Ludora."
        icone="trash-can-outline"
        destrutivo
        confirmarTexto="Excluir minha conta"
        carregandoTexto="Excluindo conta..."
        carregando={excluindo}
        onConfirmar={() => void excluirConta()}
        onFechar={() => setModalExcluir(false)}
      />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
