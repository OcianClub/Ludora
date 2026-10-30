import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  PanResponder,
  RefreshControl,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon, type IconName } from '@ludora/icons';
import { Header } from '@/src/components/Header';
import { useClubeAtivo } from '@/src/contexts/ClubeAtivoContext';
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  excluirNotificacao,
  fetchNotificacoes,
  limparNotificacoesLidas,
  marcarNotificacaoComoLida,
  marcarTodasNotificacoesComoLidas,
  type Notificacao,
} from '@/src/services/api';
import { createStyles } from '@/src/styles/notificacoesStyles';
import { criarEscopoNotificacoes } from '@/src/utils/escopoNotificacoes';

function grupoData(data: string) {
  const dia = new Date(data);
  const hoje = new Date();
  const ontem = new Date();
  ontem.setDate(hoje.getDate() - 1);
  if (dia.toDateString() === hoje.toDateString()) return 'Hoje';
  if (dia.toDateString() === ontem.toDateString()) return 'Ontem';
  return dia.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

const tipos: Record<Notificacao['tipo'], { icone: IconName; nome: string }> = {
  PARTIDA_AGENDADA: { icone: 'calendar-outline', nome: 'Agenda' },
  GOL_PARTIDA: { icone: 'soccer', nome: 'Gol' },
  RESULTADO_PARTIDA: { icone: 'trophy', nome: 'Resultado' },
};

function CartaoNotificacao({
  item,
  ocupado,
  onLer,
  onExcluir,
}: {
  item: Notificacao;
  ocupado: boolean;
  onLer: () => void;
  onExcluir: () => void;
}) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const deslocamento = useRef(new Animated.Value(0)).current;
  const acoes = useRef({ ocupado, onExcluir });
  acoes.current = { ocupado, onExcluir };
  const voltar = () =>
    Animated.spring(deslocamento, {
      toValue: 0,
      useNativeDriver: true,
      bounciness: 0,
    }).start();
  const gesto = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        !acoes.current.ocupado && dx < -14 && Math.abs(dx) > Math.abs(dy) * 1.5,
      onPanResponderMove: (_, { dx }) =>
        deslocamento.setValue(Math.max(-140, Math.min(0, dx))),
      onPanResponderRelease: (_, { dx }) => {
        if (dx < -100 && !acoes.current.ocupado) acoes.current.onExcluir();
        voltar();
      },
      onPanResponderTerminate: voltar,
    })
  ).current;
  const tipo = tipos[item.tipo];
  return (
    <View style={styles.swipeContainer}>
      <View
        style={styles.swipeBackground}
        importantForAccessibility="no-hide-descendants"
      >
        <Icon name="trash" size={23} color={colors.tituloErro} />
        <Text style={styles.swipeText}>Excluir</Text>
      </View>
      <Animated.View
        style={{ transform: [{ translateX: deslocamento }] }}
        {...gesto.panHandlers}
      >
        <View
          style={[
            styles.notificationCard,
            !item.lida && styles.notificationCardUnread,
          ]}
        >
          <TouchableOpacity
            style={styles.cardMain}
            onPress={onLer}
            disabled={ocupado || (item.lida && !item.dados?.solicitacaoId && !item.partida_id)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${item.lida ? 'Lida' : 'Não lida'}. ${item.titulo}. ${item.corpo}`}
            accessibilityHint="Toque para marcar como lida"
          >
            <View style={styles.notificationIcon}>
              <Icon
                name={tipo.icone}
                size={22}
                color={
                  item.tipo === 'GOL_PARTIDA' ? colors.amarelo : colors.primaria
                }
              />
            </View>
            <View style={styles.notificationContent}>
              <View style={styles.notificationTopLine}>
                {!item.lida && <View style={styles.unreadDot} />}
                <Text style={styles.typeText}>{tipo.nome}</Text>
                <Text style={styles.notificationTime}>
                  {new Date(item.criada_em).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.notificationTitle}>{item.titulo}</Text>
              <Text style={styles.notificationBody}>{item.corpo}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={onExcluir}
            disabled={ocupado}
            accessibilityRole="button"
            accessibilityLabel={`Excluir notificação: ${item.titulo}`}
          >
            {ocupado ? (
              <ActivityIndicator size="small" color={colors.textoSecundario} />
            ) : (
              <Icon name="trash" size={19} color={colors.textoSecundario} />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
}

export default function Notificacoes() {
  const router = useRouter();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { clubeAtivo } = useClubeAtivo();
  const { atualizarNaoLidas, versaoNotificacoes } = useNotificacoes();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [totalNaoLidas, setTotalNaoLidas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [excluindo, setExcluindo] = useState<number[]>([]);
  const pendentes = useRef(new Set<number>());
  const requisicao = useRef(0);
  const [filtro, setFiltro] = useState<'todas' | 'naoLidas'>('todas');
  const [erro, setErro] = useState('');
  const escopo = useRef(criarEscopoNotificacoes()).current;
  escopo.definirClube(clubeAtivo?.papel ? clubeAtivo.id : null);

  const carregar = useCallback(
    async (refresh = false) => {
      const atual = ++requisicao.current;
      if (!clubeAtivo?.papel) {
        setNotificacoes([]);
        setTotalNaoLidas(0);
        setCarregando(false);
        return;
      }
      if (refresh) setAtualizando(true);
      setErro('');
      try {
        const resposta = await fetchNotificacoes(100, clubeAtivo.id);
        if (atual !== requisicao.current) return;
        setNotificacoes(
          resposta.notificacoes.filter(
            (item) => !pendentes.current.has(item.id)
          )
        );
        setTotalNaoLidas(resposta.totalNaoLidas);
      } catch {
        if (atual === requisicao.current)
          setErro('Não foi possível atualizar os avisos. Tente novamente.');
      } finally {
        if (atual === requisicao.current) {
          setCarregando(false);
          setAtualizando(false);
        }
      }
    },
    [clubeAtivo?.id, clubeAtivo?.papel]
  );

  useEffect(() => {
    setNotificacoes([]);
    setTotalNaoLidas(0);
    setCarregando(true);
    setOcupado(false);
    setExcluindo([]);
    pendentes.current.clear();
    return () => {
      requisicao.current += 1;
    };
  }, [clubeAtivo?.id, clubeAtivo?.papel]);
  useEffect(
    () => () => {
      escopo.definirClube(null);
    },
    [escopo]
  );
  useEffect(() => {
    void carregar();
  }, [carregar, versaoNotificacoes]);

  const atualizar = async () => {
    const contexto = escopo.capturar();
    await carregar();
    if (contexto.atual()) void atualizarNaoLidas().catch(() => undefined);
  };

  const ler = async (item: Notificacao) => {
    if (ocupado || pendentes.current.has(item.id)) return;
    if (item.dados?.solicitacaoId) router.push('/solicitacoes-partidas' as never);
    else if (item.partida_id) router.push(`/partida-compartilhada/${item.partida_id}` as never);
    if (item.lida) return;
    const operacao = escopo.iniciar();
    if (!operacao) return;
    if (operacao.clubeId !== clubeAtivo?.id) {
      operacao.concluir();
      return;
    }
    setOcupado(true);
    try {
      await marcarNotificacaoComoLida(item.id, operacao.clubeId);
      if (operacao.atual()) await atualizar();
    } catch {
      if (operacao.atual())
        setErro(
          'Não foi possível marcar o aviso como lido. Atualize para conferir o estado salvo.'
        );
    } finally {
      if (operacao.concluir()) setOcupado(false);
    }
  };

  const excluir = async (item: Notificacao) => {
    if (ocupado || pendentes.current.has(item.id)) return;
    const operacao = escopo.iniciar();
    if (!operacao) return;
    if (operacao.clubeId !== clubeAtivo?.id) {
      operacao.concluir();
      return;
    }
    pendentes.current.add(item.id);
    setExcluindo([...pendentes.current]);
    setOcupado(true);
    try {
      await excluirNotificacao(item.id, operacao.clubeId);
      if (!operacao.atual()) return;
      setNotificacoes((atuais) =>
        atuais.filter((aviso) => aviso.id !== item.id)
      );
      await atualizar();
    } catch {
      if (operacao.atual())
        setErro(
          'Não foi possível confirmar a exclusão. Atualize para conferir o estado salvo.'
        );
    } finally {
      if (operacao.concluir()) {
        pendentes.current.delete(item.id);
        setExcluindo([...pendentes.current]);
        setOcupado(false);
      }
    }
  };

  const acaoEmLote = async (
    limpar: boolean,
    clubeEsperado = clubeAtivo?.id
  ) => {
    if (ocupado || pendentes.current.size) return;
    const operacao = escopo.iniciar();
    if (!operacao) return;
    if (operacao.clubeId !== clubeEsperado) {
      operacao.concluir();
      return;
    }
    setOcupado(true);
    try {
      if (limpar) await limparNotificacoesLidas(operacao.clubeId);
      else await marcarTodasNotificacoesComoLidas(operacao.clubeId);
      if (operacao.atual()) await atualizar();
    } catch {
      if (operacao.atual())
        setErro(
          'Não foi possível confirmar a ação. Atualize para conferir o estado salvo.'
        );
    } finally {
      if (operacao.concluir()) setOcupado(false);
    }
  };

  const visiveis = notificacoes.filter(
    (item) => filtro === 'todas' || !item.lida
  );
  const bloqueado = ocupado || excluindo.length > 0;
  const possuiLidas = notificacoes.some((item) => item.lida);
  const confirmarLimpeza = () => {
    const contexto = escopo.capturar();
    Alert.alert(
      'Limpar avisos lidos?',
      'Os avisos já lidos deste clube serão excluídos do seu histórico. Os não lidos serão mantidos.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Limpar lidas',
          style: 'destructive',
          onPress: () => {
            if (contexto.atual()) void acaoEmLote(true, clubeAtivo?.id);
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <Header
        title="Notificações"
        btnVoltar="arrow-left"
        showProfile={false}
        papelUsuario={clubeAtivo?.papel ?? undefined}
      />
      {carregando ? (
        <View style={styles.emptyState}>
          <ActivityIndicator size="large" color={colors.primaria} />
        </View>
      ) : (
        <FlatList
          data={visiveis}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={atualizando}
              onRefresh={() => void carregar(true)}
              tintColor={colors.primaria}
              colors={[colors.primaria]}
            />
          }
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.clubName}>
                {clubeAtivo?.nome ?? 'Seu clube'}
              </Text>
              <Text style={styles.listDescription}>
                {!clubeAtivo?.papel
                  ? 'Siga este clube para receber e guardar os avisos dele.'
                  : totalNaoLidas
                    ? `${totalNaoLidas} ${totalNaoLidas === 1 ? 'aviso não lido' : 'avisos não lidos'}`
                    : 'Você está em dia com os avisos do clube.'}
              </Text>
              <View style={styles.filters}>
                {(['todas', 'naoLidas'] as const).map((valor) => (
                  <TouchableOpacity
                    key={valor}
                    style={[
                      styles.filterButton,
                      filtro === valor && styles.filterActive,
                    ]}
                    onPress={() => setFiltro(valor)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: filtro === valor }}
                  >
                    <Text
                      style={[
                        styles.filterText,
                        filtro === valor && styles.filterTextActive,
                      ]}
                    >
                      {valor === 'todas' ? 'Todas' : 'Não lidas'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {notificacoes.length > 0 && (
                <>
                  <View style={styles.actions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      disabled={bloqueado || !totalNaoLidas}
                      onPress={() => void acaoEmLote(false)}
                      accessibilityRole="button"
                    >
                      <Icon
                        name="check-all"
                        size={18}
                        color={
                          totalNaoLidas && !bloqueado
                            ? colors.primaria
                            : colors.textoSecundario
                        }
                      />
                      <Text
                        style={[
                          styles.actionText,
                          (!totalNaoLidas || bloqueado) && styles.disabledText,
                        ]}
                      >
                        Ler todas
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionButton,
                        (!possuiLidas || bloqueado) && styles.disabledAction,
                      ]}
                      disabled={bloqueado || !possuiLidas}
                      onPress={confirmarLimpeza}
                      accessibilityRole="button"
                    >
                      <Icon
                        name="trash"
                        size={17}
                        color={colors.textoSecundario}
                      />
                      <Text style={styles.secondaryActionText}>
                        Limpar lidas
                      </Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.hint}>
                    Deslize para a esquerda para excluir um aviso.
                  </Text>
                </>
              )}
              {!!erro && (
                <View style={styles.errorBox} accessibilityRole="alert">
                  <Text style={styles.errorText}>{erro}</Text>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => void carregar(true)}
                  >
                    <Text style={styles.actionText}>Tentar novamente</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Icon name="bell-outline" size={30} color={colors.primaria} />
              </View>
              <Text style={styles.emptyTitle}>
                {erro
                  ? 'Não conseguimos carregar'
                  : filtro === 'naoLidas'
                    ? 'Tudo lido por aqui'
                    : 'Nenhum aviso por enquanto'}
              </Text>
              <Text style={styles.emptyText}>
                {erro
                  ? 'Confira sua conexão e tente novamente.'
                  : filtro === 'naoLidas'
                    ? 'Seus avisos anteriores continuam na aba Todas.'
                    : 'Novas partidas, gols e resultados do clube aparecerão aqui.'}
              </Text>
            </View>
          }
          renderItem={({ item, index }) => (
            <>
              {(index === 0 ||
                grupoData(item.criada_em) !==
                  grupoData(visiveis[index - 1].criada_em)) && (
                <Text style={styles.dateTitle}>
                  {grupoData(item.criada_em)}
                </Text>
              )}
              <CartaoNotificacao
                item={item}
                ocupado={ocupado || excluindo.includes(item.id)}
                onLer={() => void ler(item)}
                onExcluir={() => void excluir(item)}
              />
            </>
          )}
          ListFooterComponent={
            notificacoes.length >= 100 ? (
              <Text style={styles.hint}>
                Exibindo os 100 avisos mais recentes.
              </Text>
            ) : null
          }
        />
      )}
    </View>
  );
}
