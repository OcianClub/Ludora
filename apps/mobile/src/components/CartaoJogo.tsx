import { partidaAtrasada } from '../../../../packages/shared-types/src/matchSchedule';
import { memo, useEffect, useState } from "react";
import { Image, Text, View } from "react-native";
import { MatchCardLayout } from "./MatchCardLayout";
import { SinalAoVivo } from "./SinalAoVivo";
import { Icon } from "@ludora/icons";
import { liveBadgeColors, matchResultColors, matchStatusColors, matchStatusLabels, radius, spacing } from "@ludora/design-tokens";
import { useTheme } from "@/src/contexts/ThemeContext";
import { createStyles } from "@/src/styles/jogosStyles";
import { type PartidaAgendaBase } from "@/src/utils/agendaJogos";

import { resultadoDoClube } from "@/src/utils/resumoPartidas";

export interface PartidaJogo extends PartidaAgendaBase {
  organizador_id?: number | null;
  paulista_evento_id?: number | null;
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
    <View style={[styles.teamCol, { flex: 0, width: "100%" }]}>
      <View style={[styles.fundoImg, { width: 48, height: 48 }, destaque && styles.crestHighlight]}>
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
      <Text style={[styles.teamName, { fontSize: 13, lineHeight: 20, height: 40 }]} numberOfLines={2}>
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
  gestor?:boolean;
  styles: Estilos;
  onPress: (partida: PartidaJogo) => void;
}) {
  const { colors, tema } = useTheme();
  const aoVivo = partida.status === "AO_VIVO";
  const finalizada = partida.status === "FINALIZADA";
  const resultado = finalizada ? resultadoDoClube(partida) : null;
  const [relogio,setRelogio]=useState(()=>new Date());
  const atrasada = partidaAtrasada(partida,relogio);
  useEffect(()=>{
    setRelogio(new Date());
    if(!['AGENDADA','PREPARADA'].includes(partida.status) || atrasada)return;
    const timer=setInterval(()=>setRelogio(new Date()),60000);
    return()=>clearInterval(timer);
  },[partida.id,partida.data,partida.horario,partida.status,atrasada]);
  const status = atrasada ? "ATRASADA" : partida.status;
  const situacao = resultado
    ? { V: "Vitória", E: "Empate", D: "Derrota" }[resultado]
    : matchStatusLabels[status as keyof typeof matchStatusLabels] || status;
  const paleta = matchStatusColors[tema];
  const badge = resultado ? matchResultColors[tema][resultado] : paleta[status as keyof typeof paleta];
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
    <MatchCardLayout
      onPress={() => onPress(partida)}
      label={`${partida.mandante.nome} contra ${partida.visitante.nome}`}
      action={acao} live={aoVivo} badgesBelow={finalizada}
      local={partida.local?.trim() || "Local não definido"}
      agenda={<View style={[styles.cardTopLeft, { flexWrap: 'wrap', gap: 8 }]}>
        <Text style={styles.cardDate}>{dia}</Text>
        {!partida.paulista_evento_id && <Text style={styles.catText}>{partida.categoria?.nome.toUpperCase()}</Text>}
        <Text style={styles.weekdayText}>{diaSemana}</Text>
        <Icon name="clock-outline" size={12} color={colors.textoSecundario}/>
        <Text style={styles.timeText}>{partida.horario?.slice(0, 5) ?? "--:--"}</Text>
      </View>}
      context={!!partida.paulista_evento_id && <View style={[styles.cardTopLeft, { marginTop: 7, flexWrap: 'wrap', gap: 10 }]}>
        <Text style={[styles.catText, { color: colors.primaria }]}>Campeonato Paulista</Text>
        <Text style={styles.catText}>{partida.categoria?.nome.toUpperCase()}</Text>
      </View>}
      badges={<>
          {aoVivo && <View style={[styles.cardStatusBadge, { backgroundColor: liveBadgeColors.fundo, borderRadius: radius.badge,
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs }]}>
            <SinalAoVivo size={14} color={liveBadgeColors.indicador} />
            <Text style={{ color: liveBadgeColors.texto, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{situacao}</Text>
          </View>}
          {!aoVivo && badge && <View style={[styles.cardStatusBadge, { backgroundColor: badge.fundo, borderRadius: radius.badge,
            flexDirection: 'row', alignItems: 'center', gap: spacing.xs }]}>
            {atrasada && <Icon name="clock-outline" size={14} color={badge.texto} />}
            <Text style={{ color: badge.texto, fontSize: 10, fontFamily: 'Inter_600SemiBold' }}>{situacao}</Text>
          </View>}
          <View style={styles.badge}>
            <Icon name={partida.emCasa ? "home-outline" : "bus"} size={14} color={colors.textoSecundario}/>
            <Text style={styles.badgeText}>{partida.emCasa ? "Casa" : "Fora"}
            </Text>
          </View>
      </>}
      home={<TimeJogo time={partida.mandante} destaque={partida.emCasa} styles={styles}/>}
      away={<TimeJogo time={partida.visitante} destaque={!partida.emCasa} styles={styles}/>}
      score={aoVivo || finalizada ? (
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
    />
  );
});
