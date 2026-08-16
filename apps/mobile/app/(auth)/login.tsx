import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { BASE_URL } from '@/src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgProps } from 'react-native-svg';

// Importação dos estilos e design tokens
import { styles } from '@/src/styles/loginStyles';
import { colors } from '@ludora/design-tokens';

import LogoArquivo from '@/assets/logo.svg';
const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

export default function Login() {
  const router = useRouter();
  const [email,        setEmail]        = useState('');
  const [senha,        setSenha]        = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando,   setCarregando]   = useState(false);
  const [erro,         setErro]         = useState('');
  const [emailFocado,  setEmailFocado]  = useState(false);
  const [senhaFocada,  setSenhaFocada]  = useState(false);

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

      // Salvando os dados básicos de forma segura (garantindo conversão para string)
      await SecureStore.setItemAsync('userToken',     String(dados.token || ''));
      await SecureStore.setItemAsync('userName',      String(dados.nome || ''));
      await SecureStore.setItemAsync('userCriadoEm',  String(dados.criadoEm || ''));
      await SecureStore.setItemAsync('userEmail',     String(dados.email || ''));

      // Salvando a lista de clubes (como é um array/objeto, usamos JSON.stringify para virar string)
      if (dados.clubes) {
        await SecureStore.setItemAsync('userData', JSON.stringify({ clubes: dados.clubes }));
      }
      router.replace('/clubes');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <View style={styles.container}>
      
      {/* Botão Voltar */}
      <TouchableOpacity style={styles.btnVoltar} onPress={() => router.back()}>
        <MaterialCommunityIcons name="arrow-left" size={22} color={colors.texto} />
      </TouchableOpacity>

      {/* Cabeçalho */}
      <View style={styles.header}>
        <View style={styles.logoContainer}>
          <Logo width={60} height={60} />
        </View>
        <Text style={styles.titulo}>BEM-VINDO DE VOLTA</Text>
        <Text style={styles.subtitulo}>Faça login para acessar o painel do clube</Text>
      </View>

      {/* Formulário (só header + inputs) */}
      <View style={styles.form}>
        {erro !== '' && (
          <View style={styles.erroContainer}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.tituloErro} />
            <Text style={styles.erroTxt}>{erro}</Text>
          </View>
        )}

        <View>
          <Text style={styles.inputLabel}>EMAIL</Text>
          <View style={[styles.inputRow, emailFocado && styles.inputRowFocado]}>
            <MaterialCommunityIcons name="email-outline" size={20} color={emailFocado ? colors.primaria : colors.textoSecundario} />
            <TextInput
              style={styles.input}
              placeholder="seu@email.com"
              placeholderTextColor={colors.textoSecundario}
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
            <MaterialCommunityIcons name="lock-outline" size={20} color={senhaFocada ? colors.primaria : colors.textoSecundario} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={colors.textoSecundario}
              secureTextEntry={!mostrarSenha}
              value={senha}
              onChangeText={v => { setSenha(v); setErro(''); }}
              onFocus={() => setSenhaFocada(true)}
              onBlur={() => setSenhaFocada(false)}
            />
            <TouchableOpacity onPress={() => setMostrarSenha(v => !v)} activeOpacity={0.7} style={styles.olho}>
              <MaterialCommunityIcons
                name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'}
                size={22}
                color={colors.textoSecundario}
              />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Empurra o footer pra baixo */}
      <View style={styles.spacer} />

      {/* Botão + link de cadastro, fixos embaixo */}
      <View style={styles.footer}>
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

        <View style={styles.linhaCadastro}>
          <Text style={styles.textoCinza}>Não tem uma conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')} activeOpacity={0.7}>
            <Text style={styles.textoAzul}>Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}