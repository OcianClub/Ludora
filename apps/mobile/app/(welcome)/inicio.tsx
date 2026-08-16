import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { SvgProps } from 'react-native-svg';

import { colors, typography } from '@ludora/design-tokens';

import LogoArquivo from '@/assets/logo.svg';
const Logo = LogoArquivo as unknown as React.FC<SvgProps>;

export default function Inicio() {
  const router = useRouter();

  return (
    <View style={styles.container}>

      <View style={styles.conteudoCentral}>
        <View style={styles.logoWrapper}>
          <Logo width={90} height={90} />
        </View>
        
        <Text style={styles.titulo}>LUDORA</Text>
        <Text style={styles.subtitulo}>GESTÃO E ESTATÍSTICAS DE CLUBES</Text>

        <TouchableOpacity 
          style={styles.btnEntrar} 
          activeOpacity={0.8}
          onPress={() => router.push('/(auth)/login')}
        >
          <Text style={styles.txtBtnEntrar}>ENTRAR</Text>
        </TouchableOpacity>

        <View style={styles.linhaCadastro}>
          <Text style={styles.textoCinza}>Ainda não tem uma conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/cadastro')}>
            <Text style={styles.textoAzul}>Cadastre-se</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.rodape}>
        <View style={styles.linhaSeparadora} />
        <View style={styles.linhaCadastro}>
          <Text style={styles.textoCinzaRodape}>É técnico ou administrador? </Text>
          <TouchableOpacity onPress={() => console.log('Ir para tela de convite')}>
            <Text style={styles.textoAzulRodape}>Entrar com código de convite</Text>
          </TouchableOpacity>
        </View>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.fundo, 
    justifyContent: 'space-between', 
  },
  conteudoCentral: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoWrapper: {
    marginBottom: 20,
  },
  titulo: {
    color: colors.texto,
    fontSize: typography.fontSize.xxl,
    fontFamily: typography.fontFamily.titulo.bold,
    marginBottom: 8,
  },
  subtitulo: {
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.corpo.medium,
    letterSpacing: 0.5,
    marginBottom: 40,
  },
  btnEntrar: {
    width: '100%',
    backgroundColor: colors.primaria, 
    paddingVertical: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 24,
  },
  txtBtnEntrar: {
    color: '#FFFFFF',
    fontSize: typography.fontSize.md,
    fontFamily: typography.fontFamily.corpo.semiBold,
  },
  linhaCadastro: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textoCinza: {
    color: colors.textoSecundario,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.corpo.regular,
  },
  textoAzul: {
    color: colors.primaria,
    fontSize: typography.fontSize.sm,
    fontFamily: typography.fontFamily.corpo.semiBold,
  },
  rodape: {
    paddingBottom: 40, 
    paddingHorizontal: 24,
  },
  linhaSeparadora: {
    height: 1,
    backgroundColor: colors.linha, 
    width: '100%',
    marginBottom: 20,
  },
  textoCinzaRodape: {
    color: colors.textoSecundario,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.corpo.regular,
  },
  textoAzulRodape: {
    color: colors.primaria,
    fontSize: typography.fontSize.xs,
    fontFamily: typography.fontFamily.corpo.medium,
  },
});