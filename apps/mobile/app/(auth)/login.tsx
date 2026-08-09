import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '@/src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../../src/styles/loginStyles';
import { colors } from '@/src/theme/colors';

export default function Login() {
  const router = useRouter();

  const [email,       setEmail]       = useState('');
  const [senha,       setSenha]       = useState('');
  const [mostrarSenha,setMostrarSenha]= useState(false);
  const [carregando,  setCarregando]  = useState(false);
  const [erro,        setErro]        = useState('');
  const [emailFocado, setEmailFocado] = useState(false);
  const [senhaFocada, setSenhaFocada] = useState(false);

  const handleLogin = async () => {
    setErro('');
    if (!email.trim() || !senha.trim()) {
      setErro('Preencha e-mail e senha.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await fetch(`${BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), senha }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Erro ao fazer login');

      await SecureStore.setItemAsync('userToken',    dados.token);
      await SecureStore.setItemAsync('userRole',     dados.role);
      await SecureStore.setItemAsync('userName',     dados.nome);
      await SecureStore.setItemAsync('userCriadoEm', dados.criadoEm);
      await SecureStore.setItemAsync('userEmail',    dados.email);

      router.replace('/(tabs)');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.logoContainer}>
        <MaterialCommunityIcons name="soccer" size={38} color={colors.primary} />
      </View>

      <Text style={styles.titulo}>Bem-vindo de volta!</Text>
      <Text style={styles.subtitulo}>Faça login para acessar o painel do clube</Text>

      <View style={styles.form}>
        {erro !== '' && (
          <View style={styles.erroContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.vermelho} />
            <Text style={styles.erroTxt}>{erro}</Text>
          </View>
        )}

        <View>
          <Text style={styles.inputLabel}>E-MAIL</Text>
          <View style={[styles.inputRow, emailFocado && styles.inputRowFocado]}>
            <MaterialCommunityIcons name="email-outline" size={18} color={emailFocado ? colors.primary : colors.text_secondary} />
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor="#444"
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={v => { setEmail(v); setErro(''); }}
              onFocus={() => setEmailFocado(true)}
              onBlur={() => setEmailFocado(false)}
            />
          </View>
        </View>

        <View>
          <Text style={styles.inputLabel}>SENHA</Text>
          <View style={[styles.inputRow, senhaFocada && styles.inputRowFocado]}>
            <MaterialCommunityIcons name="lock-outline" size={18} color={senhaFocada ? colors.primary : colors.text_secondary} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor="#444"
              secureTextEntry={!mostrarSenha}
              value={senha}
              onChangeText={v => { setSenha(v); setErro(''); }}
              onFocus={() => setSenhaFocada(true)}
              onBlur={() => setSenhaFocada(false)}
            />
            <TouchableOpacity onPress={() => setMostrarSenha(v => !v)} activeOpacity={0.7}>
              <MaterialCommunityIcons
                name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={colors.text_secondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btnEntrar, carregando && styles.btnEntrarDisabled]}
          onPress={handleLogin}
          disabled={carregando}
          activeOpacity={0.85}
        >
          {carregando
            ? <ActivityIndicator color="#FFF" />
            : <Text style={styles.txtBtnEntrar}>ENTRAR</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.btnCadastro} onPress={() => router.push('/cadastro')} activeOpacity={0.7}>
          <Text style={styles.txtCadastro}>
            Não tem uma conta?{' '}
            <Text style={styles.txtCadastroDestaque}>Cadastre-se</Text>
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}