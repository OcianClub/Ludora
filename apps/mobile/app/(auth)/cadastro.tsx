import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { BASE_URL } from '@/src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SvgProps } from 'react-native-svg';
import { styles } from '@/src/styles/cadastroStyles'
import { colors } from '@ludora/design-tokens';

import LogoArquivo from '@/assets/logo.svg'; 

const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

export default function Cadastro() {
  const router = useRouter();

  const [email,          setEmail]          = useState('');
  const [senha,          setSenha]          = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha,   setMostrarSenha]   = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [carregando,     setCarregando]     = useState(false);
  const [erro,           setErro]           = useState('');

  const [emailFocado,   setEmailFocado]   = useState(false);
  const [senhaFocada,   setSenhaFocada]   = useState(false);
  const [confirmFocado, setConfirmFocado] = useState(false);

  const senhaMin6      = senha.length >= 6;
  const senhaCoincidem = senha === confirmarSenha && confirmarSenha.length > 0;
  const emailValido    = /\S+@\S+\.\S+/.test(email);

  const formValido = emailValido && senhaMin6 && senhaCoincidem;

  const handleCadastro = async () => {
    setErro('');
    if (!formValido) {
      setErro('Preencha todos os campos corretamente.');
      return;
    }
    setCarregando(true);
    try {
      const nomeFallback = email.split('@')[0];

      const resposta = await fetch(`${BASE_URL}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: email.trim().toLowerCase(), 
          senha, 
          nome: nomeFallback, 
          role: 'USER' 
        }),
      });
      const dados = await resposta.json();
      if (!resposta.ok) throw new Error(dados.error || 'Erro ao criar conta.');
      
      router.replace('/(auth)/login');
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.container}>
        
        <TouchableOpacity style={styles.btnVoltar} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.texto} />
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Logo width={60} height={60} />
          </View>
          <Text style={styles.titulo}>CRIE SUA CONTA</Text>
          <Text style={styles.subtitulo}>
            Leva menos de um minuto e você{'\n'}já pode seguir os clubes que quiser.
          </Text>
        </View>

        <View style={styles.form}>
          {erro !== '' && (
            <View style={styles.erroContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.vermelho} />
              <Text style={styles.erroTxt}>{erro}</Text>
            </View>
          )}

          <View>
            <Text style={styles.inputLabel}>EMAIL</Text>
            <View style={[styles.inputRow, emailFocado && styles.inputRowFocado, email && !emailValido && styles.inputRowErro]}>
              <MaterialCommunityIcons name="email-outline" size={20} color={emailFocado ? colors.primaria : colors.textoSecundario} />
              <TextInput
                style={styles.input}
                placeholder="email@exemplo.com"
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
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={senhaFocada ? colors.primaria : colors.textoSecundario} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor={colors.textoSecundario}
                secureTextEntry={!mostrarSenha}
                value={senha}
                onChangeText={v => { setSenha(v); setErro(''); }}
                onFocus={() => setSenhaFocada(true)}
                onBlur={() => setSenhaFocada(false)}
              />
              <TouchableOpacity onPress={() => setMostrarSenha(v => !v)} activeOpacity={0.7} style={styles.olho}>
                <MaterialCommunityIcons name={mostrarSenha ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={styles.inputLabel}>CONFIRME A SENHA</Text>
            <View style={[styles.inputRow, confirmFocado && styles.inputRowFocado, confirmarSenha && !senhaCoincidem && styles.inputRowErro]}>
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={confirmFocado ? colors.primaria : colors.textoSecundario} />
              <TextInput
                style={styles.input}
                placeholder="Digite sua senha"
                placeholderTextColor={colors.textoSecundario}
                secureTextEntry={!mostrarConfirm}
                value={confirmarSenha}
                onChangeText={v => { setConfirmarSenha(v); setErro(''); }}
                onFocus={() => setConfirmFocado(true)}
                onBlur={() => setConfirmFocado(false)}
              />
              <TouchableOpacity onPress={() => setMostrarConfirm(v => !v)} activeOpacity={0.7} style={styles.olho}>
                <MaterialCommunityIcons name={mostrarConfirm ? 'eye-outline' : 'eye-off-outline'} size={22} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={{ flex: 1 }} />

        <View style={styles.bottomSection}>
          <TouchableOpacity
            style={[styles.btnContinuar, !formValido && styles.btnContinuarDisabled]}
            onPress={handleCadastro}
            disabled={!formValido || carregando}
            activeOpacity={0.85}
          >
            {carregando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.txtBtnContinuar}>CONTINUAR</Text>
            }
          </TouchableOpacity>

          <View style={styles.rodape}>
            <View style={styles.linhaSeparadora} />
            <View style={styles.linhaRodape}>
              <Text style={styles.textoCinzaRodape}>É técnico ou administrador? </Text>
              <TouchableOpacity onPress={() => console.log('Ir para convite')}>
                <Text style={styles.textoAzulRodape}>Entrar com código de convite</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

      </View>
    </ScrollView>
  );
}