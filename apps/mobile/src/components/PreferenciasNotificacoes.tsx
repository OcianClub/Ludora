import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Icon } from '@ludora/icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/src/contexts/ThemeContext';
import { useNotificacoes } from '@/src/contexts/NotificacoesContext';
import {
  fetchPreferenciasPorClube,
  salvarPreferenciaPorClube,
  type CampoPreferenciaPush,
  type PreferenciaNotificacoesClube,
} from '@/src/services/api';
import { createStyles } from '@/src/styles/preferenciasNotificacoesStyles';

const OPCOES: {
  campo: CampoPreferenciaPush;
  titulo: string;
  descricao: string;
}[] = [
  {
    campo: 'push_agendamentos',
    titulo: 'Partidas agendadas',
    descricao: 'Quando uma nova partida for marcada',
  },
  {
    campo: 'push_gols',
    titulo: 'Gols',
    descricao: 'Atualizações durante a partida',
  },
  {
    campo: 'push_resultados',
    titulo: 'Resultados',
    descricao: 'Vitórias, empates e derrotas',
  },
];

export function PreferenciasNotificacoes({
  onFechar,
}: {
  onFechar: () => void;
}) {
  const { colors } = useTheme();
  const { notificacoesAtivas } = useNotificacoes();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const [clubes, setClubes] = useState<PreferenciaNotificacoesClube[]>([]);
  const [expandido, setExpandido] = useState<number | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erro, setErro] = useState('');
  const [estadoIncerto, setEstadoIncerto] = useState(false);
  const [tentativa, setTentativa] = useState(0);
  const ocupado = useRef(false);
  const montado = useRef(true);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setCarregando(true);
    setErro('');
    fetchPreferenciasPorClube(controller.signal)
      .then((lista) => {
        if (controller.signal.aborted) return;
        setClubes(lista);
        setEstadoIncerto(false);
        setExpandido(lista[0]?.clube_id ?? null);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar os clubes.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });
    return () => controller.abort();
  }, [tentativa]);

  const salvar = async (
    clubeId: number,
    campo: CampoPreferenciaPush,
    ativa: boolean
  ) => {
    if (ocupado.current || estadoIncerto || carregando) return;
    ocupado.current = true;
    setSalvando(`${clubeId}:${campo}`);
    setErro('');
    try {
      const atualizado = await salvarPreferenciaPorClube(clubeId, campo, ativa);
      if (montado.current)
        setClubes((atuais) =>
          atuais.map((clube) =>
            clube.clube_id === clubeId ? atualizado : clube
          )
        );
    } catch (error) {
      if (montado.current) {
        setEstadoIncerto(true);
        setErro(
          `${error instanceof Error ? error.message : 'Não foi possível confirmar a alteração.'} Atualize para conferir o que ficou salvo.`
        );
      }
    } finally {
      ocupado.current = false;
      if (montado.current) setSalvando(null);
    }
  };

  const fechar = () => {
    if (!ocupado.current) onFechar();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={fechar}>
      <View style={[styles.overlay, { paddingTop: insets.top + 20 }]}>
        <Pressable
          style={styles.backdrop}
          onPress={fechar}
          accessibilityLabel="Fechar preferências"
          accessibilityRole="button"
        />
        <View
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text style={styles.titulo}>Avisos por clube</Text>
            <TouchableOpacity
              style={styles.fechar}
              onPress={fechar}
              disabled={!!salvando}
              accessibilityLabel="Fechar"
              accessibilityRole="button"
            >
              <Icon name="close" size={24} color={colors.texto} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.descricao}>
              Escolha os avisos que chegam ao seu dispositivo. O histórico
              dentro do app continua disponível.
            </Text>
            {!notificacoesAtivas && (
              <Text style={styles.aviso}>
                Os avisos externos estão pausados no perfil. Suas escolhas
                abaixo serão usadas quando você os ativar.
              </Text>
            )}
            {erro ? (
              <Text style={styles.erro} accessibilityLiveRegion="polite">
                {erro}
              </Text>
            ) : null}
            {erro && !carregando ? (
              <TouchableOpacity
                style={styles.retry}
                onPress={() => setTentativa((valor) => valor + 1)}
                accessibilityRole="button"
              >
                <Text style={styles.link}>Atualizar preferências</Text>
              </TouchableOpacity>
            ) : null}
            {carregando ? (
              <View
                style={styles.loading}
                accessibilityLabel="Carregando clubes"
              >
                <ActivityIndicator color={colors.primaria} />
                <Text style={styles.descricao}>Carregando seus clubes…</Text>
              </View>
            ) : !clubes.length ? (
              <View style={styles.loading}>
                <Text style={styles.descricao}>
                  {erro
                    ? 'Confira sua conexão para tentar novamente.'
                    : 'Siga um clube ou aceite um convite para receber os avisos dele.'}
                </Text>
              </View>
            ) : (
              clubes.map((clube) => (
                <View key={clube.clube_id} style={styles.card}>
                  <TouchableOpacity
                    style={styles.clube}
                    onPress={() =>
                      setExpandido((atual) =>
                        atual === clube.clube_id ? null : clube.clube_id
                      )
                    }
                    accessibilityRole="button"
                    accessibilityState={{
                      expanded: expandido === clube.clube_id,
                    }}
                  >
                    <View style={styles.identidade}>
                      <Text style={styles.nome}>{clube.clube.nome}</Text>
                      <Text style={styles.descricao}>
                        {OPCOES.filter(({ campo }) => clube[campo]).length} de 3
                        tipos ativados
                      </Text>
                    </View>
                    <Icon
                      name={
                        expandido === clube.clube_id
                          ? 'chevron-up'
                          : 'chevron-down'
                      }
                      size={22}
                      color={colors.textoSecundario}
                    />
                  </TouchableOpacity>
                  {expandido === clube.clube_id &&
                    OPCOES.map(({ campo, titulo, descricao }) => (
                      <View key={campo} style={styles.opcao}>
                        <View style={styles.identidade}>
                          <Text style={styles.label}>{titulo}</Text>
                          <Text style={styles.descricao}>{descricao}</Text>
                        </View>
                        {salvando === `${clube.clube_id}:${campo}` ? (
                          <ActivityIndicator
                            color={colors.primaria}
                            accessibilityLabel="Salvando preferência"
                          />
                        ) : null}
                        <Switch
                          value={clube[campo]}
                          onValueChange={(ativa) =>
                            salvar(clube.clube_id, campo, ativa)
                          }
                          disabled={!!salvando || estadoIncerto || carregando}
                          trackColor={{
                            false: colors.cardSecundario,
                            true: colors.primaria,
                          }}
                          thumbColor={colors.textoSobrePrimaria}
                          ios_backgroundColor={colors.cardSecundario}
                          accessibilityLabel={`${titulo} de ${clube.clube.nome}`}
                        />
                      </View>
                    ))}
                </View>
              ))
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
