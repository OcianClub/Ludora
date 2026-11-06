import { AppSheet } from "./ui/AppSheet";
import { AppButton } from "./ui/Controls";
import { CalendarioPartida } from "./CalendarioPartida";
import { dataPartidaISO } from "@/src/utils/validarPartida";
import { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Icon, type IconName } from "@ludora/icons";
import { useTheme } from "@/src/contexts/ThemeContext";
import { createStyles } from "@/src/styles/filtrosJogosStyles";
import {
  filtrosJogosAtuais,
  PERIODOS_JOGOS,
  periodoJogos,
  STATUS_JOGOS,
  type FiltrosJogos as ValoresFiltros,
} from "@/src/utils/filtrosJogos";

type Props = {
  filtros: ValoresFiltros;
  onAplicar: (filtros: ValoresFiltros) => void;
  onFechar: () => void;
};

const grupos = [
  {
    chave: "organizadas",
    titulo: "Organização",
    opcoes: [
      { label: "Todos os clubes", valor: undefined },
      { label: "Organizadas pelo meu clube", valor: true },
    ],
  },
  {
    chave: "preparacao",
    titulo: "Preparação",
    opcoes: [
      { label: "Todas as situações", valor: undefined },
      { label: "Agendadas", valor: "AGENDADA" },
      { label: "Preparadas", valor: "PREPARADA" },
    ],
  },
  {
    chave: "mando",
    titulo: "Mando de campo",
    opcoes: [
      { label: "Casa e fora", valor: undefined },
      { label: "Em casa", valor: "casa", icone: "home" },
      { label: "Fora", valor: "fora", icone: "bus" },
    ],
  },
  {
    chave: "ordem",
    titulo: "Ordenar",
    opcoes: [
      { label: "Por horário", valor: "horario", icone: "clock" },
      { label: "Por categoria", valor: "categoria" },
    ],
  },
] as const;

export function FiltrosJogos({ filtros, onAplicar, onFechar }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rascunho, setRascunho] = useState<ValoresFiltros>({ ...filtros });

  const [campoData, setCampoData] = useState<"de" | "ate" | null>(null);
  const invalido =
    rascunho.periodo === "personalizado" &&
    (!rascunho.de || (!!rascunho.ate && rascunho.ate < rascunho.de));
  const textoData = (iso?: string) => iso?.split("-").reverse().join("/") ?? "";
  if (campoData)
    return (
      <CalendarioPartida
        data={textoData(rascunho[campoData] ?? rascunho.de)}
        tituloPainel={campoData === "de" ? "Data inicial" : "Data final"}
        subtitulo={
          campoData === "de"
            ? "Escolha o primeiro dia do período."
            : "Escolha o último dia do período."
        }
        onFechar={() => setCampoData(null)}
        onSelecionar={(data) => {
          const iso = dataPartidaISO(data);
          if (!iso) return;
          setRascunho((atual) => ({ ...atual, [campoData]: iso }));
          setCampoData(null);
        }}
      />
    );

  return (
    <AppSheet
      title="Filtrar jogos"
      subtitle={periodoJogos(rascunho)}
      onClose={onFechar}
      closeLabel="Fechar sem aplicar os filtros"
      contentStyle={{ gap: 0 }}
      footer={
        <>
          <AppButton
            label="Limpar filtros"
            variant="ghost"
            onPress={() =>
              setRascunho({
                ...filtrosJogosAtuais(),
                todosPeriodos: true,
                periodo: "todos",
              })
            }
          />
          <AppButton
            label="Aplicar filtros"
            variant="primary"
            disabled={invalido}
            accessibilityLabel={`Aplicar filtros: ${periodoJogos(rascunho)}, ${STATUS_JOGOS.find((opcao) => opcao.value === rascunho.status)?.label}`}
            onPress={() => onAplicar(rascunho)}
          />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <Text style={styles.label}>Período</Text>
        <View style={styles.chipRow}>
          {PERIODOS_JOGOS.map((opcao) => {
            const selecionado = (rascunho.periodo ?? "todos") === opcao.id;
            return (
              <TouchableOpacity
                key={opcao.id}
                style={[styles.chip, selecionado && styles.chipActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: selecionado }}
                onPress={() => {
                  setRascunho((atual) => ({
                    ...atual,
                    periodo: opcao.id,
                    todosPeriodos: opcao.id === "todos",
                    de: opcao.id === "personalizado" ? atual.de : undefined,
                    ate: opcao.id === "personalizado" ? atual.ate : undefined,
                  }));
                  if (opcao.id === "personalizado" && !rascunho.de)
                    setCampoData("de");
                }}
              >
                <Text
                  style={[
                    styles.optionText,
                    selecionado && styles.chipTextActive,
                  ]}
                >
                  {opcao.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {rascunho.periodo === "personalizado" && (
        <View style={styles.chipSection}>
          <View style={styles.chipRow}>
            {(["de", "ate"] as const).map((campo) => (
              <TouchableOpacity
                key={campo}
                style={styles.chip}
                accessibilityRole="button"
                accessibilityLabel={
                  campo === "de"
                    ? "Escolher data inicial"
                    : "Escolher data final"
                }
                onPress={() => setCampoData(campo)}
              >
                <Icon
                  name="calendar-outline"
                  size={16}
                  color={colors.textoSecundario}
                />
                <Text style={styles.optionText}>
                  {textoData(rascunho[campo]) ||
                    (campo === "de" ? "Data inicial" : "Data final opcional")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {invalido && rascunho.de && (
            <Text style={styles.optionText} accessibilityRole="alert">
              A data final deve ser igual ou posterior à inicial.
            </Text>
          )}
        </View>
      )}
      {grupos.map(({ chave, titulo, opcoes }) => (
        <View key={chave} style={styles.chipSection}>
          <Text style={styles.label}>{titulo}</Text>
          <View style={styles.chipRow}>
            {opcoes.map((opcao) => {
              const selecionado =
                (rascunho[chave] ??
                  (chave === "ordem" ? "horario" : undefined)) === opcao.valor;
              return (
                <TouchableOpacity
                  key={opcao.label}
                  style={[styles.chip, selecionado && styles.chipActive]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selecionado }}
                  onPress={() =>
                    setRascunho((atual) => ({
                      ...atual,
                      ...(chave === "preparacao" && opcao.valor
                        ? { status: "TODOS" as const }
                        : {}),
                      [chave]: opcao.valor,
                    }))
                  }
                >
                  {"icone" in opcao && (
                    <Icon
                      name={opcao.icone as IconName}
                      size={15}
                      color={
                        selecionado
                          ? colors.textoSobrePrimaria
                          : colors.textoSecundario
                      }
                    />
                  )}
                  <Text
                    style={[
                      styles.optionText,
                      selecionado && styles.chipTextActive,
                    ]}
                  >
                    {opcao.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}
    </AppSheet>
  );
}
