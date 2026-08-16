import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
} from "react-native";
import { useState, useEffect } from "react";
import { styles } from "../../../src/styles/perfilStyles";
import { Header } from "@/src/components/Header";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { colors } from "@ludora/design-tokens";
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";

import DadosPessoais from "./dadosPessoais/dadosPessoais";
import Equipes from "./equipes/equipes";

interface CardMenuProps {
  titulo: string;
  subtitulo: string;
  icone: keyof typeof MaterialCommunityIcons.glyphMap;
  action: () => void;
}

function CardMenu({
  titulo,
  subtitulo,
  icone,
  action,
}: CardMenuProps) {
  return (
    <TouchableOpacity
      style={styles.menuItem}
      activeOpacity={0.75}
      onPress={action}
    >
      <View style={styles.menuIcon}>
        <MaterialCommunityIcons
          name={icone}
          size={21}
          color={colors.primaria}
        />
      </View>

      <View style={styles.menuContent}>
        <Text style={styles.menuTitulo}>
          {titulo}
        </Text>

        <Text style={styles.menuSubtitulo}>
          {subtitulo}
        </Text>
      </View>

      <MaterialCommunityIcons
        name="chevron-right"
        size={22}
        color={colors.textoSecundario}
      />
    </TouchableOpacity>
  );
}

export default function Perfil() {
  const [nome, setNome] = useState("");
  const [membroDesde, setMembroDesde] = useState("");
  const [modalSair, setModalSair] = useState(false);
  const [modalDadosPessoais, setModalDadosPessoais] =
    useState(false);
  const [modalMinhasEquipes, setModalMinhasEquipes] =
    useState(false);
  const [ehAdmin, setEhAdmin] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const nomeUsuario =
      await SecureStore.getItemAsync("userName");

    if (nomeUsuario) {
      setNome(nomeUsuario);
    }

    const dataCriacao =
      await SecureStore.getItemAsync("userCriadoEm");

    if (dataCriacao) {
      const data = new Date(dataCriacao);

      const formatada = data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      setMembroDesde(formatada.replace(".", ""));
    }

    const role =
      await SecureStore.getItemAsync("userRole");

    setEhAdmin(role === "ADMIN");
  };

  const fecharDadosPessoais = async () => {
    const nomeAtualizado =
      await SecureStore.getItemAsync("userName");

    if (nomeAtualizado) {
      setNome(nomeAtualizado);
    }

    setModalDadosPessoais(false);
  };

  const deslogar = async () => {
    await SecureStore.deleteItemAsync("userToken");
    await SecureStore.deleteItemAsync("userRole");
    await SecureStore.deleteItemAsync("userName");

    router.replace("/(auth)/login");
  };

  return (
    <View style={styles.container}>
      <Header
        title="MEU PERFIL"
        showLogo={false}
        showProfile={false}
        btnVoltar="arrow-left"
      />

      <View style={styles.content}>
        {/* HEADER DO PERFIL */}
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
            <Text style={styles.dataMembro}>
              MEMBRO DESDE{" "}
              {membroDesde.toUpperCase()}
            </Text>
          ) : null}
        </View>

        {/* CONTA */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIndicator} />

            <Text style={styles.sectionTitle}>
              CONTA
            </Text>
          </View>

          <View style={styles.menu}>
            <CardMenu
              titulo="Dados pessoais"
              subtitulo="Informações da sua conta"
              icone="account-outline"
              action={() =>
                setModalDadosPessoais(true)
              }
            />

            {ehAdmin && (
              <CardMenu
                titulo="Equipes"
                subtitulo="Times e campeonatos cadastrados"
                icone="account-group-outline"
                action={() =>
                  setModalMinhasEquipes(true)
                }
              />
            )}

            <CardMenu
              titulo="Notificações"
              subtitulo="Alertas e preferências"
              icone="bell-outline"
              action={() => {}}
            />
          </View>
        </View>

        {/* SESSÃO */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.75}
            onPress={() => setModalSair(true)}
          >
            <View style={styles.logoutIcon}>
              <MaterialCommunityIcons
                name="logout"
                size={20}
                color={colors.tituloErro}
              />
            </View>

            <View style={styles.logoutContent}>
              <Text style={styles.logoutTitle}>
                Sair da conta
              </Text>

              <Text style={styles.logoutSubtitle}>
                Encerrar sua sessão neste dispositivo
              </Text>
            </View>

            <MaterialCommunityIcons
              name="chevron-right"
              size={22}
              color={colors.tituloErro}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL SAIR */}
      <Modal
        visible={modalSair}
        transparent
        animationType="fade"
        onRequestClose={() => setModalSair(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setModalSair(false)}
        >
          <Pressable style={styles.modalCard}>
            <View style={styles.modalIcon}>
              <MaterialCommunityIcons
                name="logout"
                size={26}
                color={colors.tituloErro}
              />
            </View>

            <Text style={styles.modalTitulo}>
              Sair da conta?
            </Text>

            <Text style={styles.modalSubtitulo}>
              Sua sessão será encerrada neste
              dispositivo.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setModalSair(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.cancelText}>
                  CANCELAR
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.confirmButton}
                onPress={deslogar}
                activeOpacity={0.8}
              >
                <Text style={styles.confirmText}>
                  SAIR
                </Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* DADOS PESSOAIS */}
      <Modal
        visible={modalDadosPessoais}
        transparent={false}
        animationType="slide"
        onRequestClose={() =>
          setModalDadosPessoais(false)
        }
      >
        <DadosPessoais
          noModal={true}
          onFechar={fecharDadosPessoais}
        />
      </Modal>

      {/* EQUIPES */}
      <Modal
        visible={modalMinhasEquipes}
        transparent={false}
        animationType="slide"
        onRequestClose={() =>
          setModalMinhasEquipes(false)
        }
      >
        <Equipes
          noModal={true}
          onFechar={() =>
            setModalMinhasEquipes(false)
          }
        />
      </Modal>
    </View>
  );
}