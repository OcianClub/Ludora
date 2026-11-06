import { AppSheet } from "./ui/AppSheet";
import { AppButton } from "./ui/Controls";
import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
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
    <AppSheet
      title="Filtrar solicitações"
      onClose={props.onFechar}
      closeLabel="Fechar filtros"
      contentStyle={{ gap: 0 }}
      footer={
        <>
          <AppButton
            label="Limpar filtros"
            variant="ghost"
            onPress={() => {
              setTodas(true);
              setDirecao("todas");
            }}
          />
          <AppButton
            label="Aplicar filtros"
            variant="primary"
            onPress={() => props.onAplicar(todas, direcao)}
          />
        </>
      }
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
    </AppSheet>
  );
}
