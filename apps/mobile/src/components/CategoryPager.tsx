import {
  Children,
  createContext,
  useContext,
  forwardRef,
  useCallback,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Keyboard, ScrollView, View, type ScrollViewProps, type StyleProp, type ViewStyle } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  cancelAnimation,
  runOnJS,
  runOnUI,
  useAnimatedStyle,
  useFrameCallback,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { pageDestination } from "@/src/utils/categoryMotion";

const PagerGestureContext = createContext<ReturnType<typeof Gesture.Pan> | null>(null);

/** A faixa inteira, inclusive as folgas, pertence ao scroll interno. */
export function CategoryFilterScroll({
  contentContainerStyle, activateOnStart = true, ref, ...props
}: ScrollViewProps & { activateOnStart?: boolean; ref?: React.Ref<ScrollView> }) {
  const pager = useContext(PagerGestureContext);
  const native = useMemo(() => {
    const gesture = Gesture.Native().disallowInterruption(true).shouldActivateOnStart(activateOnStart);
    return pager ? gesture.blocksExternalGesture(pager) : gesture;
  }, [pager, activateOnStart]);
  return <GestureDetector gesture={native}>
    <ScrollView {...props} ref={ref} horizontal showsHorizontalScrollIndicator={false}
      contentContainerStyle={[{ flexGrow: 1, minWidth: '100%' }, contentContainerStyle]} />
  </GestureDetector>;
}

