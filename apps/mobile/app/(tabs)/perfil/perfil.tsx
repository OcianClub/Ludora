import Svg, { Path } from 'react-native-svg';
import { Icon, type IconName } from '@ludora/icons';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useState, useCallback, useRef } from "react";
import { createStyles } from "../../../src/styles/perfilStyles";
import { HeaderClube } from "@/src/components/HeaderClube";
import { ConfirmacaoConta } from '@/src/components/ConfirmacaoConta';
import { PreferenciasNotificacoes } from '@/src/components/PreferenciasNotificacoes';
import { useTheme } from '@/src/contexts/ThemeContext';
import { router, useFocusEffect } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { limparCacheConsultas } from '@/src/services/cacheConsultas';
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import { desvincularDispositivoPush, fetchClubes, type ClubeListado } from '@/src/services/api';
import type { PreferenciaTema } from '@/src/utils/tema';

import DadosPessoais from "./dadosPessoais/dadosPessoais";

const SECOES = [
  { id: 'conta', label: 'Conta', icon: 'account' },
  { id: 'preferencias', label: 'Preferências', icon: null },
  { id: 'clubes', label: 'Meus clubes', icon: 'shield-outline' },
] as const;
const ROTULOS_CLUBE = { ADMIN: 'Administrador', TECNICO: 'Técnico', MESARIO: 'Mesário', OLHEIRO: 'Olheiro', TORCEDOR: 'Visitante' };
type SecaoPerfil = typeof SECOES[number]['id'];

interface CardMenuProps {
  titulo: string;
  subtitulo: string;
  icone: IconName;
  action: () => void;
  ultimo?: boolean;
}

function CardMenu({
  titulo,
  subtitulo,
  icone,
  action,
  ultimo,
}: CardMenuProps) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <TouchableOpacity
      style={[styles.menuItem, ultimo && { borderBottomWidth: 0 }]}
      accessibilityRole="button"
      activeOpacity={0.75}
      onPress={action}
    >
      <View style={styles.menuIcon}>
        <Icon
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

      <Icon
        name="chevron-right"
        size={22}
        color={colors.textoSecundario}
      />
    </TouchableOpacity>
  );
}

