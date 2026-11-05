import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  PanResponder,
  Platform,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
  Text,
  TouchableOpacity,
  View,
  type ViewStyle,
} from "react-native";
import { Icon } from "@ludora/icons";
import { useTheme } from "../contexts/ThemeContext";
import type { EquipePartida } from "../services/partidasCompartilhadas";
import { criarGestoTroca } from "../utils/gestoTroca";
import { PositionLabel } from "./PositionIcon";

type Jogador = EquipePartida["escalacao"][number];
type Area = { x: number; y: number; width: number; height: number };
type Props = {
  equipe: EquipePartida;
  sai?: number;
  entra?: number;
  bloqueado: boolean;
  onSai: (id: number) => void;
  onEntra: (id: number) => void;
  onArrastando: (ativo: boolean) => void;
};

function Linha({
  jogador,
  selecionado,
  bloqueado,
  registrar,
  capturar,
  mover,
  soltar,
  tocar,
}: {
  jogador: Jogador;
  selecionado: boolean;
  bloqueado: boolean;
  registrar: (id: number, ref: View | null) => void;
  capturar: (id: number) => void;
  mover: (id: number, x: number, y: number) => void;
  soltar: (id: number, dx: number, dy: number) => void;
  tocar: () => void;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => estilos(colors), [colors]);
  const [arrastando, setArrastando] = useState(false);
  const handlers = useRef({ capturar, mover, soltar, tocar, bloqueado });
  handlers.current = { capturar, mover, soltar, tocar, bloqueado };
  const gesto = useMemo(
    () =>
      criarGestoTroca({
        capturar: () => handlers.current.capturar(jogador.jogador_id),
        ativar: setArrastando,
        mover: (x, y) => handlers.current.mover(jogador.jogador_id, x, y),
        soltar: (x, y) => handlers.current.soltar(jogador.jogador_id, x, y),
        tocar: () => handlers.current.tocar(),
      }),
    [jogador.jogador_id],
  );
  useEffect(() => () => gesto.cancelar(), [gesto]);
  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => !handlers.current.bloqueado,
        onStartShouldSetPanResponderCapture: () => !handlers.current.bloqueado,
        onPanResponderGrant: () => gesto.iniciar(),
        onPanResponderMove: (_, g) => gesto.mover(g.dx, g.dy),
        onPanResponderRelease: (_, g) => {
          gesto.mover(g.dx, g.dy);
          gesto.soltar();
        },
        onPanResponderTerminate: () => gesto.cancelar(),
        onPanResponderTerminationRequest: () => false,
        onShouldBlockNativeResponder: () => true,
      }),
    [gesto],
  );
  return (
    <View
      ref={(ref) => registrar(jogador.jogador_id, ref)}
      collapsable={false}
      style={arrastando && { zIndex: 20, elevation: 12 }}
    >
      <Animated.View
        style={[
          styles.row,
          jogador.titular && styles.field,
          selecionado && styles.selected,
          arrastando && { opacity: 0.35 },
        ]}
      >
        <TouchableOpacity
          accessibilityRole="radio"
          accessibilityLabel={`${jogador.titular ? "Sai" : "Entra"}: ${jogador.jogador?.nome}`}
          accessibilityState={{ checked: selecionado, disabled: bloqueado }}
          aria-checked={selecionado}
          disabled={bloqueado}
          onPress={tocar}
          style={styles.identity}
        >
          <View style={styles.shirt}>
            <Text style={styles.name}>
              {String(jogador.numCamisa).padStart(2, "0")}
            </Text>
          </View>
          <View style={styles.textBlock}>
            <Text style={styles.name} numberOfLines={1}>
              {jogador.jogador?.nome}
            </Text>
            <PositionLabel
              position={jogador.jogador?.posicao || ""}
              textStyle={styles.muted}
            />
          </View>
          {selecionado && (
            <Icon name="check" size={17} color={colors.primaria} />
          )}
        </TouchableOpacity>
        <View
          {...responder.panHandlers}
          accessible
          focusable
          accessibilityRole="button"
          accessibilityLabel={`Arrastar ${jogador.jogador?.nome}`}
          accessibilityHint="Segure e arraste sobre um jogador do outro grupo, ou selecione um jogador em campo e um reserva."
          accessibilityState={{ disabled: bloqueado }}
          accessibilityActions={[
            { name: "activate", label: "Selecionar para substituição" },
          ]}
          onAccessibilityAction={() => {
            if (!bloqueado) tocar();
          }}
          {...(Platform.OS === "web"
            ? {
                onKeyDown: (e: { key: string; preventDefault: () => void }) => {
                  if (!bloqueado && ["Enter", " "].includes(e.key)) {
                    e.preventDefault();
                    tocar();
                  }
                },
              }
            : {})}
          style={[
            styles.handle,
            Platform.OS === "web" && ({ touchAction: "none" } as ViewStyle),
          ]}
        >
          <Icon name="grip-vertical" size={19} color={colors.textoSecundario} />
        </View>
      </Animated.View>
    </View>
  );
}

