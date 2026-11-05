import { memo, useMemo } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import Svg, {
  Circle,
  G,
  Line,
  Polygon,
  Text as SvgText,
  TSpan,
} from "react-native-svg";
import { useTheme } from "@/src/contexts/ThemeContext";
import { typography } from "@ludora/design-tokens";
import { createStyles } from "@/src/styles/contextoAtletaScoutStyles";
import { radarScout, jogosGraficoScout } from "@/src/utils/graficosScout";
import type {
  PartidaScout,
  TotaisContextoScout,
} from "@/src/utils/contextoScout";

export const ScoutRadar = memo(function ScoutRadar({
  totais,
}: {
  totais: TotaisContextoScout;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const { eixos, maximo } = radarScout(totais);
  const point = (i: number, r: number) => {
    const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
    return [180 + Math.cos(angle) * r, 132 + Math.sin(angle) * r];
  };
  const polygon = (r: number) =>
    eixos.map((_, i) => point(i, r).join(",")).join(" ");
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Radar de registros. ${eixos.map((e) => `${e.label}: ${e.valor}`).join(", ")}. Escala de zero a ${maximo}. Não é nota de desempenho.`}
    >
      <Svg width="100%" height={250} viewBox="0 0 360 270" accessible={false}>
        {[0.25, 0.5, 0.75, 1].map((r) => (
          <Polygon
            key={r}
            points={polygon(84 * r)}
            stroke={colors.borda}
            strokeWidth={1}
            fill="none"
          />
        ))}
        {eixos.map((e, i) => {
          const [x, y] = point(i, 84);
          const [tx, ty] = point(i, 116);
          return (
            <G key={e.label}>
              <Line x1={180} y1={132} x2={x} y2={y} stroke={colors.borda} />
              <SvgText
                x={tx}
                y={ty}
                textAnchor="middle"
                fill={colors.textoSecundario}
                fontFamily={typography.fontFamily.corpo.regular}
                fontSize={12}
              >
                {e.label}
                <TSpan
                  x={tx}
                  dy={18}
                  fill={colors.texto}
                  fontWeight="600"
                  fontSize={15}
                >
                  {e.valor}
                </TSpan>
              </SvgText>
            </G>
          );
        })}
        <Polygon
          points={eixos
            .map((e, i) => point(i, (84 * e.valor) / maximo).join(","))
            .join(" ")}
          fill={colors.primaria + "24"}
          stroke={colors.primaria}
          strokeWidth={2}
        />
        {eixos.map((e, i) => {
          const [cx, cy] = point(i, (84 * e.valor) / maximo);
          return (
            <Circle
              key={e.label}
              cx={cx}
              cy={cy}
              r={3}
              fill={colors.primaria}
            />
          );
        })}
      </Svg>
      <Text style={s.descricao}>
        Escala: 0–{maximo} eventos. Volume de registros, não nota de desempenho.
      </Text>
    </View>
  );
});
export const ScoutRecentChart = memo(function ScoutRecentChart({
  partidas,
  onSelect,
}: {
  partidas: PartidaScout[];
  onSelect: (id: number) => void;
}) {
  const { colors, tema } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const jogos = useMemo(() => jogosGraficoScout(partidas), [partidas]);
  const metrics = [
    { key: "gols", label: "Gols", color: colors.primaria },
    {
      key: "assistencias",
      label: "Assist.",
      color: tema === "dark" ? "#A58ADD" : "#7850B2",
    },
    {
      key: "defesas",
      label: "Defesas",
      color: tema === "dark" ? "#2DBCA7" : "#087F72",
    },
  ] as const;
  const max = Math.max(1, ...jogos.map((j) => j.total));
  return (
    <View style={{ gap: 16 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        {metrics.map((m) => (
          <View
            key={m.key}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
          >
            <View
              style={{
                width: 8,
                height: 8,
                borderRadius: 1,
                backgroundColor: m.color,
              }}
            />
            <Text style={s.descricao}>{m.label}</Text>
          </View>
        ))}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={{ gap: 2, paddingBottom: 14 }}
      >
        {jogos.map((j) => (
          <TouchableOpacity
            key={j.id}
            onPress={() => onSelect(j.id)}
            accessibilityRole="button"
            accessibilityLabel={`${j.adversario}, ${j.data.split("-").reverse().join("/")}. ${j.gols} gols, ${j.assistencias} assistências, ${j.defesas} defesas. Ver partida.`}
            style={{
              width: 42,
              alignItems: "center",
              gap: 8,
              paddingVertical: 6,
            }}
          >
            <Text style={s.label}>{j.total}</Text>
            <View style={{ height: 130, justifyContent: "flex-end" }}>
              <View style={{ flexDirection: "column-reverse", width: 20 }}>
                {metrics.map((m) => (
                  <View
                    key={m.key}
                    style={{
                      height: (j[m.key] / max) * 125,
                      backgroundColor: m.color,
                      width: 20,
                    }}
                  />
                ))}
              </View>
            </View>
            <Text style={[s.descricao, { fontSize: 10 }]}>
              {j.data.slice(8, 10)}/{j.data.slice(5, 7)}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <Text style={s.descricao}>
        Mais recente à direita · toque nas barras para detalhar.
      </Text>
    </View>
  );
});