export default function Perfil() {
  const [secao, setSecao] = useState<SecaoPerfil>('conta');
  const scrollRef = useRef<ScrollView>(null);
  const { colors, preferenciaTema, carregandoTema, definirPreferenciaTema } = useTheme();
  const [modalNotificacoes, setModalNotificacoes] = useState(false);
  const [salvandoTema, setSalvandoTema] = useState(false);
  const styles = createStyles(colors);
  const { clubeAtivo, limparClubeAtivo } = useClubeAtivo();
  const {
    notificacoesAtivas,
    carregandoPreferencia,
    alterarNotificacoes,
  } = useNotificacoes();
  const [modalSair, setModalSair] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [dadosPendentes, setDadosPendentes] = useState(false);
  const [dadosEmOperacao, setDadosEmOperacao] = useState(false);
  const [clubes, setClubes] = useState<ClubeListado[] | null>(null);
  const [erroClubes, setErroClubes] = useState(false);
  const [revisaoClubes, setRevisaoClubes] = useState(0);

  useFocusEffect(useCallback(() => {
    if (secao !== 'clubes') return;
    let ativo = true;
    setErroClubes(false);
    void fetchClubes().then(lista => {
      if (ativo) setClubes(lista);
    }).catch(() => {
      if (ativo) setErroClubes(true);
    });
    return () => { ativo = false; };
  }, [secao, revisaoClubes]));

  const meusClubes = clubes?.filter(clube => clube.isSeguindo || clube.papel || clube.id === clubeAtivo?.id)
    .sort((a, b) => Number(b.id === clubeAtivo?.id) - Number(a.id === clubeAtivo?.id) ||
      Number(!!b.papel && b.papel !== 'TORCEDOR') - Number(!!a.papel && a.papel !== 'TORCEDOR'));

  const navegarSemPerderDados = (acao: () => void) => {
    if (dadosEmOperacao) return;
    if (!dadosPendentes) { acao(); return; }
    Alert.alert('Descartar alterações?', 'Suas alterações ainda não foram salvas.', [
      { text: 'Continuar editando', style: 'cancel' },
      { text: 'Descartar', style: 'destructive', onPress: () => {
        setDadosPendentes(false);
        acao();
      } },
    ]);
  };

  const deslogar = async () => {
    if (saindo) return;
    setSaindo(true);
    try {
      // Desvincula o push enquanto a credencial da conta ainda está disponível.
      await desvincularDispositivoPush();
      await limparCacheConsultas();
      await limparClubeAtivo();
      await Promise.all(['userToken', 'userRole', 'userName', 'userEmail', 'userCriadoEm', 'userData', 'expoPushToken'].map(chave => SecureStore.deleteItemAsync(chave)));
      router.replace("/(auth)/login");
    } catch {
      Alert.alert('Não foi possível sair', 'Confira sua conexão e tente novamente para desvincular as notificações desta conta com segurança.');
    } finally {
      setSaindo(false);
    }
  };

  const alternarNotificacoes = async (ativa: boolean) => {
    try {
    const atualizado = await alterarNotificacoes(ativa);
    if (!atualizado && ativa) {
      Alert.alert(
        'Permissão necessária',
        'Permita notificações nas configurações do dispositivo para receber avisos sobre partidas.',
      );
    }
    } catch (error) {
      Alert.alert('Não foi possível atualizar', error instanceof Error ? error.message : 'Confira sua conexão e tente novamente.');
    }
  };

  const escolherTema = async (preferencia: PreferenciaTema) => {
    if (carregandoTema || salvandoTema) return;
    if (preferencia === preferenciaTema) return;
    setSalvandoTema(true);
    try {
      await definirPreferenciaTema(preferencia);
    } catch {
      Alert.alert('Não foi possível salvar o tema', 'Tente novamente. Sua preferência anterior foi mantida.');
    } finally {
      setSalvandoTema(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <HeaderClube />
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.profileTitleRow}>
          <Text style={styles.profileTitle} accessibilityRole="header">Meu perfil</Text>
          <TouchableOpacity style={styles.outlineAction} accessibilityRole="button"
            onPress={() => navegarSemPerderDados(() => router.navigate('/'))}>
            <Icon name="chevron-left" size={17} color={colors.textoSecundario} />
            <Text style={styles.outlineActionText}>Voltar ao clube</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.sectionTabs} accessibilityRole="tablist">
          {SECOES.map(item => (
            <TouchableOpacity key={item.id}
              style={[styles.sectionTab, secao === item.id && styles.sectionTabActive]}
              accessibilityRole="tab" accessibilityState={{ selected: secao === item.id }}
              onPress={() => navegarSemPerderDados(() => {
                setSecao(item.id);
                scrollRef.current?.scrollTo({ y: 0, animated: false });
              })}>
              {item.icon ? (
                <Icon name={item.icon} size={19} color={secao === item.id ? colors.primaria : colors.textoSecundario} />
              ) : (
                <Svg width={19} height={19} viewBox="0 0 24 24" accessible={false}>
                  <Path
                    d="M4 6h7m4 0h5M4 12h3m4 0h9M4 18h11m4 0h1M11 4v4M7 10v4m8 2v4"
                    stroke={secao === item.id ? colors.primaria : colors.textoSecundario}
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </Svg>
              )}
              <Text style={[styles.sectionTabText, secao === item.id && styles.sectionTabTextActive]}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {secao === 'conta' && (
          <DadosPessoais embutido onAlteracoesPendentes={setDadosPendentes} onOperacaoEmAndamento={setDadosEmOperacao}>
            <View style={styles.sessionBlock}>
              <View style={styles.sessionHeading}>
                <Icon name="logout" size={20} color={colors.textoSecundario} />
                <View style={styles.menuContent}>
                  <Text style={styles.menuTitulo}>Sair da conta</Text>
                  <Text style={styles.menuSubtitulo}>Encerra sua sessão neste dispositivo.</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.outlineAction} accessibilityRole="button"
                onPress={() => navegarSemPerderDados(() => setModalSair(true))}>
                <Text style={styles.outlineActionText}>Sair da conta</Text>
              </TouchableOpacity>
            </View>
          </DadosPessoais>
        )}

        {secao === 'preferencias' && <>
        <View style={styles.sectionIntro}>
          <Text style={styles.pageSectionTitle} accessibilityRole="header">Preferências</Text>
          <Text style={styles.sectionDescription}>Personalize o tema e os avisos do Ludora.</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              NOTIFICAÇÕES
            </Text>
          </View>

          <View style={styles.menu}>
            <View style={styles.themeItem}>
              <View style={styles.menuIcon}>
                <Icon name="bell-outline" size={21} color={colors.primaria} />
              </View>

              <View style={styles.menuContent}>
                <Text style={styles.menuTitulo}>
                  Receber notificações
                </Text>

                <Text style={styles.menuSubtitulo}>
                  {notificacoesAtivas
                    ? 'Avisos de partidas, gols e resultados'
                    : 'Avisos externos estão desativados'}
                </Text>
              </View>

              <Switch
                value={notificacoesAtivas}
                onValueChange={alternarNotificacoes}
                disabled={carregandoPreferencia}
                trackColor={{
                  false: colors.cardSecundario,
                  true: colors.primaria,
                }}
                thumbColor={colors.textoSobrePrimaria}
                ios_backgroundColor={colors.cardSecundario}
                accessibilityLabel="Receber notificações"
              />
            </View>
            <View style={styles.menuDivider} />
            <CardMenu
              titulo="Avisos por clube"
              subtitulo="Escolha quais avisos deseja receber"
              icone="bell-outline"
              action={() => setModalNotificacoes(true)}
              ultimo
            />
            <View style={styles.menuDivider} />
            <CardMenu
              titulo="Histórico de notificações"
              subtitulo="Consulte os avisos do clube atual"
              icone="bell-outline"
              action={() => router.push('perfil/notificacoes')}
              ultimo
            />
          </View>
        </View>
        <View style={styles.section}>
          <View style={[styles.menu, styles.themeSettingRow]}>
            <View style={styles.themeDescription}>
              <Text style={styles.menuTitulo}>Aparência</Text>
              <Text style={styles.sectionDescription}>Escolha entre o tema do dispositivo, claro ou escuro.</Text>
            </View>
            <View style={styles.themeControl} accessibilityRole="radiogroup" accessibilityLabel="Tema">
              {([
                { valor: 'system', label: 'Sistema', desenho: 'M9 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 15h2' },
                { valor: 'light', label: 'Claro', desenho: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M19 5l-1.5 1.5m-11 11L5 19' },
                { valor: 'dark', label: 'Escuro', desenho: 'M20.8 13.3A8.8 8.8 0 1 1 10.7 3.2 7.4 7.4 0 0 0 20.8 13.3Z' },
              ] as const).map(({ valor, label, desenho }) => {
                const selecionado = preferenciaTema === valor;
                const bloqueado = carregandoTema || salvandoTema;
                return (
                  <TouchableOpacity key={valor} style={[styles.themeOption, selecionado && styles.themeOptionActive]}
                    accessibilityRole="radio" accessibilityLabel={label}
                    accessibilityState={{ checked: selecionado, disabled: bloqueado }}
                    disabled={bloqueado} onPress={() => void escolherTema(valor)}>
                    <Svg width={18} height={18} viewBox="0 0 24 24" accessible={false}>
                      <Path d={desenho} fill="none" stroke={selecionado ? colors.primaria : colors.textoSecundario}
                        strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                    </Svg>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
        </>}

        {secao === 'clubes' && (
          <View style={styles.clubCard}>
            <Text style={styles.pageSectionTitle} accessibilityRole="header">Meus clubes</Text>
            <Text style={styles.sectionDescription}>Seus acessos e clubes que você segue.</Text>
            {erroClubes && <CardMenu titulo="Tentar novamente" subtitulo="Não foi possível carregar seus clubes." icone="alert-circle-outline" action={() => setRevisaoClubes(valor => valor + 1)} />}
            {!clubes && !erroClubes && <Text style={styles.sectionDescription}>Carregando clubes…</Text>}
            {meusClubes?.length === 0 && <Text style={styles.sectionDescription}>Você ainda não tem clubes vinculados.</Text>}
            {meusClubes?.map(clube => (
                <View key={clube.id} style={styles.sessionHeading}>
                  <View style={styles.clubCrest}>
                    {clube.escudo ? <Image source={{ uri: clube.escudo }} style={styles.clubImage} resizeMode="contain" /> :
                      <Text style={styles.menuTitulo}>{clube.nome.charAt(0).toUpperCase()}</Text>}
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuTitulo}>{clube.nome}</Text>
                    <Text style={styles.menuSubtitulo}>{[clube.id === clubeAtivo?.id && 'Clube atual', clube.papel && ROTULOS_CLUBE[clube.papel], clube.isSeguindo && 'Seguindo'].filter(Boolean).join(' · ')}</Text>
                  </View>
                </View>
              ))}
            <TouchableOpacity style={styles.outlineAction} accessibilityRole="button" onPress={() => router.navigate('/clubes/clubes')}>
              <Text style={styles.outlineActionText}>Explorar clubes</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {modalNotificacoes && <PreferenciasNotificacoes onFechar={() => setModalNotificacoes(false)} />}


      {/* MODAL SAIR */}
      <ConfirmacaoConta
        visible={modalSair}
        titulo="Sair da sua conta?"
        descricao="Você sairá do Ludora neste aparelho. Sua conta será mantida e você poderá entrar novamente quando quiser."
        icone="logout"
        confirmarTexto="Sair da conta"
        carregandoTexto="Encerrando sessão..."
        carregando={saindo}
        onConfirmar={() => void deslogar()}
        onFechar={() => setModalSair(false)}
      />

    </KeyboardAvoidingView>
  );
}