export default function SubstituicaoPartida({
  equipe,
  sai,
  entra,
  bloqueado,
  onSai,
  onEntra,
  onArrastando,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => estilos(colors), [colors]);
  const { height } = useWindowDimensions();
  const [arrastando, setArrastando] = useState(false);
  const alturaLista = Math.max(100, Math.min(190, (height * 0.88 - 330) / 2));
  const linhas = useRef(new Map<number, View>()),
    areas = useRef(new Map<number, Area>());
  const listas = useRef(new Map<boolean, View>()),
    limites = useRef(new Map<boolean, Area>());
  const raiz = useRef<View>(null),
    origemRaiz = useRef({ x: 0, y: 0 });
  const fantasmaPos = useRef(new Animated.ValueXY()).current;
  const fantasmaId = useRef<number | undefined>(undefined);
  const [fantasma, setFantasma] = useState<{
    jogador: Jogador;
    width: number;
  } | null>(null);
  function capturar() {
    raiz.current?.measureInWindow((x, y) => {
      origemRaiz.current = { x, y };
    });
    setArrastando(true);
    onArrastando(true);
    areas.current.clear();
    limites.current.clear();
    listas.current.forEach((ref, grupo) =>
      ref.measureInWindow((x, y, width, height) =>
        limites.current.set(grupo, { x, y, width, height }),
      ),
    );
    linhas.current.forEach((ref, id) =>
      ref.measureInWindow((x, y, width, height) =>
        areas.current.set(id, { x, y, width, height }),
      ),
    );
  }
  function mover(id: number, dx: number, dy: number) {
    const area = areas.current.get(id),
      jogador = equipe.escalacao.find((j) => j.jogador_id === id);
    if (!area || !jogador) return;
    fantasmaPos.setValue({
      x: area.x - origemRaiz.current.x + dx,
      y: area.y - origemRaiz.current.y + dy,
    });
    if (fantasmaId.current !== id) {
      fantasmaId.current = id;
      setFantasma({ jogador, width: area.width });
    }
  }
  function soltar(id: number, dx: number, dy: number) {
    setArrastando(false);
    onArrastando(false);
    fantasmaId.current = undefined;
    setFantasma(null);
    const area = areas.current.get(id);
    if (!area || !Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const x = area.x + area.width / 2 + dx,
      y = area.y + area.height / 2 + dy;
    const origem = equipe.escalacao.find((j) => j.jogador_id === id);
    if (!origem) return;
    const limite = limites.current.get(!origem.titular);
    if (
      !limite ||
      x < limite.x ||
      x > limite.x + limite.width ||
      y < limite.y ||
      y > limite.y + limite.height
    )
      return;
    const destinoId = [...areas.current].find(
      ([outro, a]) =>
        outro !== id &&
        equipe.escalacao.some(
          (j) => j.jogador_id === outro && j.titular !== origem.titular,
        ) &&
        x >= a.x &&
        x <= a.x + a.width &&
        y >= a.y &&
        y <= a.y + a.height,
    )?.[0];
    const destino = equipe.escalacao.find((j) => j.jogador_id === destinoId);
    if (!origem || !destino || origem.titular === destino.titular) return;
    onSai(origem.titular ? id : destino.jogador_id);
    onEntra(origem.titular ? destino.jogador_id : id);
    AccessibilityInfo.announceForAccessibility(
      "Substituição selecionada. Confira quem sai e quem entra e confirme.",
    );
  }
  return (
    <View ref={raiz} collapsable={false} style={styles.content}>
      <View style={styles.help}>
        <Icon name="swap-horizontal" size={18} color={colors.textoSecundario} />
        <Text style={[styles.muted, styles.textBlock]}>
          Toque em quem sai e em quem entra, ou arraste pela alça de três pontos
          de um grupo para o outro.
        </Text>
      </View>
      {[true, false].map((titular) => (
        <View
          key={String(titular)}
          style={styles.group}
          accessibilityRole="radiogroup"
          accessibilityLabel={
            titular ? "Quem sai de campo" : "Quem entra do banco"
          }
        >
          <View style={styles.heading}>
            <View style={styles.heading}>
              <Icon
                name={titular ? "soccer-field" : "group"}
                size={17}
                color={colors.textoSecundario}
              />
              <Text style={styles.name}>
                {titular ? "Sai de campo" : "Entra do banco"}
              </Text>
            </View>
            <Text style={styles.muted}>
              {equipe.escalacao.filter((j) => j.titular === titular).length}
            </Text>
          </View>
          <View
            ref={(ref) => {
              if (ref) listas.current.set(titular, ref);
              else listas.current.delete(titular);
            }}
            collapsable={false}
          >
            <ScrollView
              style={{ maxHeight: alturaLista }}
              contentContainerStyle={{ gap: 8, paddingBottom: 6 }}
              scrollEnabled={!arrastando}
              nestedScrollEnabled
              keyboardShouldPersistTaps="handled"
            >
              {equipe.escalacao
                .filter((j) => j.titular === titular)
                .map((j) => (
                  <Linha
                    key={j.jogador_id}
                    jogador={j}
                    selecionado={j.jogador_id === (titular ? sai : entra)}
                    bloqueado={bloqueado}
                    registrar={(id, ref) => {
                      if (ref) linhas.current.set(id, ref);
                      else linhas.current.delete(id);
                    }}
                    capturar={capturar}
                    mover={mover}
                    soltar={soltar}
                    tocar={() =>
                      titular ? onSai(j.jogador_id) : onEntra(j.jogador_id)
                    }
                  />
                ))}
            </ScrollView>
          </View>
          {!equipe.escalacao.some((j) => j.titular === titular) && (
            <Text style={styles.muted}>Nenhum reserva convocado.</Text>
          )}
        </View>
      ))}
      {fantasma && (
        <Animated.View
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={[
            styles.row,
            styles.selected,
            {
              position: "absolute",
              left: 0,
              top: 0,
              width: fantasma.width,
              zIndex: 100,
              elevation: 20,
              paddingRight: 10,
              transform: fantasmaPos.getTranslateTransform(),
            },
          ]}
        >
          <View style={styles.identity}>
            <View style={styles.shirt}>
              <Text style={styles.name}>
                {String(fantasma.jogador.numCamisa).padStart(2, "0")}
              </Text>
            </View>
            <View style={styles.textBlock}>
              <Text numberOfLines={1} style={styles.name}>
                {fantasma.jogador.jogador?.nome}
              </Text>
              <PositionLabel
                position={fantasma.jogador.jogador?.posicao || ""}
                textStyle={styles.muted}
              />
            </View>
            <Icon name="grip-vertical" size={19} color={colors.primaria} />
          </View>
        </Animated.View>
      )}
      {(sai || entra) && (
        <View style={styles.summary}>
          <Icon name="swap-horizontal" size={18} color={colors.primaria} />
          <View style={styles.textBlock}>
            <Text style={styles.muted}>
              Sai:{" "}
              <Text style={styles.name}>
                {equipe.escalacao.find((j) => j.jogador_id === sai)?.jogador
                  ?.nome || "Selecione um jogador"}
              </Text>
            </Text>
            <Text style={styles.muted}>
              Entra:{" "}
              <Text style={styles.name}>
                {equipe.escalacao.find((j) => j.jogador_id === entra)?.jogador
                  ?.nome || "Selecione um reserva"}
              </Text>
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

function estilos(c: ReturnType<typeof useTheme>["colors"]) {
  return StyleSheet.create({
    content: { gap: 18 },
    group: { gap: 8 },
    heading: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 7,
    },
    help: { flexDirection: "row", alignItems: "center", gap: 9 },
    muted: { color: c.textoSecundario, fontSize: 12, lineHeight: 18 },
    name: { color: c.texto, fontSize: 12, fontWeight: "600" },
    textBlock: { flex: 1, minWidth: 0, gap: 4 },
    row: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.borda,
      borderRadius: 8,
      flexDirection: "row",
      alignItems: "center",
      minHeight: 62,
      paddingLeft: 10,
    },
    field: { borderColor: c.primaria + "70" },
    selected: { borderColor: c.primaria, borderWidth: 2 },
    identity: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingVertical: 10,
    },
    shirt: {
      width: 33,
      height: 35,
      borderRadius: 7,
      backgroundColor: c.cardSecundario,
      alignItems: "center",
      justifyContent: "center",
    },
    handle: {
      width: 38,
      height: 48,
      alignItems: "center",
      justifyContent: "center",
    },
    summary: {
      borderTopWidth: 1,
      borderTopColor: c.borda,
      paddingTop: 14,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
    },
  });
}
