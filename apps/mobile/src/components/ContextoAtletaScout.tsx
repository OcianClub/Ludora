import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Icon, type IconName } from "@ludora/icons";
import { useTheme } from "@/src/contexts/ThemeContext";
import { obterContextoScout } from "@/src/services/mlService";
import {
  formatarMediaScout,
  resumirContextoScout,
  type ContextoScout,
  type FiltroContextoScout,
} from "@/src/utils/contextoScout";
import { temporadasScout } from "@/src/utils/graficosScout";
import { createStyles } from "@/src/styles/contextoAtletaScoutStyles";
import { ScoutSelect, ScoutHelp } from "./ScoutControls";
import { ScoutRadar, ScoutRecentChart } from "./ScoutCharts";
import { Skeleton } from "./Skeleton";
import { ErroConsulta, ErroConexao } from "@/src/utils/request";
import { iniciarMedicaoCarregamento } from "@/src/utils/desempenho";

const EVENTOS: Record<string, { label: string; icon: IconName }> = {
  GOL: { label: "Gol", icon: "soccer" },
  ASSISTENCIA: { label: "Assistência", icon: "handshake" },
  DEFESA: { label: "Defesa", icon: "shield-check" },
  FALTA: { label: "Falta", icon: "whistle" },
  CARTAO_AMARELO: { label: "Cartão amarelo", icon: "card" },
  CARTAO_VERMELHO: { label: "Cartão vermelho", icon: "card" },
  CARTAO_AZUL: { label: "Cartão azul", icon: "card" },
};
function Disclosure({
  title,
  icon,
  children,
}: {
  title: string;
  icon: IconName;
  children: ReactNode;
}) {
  const { colors } = useTheme();
  const s = createStyles(colors);
  const [open, setOpen] = useState(false);
  return (
    <View style={s.panel}>
      <TouchableOpacity
        style={s.disclosure}
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(!open)}
      >
        <Icon name={icon} size={17} color={colors.texto} />
        <Text style={[s.subtitulo, { flex: 1 }]}>{title}</Text>
        <Icon
          name={open ? "chevron-up" : "chevron-down"}
          size={17}
          color={colors.textoSecundario}
        />
      </TouchableOpacity>
      {open && children}
    </View>
  );
}
export function ContextoAtletaScout({
  jogadorId,
  clubeId,
  consultaLocal,
}: {
  jogadorId: number;
  clubeId: number;
  consultaLocal: boolean;
}) {
  const { colors } = useTheme();
  const s = useMemo(() => createStyles(colors), [colors]);
  const [resultado, setResultado] = useState<{
    chave: string;
    dados: ContextoScout;
  } | null>(null);
  const [opcoes, setOpcoes] = useState<ContextoScout["opcoes"]>();
  const [filtro, setFiltro] = useState<FiltroContextoScout>({});
  const [tipo, setTipo] = useState<"geral" | "competicao" | "partida">("geral");
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [help, setHelp] = useState(false);
  const chave = JSON.stringify([
    clubeId,
    jogadorId,
    filtro.ano,
    filtro.competicao_id,
    filtro.partida_id,
  ]);
  const contexto = resultado?.chave === chave ? resultado.dados : null;
  const [demorando, setDemorando] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    const finalizar = iniciarMedicaoCarregamento("scout:ficha-pronta");
    setErro("");
    setDemorando(false);
    if (consultaLocal) {
      setCarregando(false);
      return () => controller.abort();
    }
    setCarregando(true);
    const demora = setTimeout(() => {
      if (!controller.signal.aborted) setDemorando(true);
    }, 4000);
    const exibir = (data: ContextoScout) => {
      if (controller.signal.aborted) return;
      setResultado((anterior) =>
        anterior?.chave === chave && anterior.dados === data
          ? anterior
          : { chave, dados: data },
      );
      setOpcoes(data.opcoes);
    };
    obterContextoScout(
      jogadorId,
      clubeId,
      controller.signal,
      filtro,
      tentativa > 0,
      (data) => exibir(data),
    )
      .then((data) => {
        exibir(data);
        finalizar({ resultado: "dados" });
      })
      .catch((e: unknown) => {
        if (controller.signal.aborted) return;
        if (e instanceof ErroConsulta && [401, 403, 404].includes(e.status))
          setResultado(null);
        setErro(
          e instanceof ErroConexao
            ? "A conexão está indisponível ou demorou a responder. Confira sua internet e tente novamente."
            : e instanceof ErroConsulta && [401, 403, 404].includes(e.status)
              ? e.message
              : "Não foi possível atualizar os registros. Tente novamente.",
        );
        finalizar({ resultado: "erro" });
      })
      .finally(() => {
        clearTimeout(demora);
        if (!controller.signal.aborted) setCarregando(false);
      });
    return () => {
      clearTimeout(demora);
      controller.abort();
    };
  }, [jogadorId, clubeId, consultaLocal, chave, tentativa]);
  const alterarFiltro = useCallback((novo: FiltroContextoScout) => {
    setTentativa(0);
    setFiltro((atual) =>
      atual.ano === novo.ano &&
      atual.competicao_id === novo.competicao_id &&
      atual.partida_id === novo.partida_id
        ? atual
        : novo,
    );
  }, []);
  function change(next: typeof tipo) {
    setTipo(next);
    alterarFiltro(
      next === "competicao" && opcoes?.competicoes.length
        ? { competicao_id: opcoes.competicoes[0].id }
        : next === "partida" && opcoes?.partidas.length
          ? { partida_id: opcoes.partidas[0].id }
          : {},
    );
  }
  const selectMatch = useCallback(
    (id: number) => {
      setTipo("partida");
      alterarFiltro({ partida_id: id });
    },
    [alterarFiltro],
  );
  const summary = contexto ? resumirContextoScout(contexto) : null;
  const match =
    contexto?.recorte?.tipo === "partida" ? contexto.partidas[0] : null;
  const totals = contexto?.totais;
  const title =
    tipo === "partida"
      ? "Nesta partida"
      : tipo === "competicao"
        ? opcoes?.competicoes.find((c) => c.id === filtro.competicao_id)
            ?.nome || "Campeonato"
        : filtro.ano
          ? `Temporada ${filtro.ano}`
          : "Histórico completo";
  const countCards = totals
    ? totals.amarelos + totals.vermelhos + totals.azuis
    : 0;
  if (consultaLocal)
    return (
      <View style={s.avisoContainer}>
        <Text style={s.subtitulo}>Histórico salvo no dispositivo</Text>
        <Text style={s.descricao}>
          Conecte-se para consultar temporadas, campeonatos, partidas e
          gráficos. Os totais gerais salvos estão disponíveis abaixo.
        </Text>
      </View>
    );
  return (
    <View style={s.container}>
      <View style={{ gap: 8 }}>
        <Text style={s.descricao}>Analisar</Text>
        <View style={s.seletor} accessibilityRole="radiogroup">
          {(["geral", "competicao", "partida"] as const).map((t) => {
            const disabled =
              t === "competicao"
                ? !opcoes?.competicoes.length
                : t === "partida"
                  ? !opcoes?.partidas.length
                  : false;
            return (
              <TouchableOpacity
                key={t}
                style={[
                  s.opcao,
                  tipo === t && { backgroundColor: colors.cardSecundario },
                  disabled && { opacity: 0.4 },
                ]}
                disabled={disabled}
                accessibilityRole="radio"
                accessibilityState={{ checked: tipo === t, disabled }}
                onPress={() => change(t)}
              >
                <Text style={s.label}>
                  {t === "geral"
                    ? "Geral"
                    : t === "competicao"
                      ? "Campeonato"
                      : "Partida"}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
      {tipo === "geral" && (
        <ScoutSelect
          label="Temporada"
          value={String(filtro.ano || "")}
          disabled={carregando && !opcoes}
          options={[
            { value: "", label: "Todas as temporadas" },
            ...temporadasScout(opcoes).map((y) => ({
              value: String(y),
              label: String(y),
            })),
          ]}
          onChange={(v) => {
            if (!v || temporadasScout(opcoes).includes(Number(v))) {
              alterarFiltro(v ? { ano: Number(v) } : {});
            }
          }}
        />
      )}
      {tipo === "competicao" && (
        <ScoutSelect
          label="Campeonato"
          value={String(filtro.competicao_id || "")}
          options={(opcoes?.competicoes || []).map((c) => ({
            value: String(c.id),
            label: `${c.nome} · ${c.ano}`,
          }))}
          onChange={(v) => {
            alterarFiltro({ competicao_id: Number(v) });
          }}
        />
      )}
      {tipo === "partida" && (
        <ScoutSelect
          label="Partida"
          value={String(filtro.partida_id || "")}
          options={(opcoes?.partidas || []).map((p) => ({
            value: String(p.id),
            label: `${p.data.split("-").reverse().join("/")} · ${p.nome}${p.status === "AO_VIVO" ? " · Ao vivo" : ""}`,
          }))}
          onChange={(v) => selectMatch(Number(v))}
        />
      )}
      <View style={{ height: 1, backgroundColor: colors.linha }} />
      {(carregando || !erro) && !contexto ? (
        <View
          style={{ gap: 14 }}
          accessibilityRole="progressbar"
          accessibilityLabel="Carregando histórico do atleta"
          accessibilityLiveRegion="polite"
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 9,
              paddingVertical: 8,
            }}
          >
            <ActivityIndicator size="small" color={colors.primaria} />
            <Text style={s.descricao}>
              Carregando registros{demorando ? " · aguardando o servidor" : ""}…
            </Text>
          </View>
          <View style={s.medias}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={s.media}>
                <Skeleton width="65%" height={12} />
                <Skeleton width={38} height={30} />
              </View>
            ))}
          </View>
          <View style={s.panel}>
            <Skeleton width="60%" height={16} />
            <Skeleton height={190} />
          </View>
          {demorando && (
            <Text style={s.descricao}>
              O servidor está levando mais tempo. Você pode fechar a ficha e
              voltar em instantes.
            </Text>
          )}
        </View>
      ) : erro && !contexto ? (
        <View style={s.loading}>
          <Icon
            name="information-outline"
            size={28}
            color={colors.textoSecundario}
          />
          <Text
            style={[s.descricao, { textAlign: "center" }]}
            accessibilityRole="alert"
          >
            {erro}
          </Text>
          <TouchableOpacity
            style={s.botao}
            onPress={() => setTentativa((t) => t + 1)}
            accessibilityRole="button"
          >
            <Text style={s.link}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      ) : (
        contexto &&
        summary && (
          <>
            {carregando && (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
                accessibilityLiveRegion="polite"
              >
                <ActivityIndicator size="small" color={colors.primaria} />
                <Text style={s.descricao}>Atualizando registros…</Text>
              </View>
            )}
            {!!erro && (
              <View style={s.avisoContainer} accessibilityRole="alert">
                <Text style={s.descricao}>
                  Mostrando os últimos registros carregados deste recorte.{" "}
                  {erro}
                </Text>
                <TouchableOpacity
                  style={s.botao}
                  onPress={() => setTentativa((t) => t + 1)}
                  accessibilityRole="button"
                >
                  <Text style={s.link}>Tentar novamente</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={s.heading}>
              <Text style={[s.subtitulo, { flexShrink: 1 }]}>{title}</Text>
              <Text style={s.descricao}>
                {contexto.total_partidas}{" "}
                {contexto.total_partidas === 1 ? "partida" : "partidas"} com
                registro
              </Text>
            </View>
            {contexto.recorte?.provisorio && (
              <View style={s.avisoContainer}>
                <Text style={s.descricao}>
                  Dados provisórios: partida ao vivo. Fora das médias históricas
                  e do treinamento.
                </Text>
              </View>
            )}
            {!contexto.total_partidas ? (
              <View style={s.loading}>
                <Icon name="radar" size={30} color={colors.textoSecundario} />
                <Text style={s.subtitulo}>
                  Ainda sem registros neste recorte
                </Text>
                <Text style={[s.descricao, { textAlign: "center" }]}>
                  Os dados aparecem após uma convocação ou evento em uma partida
                  finalizada.
                </Text>
                {!!filtro.ano && (
                  <TouchableOpacity
                    style={s.botao}
                    onPress={() => change("geral")}
                  >
                    <Text style={s.link}>Ver histórico completo</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <>
                {match && (
                  <View style={s.panel}>
                    <Text style={s.descricao}>
                      {match.data.split("-").reverse().join("/")} ·{" "}
                      {match.competicao?.nome || "Amistoso"}
                    </Text>
                    <Text style={s.subtitulo}>
                      {match.mandante} {match.gols_mandante} ×{" "}
                      {match.gols_visitante} {match.visitante}
                    </Text>
                    <Text style={s.descricao}>
                      {match.titular_inicial === true
                        ? "Titular inicial"
                        : match.titular_inicial === false
                          ? "Reserva inicial"
                          : match.convocado
                            ? "Convocado"
                            : "Com eventos registrados"}
                    </Text>
                  </View>
                )}
                {totals && (
                  <>
                    <View style={s.medias}>
                      {(
                        [
                          [
                            "Convocações",
                            totals.convocacoes,
                            "account-group-outline",
                          ],
                          ["Gols", totals.gols, "soccer"],
                          ["Assist.", totals.assistencias, "handshake"],
                          ["Defesas", totals.defesas, "shield-check"],
                        ] as [string, number, IconName][]
                      ).map(([label, value, icon]) => (
                        <View
                          key={label}
                          style={s.media}
                          accessible
                          accessibilityLabel={`${label === "Assist." ? "Assistências" : label}: ${value}`}
                        >
                          <View style={s.totalLabel}>
                            <Text style={s.descricao}>{label}</Text>
                            <Icon
                              name={icon}
                              size={18}
                              color={colors.primaria}
                            />
                          </View>
                          <Text style={s.valor}>{value}</Text>
                        </View>
                      ))}
                    </View>
                    <View style={s.secundarios}>
                      <Text style={s.descricao}>
                        {totals.titularidades} como titular inicial
                      </Text>
                      <Text style={s.descricao}>
                        {totals.faltas}{" "}
                        {totals.faltas === 1 ? "falta" : "faltas"}
                      </Text>
                      <Text style={s.descricao}>
                        {countCards} {countCards === 1 ? "cartão" : "cartões"}
                      </Text>
                    </View>
                    <View style={s.panel}>
                      <Text style={s.subtitulo}>Raio-X dos registros</Text>
                      <Text style={s.descricao}>
                        {match ? "Nesta partida" : "No período selecionado"}
                      </Text>
                      <ScoutRadar totais={totals} />
                    </View>
                  </>
                )}
                {!match && !!contexto.partidas.length && (
                  <>
                    <View style={s.panel}>
                      <Text style={s.subtitulo}>Últimos jogos</Text>
                      <Text style={s.descricao}>
                        Gols, assistências e defesas por partida
                      </Text>
                      <ScoutRecentChart
                        partidas={contexto.partidas}
                        onSelect={selectMatch}
                      />
                      <View
                        style={{
                          gap: 12,
                          borderTopWidth: 1,
                          borderTopColor: colors.linha,
                          paddingTop: 16,
                        }}
                      >
                        <Text style={s.descricao}>
                          Média nas últimas {summary.tamanhoRecente} partidas
                        </Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          {summary.metricas.map((m) => (
                            <View
                              key={m.campo}
                              style={{ flex: 1, minWidth: 0, gap: 5 }}
                            >
                              <Text style={[s.descricao, { fontSize: 11 }]}>
                                {m.titulo === "Assistências"
                                  ? "Assist."
                                  : m.titulo}
                                /jogo
                              </Text>
                              <Text style={s.valor}>
                                {formatarMediaScout(m.recente)}
                              </Text>
                              {summary.podeComparar && (
                                <Text style={[s.descricao, { fontSize: 10 }]}>
                                  Antes: {formatarMediaScout(m.anterior)}
                                </Text>
                              )}
                            </View>
                          ))}
                        </View>
                        {summary.podeComparar && (
                          <Text style={s.descricao}>
                            Antes = média das 5 partidas anteriores.
                          </Text>
                        )}
                      </View>
                    </View>
                    {summary.poucosRegistros && (
                      <Text style={s.descricao}>
                        Amostra inicial: {contexto.total_partidas} de 5
                        partidas. Evite conclusões com poucos registros.
                      </Text>
                    )}
                    <View style={{ gap: 10 }}>
                      <Text style={s.subtitulo}>Jogos com registro</Text>
                      <Text style={s.descricao}>
                        Últimos {contexto.partidas.length} · mais recentes
                        primeiro
                      </Text>
                      <View style={s.table}>
                        <View style={s.tableHeader}>
                          <Text
                            style={[s.descricao, s.opponent, { fontSize: 10 }]}
                          >
                            Adversário / data
                          </Text>
                          {["Gols", "Assist", "Defesas"].map((label) => (
                            <Text key={label} style={[s.column, s.columnHead]}>
                              {label}
                            </Text>
                          ))}
                        </View>
                        {contexto.partidas.map((p) => (
                          <TouchableOpacity
                            key={p.id}
                            style={s.tableRow}
                            onPress={() => selectMatch(p.id)}
                            accessibilityRole="button"
                            accessibilityLabel={`${p.adversario}, ${p.data.split("-").reverse().join("/")}, ${p.gols} gols, ${p.assistencias} assistências, ${p.defesas} defesas. Ver registros.`}
                          >
                            <View style={s.opponent}>
                              <Text style={s.label} numberOfLines={1}>
                                {p.adversario}
                              </Text>
                              <Text style={s.descricao}>
                                {p.data.split("-").reverse().join("/")}
                              </Text>
                              <Text style={s.descricao} numberOfLines={1}>
                                {p.competicao?.nome || "Amistoso"}
                              </Text>
                            </View>
                            {[p.gols, p.assistencias, p.defesas].map((v, i) => (
                              <Text key={i} style={s.column}>
                                {v}
                              </Text>
                            ))}
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  </>
                )}
                {match && (
                  <View style={s.panel}>
                    <Text style={s.subtitulo}>Ações do atleta</Text>
                    {match.eventos?.length ? (
                      match.eventos.map((e) => (
                        <View key={e.id} style={s.row}>
                          <Icon
                            name={
                              EVENTOS[e.tipo]?.icon || "information-outline"
                            }
                            size={18}
                            color={colors.texto}
                          />
                          <Text style={[s.label, { flex: 1 }]}>
                            {e.gol_contra
                              ? "Gol contra"
                              : EVENTOS[e.tipo]?.label || e.tipo}
                          </Text>
                          <Text style={s.descricao}>
                            {e.periodo}º tempo
                            {e.minuto != null ? ` · ${e.minuto} min` : ""}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={s.descricao}>
                        Nenhum evento atribuído ao atleta nesta partida. Isso
                        não avalia seu desempenho em campo.
                      </Text>
                    )}
                  </View>
                )}
                {totals && (
                  <Disclosure title="Disciplina e escalação" icon="whistle">
                    <View style={s.medias}>
                      {[
                        ["Faltas", totals.faltas],
                        ["Amarelos", totals.amarelos],
                        ["Vermelhos", totals.vermelhos],
                        ["Azuis", totals.azuis],
                        ["Gols contra", totals.gols_contra],
                        ["Titularidades iniciais", totals.titularidades],
                      ].map(([label, value]) => (
                        <View
                          key={label}
                          style={{
                            flexBasis: "47%",
                            flexGrow: 1,
                            gap: 6,
                            paddingVertical: 6,
                          }}
                        >
                          <Text style={s.descricao}>{label}</Text>
                          <Text style={s.subtitulo}>{value}</Text>
                        </View>
                      ))}
                    </View>
                    {!!totals.titularidades_desconhecidas && (
                      <Text style={s.descricao}>
                        {totals.titularidades_desconhecidas} convocações antigas
                        sem titularidade inicial informada.
                      </Text>
                    )}
                  </Disclosure>
                )}
                {!match && !!contexto.por_tempo?.length && (
                  <Disclosure title="Registros por tempo" icon="clock-outline">
                    <Text style={s.descricao}>
                      Contagem de eventos; não indica o tempo jogado.
                    </Text>
                    {contexto.por_tempo.map((p) => (
                      <View
                        key={p.periodo}
                        style={[s.row, { flexWrap: "wrap" }]}
                      >
                        <Text style={s.label}>{p.periodo}º tempo</Text>
                        <Text style={s.descricao}>
                          {p.gols} gols · {p.assistencias} assist · {p.defesas}{" "}
                          defesas
                        </Text>
                      </View>
                    ))}
                  </Disclosure>
                )}
                {!!contexto.semelhantes?.length && (
                  <Disclosure
                    title="Registros semelhantes"
                    icon="account-group-outline"
                  >
                    <Text style={s.descricao}>
                      Mesma categoria e posição · médias por convocação. Não
                      significa habilidade equivalente.
                    </Text>
                    {contexto.semelhantes.map((p) => (
                      <Text key={p.id} style={s.label}>
                        {p.numCamisa != null ? `#${p.numCamisa} · ` : ""}
                        {p.nome}
                      </Text>
                    ))}
                  </Disclosure>
                )}
              </>
            )}
            <TouchableOpacity
              style={[s.disclosure, { alignSelf: "flex-start" }]}
              onPress={() => setHelp(true)}
              accessibilityRole="button"
            >
              <Icon
                name="information-outline"
                size={16}
                color={colors.textoSecundario}
              />
              <Text style={s.link}>Como interpretar o Scout</Text>
            </TouchableOpacity>
          </>
        )
      )}
      {help && <ScoutHelp onClose={() => setHelp(false)} />}
    </View>
  );
}
