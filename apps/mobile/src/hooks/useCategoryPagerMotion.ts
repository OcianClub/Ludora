import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { PagerViewOnPageScrollEvent, PageScrollStateChangedNativeEvent } from 'react-native-pager-view';
import { useEvent, useSharedValue } from 'react-native-reanimated';

export function useCategoryPagerMotion(pager: RefObject<{ setPage: (index: number, velocity?: number) => void } | null>) {
  const [request, setRequest] = useState<{ index: number; velocity: number } | null>(null);
  const progress = useSharedValue(0), origin = useSharedValue(0), settling = useSharedValue(false);
  const onScroll = useEvent<PagerViewOnPageScrollEvent>(event => {
    'worklet';
    progress.value = event.position + event.offset;
  }, ['onPageScroll']);
  const onState = useCallback((event: PageScrollStateChangedNativeEvent) => {
    const state = event.nativeEvent.pageScrollState;
    settling.value = state === 'settling';
    if (state === 'idle') { origin.value = Math.round(progress.value); setRequest(null); }
  }, [origin, progress, settling]);
  useEffect(() => { if (request) pager.current?.setPage(request.index, request.velocity); }, [request, pager]);
  // A new request object also restarts a cancelled spring toward the same SUB.
  const goTo = useCallback((index: number, velocity = 0) => setRequest({ index, velocity }), []);
  const onSettled = useCallback((_index: number) => setRequest(null), []);
  return { progress, origin, settling, onScroll, onState, goTo, target: request?.index ?? null, onSettled };
}
