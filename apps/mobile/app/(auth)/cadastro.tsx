import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { BASE_URL } from '@/src/services/api';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../../src/styles/cadastroStyles';
import { colors } from '@/src/theme/colors';

function Requisito({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <View style={styles.requisitoItem}>
      <MaterialCommunityIcons
        name={ok ? 'check-circle' : 'circle-outline'}
        size={13}
        color={ok ? '#22c55e' : '#444'}
      />
      <Text style={[styles.requisitoTxt, ok && styles.requisitoOk]}>{texto}</Text>
    </View>
  );
}

export default function Cadastro() {
  const router = useRouter();

  const [nome,           setNome]           = useState('');
  const [email,          setEmail]          = useState('');
  const [senha,          setSenha]          = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [mostrarSenha,   setMostrarSenha]   = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [carregando,     setCarregando]     = useState(false);
  const [erro,           setErro]           = useState('');

  const [nomeFocado,    setNomeFocado]    = useState(false);
  const [emailFocado,   setEmailFocado]   = useState(false);
  const [senhaFocada,   setSenhaFocada]   = useState(false);
  const [confirmFocado, setConfirmFocado] = useState(false);

  const senhaMin6    = senha.length >= 6;
  const senhaCoincidem = senha === confirmarSenha && confirmarSenha.length > 0;
  const emailValido  = /\S+@\S+\.\S+/.test(email);

  const formValido = nome.trim() && emailValido && senhaMin6 && senhaCoincidem;

  const handleCadastro = async () => {
    setErro('');
    if (!formValido) {
      setErro('Preencha todos os campos corretamente.');
      return;
    }
    setCarregando(true);
    try {
      const resposta = await fetch(`${BASE_URL}/auth/registrar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), senha, nome: nome.trim(), role: 'USER' }),
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
          <MaterialCommunityIcons name="arrow-left" size={22} color={colors.text} />
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <MaterialCommunityIcons name="account-plus-outline" size={34} color={colors.primary} />
        </View>

        <Text style={styles.titulo}>Criar Conta</Text>
        <Text style={styles.subtitulo}>Junte-se ao CFA Ocian</Text>

        <View style={styles.form}>
          {erro !== '' && (
            <View style={styles.erroContainer}>
              <MaterialCommunityIcons name="alert-circle-outline" size={18} color={colors.vermelho} />
              <Text style={styles.erroTxt}>{erro}</Text>
            </View>
          )}

          <View>
            <Text style={styles.inputLabel}>NOME COMPLETO</Text>
            <View style={[styles.inputRow, nomeFocado && styles.inputRowFocado]}>
              <MaterialCommunityIcons name="account-outline" size={18} color={nomeFocado ? colors.primary : colors.text_secondary} />
              <TextInput
                style={styles.input}
                placeholder="Seu nome"
                placeholderTextColor="#444"
                autoCapitalize="words"
                value={nome}
                onChangeText={v => { setNome(v); setErro(''); }}
                onFocus={() => setNomeFocado(true)}
                onBlur={() => setNomeFocado(false)}
              />
            </View>
          </View>

          <View>
            <Text style={styles.inputLabel}>E-MAIL</Text>
            <View style={[styles.inputRow, emailFocado && styles.inputRowFocado, email && !emailValido && styles.inputRowErro]}>
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
              {emailValido && (
                <MaterialCommunityIcons name="check-circle" size={16} color="#22c55e" />
              )}
            </View>
          </View>

          <View>
            <Text style={styles.inputLabel}>SENHA</Text>
            <View style={[styles.inputRow, senhaFocada && styles.inputRowFocado]}>
              <MaterialCommunityIcons name="lock-outline" size={18} color={senhaFocada ? colors.primary : colors.text_secondary} />
              <TextInput
                style={styles.input}
                placeholder="Mínimo 6 caracteres"
                placeholderTextColor="#444"
                secureTextEntry={!mostrarSenha}
                value={senha}
                onChangeText={v => { setSenha(v); setErro(''); }}
                onFocus={() => setSenhaFocada(true)}
                onBlur={() => setSenhaFocada(false)}
              />
              <TouchableOpacity onPress={() => setMostrarSenha(v => !v)} activeOpacity={0.7}>
                <MaterialCommunityIcons name={mostrarSenha ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.text_secondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View>
            <Text style={styles.inputLabel}>CONFIRMAR SENHA</Text>
            <View style={[styles.inputRow, confirmFocado && styles.inputRowFocado, confirmarSenha && !senhaCoincidem && styles.inputRowErro]}>
              <MaterialCommunityIcons name="lock-check-outline" size={18} color={confirmFocado ? colors.primary : colors.text_secondary} />
              <TextInput
                style={styles.input}
                placeholder="Repita a senha"
                placeholderTextColor="#444"
                secureTextEntry={!mostrarConfirm}
                value={confirmarSenha}
                onChangeText={v => { setConfirmarSenha(v); setErro(''); }}
                onFocus={() => setConfirmFocado(true)}
                onBlur={() => setConfirmFocado(false)}
              />
              <TouchableOpacity onPress={() => setMostrarConfirm(v => !v)} activeOpacity={0.7}>
                <MaterialCommunityIcons name={mostrarConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.text_secondary} />
              </TouchableOpacity>
            </View>
          </View>

          {senha.length > 0 && (
            <View style={styles.requisitos}>
              <Requisito ok={senhaMin6} texto="Mínimo 6 caracteres" />
              <Requisito ok={senhaCoincidem} texto="Senhas coincidem" />
            </View>
          )}

          <TouchableOpacity
            style={[styles.btnEntrar, !formValido && styles.btnEntrarDisabled]}
            onPress={handleCadastro}
            disabled={!formValido || carregando}
            activeOpacity={0.85}
          >
            {carregando
              ? <ActivityIndicator color="#FFF" />
              : <Text style={styles.txtBtnEntrar}>CRIAR CONTA</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity style={styles.btnCadastro} onPress={() => router.back()} activeOpacity={0.7}>
            <Text style={styles.txtCadastro}>
              Já tem uma conta?{' '}
              <Text style={styles.txtCadastroDestaque}>Faça login</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
}