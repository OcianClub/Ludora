import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@ludora/icons";
import { useTheme } from "../contexts/ThemeContext";
import { createStyles } from "../styles/filtrosJogosStyles";

type Direcao = "todas" | "recebidas" | "enviadas";
type Props = {
  todas: boolean;
  direcao: Direcao;
  pendentes: number;
  paraResponder: number;
  onFechar: () => void;
  onAplicar: (todas: boolean, direcao: Direcao) => void;
};

export function FiltrosSolicitacoes(props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [todas, setTodas] = useState(props.todas);
  const [direcao, setDirecao] = useState(props.direcao);
  function opcao(label: string, selecionada: boolean, onPress: () => void) {
    return (
      <TouchableOpacity
        key={label}
        accessibilityRole="radio"
        accessibilityState={{ checked: selecionada }}
        aria-checked={selecionada}
        onPress={onPress}
        style={[styles.chip, selecionada && styles.chipActive]}
      >
        <Text style={[styles.optionText, selecionada && styles.chipTextActive]}>
          {label}
        </Text>
      </TouchableOpacity>
    );
  }
  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={props.onFechar}
    >
      <View style={[styles.overlay, { paddingTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backdrop}
          onPress={props.onFechar}
          accessibilityRole="button"
          accessibilityLabel="Fechar sem aplicar os filtros"
        />
        <View
          style={[styles.sheet, { maxHeight: height - insets.top - 16 }]}
          accessibilityViewIsModal
        >
          <View style={styles.header}>
            <Text
              style={[styles.title, styles.heading]}
              accessibilityRole="header"
            >
              Filtrar solicitações
            </Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={props.onFechar}
              accessibilityRole="button"
              accessibilityLabel="Fechar filtros"
            >
              <Icon name="close" size={21} color={colors.textoSecundario} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
          >
            <View
              style={styles.chipSection}
              accessibilityRole="radiogroup"
              accessibilityLabel="Situação"
            >
              <Text style={styles.label}>Situação</Text>
              <View style={styles.chipRow}>
                {opcao(`Pendentes · ${props.pendentes}`, !todas, () =>
                  setTodas(false),
                )}
                {opcao("Todas as situações", todas, () => setTodas(true))}
              </View>
            </View>
            <View
              style={styles.chipSection}
              accessibilityRole="radiogroup"
              accessibilityLabel="Solicitações"
            >
              <Text style={styles.label}>Solicitações</Text>
              <View style={styles.chipRow}>
                {opcao("Todas", direcao === "todas", () => setDirecao("todas"))}
                {opcao(
                  `Para responder · ${props.paraResponder}`,
                  direcao === "recebidas",
                  () => setDirecao("recebidas"),
                )}
                {opcao("Enviadas", direcao === "enviadas", () =>
                  setDirecao("enviadas"),
                )}
              </View>
            </View>
          </ScrollView>
          <View
            style={[
              styles.footer,
              { paddingBottom: Math.max(12, insets.bottom) },
            ]}
          >
            <TouchableOpacity
              style={styles.clearButton}
              accessibilityRole="button"
              onPress={() => {
                setTodas(true);
                setDirecao("todas");
              }}
            >
              <Text style={styles.resetText}>Limpar filtros</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.applyButton,
                { minHeight: 44, paddingVertical: 10 },
              ]}
              accessibilityRole="button"
              onPress={() => props.onAplicar(todas, direcao)}
            >
              <Text style={styles.applyText}>Aplicar filtros</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}
