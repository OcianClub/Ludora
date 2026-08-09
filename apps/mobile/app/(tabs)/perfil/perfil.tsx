import { Modal, View, Text, TouchableOpacity, Pressable } from "react-native";
import { useState, useEffect } from 'react';
import { styles } from "../../../src/styles/perfilStyles";
import { Header } from '@/src/components/Header';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import DadosPessoais from "./dadosPessoais/dadosPessoais";
import Equipes from "./equipes/equipes";

interface CardMenuProps {
  titulo: string;
  subtitulo: string;
  icone: keyof typeof MaterialCommunityIcons.glyphMap;
  action: () => void;
}

function CardsMeuPerfil({ titulo, subtitulo, icone, action }: CardMenuProps) {
  return (
    <TouchableOpacity style={styles.cardContainer} activeOpacity={0.6} onPress={action}>
      <View style={styles.card}>
        <View style={styles.cardSpace}>
          <View style={{ backgroundColor: colors.cinza, padding: 8, borderRadius: 10 }}>
            <MaterialCommunityIcons name={icone} size={26} color={colors.azulClaro} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.titulo}>{titulo}</Text>
            <Text style={styles.subtitulo}>{subtitulo}</Text>
          </View>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={colors.cinza_claro} />
      </View>
    </TouchableOpacity>
  );
}


export default function Perfil() {
  const [nome, setNome] = useState('');
  const [membroDesde, setMembroDesde] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [modalDadosPessoais, setModalDadosPessoais] = useState(false);
  const [modalMinhasEquipes, setModalMinhasEquipes] = useState(false);

  type MenuItem = {
    id: number;
    titulo: string;
    subtitulo: string;
    icone: keyof typeof MaterialCommunityIcons.glyphMap;
    action: () => void;
  }
  const [ehAdmin, setEhAdmin] = useState(false);

  const MEU_PERFIL: MenuItem[] = [
    { id: 1, titulo: "Dados Pessoais", subtitulo: "Gerencie suas informações básicas", icone: "account-outline", action: () => setModalDadosPessoais(true) },
    ...(ehAdmin ? [{ id: 2, titulo: "Equipes", subtitulo: "Times e campeonatos cadastrados", icone: "account-group" as any, action: () => setModalMinhasEquipes(true) }] : []),
    { id: 3, titulo: "Notificações", subtitulo: "Preferências de alertas e avisos", icone: "bell" as any, action: () => {} },
  ];

  useEffect(() => {
    SecureStore.getItemAsync('userName').then(n => { if (n) setNome(n); });
    SecureStore.getItemAsync('userCriadoEm').then(data => {
      if (data) {
        const formatted = new Date(data).toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'short', year: 'numeric'
        });
        setMembroDesde(formatted);
      }
    });
    SecureStore.getItemAsync('userRole').then(role => setEhAdmin(role === 'ADMIN'));
  }, []);

  const fecharDadosPessoais = async () => {
    const nomeAtualizado = await SecureStore.getItemAsync('userName');
    if (nomeAtualizado) setNome(nomeAtualizado);
    setModalDadosPessoais(false);
  };

  const deslogar = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('userName');
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.container}>
      <Header title="Meu Perfil" showLogo={false} showProfile={false} btnVoltar="arrow-left" />
      <View style={styles.content}>
        <View style={styles.contentSecundario}>

          <View style={styles.headerPerfil}>
            <Text style={styles.nomeUsuario}>{nome}</Text>
            <Text style={styles.dataMembro}>Membro desde {membroDesde}</Text>
          </View>

          <View>
            {MEU_PERFIL.map(item => (
              <CardsMeuPerfil
                key={item.id}
                titulo={item.titulo}
                subtitulo={item.subtitulo}
                icone={item.icone}
                action={item.action}
              />
            ))}
          </View>

          <TouchableOpacity style={styles.btnSair} activeOpacity={0.8} onPress={() => setVisivel(true)}>
            <MaterialCommunityIcons name="logout" size={24} color={colors.vermelho} />
            <Text style={styles.txtSair}>SAIR DA CONTA</Text>
          </TouchableOpacity>

        </View>
      </View>

      <Modal visible={visivel} transparent animationType="fade" onRequestClose={() => setVisivel(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setVisivel(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="logout" size={36} color={colors.vermelho} style={{ marginBottom: 8 }} />
            <Text style={styles.modalTitulo}>Sair da conta</Text>
            <Text style={styles.modalSubtitulo}>Tem certeza que deseja encerrar sua sessão?</Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.btnNao} onPress={() => setVisivel(false)} activeOpacity={0.8}>
                <Text style={styles.txtNao}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSim} onPress={deslogar} activeOpacity={0.8}>
                <Text style={styles.txtSim}>SAIR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={modalDadosPessoais} transparent={false} animationType="slide" onRequestClose={() => setModalDadosPessoais(false)}>
        <DadosPessoais
          noModal={true}
          onFechar={fecharDadosPessoais}
        />
      </Modal>

      <Modal visible={modalMinhasEquipes} transparent={false} animationType="slide" onRequestClose={() => setModalMinhasEquipes(false)}>
        <Equipes
          noModal={true}
          onFechar={() => setModalMinhasEquipes(false)}
        />
      </Modal>
    </View>
  );
}