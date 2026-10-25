import { Icon, type IconName } from '@ludora/icons';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Pressable,
  Switch,
  Alert,
  ScrollView,
} from "react-native";
import { useState, useEffect, useRef } from "react";
import { createStyles } from "../../../src/styles/perfilStyles";
import { Header } from "@/src/components/Header";
import { ConfirmacaoConta } from '@/src/components/ConfirmacaoConta';
import { PreferenciasNotificacoes } from '@/src/components/PreferenciasNotificacoes';
import { useTheme } from '@/src/contexts/ThemeContext';
import { router } from "expo-router";
import * as SecureStore from "expo-secure-store";
import { limparCacheConsultas } from '@/src/services/cacheConsultas';
import { useClubeAtivo } from "@/src/contexts/ClubeAtivoContext";
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import { desvincularDispositivoPush } from '@/src/services/api';
import type { PreferenciaTema } from '@/src/utils/tema';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import DadosPessoais from "./dadosPessoais/dadosPessoais";

const SECOES = [
  { id: 'dados', label: 'Dados pessoais' },
  { id: 'preferencias', label: 'Preferências' },
  { id: 'conta', label: 'Conta' },
] as const;
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
  const [secao, setSecao] = useState<SecaoPerfil>('dados');
  const scrollRef = useRef<ScrollView>(null);
  const { colors, preferenciaTema, carregandoTema, definirPreferenciaTema } = useTheme();
  const insets = useSafeAreaInsets();
  const [modalTema, setModalTema] = useState(false);
  const [modalNotificacoes, setModalNotificacoes] = useState(false);
  const [salvandoTema, setSalvandoTema] = useState(false);
  const styles = createStyles(colors);
  const { clubeAtivo, limparClubeAtivo } = useClubeAtivo();
  const {
    notificacoesAtivas,
    carregandoPreferencia,
    alterarNotificacoes,
  } = useNotificacoes();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState('');
  const [membroDesde, setMembroDesde] = useState("");
  const [modalSair, setModalSair] = useState(false);
  const [saindo, setSaindo] = useState(false);
  const [modalDadosPessoais, setModalDadosPessoais] =
    useState(false);
  const [dadosPendentes, setDadosPendentes] = useState(false);
  const [dadosEmOperacao, setDadosEmOperacao] = useState(false);

  useEffect(() => {
    carregarDados();
  }, []);

  const carregarDados = async () => {
    const [nomeUsuario, emailUsuario, dataCriacao] = await Promise.all([
      SecureStore.getItemAsync('userName'),
      SecureStore.getItemAsync('userEmail'),
      SecureStore.getItemAsync('userCriadoEm'),
    ]);
    setEmail(emailUsuario ?? '');

    if (nomeUsuario) {
      setNome(nomeUsuario);
    }

    if (dataCriacao) {
      const data = new Date(dataCriacao);

      const formatada = data.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });

      setMembroDesde(formatada.replace(".", ""));
    }

  };

  const fecharDadosPessoais = async () => {
    setModalDadosPessoais(false);
    await carregarDados();
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
    if (preferencia === preferenciaTema) { setModalTema(false); return; }
    setSalvandoTema(true);
    try {
      await definirPreferenciaTema(preferencia);
      setModalTema(false);
    } catch {
      Alert.alert('Não foi possível salvar o tema', 'Tente novamente. Sua preferência anterior foi mantida.');
    } finally {
      setSalvandoTema(false);
    }
  };

  return (
    <View style={styles.container}>
      <Header
        title="Meu perfil"
        showLogo={false}
        showProfile={false}
        btnVoltar="arrow-left"
        papelUsuario={clubeAtivo?.papel ?? undefined}
      />

      <View style={styles.sectionTabs} accessibilityRole="tablist">
        {SECOES.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[styles.sectionTab, secao === item.id && styles.sectionTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: secao === item.id }}
            activeOpacity={0.75}
            onPress={() => {
              setSecao(item.id);
              scrollRef.current?.scrollTo({ y: 0, animated: false });
            }}
          >
            <Text style={[styles.sectionTabText, secao === item.id && styles.sectionTabTextActive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {secao === 'dados' && <>
        <View style={styles.sectionIntro}>
          <Text style={styles.pageSectionTitle} accessibilityRole="header">Dados pessoais</Text>
          <Text style={styles.sectionDescription}>Suas informações de identificação e acesso.</Text>
        </View>
        <View style={styles.profileHeader}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatar}>
              <Text style={styles.avatarLetra}>
                {nome
                  ? nome.charAt(0).toUpperCase()
                  : "?"}
              </Text>
            </View>

          </View>
          <View style={styles.profileIdentity}>
          <Text style={styles.nomeUsuario}>
            {nome || "Usuário"}
          </Text>

          {membroDesde ? (
            <Text style={styles.dataMembro}>
              Membro desde {membroDesde}
            </Text>
          ) : null}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.menu}>
            <View style={styles.personalInfoRow}>
              <Text style={styles.personalInfoLabel}>Nome</Text>
              <Text style={styles.personalInfoValue} selectable>{nome || 'Não informado'}</Text>
            </View>
            <View style={styles.personalInfoRow}>
              <Text style={styles.personalInfoLabel}>E-mail</Text>
              <Text style={styles.personalInfoValue} selectable>{email || 'Não informado'}</Text>
            </View>
            <CardMenu
              titulo="Editar meus dados"
              subtitulo="Nome, e-mail e senha"
              icone="pencil-outline"
              action={() =>
                setModalDadosPessoais(true)
              }
              ultimo
            />
          </View>
        </View>
        </>}

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
          <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>APARÊNCIA</Text></View>
          <View style={styles.menu}>
            <TouchableOpacity
              style={styles.themeSettingRow}
              onPress={() => setModalTema(true)}
              disabled={carregandoTema}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel={`Tema: ${preferenciaTema === 'system' ? 'Sistema' : preferenciaTema === 'light' ? 'Claro' : 'Escuro'}`}
              accessibilityHint="Abre as opções de aparência"
            >
              <View style={styles.themePreviewWrapper} accessible={false}><View style={styles.themePreview}><View style={styles.themePreviewHalf} /></View></View>
              <Text style={[styles.menuTitulo, styles.themeSettingTitle]}>Tema</Text>
              <Text style={styles.themeCurrentValue}>{preferenciaTema === 'system' ? 'Sistema' : preferenciaTema === 'light' ? 'Claro' : 'Escuro'}</Text>
              <Icon name="chevron-right" size={20} color={colors.textoSecundario} />
            </TouchableOpacity>
          </View>
        </View>
        </>}

        {secao === 'conta' && <>
        <View style={styles.sectionIntro}>
          <Text style={styles.pageSectionTitle} accessibilityRole="header">Conta</Text>
          <Text style={styles.sectionDescription}>Gerencie seus dados de acesso e sua sessão neste aparelho.</Text>
        </View>
        <View style={styles.section}>
          <View style={styles.menu}>
            <CardMenu
              titulo="Gerenciar conta"
              subtitulo="Segurança, acesso e exclusão da conta"
              icone="lock-outline"
              action={() => setModalDadosPessoais(true)}
              ultimo
            />
          </View>
        </View>
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.logoutButton}
            activeOpacity={0.75}
            onPress={() => setModalSair(true)}
            accessibilityRole="button"
            accessibilityLabel="Sair da conta"
          >
            <View style={styles.logoutIcon}>
              <Icon
                name="logout"
                size={20}
                color={colors.tituloErro}
              />
            </View>

            <View style={styles.logoutContent}>
              <Text style={styles.logoutTitle}>
                Sair da conta
              </Text>

            </View>

            <Icon
              name="chevron-right"
              size={22}
              color={colors.tituloErro}
            />
          </TouchableOpacity>
        </View>
        </>}
      </ScrollView>

      {modalNotificacoes && <PreferenciasNotificacoes onFechar={() => setModalNotificacoes(false)} />}

      <Modal visible={modalTema} transparent animationType="slide" onRequestClose={() => setModalTema(false)}>
        <View style={styles.themeSheetOverlay}>
          <Pressable style={styles.themeBackdrop} onPress={() => setModalTema(false)} accessibilityRole="button" accessibilityLabel="Fechar opções de tema" />
          <View style={[styles.themeSheet, { paddingBottom: Math.max(insets.bottom, 16) + 12 }]} accessibilityViewIsModal>
            <View style={styles.themeSheetHeader}>
              <Text style={styles.themeSheetTitle}>Tema</Text>
              <TouchableOpacity style={styles.themeCloseButton} onPress={() => setModalTema(false)} accessibilityRole="button" accessibilityLabel="Fechar">
                <Icon name="close" size={22} color={colors.textoSecundario} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.themeSheetList} showsVerticalScrollIndicator={false}>
              {([
                { valor: 'system', label: 'Usar tema do sistema' },
                { valor: 'light', label: 'Claro' },
                { valor: 'dark', label: 'Escuro' },
              ] as const).map(({ valor, label }) => (
                <TouchableOpacity key={valor} style={styles.themeChoice} onPress={() => void escolherTema(valor)} disabled={carregandoTema || salvandoTema} accessibilityRole="radio" accessibilityState={{ checked: preferenciaTema === valor, disabled: carregandoTema || salvandoTema }} activeOpacity={0.7}>
                  <Text style={[styles.themeChoiceText, preferenciaTema === valor && styles.themeChoiceTextSelected]}>{label}</Text>
                  <View style={[styles.themeRadio, preferenciaTema === valor && styles.themeRadioSelected]}>
                    {preferenciaTema === valor && <View style={styles.themeRadioDot} />}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

      {/* DADOS PESSOAIS */}
      <Modal
        visible={modalDadosPessoais}
        transparent={false}
        animationType="slide"
        onRequestClose={() => {
          if (dadosEmOperacao) return;
          if (!dadosPendentes) { void fecharDadosPessoais(); return; }
          Alert.alert('Descartar alterações?', 'Suas alterações ainda não foram salvas.', [
            { text: 'Continuar editando', style: 'cancel' },
            { text: 'Descartar', style: 'destructive', onPress: () => void fecharDadosPessoais() },
          ]);
        }}
      >
        {modalDadosPessoais && <DadosPessoais
          noModal={true}
          onFechar={fecharDadosPessoais}
          onAlteracoesPendentes={setDadosPendentes}
          onOperacaoEmAndamento={setDadosEmOperacao}
        />}
      </Modal>

    </View>
  );
}
