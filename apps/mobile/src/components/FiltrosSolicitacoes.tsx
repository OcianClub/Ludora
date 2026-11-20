import { RadioOption } from './ui/RadioOption';
import { AppSheet } from "./ui/AppSheet";
import { AppButton } from "./ui/Controls";
import { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { createStyles } from "../styles/filtrosJogosStyles";

type Props = {
  todas: boolean;
  pendentes: number;
  onFechar: () => void;
  onAplicar: (todas: boolean) => void;
};

export function FiltrosSolicitacoes(props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [todas, setTodas] = useState(props.todas);
  function opcao(label: string, selecionada: boolean, onPress: () => void) {
    return <RadioOption key={label} label={label} selected={selecionada} onPress={onPress} />;
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
            }}
          />
          <AppButton
            label="Aplicar filtros"
            variant="primary"
            onPress={() => props.onAplicar(todas)}
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
        <View style={{ gap: 4 }}>
          {opcao(`Pendentes · ${props.pendentes}`, !todas, () =>
            setTodas(false),
          )}
          {opcao("Todas as situações", todas, () => setTodas(true))}
        </View>
      </View>
    </AppSheet>
  );
}
