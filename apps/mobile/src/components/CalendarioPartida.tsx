import { useMemo, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Icon } from '@ludora/icons';
import { useTheme } from '@/src/contexts/ThemeContext';
import { createStyles } from '@/src/styles/organizarPartidasStyles';
import { dataPartidaISO } from '@/src/utils/validarPartida';
import {
  dataPartidaTexto,
  diasCalendarioPartida,
} from '@/src/utils/organizarPartida';
import { PainelOrganizarPartida } from './PainelOrganizarPartida';

export function CalendarioPartida({
  data,
  onSelecionar,
  onFechar,
}: {
  data: string;
  onSelecionar: (data: string) => void;
  onFechar: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const iso = /^\d{2}\/\d{2}\/\d{4}$/.test(data) ? dataPartidaISO(data) : null;
  const [mes, setMes] = useState(() =>
    iso ? new Date(`${iso}T12:00:00`) : new Date()
  );
  const ano = mes.getFullYear();
  const indiceMes = mes.getMonth();
  const titulo = mes.toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });
  const hoje = dataPartidaTexto(new Date());
  const anterior = ano > 1900 || indiceMes > 0;
  const proximo = ano < 9998 || indiceMes < 11;

  return (
    <PainelOrganizarPartida
      titulo="Data da partida"
      subtitulo="Você também pode digitar a data completa no formulário."
      onFechar={onFechar}
    >
      <ScrollView
        style={styles.selectorList}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.calendarTop}>
          <TouchableOpacity
            style={[styles.closeButton, !anterior && styles.disabled]}
            disabled={!anterior}
            onPress={() => setMes(new Date(ano, indiceMes - 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Mês anterior"
          >
            <Icon name="chevron-left" size={22} color={colors.texto} />
          </TouchableOpacity>
          <Text style={styles.calendarTitle} accessibilityLiveRegion="polite">
            {titulo}
          </Text>
          <TouchableOpacity
            style={[styles.closeButton, !proximo && styles.disabled]}
            disabled={!proximo}
            onPress={() => setMes(new Date(ano, indiceMes + 1, 1))}
            accessibilityRole="button"
            accessibilityLabel="Próximo mês"
          >
            <Icon name="chevron-right" size={22} color={colors.texto} />
          </TouchableOpacity>
        </View>
        <View style={styles.calendarGrid}>
          {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((dia, index) => (
            <View key={index} style={styles.calendarCell}>
              <Text style={styles.calendarWeekday}>{dia}</Text>
            </View>
          ))}
          {diasCalendarioPartida(ano, indiceMes).map((dia, indice) => {
            const valor =
              dia === null
                ? ''
                : dataPartidaTexto(new Date(ano, indiceMes, dia));
            const selecionado = valor === data;
            return (
              <View key={indice} style={styles.calendarCell}>
                {dia !== null && (
                  <TouchableOpacity
                    style={[
                      styles.calendarDay,
                      valor === hoje && styles.calendarToday,
                      selecionado && styles.calendarSelected,
                    ]}
                    onPress={() => onSelecionar(valor)}
                    accessibilityRole="button"
                    accessibilityLabel={valor}
                    accessibilityState={{ selected: selecionado }}
                  >
                    <Text
                      style={[
                        styles.calendarText,
                        selecionado && styles.calendarTextSelected,
                      ]}
                    >
                      {dia}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>
        <TouchableOpacity
          style={styles.todayButton}
          onPress={() => onSelecionar(hoje)}
          accessibilityRole="button"
          accessibilityLabel="Selecionar a data de hoje"
        >
          <Text style={styles.todayText}>Usar hoje</Text>
        </TouchableOpacity>
      </ScrollView>
    </PainelOrganizarPartida>
  );
}
