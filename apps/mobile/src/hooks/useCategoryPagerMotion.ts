import { useCallback, type RefObject } from "react";
import type {
  PagerViewOnPageScrollEvent,
  PageScrollStateChangedNativeEvent,
} from "react-native-pager-view";
import { useEvent, useSharedValue } from "react-native-reanimated";

export function useCategoryPagerMotion(
  pager: RefObject<{
    setPage: (index: number, velocity?: number) => void;
  } | null>,
) {
  const progress = useSharedValue(0),
    origin = useSharedValue(0),
    settling = useSharedValue(false);
  const onScroll = useEvent<PagerViewOnPageScrollEvent>(
    (event) => {
      "worklet";
      progress.value = event.position + event.offset;
    },
    ["onPageScroll"],
  );
  const onState = useCallback(
    (event: PageScrollStateChangedNativeEvent) => {
      const state = event.nativeEvent.pageScrollState;
      settling.value = state === "settling";
      if (state === "idle") origin.value = Math.round(progress.value);
    },
    [origin, progress, settling],
  );
  // Inicia a mola diretamente na UI. Um setState + useEffect aqui obrigava
  // Home/Jogos/Scout a reconciliar suas listas antes de a animação começar.
  const goTo = useCallback(
    (index: number, velocity = 0) => {
      pager.current?.setPage(index, velocity);
    },
    [pager],
  );
  const onSettled = useCallback((_index: number) => {}, []);
  return { progress, origin, settling, onScroll, onState, goTo, onSettled };
}
