import { Icon, type IconName } from '@ludora/icons';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";

import { useState, useEffect } from "react";

import { styles } from "@/src/styles/dadosPessoaisStyles";
import { Header } from "@/src/components/Header";
import { colors } from "@ludora/design-tokens";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";

import {
  atualizarUsuario,
  excluirConta as excluirContaAPI,
} from "@/src/services/api";

interface DadosPessoaisProps {
  onFechar: () => void;
  noModal?: boolean;
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
}: CampoProps) {
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
            numberOfLines={1}
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

      <View style={styles.inputWrapper}>
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
          selectionColor={colors.primaria}
        />

        {secureTextEntry !== undefined && (
          <TouchableOpacity
            onPress={onToggleSenha}
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
}: DadosPessoaisProps) {
  const { clubeAtivo } = useClubeAtivo();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");

  const [membroDesde, setMembroDesde] = useState("");

  const [editando, setEditando] = useState(false);
  const [mostrarSenha, setMostrarSenha] =
    useState(false);

  const [salvando, setSalvando] = useState(false);

  const [modalExcluir, setModalExcluir] =
    useState(false);

  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const nomeSalvo =
      await SecureStore.getItemAsync("userName");

    const emailSalvo =
      await SecureStore.getItemAsync("userEmail");

    const dataSalva =
      await SecureStore.getItemAsync("userCriadoEm");

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
    if (!nome.trim() || !email.trim()) {
      Alert.alert(
        "Atenção",
        "Preencha nome e e-mail."
      );
      return;
    }
    if (senha.length > 0 && senha.length < 8) {
      Alert.alert("Atenção", "A nova senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setSalvando(true);

    try {
      await atualizarUsuario({
        nome,
        email,
        ...(senha.length >= 8 && {
          senha,
        }),
      });

      await SecureStore.setItemAsync(
        "userName",
        nome
      );

      await SecureStore.setItemAsync(
        "userEmail",
        email
      );

      setSenha("");
      setMostrarSenha(false);
      setEditando(false);
      setSucesso(true);

      setTimeout(() => {
        setSucesso(false);
      }, 3000);
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message ||
          "Não foi possível salvar as alterações."
      );
    } finally {
      setSalvando(false);
    }
  };

  const cancelarEdicao = async () => {
    await carregarDados();

    setSenha("");
    setMostrarSenha(false);
    setEditando(false);
  };

  const excluirConta = async () => {
    try {
      await excluirContaAPI();

      await SecureStore.deleteItemAsync("userToken");
      await SecureStore.deleteItemAsync("userRole");
      await SecureStore.deleteItemAsync("userName");
      await SecureStore.deleteItemAsync("userEmail");
      await SecureStore.deleteItemAsync("userCriadoEm");

      setModalExcluir(false);

      onFechar();

      router.replace("/(auth)/login");
    } catch (err: any) {
      Alert.alert(
        "Erro",
        err.message ||
          "Não foi possível excluir a conta."
      );
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="DADOS PESSOAIS"
        showLogo={false}
        showProfile={false}
        btnVoltar="arrow-left"
        onBtnVoltar={onFechar}
        papelUsuario={clubeAtivo?.papel ?? undefined}
        semSafeArea={noModal}
      />

      <ScrollView
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

            <View style={styles.avatarStatus} />
          </View>

          <Text style={styles.nomeUsuario}>
            {nome || "Usuário"}
          </Text>

          {membroDesde ? (
            <Text style={styles.membroDesde}>
              MEMBRO DESDE{" "}
              {membroDesde.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* INFORMAÇÕES */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />

            <Text style={styles.sectionTitle}>
              INFORMAÇÕES DA CONTA
            </Text>
          </View>

          <View style={styles.infoCard}>
            <Campo
              label="NOME COMPLETO"
              valor={nome}
              icone="account-outline"
              editando={editando}
              onChangeText={setNome}
            />

            <View style={styles.divider} />

            <Campo
              label="E-MAIL"
              valor={email}
              icone="email-outline"
              editando={editando}
              onChangeText={setEmail}
              keyboardType="email-address"
            />

            <View style={styles.divider} />

            <Campo
              label="SENHA"
              valor=""
              placeholder="••••••••"
              icone="lock-outline"
              editando={editando}
              onChangeText={setSenha}
              secureTextEntry={!mostrarSenha}
              mostrarSenha={mostrarSenha}
              onToggleSenha={() =>
                setMostrarSenha(
                  (prev) => !prev
                )
              }
            />
          </View>
        </View>

        {/* AÇÕES */}
        <View style={styles.actions}>
          {!editando ? (
            <TouchableOpacity
              style={styles.editButton}
              activeOpacity={0.8}
              onPress={() => setEditando(true)}
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
                style={styles.saveButton}
                activeOpacity={0.8}
                onPress={salvar}
                disabled={salvando}
              >
                {salvando ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Icon
                      name="check"
                      size={20}
                      color="#FFFFFF"
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
            <View style={styles.sectionHeader}>
            </View>

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

        <View style={{ height: 50 }} />
      </ScrollView>

      {/* SUCESSO */}
      {sucesso && (
        <View style={styles.successToast}>
          <Icon
            name="check-circle"
            size={20}
            color="#FFFFFF"
          />

          <Text style={styles.successText}>
            Dados atualizados com sucesso!
          </Text>
        </View>
      )}

      {/* MODAL EXCLUSÃO */}
      <Modal
        visible={modalExcluir}
        transparent
        animationType="fade"
        onRequestClose={() =>
          setModalExcluir(false)
        }
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() =>
            setModalExcluir(false)
          }
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <Icon
                name="trash-can-outline"
                size={27}
                color={colors.tituloErro}
              />
            </View>

            <Text style={styles.modalTitle}>
              Excluir conta?
            </Text>

            <Text style={styles.modalSubtitle}>
              Todos os seus dados serão removidos
              permanentemente. Essa ação não pode ser
              desfeita.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() =>
                  setModalExcluir(false)
                }
              >
                <Text style={styles.modalCancelText}>
                  CANCELAR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalDelete}
                onPress={excluirConta}
              >
                <Text style={styles.modalDeleteText}>
                  EXCLUIR
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