export type CategoryPagerHandle = {
  setPage: (index: number, velocity?: number) => void;
  setPageWithoutAnimation: (index: number) => void;
};
type Props = {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  progress: SharedValue<number>;
  origin: SharedValue<number>;
  settling: SharedValue<boolean>;
  onPageSelected: (event: { nativeEvent: { position: number } }) => void;
  onSettled: (index: number) => void;
  initialPage?: number;
  scrollEnabled?: boolean;
  keyboardDismissMode?: "on-drag" | "none";
};
export const CategoryPager = forwardRef<CategoryPagerHandle, Props>(
  function CategoryPager(
    {
      children,
      style,
      progress,
      origin,
      settling,
      onPageSelected,
      onSettled,
      initialPage = 0,
      scrollEnabled = true,
      keyboardDismissMode,
    },
    ref,
  ) {
    const pages = Children.toArray(children),
      count = pages.length;
    const [width, setWidth] = useState(0);
    const [active, setActive] = useState(initialPage);
    const [pendingNavigation, setPendingNavigation] = useState<{
      index: number;
      velocity: number;
    } | null>(null);
    // Os vizinhos já ficam prontos para o gesto; páginas visitadas mantêm sua
    // lista e posição de rolagem, sem montar todos os subs na abertura.
    const [visited, setVisited] = useState(() => new Set([initialPage]));
    const renderedPages = useRef(new Set<number>());
    renderedPages.current = new Set(
      Array.from({ length: count }, (_, index) => index).filter(
        (index) => visited.has(index) || Math.abs(index - active) <= 1,
      ),
    );
    const activeRef = useRef(active);
    activeRef.current = active;
    const callbacks = useRef({ onPageSelected, onSettled });
    callbacks.current = { onPageSelected, onSettled };
    const mounted = useRef(true);
    useLayoutEffect(() => {
      mounted.current = true;
      cancelAnimation(progress);
      progress.value = initialPage;
      origin.value = initialPage;
      settling.value = false;
      return () => {
        mounted.current = false;
        cancelAnimation(progress);
      };
    }, []);
    const medir = __DEV__ && process.env.EXPO_PUBLIC_DEBUG_PERF === "1";
    const amostra = useSharedValue({
      frames: 0,
      totalMs: 0,
      maiorMs: 0,
      acima33ms: 0,
    });
    const medindo = useSharedValue(false);
    useFrameCallback(
      useCallback(
        (frame) => {
          "worklet";
          const intervalo = frame.timeSincePreviousFrame;
          if (!medindo.value || intervalo === null) return;
          const anterior = amostra.value;
          amostra.value = {
            frames: anterior.frames + 1,
            totalMs: anterior.totalMs + intervalo,
            maiorMs: Math.max(anterior.maiorMs, intervalo),
            acima33ms: anterior.acima33ms + (intervalo > 33.4 ? 1 : 0),
          };
        },
        [amostra, medindo],
      ),
      medir,
    );
    const registrarAmostra = useCallback((valor: typeof amostra.value) => {
      if (valor.frames)
        console.info(
          "[desempenho]",
          JSON.stringify({
            etapa: "categorias:cadencia-ui",
            ...valor,
            mediaMs: Math.round((valor.totalMs / valor.frames) * 10) / 10,
          }),
        );
    }, []);
    const iniciarAmostra = useCallback(() => {
      "worklet";
      if (!medir) return;
      amostra.value = { frames: 0, totalMs: 0, maiorMs: 0, acima33ms: 0 };
      medindo.value = true;
    }, [medir, amostra, medindo]);
    const start = useSharedValue(0),
      engaged = useSharedValue(false);
    const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);
    const report = useCallback((position: number) => {
      if (!mounted.current) return;
      setActive(position);
      setVisited((current) =>
        current.has(position) ? current : new Set([...current, position]),
      );
      callbacks.current.onPageSelected({ nativeEvent: { position } });
      callbacks.current.onSettled(position);
    }, []);
    const settle = useCallback(
      (index: number, velocity = 0) => {
        "worklet";
        const target = Math.max(0, Math.min(count - 1, index));
        settling.value = true;
        progress.value = withSpring(
          target,
          {
            damping: 25,
            stiffness: 220,
            mass: 0.85,
            velocity,
            overshootClamping: true,
          },
          (finished) => {
            if (finished) {
              progress.value = target;
              origin.value = target;
              settling.value = false;
              if (medir) {
                medindo.value = false;
                runOnJS(registrarAmostra)(amostra.value);
              }
              runOnJS(report)(target);
            }
          },
        );
      },
      [
        count,
        progress,
        origin,
        settling,
        report,
        medir,
        medindo,
        amostra,
        registrarAmostra,
      ],
    );
    const animateTo = useCallback(
      (target: number, speed: number) => {
        "worklet";
        cancelAnimation(progress);
        origin.value = Math.round(progress.value);
        iniciarAmostra();
        settle(target, speed);
      },
      [progress, origin, iniciarAmostra, settle],
    );
    // Um toque distante pode pular uma página que ainda não foi montada.
    // Prepara o caminho antes de deslizar, evitando atravessar telas vazias.
    // O arraste e os toques nos vizinhos continuam sem render prévio.
    useLayoutEffect(() => {
      if (!pendingNavigation) return;
      runOnUI(animateTo)(pendingNavigation.index, pendingNavigation.velocity);
      setPendingNavigation(null);
    }, [pendingNavigation, animateTo]);
    useImperativeHandle(
      ref,
      () => ({
        setPage(index, velocity = 0) {
          if (!mounted.current) return;
          const target = Math.max(0, Math.min(count - 1, index));
          const from = activeRef.current;
          const path = Array.from(
            { length: Math.abs(target - from) + 1 },
            (_, offset) => Math.min(from, target) + offset,
          );
          if (path.some((page) => !renderedPages.current.has(page))) {
            setVisited((current) => new Set([...current, ...path]));
            setPendingNavigation({ index: target, velocity });
          } else {
            setPendingNavigation(null);
            runOnUI(animateTo)(target, velocity);
          }
        },
        setPageWithoutAnimation(index) {
          runOnUI((value: number) => {
            "worklet";
            cancelAnimation(progress);
            const target = Math.max(0, Math.min(count - 1, value));
            progress.value = target;
            origin.value = target;
            settling.value = false;
            medindo.value = false;
            runOnJS(report)(target);
          })(index);
        },
      }),
      [
        count,
        progress,
        origin,
        settling,
        report,
        settle,
        iniciarAmostra,
        medindo,
        animateTo,
      ],
    );
    const pan = useMemo(
      () =>
        Gesture.Pan()
          .enabled(scrollEnabled && width > 0 && count > 1)
          .activeOffsetX([-12, 12])
          .failOffsetY([-10, 10])
          .onStart(() => {
            cancelAnimation(progress);
            iniciarAmostra();
            start.value = progress.value;
            origin.value = Math.round(progress.value);
            engaged.value = true;
            settling.value = false;
            if (keyboardDismissMode === "on-drag") runOnJS(dismissKeyboard)();
          })
          .onUpdate((event) => {
            progress.value = Math.max(
              Math.max(0, origin.value - 1),
              Math.min(
                Math.min(count - 1, origin.value + 1),
                start.value - event.translationX / width,
              ),
            );
          })
          .onEnd((event, success) => {
            if (!success) return;
            engaged.value = false;
            const velocity = -event.velocityX / width;
            settle(
              pageDestination(origin.value, progress.value, velocity, count),
              velocity,
            );
          })
          .onFinalize((_event, success) => {
            if (!success && engaged.value) {
              engaged.value = false;
              settle(origin.value);
            }
          }),
      [
        scrollEnabled,
        width,
        count,
        progress,
        origin,
        start,
        engaged,
        settling,
        keyboardDismissMode,
        dismissKeyboard,
        settle,
        iniciarAmostra,
      ],
    );
    const track = useAnimatedStyle(() => ({
      transform: [{ translateX: -progress.value * width }],
    }));
    return (
      <PagerGestureContext.Provider value={pan}>
        <GestureDetector gesture={pan}>
          <View
            style={[{ flex: 1, overflow: "hidden" }, style]}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
          >
            <Animated.View
              style={[
                { flex: 1, flexDirection: "row", width: width * count },
                track,
              ]}
            >
              {pages.map((page, index) => (
                <View
                  key={(page as { key?: string }).key || index}
                  style={{ width, flexShrink: 0, height: "100%" }}
                  accessibilityElementsHidden={index !== active}
                  importantForAccessibility={
                    index === active ? "auto" : "no-hide-descendants"
                  }
                >
                  {visited.has(index) || Math.abs(index - active) <= 1
                    ? page
                    : null}
                </View>
              ))}
            </Animated.View>
          </View>
        </GestureDetector>
      </PagerGestureContext.Provider>
    );
  },
);
