import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { obterContextoScout } from '@/src/services/mlService';
import {
  formatarMediaScout,
  resumirContextoScout,
  type ContextoScout,
} from '@/src/utils/contextoScout';
import { createStyles } from '@/src/styles/contextoAtletaScoutStyles';

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
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setContexto(null);
    setErro('');
    setMostrarTodas(false);
    if (consultaLocal) {
      setCarregando(false);
      return () => controller.abort();
    }
    setCarregando(true);
    obterContextoScout(jogadorId, clubeId, controller.signal)
      .then((dados) => {
        if (!controller.signal.aborted) setContexto(dados);
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setErro(
            error instanceof Error
              ? error.message
              : 'Não foi possível carregar o histórico.'
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setCarregando(false);
      });
    return () => controller.abort();
  }, [jogadorId, clubeId, consultaLocal, tentativa]);

  const resumo = useMemo(
    () => (contexto ? resumirContextoScout(contexto) : null),
    [contexto]
  );

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Momento do atleta</Text>
      <Text style={styles.descricao}>
        Eventos registrados em partidas finalizadas
      </Text>
      {consultaLocal ? (
        <Text style={styles.aviso}>
          O histórico por partida precisa de conexão e não faz parte da cópia
          offline. Os totais salvos continuam abaixo.
        </Text>
      ) : carregando ? (
        <View
          style={styles.loading}
          accessibilityLabel="Carregando histórico do atleta"
        >
          <ActivityIndicator color={colors.primaria} />
          <Text style={styles.descricao}>Buscando os registros recentes…</Text>
        </View>
      ) : erro ? (
        <View style={styles.avisoContainer}>
          <Text style={styles.descricao} accessibilityLiveRegion="polite">
            {erro}
          </Text>
          <TouchableOpacity
            style={styles.botao}
            onPress={() => setTentativa((atual) => atual + 1)}
            accessibilityRole="button"
          >
            <Text style={styles.link}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : contexto && resumo ? (
        <>
          <View style={styles.base}>
            <Icon
              name="information-outline"
              size={20}
              color={colors.primaria}
            />
            <View style={styles.flex}>
              <Text style={styles.label}>
                {contexto.total_partidas}{' '}
                {contexto.total_partidas === 1
                  ? 'partida finalizada com registro'
                  : 'partidas finalizadas com registro'}
              </Text>
              <Text style={styles.descricao}>
                {contexto.total_partidas === 0
                  ? 'Ainda não há partidas encerradas com escalação ou eventos deste atleta.'
                  : resumo.poucosRegistros
                    ? 'Amostra inicial: menos de 5 partidas. Evite tirar conclusões a partir de poucos registros.'
                    : 'A presença na escalação não confirma minutos em quadra. Estes números não são uma avaliação definitiva.'}
              </Text>
            </View>
          </View>
          {contexto.partidas.length > 0 && (
            <>
              <Text style={styles.subtitulo}>
                Médias nos últimos {resumo.tamanhoRecente} registros
              </Text>
              <View style={styles.medias}>
                {resumo.metricas.map((metrica) => (
                  <View key={metrica.campo} style={styles.media}>
                    <Text style={styles.valor}>
                      {formatarMediaScout(metrica.recente)}
                    </Text>
                    <Text style={styles.label}>{metrica.titulo}/jogo</Text>
                    {resumo.podeComparar && (
                      <Text style={styles.descricao}>
                        Antes: {formatarMediaScout(metrica.anterior)}
                      </Text>
                    )}
                  </View>
                ))}
              </View>
              <Text style={styles.descricao}>
                {resumo.podeComparar
                  ? '“Antes” considera os 5 registros imediatamente anteriores. Compare o mesmo evento; as médias não medem a qualidade geral do atleta.'
                  : `A comparação entre dois grupos de 5 fica disponível com 10 registros. Há ${contexto.partidas.length} de 10 no recorte atual.`}
              </Text>
              <View style={styles.cabecalho}>
                <Text style={[styles.descricao, styles.flex]}>
                  Mais recentes primeiro
                </Text>
                <Text style={styles.coluna}>G</Text>
                <Text style={styles.coluna}>A</Text>
                <Text style={styles.coluna}>D</Text>
              </View>
              {contexto.partidas
                .slice(0, mostrarTodas ? 10 : 5)
                .map((partida) => (
                  <View key={partida.id} style={styles.partida}>
                    <View style={styles.flex}>
                      <Text style={styles.label}>{partida.adversario}</Text>
                      <Text style={styles.descricao}>
                        {partida.data.split('-').reverse().join('/')}
                      </Text>
                    </View>
                    <Text style={styles.coluna}>{partida.gols}</Text>
                    <Text style={styles.coluna}>{partida.assistencias}</Text>
                    <Text style={styles.coluna}>{partida.defesas}</Text>
                  </View>
                ))}
              {contexto.partidas.length > 5 && (
                <TouchableOpacity
                  style={styles.botao}
                  onPress={() => setMostrarTodas((atual) => !atual)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: mostrarTodas }}
                >
                  <Text style={styles.link}>
                    {mostrarTodas
                      ? 'Mostrar apenas 5'
                      : 'Ver os 10 últimos registros'}
                  </Text>
                </TouchableOpacity>
              )}
              <Text style={styles.descricao}>
                G: gols · A: assistências · D: defesas. Zero significa nenhum
                evento registrado, não necessariamente ausência de ações. O
                recorte inclui escalações e eventos atribuídos ao atleta.
              </Text>
            </>
          )}
        </>
      ) : null}
    </View>
  );
}
