import { View, Text, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useState, useEffect } from 'react';
import { styles } from '../../../../src/styles/dadosPessoaisStyles';
import { Header } from '@/src/components/Header';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '@/src/theme/colors';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router'
import { atualizarUsuario, excluirConta as excluirContaAPI } from '@/src/services/api';

interface DadosPessoaisProps {
  onFechar: () => void;
  noModal?: boolean;
}

interface CampoEditavelProps {
  label: string;
  valor: string;
  placeholder?: string;
  icone: keyof typeof MaterialCommunityIcons.glyphMap;
  editando: boolean;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address' | 'numeric';
}

function CampoEditavel({ label, valor, placeholder, icone, editando, onChangeText, secureTextEntry, keyboardType }: CampoEditavelProps) {
  return (
    <View style={styles.campoContainer}>
      <Text style={styles.campoLabel}>{label}</Text>
      <View style={[styles.campoInputRow, editando && styles.campoInputRowAtivo]}>
        <MaterialCommunityIcons name={icone} size={20} color={editando ? colors.azulClaro : colors.text_secondary} />
        <TextInput
          style={styles.campoInput}
          value={valor}
          onChangeText={onChangeText}
          editable={editando}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType ?? 'default'}
          placeholderTextColor={colors.text_secondary}
          placeholder={placeholder}
        />
        {editando && (
          <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.azulClaro} />
        )}
      </View>
    </View>
  );
}

export default function DadosPessoais({ onFechar, noModal }: DadosPessoaisProps) {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [membroDesde, setMembroDesde] = useState('');
  const [editando, setEditando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [modalExcluir, setModalExcluir] = useState(false);
  const [sucesso, setSucesso] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync('userName').then(n => { if (n) setNome(n); });
    SecureStore.getItemAsync('userEmail').then(e => { if (e) setEmail(e); });
    SecureStore.getItemAsync('userCriadoEm').then(data => {
      if (data) {
        const formatted = new Date(data).toLocaleDateString('pt-BR', {
          day: '2-digit', month: 'long', year: 'numeric'
        });
        setMembroDesde(formatted);
      }
    });
  }, []);

const salvar = async () => {
  setSalvando(true);
  try {
    await atualizarUsuario({ nome, email, ...(senha.length >= 6 && { senha }) });
    await SecureStore.setItemAsync('userName', nome);
    await SecureStore.setItemAsync('userEmail', email);
    setEditando(false);
    setSenha('');
    setSucesso(true);
    setTimeout(() => setSucesso(false), 3000);
  } catch (err: any) {
    Alert.alert('Erro', err.message ?? 'Não foi possível salvar as alterações.');
  } finally {
    setSalvando(false);
  }
};

const deslogar = async () => {
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('userName');
    router.replace('/(auth)/login');
    };

  const excluirConta = async () => {
  try {
    await excluirContaAPI();
    await SecureStore.deleteItemAsync('userToken');
    await SecureStore.deleteItemAsync('userRole');
    await SecureStore.deleteItemAsync('userName');
    await SecureStore.deleteItemAsync('userEmail');
    await SecureStore.deleteItemAsync('userCriadoEm');
    setModalExcluir(false);
    onFechar();
    deslogar();
  } catch (err: any) {
    Alert.alert('Erro', err.message ?? 'Não foi possível excluir a conta.');
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
        semSafeArea={noModal}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>

        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetra}>{nome.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.nomeUsuario}>{nome}</Text>
          <Text style={styles.membroDesde}>Membro desde {membroDesde}</Text>
        </View>

        <View style={styles.secao}>
          <Text style={styles.secaoLabel}>INFORMAÇÕES DA CONTA</Text>

          <CampoEditavel
            label="Nome completo"
            valor={nome}
            icone="account-outline"
            editando={editando}
            onChangeText={setNome}
          />
          <CampoEditavel
            label="E-mail"
            valor={email}
            icone="email-outline"
            editando={editando}
            onChangeText={setEmail}
            keyboardType="email-address"
          />
          <CampoEditavel
            label="Senha"
            valor={senha}
            icone="lock-outline"
            editando={editando}
            onChangeText={setSenha}
            secureTextEntry={!mostrarSenha}
            placeholder={editando ? 'Nova senha' : '••••••••'}
            />
        </View>

        <View style={styles.botoesContainer}>
          {editando ? (
            <TouchableOpacity
              style={styles.btnSalvar}
              activeOpacity={0.8}
              onPress={salvar}
              disabled={salvando}
            >
              {salvando
                ? <ActivityIndicator color="#FFF" />
                : (
                  <>
                    <MaterialCommunityIcons name="check" size={20} color="#FFF" />
                    <Text style={styles.txtBtnSalvar}>SALVAR ALTERAÇÕES</Text>
                  </>
                )
              }
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.btnEditar} activeOpacity={0.8} onPress={() => setEditando(true)}>
              <MaterialCommunityIcons name="pencil-outline" size={20} color={colors.text} />
              <Text style={styles.txtBtnEditar}>EDITAR DADOS</Text>
            </TouchableOpacity>
          )}

          {editando && (
            <TouchableOpacity style={styles.btnCancelar} activeOpacity={0.8} onPress={() => setEditando(false)}>
              <Text style={styles.txtBtnCancelar}>CANCELAR</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.secaoDanger}>
          <TouchableOpacity style={styles.btnExcluir} activeOpacity={0.8} onPress={() => setModalExcluir(true)}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.vermelho} />
            <Text style={styles.txtBtnExcluir}>EXCLUIR MINHA CONTA</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>

      {sucesso && (
        <View style={styles.toastSucesso}>
            <MaterialCommunityIcons name="check-circle" size={20} color="#FFF" />
            <Text style={styles.toastTexto}>Dados atualizados com sucesso!</Text>
        </View>
        )}

      <Modal visible={modalExcluir} transparent animationType="fade" onRequestClose={() => setModalExcluir(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalExcluir(false)}>
          <View style={styles.modalCard}>
            <MaterialCommunityIcons name="trash-can-outline" size={36} color={colors.vermelho} style={{ marginBottom: 8 }} />
            <Text style={styles.modalTitulo}>Excluir conta</Text>
            <Text style={styles.modalSubtitulo}>Essa ação é permanente e não pode ser desfeita. Todos os seus dados serão removidos.</Text>
            <View style={styles.modalBotoes}>
              <TouchableOpacity style={styles.btnNao} onPress={() => setModalExcluir(false)} activeOpacity={0.8}>
                <Text style={styles.txtNao}>CANCELAR</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btnSim} onPress={excluirConta} activeOpacity={0.8}>
                <Text style={styles.txtSim}>EXCLUIR</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}