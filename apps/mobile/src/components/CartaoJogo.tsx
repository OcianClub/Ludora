import { memo, useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { SinalAoVivo } from "./SinalAoVivo";
import { Icon } from "@ludora/icons";
import { lightColors } from "@ludora/design-tokens";
import { useTheme } from "@/src/contexts/ThemeContext";
import { createStyles } from "@/src/styles/jogosStyles";
import { type PartidaAgendaBase } from "@/src/utils/agendaJogos";

import { resultadoDoClube } from "@/src/utils/resumoPartidas";

export interface PartidaJogo extends PartidaAgendaBase {
  organizador_id?: number | null;
  somente_leitura?: boolean;
  mandante: { id: number; nome: string; escudo: string | null };
  visitante: { id: number; nome: string; escudo: string | null };
  gols_mandante: number;
  gols_visitante: number;
  local: string | null;
  emCasa: boolean;
  categoria: { id: number; nome: string } | null;
}

const formatarData = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});
const formatarSemana = new Intl.DateTimeFormat("pt-BR", { weekday: "short" });

type Estilos = ReturnType<typeof createStyles>;

function TimeJogo({
  time,
  destaque,
  styles,
}: {
  time: PartidaJogo["mandante"];
  destaque: boolean;
  styles: Estilos;
}) {
  const [falhou, setFalhou] = useState<string | null>(null);
  const escudo = time.escudo?.trim();
  return (
    <View style={styles.teamCol}>
      <View style={[styles.fundoImg, destaque && styles.crestHighlight]}>
        {escudo && falhou !== escudo ? (
          <Image
            source={{ uri: escudo }}
            style={styles.teamLogo}
            onError={() => setFalhou(escudo)}
          />
        ) : (
          <Text style={styles.crestInitial}>
            {Array.from(time.nome.trim())[0]?.toUpperCase() ?? "?"}
          </Text>
        )}
      </View>
      <Text style={styles.teamName} numberOfLines={2}>
        {time.nome}
      </Text>
    </View>
  );
}

export const CartaoJogo = memo(function CartaoJogo({
  partida,
  styles,
  onPress,
}: {
  partida: PartidaJogo;
  styles: Estilos;
  onPress: (partida: PartidaJogo) => void;
}) {
  const { colors, tema } = useTheme();
  const aoVivo = partida.status === "AO_VIVO";
  const finalizada = partida.status === "FINALIZADA";
  const resultado = finalizada ? resultadoDoClube(partida) : null;
  const situacao = resultado
    ? { V: "Vitória", E: "Empate", D: "Derrota" }[resultado]
    : {
        AGENDADA: "Agendada",
        PREPARADA: "Preparada",
        CANCELADA: "Cancelada",
      }[partida.status];
  const statusClaro = partida.status === "AGENDADA" ? lightColors.statusPartida.agendada
    : partida.status === "PREPARADA" ? lightColors.statusPartida.preparada
    : null;
  const data = new Date(partida.data.slice(0, 10) + "T12:00:00");
  const dia = formatarData
    .format(data)
    .replace(" de ", " ")
    .replace(".", "")
    .toUpperCase();
  const diaSemana = formatarSemana.format(data).replace(".", "");
  const acao = aoVivo
    ? "Acompanhar ao vivo"
    : finalizada
      ? "Ver súmula"
      : "Ver detalhes";

  return (
    <TouchableOpacity
      style={[styles.matchCard, aoVivo && styles.matchCardAoVivo]}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityHint={acao}
      onPress={() => onPress(partida)}
    >
      <View style={styles.cardTop}>
        <View style={styles.cardDateBlock}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.cardDate}>{dia}</Text>
            <Text style={styles.catText} numberOfLines={1}>
              {partida.categoria?.nome.toUpperCase()}
            </Text>
          </View>
          <View style={styles.cardTopLeft}>
            <Text style={styles.weekdayText}>{diaSemana}</Text>
            <Icon
              name="clock-outline"
              size={12}
              color={colors.textoSecundario}
            />
            <Text style={styles.timeText}>
              {partida.horario?.slice(0, 5) ?? "--:--"}
            </Text>
          </View>
        </View>
        <View style={styles.cardBadges}>
          {aoVivo && (
            <View accessible accessibilityLabel="Ao vivo">
              <SinalAoVivo />
            </View>
          )}
          {!!situacao && (
            <Text
              style={[
                styles.cardStatusBadge,
                partida.status === "PREPARADA" && styles.preparedBadge,
                partida.status === "AGENDADA" && styles.scheduledBadge,
                resultado === "V" && styles.winBadge,
                resultado === "D" && styles.lossBadge,
                resultado === "E" && styles.drawBadge,
                tema === "light" && statusClaro && { color: statusClaro.texto, backgroundColor: statusClaro.fundo },
                tema === "light" && resultado === "D" && { backgroundColor: lightColors.statusPartida.derrota },
              ]}
            >
              {situacao}
            </Text>
          )}
          <View style={styles.badge}>
            <Icon
              name={partida.emCasa ? "home-outline" : "bus"}
              size={12}
              color={colors.texto}
            />
            <Text style={styles.badgeText}>
              {partida.emCasa ? "Casa" : "Fora"}
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.cardBody}>
        <TimeJogo
          time={partida.mandante}
          destaque={partida.emCasa}
          styles={styles}
        />
        <View style={styles.placarCentral}>
          {aoVivo || finalizada ? (
            <View
              style={styles.placarRow}
              accessible
              accessibilityLabel={`${partida.gols_mandante} a ${partida.gols_visitante}`}
            >
              <Text style={styles.placarText}>{partida.gols_mandante}</Text>
              <View style={styles.scoreDot} />
              <Text style={styles.placarText}>{partida.gols_visitante}</Text>
            </View>
          ) : (
            <Text style={styles.vsText}>VS</Text>
          )}
        </View>
        <TimeJogo
          time={partida.visitante}
          destaque={!partida.emCasa}
          styles={styles}
        />
      </View>
      <View style={styles.cardFooter}>
        <Icon
          name="map-marker-outline"
          size={16}
          color={colors.textoSecundario}
        />
        <Text style={styles.locationText} numberOfLines={2}>
          {partida.local?.trim() || "Local não definido"}
        </Text>
      </View>
      <View style={[styles.cardDetails, aoVivo && styles.cardDetailsLive]}>
        <Text
          style={[styles.cardDetailsText, aoVivo && styles.cardDetailsLiveText]}
        >
          {acao}
        </Text>
        <Icon
          name={aoVivo ? "live" : "chevron-right"}
          size={16}
          color={aoVivo ? colors.textoSobrePrimaria : colors.primaria}
        />
      </View>
    </TouchableOpacity>
  );
});
