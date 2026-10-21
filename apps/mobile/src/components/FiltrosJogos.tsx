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
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/filtrosJogosStyles';
import {
  filtrosJogosAtuais,
  MESES_JOGOS,
  periodoJogos,
  STATUS_JOGOS,
  type FiltrosJogos as ValoresFiltros,
} from '@/src/utils/filtrosJogos';

type Props = {
  filtros: ValoresFiltros;
  onAplicar: (filtros: ValoresFiltros) => void;
  onFechar: () => void;
};

export function FiltrosJogos({ filtros, onAplicar, onFechar }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [rascunho, setRascunho] = useState<ValoresFiltros>({ ...filtros });

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
            <View style={styles.sectionHeader}>
              <Text style={styles.label}>Período</Text>
              <TouchableOpacity
                style={styles.resetButton}
                onPress={() => setRascunho(filtrosJogosAtuais())}
                accessibilityRole="button"
                accessibilityLabel="Restaurar mês e ano atuais e todos os jogos"
              >
                <Text style={styles.resetText}>Restaurar</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.yearSelector}>
              <TouchableOpacity
                style={[
                  styles.yearButton,
                  rascunho.ano <= 1900 && styles.disabled,
                ]}
                onPress={() =>
                  setRascunho((atual) => ({
                    ...atual,
                    ano: Math.max(1900, atual.ano - 1),
                  }))
                }
                disabled={rascunho.ano <= 1900}
                accessibilityRole="button"
                accessibilityLabel="Ano anterior"
                accessibilityState={{ disabled: rascunho.ano <= 1900 }}
              >
                <Icon name="chevron-left" size={22} color={colors.texto} />
              </TouchableOpacity>
              <View style={styles.yearCenter}>
                <Icon
                  name="calendar-outline"
                  size={19}
                  color={colors.primaria}
                />
                <Text style={styles.yearText} accessibilityLiveRegion="polite">
                  {rascunho.ano}
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.yearButton,
                  rascunho.ano >= 9998 && styles.disabled,
                ]}
                onPress={() =>
                  setRascunho((atual) => ({
                    ...atual,
                    ano: Math.min(9998, atual.ano + 1),
                  }))
                }
                disabled={rascunho.ano >= 9998}
                accessibilityRole="button"
                accessibilityLabel="Próximo ano"
                accessibilityState={{ disabled: rascunho.ano >= 9998 }}
              >
                <Icon name="chevron-right" size={22} color={colors.texto} />
              </TouchableOpacity>
            </View>

            <View style={styles.monthGrid}>
              {MESES_JOGOS.map((mes, index) => {
                const selecionado = rascunho.mes === index + 1;
                return (
                  <View key={mes} style={styles.monthCell}>
                    <TouchableOpacity
                      style={[
                        styles.monthButton,
                        selecionado && styles.optionSelected,
                      ]}
                      onPress={() =>
                        setRascunho((atual) => ({ ...atual, mes: index + 1 }))
                      }
                      accessibilityRole="radio"
                      accessibilityLabel={`${mes} de ${rascunho.ano}`}
                      accessibilityState={{ checked: selecionado }}
                    >
                      <Text
                        style={[
                          styles.optionText,
                          selecionado && styles.textSelected,
                        ]}
                      >
                        {mes.slice(0, 3)}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.wholeYear,
                rascunho.mes === null && styles.optionSelected,
              ]}
              onPress={() => setRascunho((atual) => ({ ...atual, mes: null }))}
              accessibilityRole="radio"
              accessibilityState={{ checked: rascunho.mes === null }}
              accessibilityLabel={`Todos os meses de ${rascunho.ano}`}
            >
              <Text
                style={[
                  styles.optionText,
                  rascunho.mes === null && styles.textSelected,
                ]}
              >
                Ano inteiro
              </Text>
              <Icon
                name={rascunho.mes === null ? 'check' : 'calendar-outline'}
                size={18}
                color={
                  rascunho.mes === null
                    ? colors.primaria
                    : colors.textoSecundario
                }
              />
            </TouchableOpacity>

            <Text style={[styles.label, styles.statusLabel]}>Status</Text>
            <View style={styles.statusGrid}>
              {STATUS_JOGOS.map((opcao) => {
                const selecionado = rascunho.status === opcao.value;
                return (
                  <View key={opcao.value} style={styles.statusCell}>
                    <TouchableOpacity
                      style={[
                        styles.statusButton,
                        selecionado && styles.optionSelected,
                      ]}
                      onPress={() =>
                        setRascunho((atual) => ({
                          ...atual,
                          status: opcao.value,
                        }))
                      }
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selecionado }}
                    >
                      <Icon
                        name={opcao.icon}
                        size={18}
                        color={
                          selecionado ? colors.primaria : colors.textoSecundario
                        }
                      />
                      <Text
                        style={[
                          styles.statusText,
                          selecionado && styles.textSelected,
                        ]}
                      >
                        {opcao.label}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </ScrollView>

          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(insets.bottom, 16) },
            ]}
          >
            <TouchableOpacity
              style={styles.applyButton}
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
