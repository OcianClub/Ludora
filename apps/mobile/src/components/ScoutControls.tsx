import { AppSheet } from "./ui/AppSheet";
import { AppButton } from "./ui/Controls";
import { createFilterStyles } from "./ui/styles";
import Svg, { Polygon } from "react-native-svg";
import { useMemo, useState, type ReactNode } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { Icon } from "@ludora/icons";
import { useTheme } from "@/src/contexts/ThemeContext";
import { createStyles } from "@/src/styles/contextoAtletaScoutStyles";
import {
  FILTROS_SCOUT_INICIAIS,
  type FiltrosScout,
  type OrdenacaoScout,
  type DirecaoScout,
  type PerfilScout,
} from "@/src/utils/filtrosScout";

export const ORDENS_SCOUT: { label: string; value: OrdenacaoScout }[] = [
  { label: "Convocações", value: "NOTA" },
  { label: "Gols", value: "GOLS" },
  { label: "Assistências", value: "ASSISTENCIAS" },
  { label: "Defesas", value: "DEFESAS" },
  { label: "Nome A–Z", value: "NOME" },
  { label: "Camisa", value: "CAMISA" },
];
export function ScoutSheet({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <AppSheet title={title} onClose={onClose} footer={footer}>
      {children}
    </AppSheet>
  );
}
export function ScoutSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.descricao}>{label}</Text>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${options.find((o) => o.value === value)?.label || "Selecionar"}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[s.select, disabled && { opacity: 0.5 }]}
      >
        <Text numberOfLines={1} style={[s.label, { flex: 1 }]}>
          {options.find((o) => o.value === value)?.label || "Selecionar"}
        </Text>
        <View style={s.chevron}>
          <Icon name="chevron-down" size={16} color={colors.textoSecundario} />
        </View>
      </TouchableOpacity>
      {open && (
        <ScoutSheet title={label} onClose={() => setOpen(false)}>
          <View style={{ gap: 3 }}>
            {options.map((o) => (
              <TouchableOpacity
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: o.value === value }}
                onPress={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                style={[
                  s.choice,
                  o.value === value && {
                    backgroundColor: colors.cardSecundario,
                  },
                ]}
              >
                <Text style={[s.label, { flex: 1 }]}>{o.label}</Text>
                {o.value === value && (
                  <Icon name="check" size={18} color={colors.primaria} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScoutSheet>
      )}
    </View>
  );
}
export function ScoutHelp({ onClose }: { onClose: () => void }) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  return (
    <ScoutSheet
      title="Como interpretar o Scout"
      onClose={onClose}
      footer={<AppButton label="Entendi" variant="primary" onPress={onClose} />}
    >
      {[
        [
          "O que está registrado",
          "Eventos e convocações em partidas finalizadas. Ser convocado não comprova entrada em campo; não estimamos minutos jogados. Dados ausentes não significam habilidades ausentes.",
        ],
        [
          "Perfis de contribuição",
          "Artilheiro, Armador e Paredão indicam predominância de gols, assistências e defesas; Misto indica empate. Exigem pelo menos 5 convocações e 3 eventos. Não são notas de habilidade nem recomendações de posição.",
        ],
        [
          "Registros semelhantes",
          "O modelo compara médias por convocação entre atletas da mesma categoria e posição, com ao menos 5 atletas com amostra suficiente. Semelhança estatística não significa qualidade equivalente.",
        ],
        [
          "Filtros e partidas ao vivo",
          "Temporada, campeonato ou partida mudam todo o recorte da ficha. Dados ao vivo são provisórios e ficam fora das médias históricas e do treinamento.",
        ],
        [
          "Como ler os gráficos",
          "O radar mostra contagens reais, na escala da maior contagem do recorte: uma área maior não significa melhor desempenho. Cada barra soma gols, assistências e defesas de um jogo. As médias usam os últimos 5 jogos com registro, ou os disponíveis; “Antes” são os 5 anteriores.",
        ],
      ].map(([title, text]) => (
        <View key={title} style={{ gap: 6 }}>
          <Text style={s.subtitulo}>{title}</Text>
          <Text style={s.body}>{text}</Text>
        </View>
      ))}
    </ScoutSheet>
  );
}
export function ScoutFilters({
  initial,
  perfilInicial,
  order,
  direction,
  onApply,
  onClose,
}: {
  initial: FiltrosScout;
  perfilInicial: PerfilScout;
  order: OrdenacaoScout;
  direction: DirecaoScout;
  onApply: (f: FiltrosScout, o: OrdenacaoScout, d: DirecaoScout, perfil: PerfilScout) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const f = useMemo(() => createFilterStyles(colors), [colors]);
  const [filters, setFilters] = useState(initial);
  const [perfil, setPerfil] = useState(perfilInicial);
  const [sort, setSort] = useState(`${order}:${direction}`);
  function chips(
    label: string,
    key: keyof FiltrosScout,
    choices: [string, string][],
  ) {
    return (
      <View style={{ gap: 9 }}>
        <Text style={f.label}>{label}</Text>
        <View style={f.chipRow}>
          {choices.map(([value, text]) => (
            <TouchableOpacity
              key={value}
              style={[
                f.chip,
                filters[key] === value && {
                  backgroundColor: colors.primaria,
                  borderColor: colors.primaria,
                },
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: filters[key] === value }}
              onPress={() => setFilters({ ...filters, [key]: value })}
            >
              <Text
                style={[
                  f.optionText,
                  filters[key] === value && { color: "#fff" },
                ]}
              >
                {text}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }
  return (
    <ScoutSheet
      title="Filtrar elenco"
      onClose={onClose}
      footer={
        <>
          <AppButton
            label="Limpar filtros"
            variant="ghost"
            onPress={() => {
              setFilters(FILTROS_SCOUT_INICIAIS);
              setPerfil("Todos");
              setSort("NOTA:");
            }}
          />
          <AppButton
            label="Aplicar filtros"
            variant="primary"
            onPress={() => {
              const [o, d] = sort.split(":");
              onApply(filters, o as OrdenacaoScout, d as DirecaoScout, perfil);
              onClose();
            }}
          />
        </>
      }
    >
      <View style={{ gap: 9 }}>
        <Text style={f.label}>Contribuição</Text>
        <View style={f.chipRow}>
          {(['Todos', 'Artilheiro', 'Armador', 'Paredão', 'Misto', 'Sem dados'] as PerfilScout[]).map((value) => <TouchableOpacity key={value} accessibilityRole="radio" accessibilityState={{ checked: perfil === value }}
            onPress={() => setPerfil(value)} style={[f.chip, perfil === value && { backgroundColor: colors.primaria, borderColor: colors.primaria }]}>
            <Text style={[f.optionText, perfil === value && { color: colors.textoSobrePrimaria }]}>{value === 'Sem dados' ? 'Sem perfil' : value}</Text>
          </TouchableOpacity>)}
        </View>
      </View>
      {chips("Posição", "posicao", [
        ["", "Todas"],
        ["Goleiro", "Goleiro"],
        ["Fixo", "Fixo"],
        ["Pivô", "Pivô"],
        ["Alas", "Alas"],
      ])}
      {chips("Participação", "participacao", [
        ["todos", "Todos"],
        ["com", "Com escalações"],
        ["sem", "Sem escalações"],
      ])}
      {chips("Perfil de registros", "perfil", [
        ["todos", "Todos"],
        ["com", "Com perfil"],
        ["sem", "Sem perfil"],
      ])}
      <ScoutSelect
        label="Ordenar por"
        value={sort === "NOTA:" ? "" : sort.split(":")[0]}
        onChange={(v) =>
          setSort(
            v
              ? `${v}:${["NOME", "CAMISA"].includes(v) ? "asc" : "desc"}`
              : "NOTA:",
          )
        }
        options={[
          { value: "", label: "Padrão" },
          ...ORDENS_SCOUT.map((o) => ({ value: o.value, label: o.label })),
        ]}
      />
    </ScoutSheet>
  );
}

export function ScoutSortIndicator({ direction }: { direction: DirecaoScout }) {
  const { colors } = useTheme();
  return (
    <Svg width={12} height={19} viewBox="0 0 12 19" accessible={false}>
      <Polygon
        points="6,2 10,7 2,7"
        stroke={colors.textoSecundario}
        strokeWidth={1}
        strokeLinejoin="round"
        fill={direction === "asc" ? colors.texto : "none"}
      />
      <Polygon
        points="2,12 10,12 6,17"
        stroke={colors.textoSecundario}
        strokeWidth={1}
        strokeLinejoin="round"
        fill={direction === "desc" ? colors.texto : "none"}
      />
    </Svg>
  );
}
