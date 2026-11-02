import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { obterContextoScout } from '@/src/services/mlService';
import {
  formatarMediaScout,
  observacoesContextoScout,
  resumirContextoScout,
  type ContextoScout,
  type FiltroContextoScout,
} from '@/src/utils/contextoScout';
import { createStyles } from '@/src/styles/contextoAtletaScoutStyles';

const nomesEventos: Record<string, string> = {
  GOL: 'Gol',
  ASSISTENCIA: 'Assistência',
  DEFESA: 'Defesa',
  FALTA: 'Falta',
  CARTAO_AMARELO: 'Cartão amarelo',
  CARTAO_VERMELHO: 'Cartão vermelho',
  CARTAO_AZUL: 'Cartão azul',
};

export function ContextoAtletaScout({
  jogadorId,
  clubeId,
  consultaLocal,
}: {
  jogadorId: number;
  clubeId: number;
  consultaLocal: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [contexto, setContexto] = useState<ContextoScout | null>(null);
  const [opcoes, setOpcoes] = useState<ContextoScout['opcoes']>();
  const [filtro, setFiltro] = useState<FiltroContextoScout>({});
  const [seletor, setSeletor] = useState<'competicao' | 'partida' | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setContexto(null);
    setErro('');
    if (consultaLocal) {
      setCarregando(false);
      return () => controller.abort();
    }
    setCarregando(true);
    obterContextoScout(jogadorId, clubeId, controller.signal, filtro)
      .then((dados) => {
        if (!controller.signal.aborted) {
          setContexto(dados);
          setOpcoes(dados.opcoes);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted)
          setErro('Não foi possível carregar este recorte. Tente novamente.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });
    return () => controller.abort();
  }, [jogadorId, clubeId, consultaLocal, tentativa, filtro]);
  const resumo = contexto ? resumirContextoScout(contexto) : null;
  const partida =
    contexto?.recorte?.tipo === 'partida' ? contexto.partidas[0] : null;
  const titulo = filtro.competicao_id
    ? opcoes?.competicoes.find((c) => c.id === filtro.competicao_id)?.nome ||
      'Campeonato'
    : filtro.partida_id
      ? 'Partida selecionada'
      : 'Geral · partidas finalizadas';
  const choices =
    seletor === 'competicao'
      ? (opcoes?.competicoes || []).map((c) => ({
          id: c.id,
          label: `${c.nome} · ${c.ano}`,
        }))
      : (opcoes?.partidas || []).map((p) => ({
          id: p.id,
          label: `${p.data.split('-').reverse().join('/')} · ${p.nome}${p.status === 'AO_VIVO' ? ' · Ao vivo' : ''}`,
        }));
  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Scout por contexto</Text>
      {consultaLocal ? (
        <Text style={styles.aviso}>
          Conecte-se para consultar campeonatos, partidas e evolução. Os
          registros gerais salvos continuam disponíveis abaixo.
        </Text>
      ) : (
        <>
          <View style={styles.seletor}>
            {(['geral', 'competicao', 'partida'] as const).map((tipo) => {
              const ativo =
                tipo === 'geral'
                  ? !filtro.competicao_id && !filtro.partida_id
                  : tipo === 'competicao'
                    ? !!filtro.competicao_id
                    : !!filtro.partida_id;
              return (
                <TouchableOpacity
                  key={tipo}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ativo }}
                  style={[
                    styles.opcao,
                    ativo && { backgroundColor: colors.primaria },
                  ]}
                  onPress={() =>
                    tipo === 'geral' ? setFiltro({}) : setSeletor(tipo)
                  }
                >
                  <Text style={[styles.label, ativo && { color: '#fff' }]}>
                    {tipo === 'geral'
                      ? 'Geral'
                      : tipo === 'competicao'
                        ? 'Campeonato'
                        : 'Partida'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={styles.subtitulo}>{titulo}</Text>
          {carregando ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primaria} />
              <Text style={styles.descricao}>Consultando os registros…</Text>
            </View>
          ) : erro ? (
            <View style={styles.avisoContainer}>
              <Text accessibilityRole="alert" style={styles.descricao}>
                {erro}
              </Text>
              <TouchableOpacity
                style={styles.botao}
                accessibilityRole="button"
                onPress={() => setTentativa((t) => t + 1)}
              >
                <Text style={styles.link}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            contexto &&
            resumo && (
              <>
                <Text style={styles.descricao}>
                  {contexto.total_partidas} partidas com registro. Convocação
                  não comprova entrada em campo; não há estimativa de minutos
                  jogados.
                </Text>
                {contexto.recorte?.provisorio && (
                  <Text style={styles.aviso}>
                    Dados provisórios de uma partida ao vivo. Não entram nas
                    análises históricas.
                  </Text>
                )}
                {partida && (
                  <View style={styles.avisoContainer}>
                    <Text style={styles.subtitulo}>
                      {partida.mandante} {partida.gols_mandante} ×{' '}
                      {partida.gols_visitante} {partida.visitante}
                    </Text>
                    <Text style={styles.descricao}>
                      {partida.data.split('-').reverse().join('/')} ·{' '}
                      {partida.competicao?.nome || 'Amistoso'}
                    </Text>
                    <Text style={styles.descricao}>
                      {partida.titular_inicial === true
                        ? 'Titular na escalação inicial'
                        : partida.titular_inicial === false
                          ? 'Reserva na escalação inicial'
                          : 'Titularidade inicial não informada'}
                    </Text>
                  </View>
                )}
                {!!contexto.totais?.titularidades_desconhecidas && (
                  <Text style={styles.descricao}>
                    Em {contexto.totais.titularidades_desconhecidas} convocações
                    antigas, a titularidade inicial não foi registrada.
                  </Text>
                )}
                {!!contexto.totais?.gols_contra && (
                  <Text style={styles.descricao}>
                    {contexto.totais.gols_contra} gol(s) contra, separados dos
                    gols a favor.
                  </Text>
                )}
                {contexto.totais && (
                  <View style={styles.medias}>
                    {[
                      ['Convocações', contexto.totais.convocacoes],
                      ['Titularidades', contexto.totais.titularidades],
                      ['Gols', contexto.totais.gols],
                      ['Assistências', contexto.totais.assistencias],
                      ['Defesas', contexto.totais.defesas],
                      ['Faltas', contexto.totais.faltas],
                      ['Amarelos', contexto.totais.amarelos],
                      ['Vermelhos', contexto.totais.vermelhos],
                      ['Azuis', contexto.totais.azuis],
                    ].map(([label, value]) => (
                      <View key={label} style={styles.media}>
                        <Text style={styles.valor}>{value}</Text>
                        <Text style={styles.label}>{label}</Text>
                      </View>
                    ))}
                  </View>
                )}
                {observacoesContextoScout(contexto).map((o) => (
                  <View style={styles.avisoContainer} key={o.titulo}>
                    <Text style={styles.label}>{o.titulo}</Text>
                    <Text style={styles.descricao}>{o.texto}</Text>
                  </View>
                ))}
                {!partida && !!resumo.tamanhoRecente && (
                  <>
                    <Text style={styles.subtitulo}>
                      Médias nas últimas {resumo.tamanhoRecente} partidas com
                      registro
                    </Text>
                    <View style={styles.medias}>
                      {resumo.metricas.map((m) => (
                        <View key={m.campo} style={styles.media}>
                          <Text style={styles.valor}>
                            {formatarMediaScout(m.recente)}
                          </Text>
                          <Text style={styles.label}>{m.titulo}</Text>
                          <Text style={styles.descricao}>
                            por partida com registro
                          </Text>
                        </View>
                      ))}
                    </View>
                    <Text style={styles.descricao}>
                      Últimos jogos · toque para consultar a partida
                    </Text>
                    {contexto.partidas.map((p) => (
                      <TouchableOpacity
                        key={p.id}
                        style={styles.partida}
                        accessibilityRole="button"
                        onPress={() => setFiltro({ partida_id: p.id })}
                      >
                        <View style={styles.flex}>
                          <Text style={styles.label}>{p.adversario}</Text>
                          <Text style={styles.descricao}>
                            {p.data.split('-').reverse().join('/')} ·{' '}
                            {p.competicao?.nome || 'Amistoso'}
                          </Text>
                          <Text style={styles.descricao}>
                            {p.gols} gols · {p.assistencias} assist ·{' '}
                            {p.defesas} defesas
                          </Text>
                        </View>
                        <Icon
                          name="chevron-right"
                          size={18}
                          color={colors.primaria}
                        />
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {partida &&
                  (partida.eventos?.length ? (
                    partida.eventos.map((e) => (
                      <View key={e.id} style={styles.partida}>
                        <View style={styles.flex}>
                          <Text style={styles.label}>
                            {e.gol_contra
                              ? 'Gol contra'
                              : nomesEventos[e.tipo] || e.tipo}
                          </Text>
                          <Text style={styles.descricao}>
                            {e.periodo}º tempo
                            {e.minuto != null ? ` · ${e.minuto} min` : ''}
                          </Text>
                        </View>
                      </View>
                    ))
                  ) : (
                    <Text style={styles.descricao}>
                      Nenhum evento atribuído ao atleta. Isso não avalia seu
                      desempenho em campo.
                    </Text>
                  ))}
                {!!contexto.semelhantes?.length && (
                  <View style={styles.avisoContainer}>
                    <Text style={styles.subtitulo}>Registros semelhantes</Text>
                    <Text style={styles.descricao}>
                      Mesma categoria e posição · médias por convocação. Não
                      significa habilidade equivalente.
                    </Text>
                    {contexto.semelhantes.map((p) => (
                      <Text key={p.id} style={styles.label}>
                        {p.numCamisa != null ? `#${p.numCamisa} · ` : ''}
                        {p.nome}
                      </Text>
                    ))}
                  </View>
                )}
                <Text style={styles.descricao}>
                  Zero significa nenhum evento registrado, não ausência de ações
                  em campo. Os dados podem ser parciais.
                </Text>
              </>
            )
          )}
        </>
      )}
      <Modal
        visible={seletor != null}
        transparent
        animationType="slide"
        onRequestClose={() => setSeletor(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#0008',
            justifyContent: 'flex-end',
          }}
        >
          <SafeAreaView
            edges={['bottom']}
            style={{
              backgroundColor: colors.card,
              padding: 18,
              maxHeight: '85%',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
            }}
          >
            <View style={styles.cabecalho}>
              <Text style={[styles.subtitulo, styles.flex]}>
                {seletor === 'competicao'
                  ? 'Selecionar campeonato'
                  : 'Selecionar partida'}
              </Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="Fechar seleção"
                style={[styles.opcao, { flex: 0, width: 44 }]}
                onPress={() => setSeletor(null)}
              >
                <Icon name="close" size={22} color={colors.texto} />
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={{ gap: 8, paddingTop: 14 }}>
              {choices.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.partida, { backgroundColor: colors.fundo }]}
                  accessibilityRole="button"
                  onPress={() => {
                    setFiltro(
                      seletor === 'competicao'
                        ? { competicao_id: c.id }
                        : { partida_id: c.id }
                    );
                    setSeletor(null);
                  }}
                >
                  <Text style={styles.label}>{c.label}</Text>
                </TouchableOpacity>
              ))}
              {!choices.length && (
                <Text style={styles.descricao}>
                  Nenhum registro disponível neste contexto.
                </Text>
              )}
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}
