import { CalendarioPartida } from './CalendarioPartida';
import { dataPartidaISO } from '@/src/utils/validarPartida';
import { useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon, type IconName } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/filtrosJogosStyles';
import {
  filtrosJogosAtuais,
  PERIODOS_JOGOS,
  periodoJogos,
  STATUS_JOGOS,
  type FiltrosJogos as ValoresFiltros,
} from '@/src/utils/filtrosJogos';

type Props = {
  filtros: ValoresFiltros;
  onAplicar: (filtros: ValoresFiltros) => void;
  onFechar: () => void;
};

const grupos = [
  { chave: 'organizadas', titulo: 'Organização', opcoes: [
    { label: 'Todos os clubes', valor: undefined }, { label: 'Organizadas pelo meu clube', valor: true },
  ] },
  { chave: 'preparacao', titulo: 'Preparação', opcoes: [
    { label: 'Todas as situações', valor: undefined }, { label: 'Agendadas', valor: 'AGENDADA' }, { label: 'Preparadas', valor: 'PREPARADA' },
  ] },
  { chave: 'mando', titulo: 'Mando de campo', opcoes: [
    { label: 'Casa e fora', valor: undefined }, { label: 'Em casa', valor: 'casa', icone: 'home' }, { label: 'Fora', valor: 'fora', icone: 'bus' },
  ] },
  { chave: 'ordem', titulo: 'Ordenar', opcoes: [
    { label: 'Por horário', valor: 'horario', icone: 'clock' }, { label: 'Por categoria', valor: 'categoria' },
  ] },
] as const;

export function FiltrosJogos({ filtros, onAplicar, onFechar }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [rascunho, setRascunho] = useState<ValoresFiltros>({ ...filtros });

  const [campoData, setCampoData] = useState<'de' | 'ate' | null>(null);
  const invalido = rascunho.periodo === 'personalizado' &&
    (!rascunho.de || (!!rascunho.ate && rascunho.ate < rascunho.de));
  const textoData = (iso?: string) => iso?.split('-').reverse().join('/') ?? '';
  if (campoData) return (
    <CalendarioPartida
      data={textoData(rascunho[campoData] ?? rascunho.de)}
      tituloPainel={campoData === 'de' ? 'Data inicial' : 'Data final'}
      subtitulo={campoData === 'de' ? 'Escolha o primeiro dia do período.' : 'Escolha o último dia do período.'}
      onFechar={() => setCampoData(null)}
      onSelecionar={data => {
        const iso = dataPartidaISO(data);
        if (!iso) return;
        setRascunho(atual => ({ ...atual, [campoData]: iso }));
        setCampoData(null);
      }}
    />
  );

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onFechar}>
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backdrop}
          onPress={onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar sem aplicar os filtros"
        />
        <View
          style={[
            styles.sheet,
            { maxHeight: Math.min(height - insets.top - 16, 720) },
          ]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={styles.title} accessibilityRole="header">
                Filtrar jogos
              </Text>
              <Text style={styles.subtitle}>{periodoJogos(rascunho)}</Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar sem aplicar os filtros"
            >
              <Icon name="close" size={22} color={colors.textoSecundario} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            <Text style={styles.label}>Período</Text>
            <View style={styles.chipRow}>
              {PERIODOS_JOGOS.map(opcao => {
                const selecionado = (rascunho.periodo ?? 'todos') === opcao.id;
                return (
                  <TouchableOpacity key={opcao.id} style={[styles.chip, selecionado && styles.chipActive]}
                    accessibilityRole="radio" accessibilityState={{ checked: selecionado }}
                    onPress={() => {
                      setRascunho(atual => ({ ...atual, periodo: opcao.id, todosPeriodos: opcao.id === 'todos',
                        de: opcao.id === 'personalizado' ? atual.de : undefined,
                        ate: opcao.id === 'personalizado' ? atual.ate : undefined }));
                      if (opcao.id === 'personalizado' && !rascunho.de) setCampoData('de');
                    }}>
                    <Text style={[styles.optionText, selecionado && styles.chipTextActive]}>{opcao.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {rascunho.periodo === 'personalizado' && (
              <View style={styles.chipSection}>
                <View style={styles.chipRow}>
                  {(['de', 'ate'] as const).map(campo => (
                    <TouchableOpacity key={campo} style={styles.chip} accessibilityRole="button"
                      accessibilityLabel={campo === 'de' ? 'Escolher data inicial' : 'Escolher data final'}
                      onPress={() => setCampoData(campo)}>
                      <Icon name="calendar-outline" size={16} color={colors.textoSecundario} />
                      <Text style={styles.optionText}>{textoData(rascunho[campo]) || (campo === 'de' ? 'Data inicial' : 'Data final opcional')}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {invalido && rascunho.de && <Text style={styles.optionText} accessibilityRole="alert">A data final deve ser igual ou posterior à inicial.</Text>}
              </View>
            )}
            {grupos.map(({ chave, titulo, opcoes }) => (
              <View key={chave} style={styles.chipSection}>
                <Text style={styles.label}>{titulo}</Text>
                <View style={styles.chipRow}>
                  {opcoes.map(opcao => {
                    const selecionado = (rascunho[chave] ?? (chave === 'ordem' ? 'horario' : undefined)) === opcao.valor;
                    return (
                      <TouchableOpacity key={opcao.label} style={[styles.chip, selecionado && styles.chipActive]}
                        accessibilityRole="radio" accessibilityState={{ checked: selecionado }}
                        onPress={() => setRascunho(atual => ({
                          ...atual,
                          ...(chave === 'preparacao' && opcao.valor ? { status: 'TODOS' as const } : {}),
                          [chave]: opcao.valor,
                        }))}>
                        {'icone' in opcao && <Icon name={opcao.icone as IconName} size={15}
                          color={selecionado ? colors.textoSobrePrimaria : colors.textoSecundario} />}
                        <Text style={[styles.optionText, selecionado && styles.chipTextActive]}>{opcao.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity style={styles.clearButton} accessibilityRole="button"
              onPress={() => setRascunho({ ...filtrosJogosAtuais(), todosPeriodos: true, periodo: 'todos' })}>
              <Text style={styles.optionText}>Limpar filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.applyButton, invalido && styles.disabled]}
              disabled={invalido}
              activeOpacity={0.8}
              onPress={() => onAplicar(rascunho)}
              accessibilityRole="button"
              accessibilityLabel={`Aplicar filtros: ${periodoJogos(rascunho)}, ${STATUS_JOGOS.find((opcao) => opcao.value === rascunho.status)?.label}`}
            >
              <Text style={styles.applyText}>Aplicar filtros</Text>
              <Icon name="check" size={19} color={colors.textoSobrePrimaria} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
