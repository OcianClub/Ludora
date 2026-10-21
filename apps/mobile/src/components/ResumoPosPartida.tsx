import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Share,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useTheme } from '@/src/contexts/ThemeContext';
import {
  montarResumoPosPartida,
  textoCompartilhamentoPartida,
  type EventoResumo,
  type PartidaResumo,
} from '@/src/utils/resumoPosPartida';
import { createStyles } from '@/src/styles/resumoPosPartidaStyles';

export function ResumoPosPartida({
  partida,
  eventos,
  confirmado,
  carregando,
  onAtualizar,
}: {
  partida: PartidaResumo;
  eventos: EventoResumo[];
  confirmado: boolean;
  carregando: boolean;
  onAtualizar: () => Promise<boolean>;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const resumo = useMemo(
    () => montarResumoPosPartida(partida, eventos),
    [partida, eventos]
  );
  const [incluirAtletas, setIncluirAtletas] = useState(false);
  const [compartilhando, setCompartilhando] = useState(false);
  const [jaConfirmado, setJaConfirmado] = useState(false);
  const ocupado = useRef(false);

  useEffect(() => {
    if (confirmado) setJaConfirmado(true);
  }, [confirmado]);

  const compartilhar = async () => {
    if (!confirmado || ocupado.current) return;
    const texto = textoCompartilhamentoPartida(
      partida,
      eventos,
      incluirAtletas
    );
    if (!texto) return;
    ocupado.current = true;
    setCompartilhando(true);
    try {
      await Share.share({
        message: texto,
        title: 'Resultado da partida · Ludora',
      });
    } catch {
      Alert.alert(
        'Não foi possível compartilhar',
        'Tente novamente. Nenhuma alteração foi feita na partida.'
      );
    } finally {
      ocupado.current = false;
      setCompartilhando(false);
    }
  };

  if (!resumo) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>Resumo pós-partida</Text>
      {!confirmado && !jaConfirmado ? (
        <View style={styles.aviso}>
          {carregando ? <ActivityIndicator color={colors.primaria} /> : null}
          <Text style={styles.descricao}>
            {carregando
              ? 'Confirmando o resultado e os acontecimentos…'
              : 'Conecte-se e atualize a partida para consultar e compartilhar o resumo confirmado.'}
          </Text>
          {!carregando && (
            <TouchableOpacity
              style={styles.botaoSecundario}
              onPress={() => {
                void onAtualizar();
              }}
              accessibilityRole="button"
            >
              <Text style={styles.link}>Atualizar partida</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <>
          {!confirmado && (
            <View style={styles.aviso}>
              <Text style={styles.descricao} accessibilityLiveRegion="polite">
                {carregando
                  ? 'Atualizando… O último resumo confirmado permanece visível.'
                  : 'Não foi possível atualizar. Exibindo o último resumo confirmado; o compartilhamento está pausado.'}
              </Text>
              {!carregando && (
                <TouchableOpacity
                  style={styles.botaoSecundario}
                  onPress={() => {
                    void onAtualizar();
                  }}
                  accessibilityRole="button"
                >
                  <Text style={styles.link}>Atualizar partida</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
          <View style={styles.resultado}>
            <Text style={styles.resultadoTexto}>
              {resumo.resultado} · {resumo.clube}
            </Text>
            <Text style={styles.placar}>
              {partida.mandante.nome} {partida.gols_mandante} ×{' '}
              {partida.gols_visitante} {partida.visitante.nome}
            </Text>
            <Text style={styles.descricao}>
              {resumo.data}
              {partida.categoria ? ` · ${partida.categoria.nome}` : ''}
            </Text>
          </View>
          {!resumo.eventosDoClubeDisponiveis ? (
            <Text style={styles.avisoTexto}>
              Partida registrada por outro clube. O resultado está disponível,
              mas os eventos publicados pertencem ao clube de origem e não são
              usados para atribuir destaques ao seu clube.
            </Text>
          ) : (
            <>
              {!resumo.golsConferem && (
                <Text style={styles.avisoTexto}>
                  Há {resumo.golsRegistrados}{' '}
                  {resumo.golsRegistrados === 1
                    ? 'gol registrado'
                    : 'gols registrados'}{' '}
                  nos eventos do clube e {resumo.golsClube} no placar. O
                  resultado usa o placar salvo; revise os eventos antes de
                  divulgar a autoria.
                </Text>
              )}
              <Text style={styles.subtitulo}>Acontecimentos do clube</Text>
              <View style={styles.metricas}>
                {resumo.metricas.map((metrica) => (
                  <View key={metrica.tipo} style={styles.metrica}>
                    <Text style={styles.numero}>{metrica.total}</Text>
                    <Text style={styles.descricao}>
                      {metrica.titulo} registrados
                    </Text>
                  </View>
                ))}
              </View>
              {resumo.temEventos ? (
                resumo.metricas.map((metrica) =>
                  metrica.lideres.length > 0 &&
                  (metrica.tipo !== 'GOL' || resumo.golsConferem) ? (
                    <View key={metrica.tipo} style={styles.destaque}>
                      <Text style={styles.label}>
                        {metrica.titulo} em destaque
                      </Text>
                      <Text style={styles.nomes}>
                        {metrica.lideres
                          .map((atleta) => atleta.nome)
                          .join(' · ')}
                      </Text>
                      <Text style={styles.descricao}>
                        {metrica.maior}{' '}
                        {metrica.maior === 1
                          ? metrica.singular
                          : metrica.titulo.toLowerCase()}{' '}
                        {metrica.lideres.length > 1
                          ? 'para cada atleta'
                          : 'no registro da partida'}
                      </Text>
                    </View>
                  ) : null
                )
              ) : (
                <Text style={styles.descricao}>
                  Não há eventos individuais cadastrados. O placar final
                  continua disponível para compartilhar.
                </Text>
              )}
              <Text style={styles.descricao}>
                Destaques consideram apenas os eventos registrados e preservam
                empates. Zero registros não significa ausência de ações.
              </Text>
              <View style={styles.preferencia}>
                <View style={styles.flex}>
                  <Text style={styles.label}>
                    Incluir nomes no compartilhamento
                  </Text>
                  <Text style={styles.descricao}>
                    Ative apenas se tiver autorização para divulgar os atletas.
                  </Text>
                </View>
                <Switch
                  value={incluirAtletas}
                  onValueChange={setIncluirAtletas}
                  disabled={compartilhando || !confirmado}
                  trackColor={{
                    false: colors.cardSecundario,
                    true: colors.primaria,
                  }}
                  thumbColor={colors.textoSobrePrimaria}
                  ios_backgroundColor={colors.cardSecundario}
                  accessibilityLabel="Incluir nomes de atletas no compartilhamento"
                />
              </View>
            </>
          )}
          <TouchableOpacity
            style={[
              styles.botao,
              (compartilhando || !confirmado) && styles.desabilitado,
            ]}
            onPress={compartilhar}
            disabled={compartilhando || !confirmado}
            accessibilityRole="button"
            accessibilityLabel="Compartilhar resultado em texto"
          >
            {compartilhando ? (
              <ActivityIndicator color={colors.textoSobrePrimaria} />
            ) : (
              <Text style={styles.botaoTexto}>Compartilhar resultado</Text>
            )}
          </TouchableOpacity>
          <Text style={styles.rodape}>
            Abre o menu do celular com um texto. Nada é publicado
            automaticamente.
          </Text>
        </>
      )}
    </View>
  );
}
