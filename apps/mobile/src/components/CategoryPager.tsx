import { Children, forwardRef, useCallback, useImperativeHandle, useLayoutEffect, useState, type ReactNode } from 'react';
import { Keyboard, View, type StyleProp, type ViewStyle } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { cancelAnimation, runOnJS, runOnUI, useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { pageDestination } from '@/src/utils/categoryMotion';

export type CategoryPagerHandle = { setPage: (index: number, velocity?: number) => void; setPageWithoutAnimation: (index: number) => void };
type Props = {
  children: ReactNode; style?: StyleProp<ViewStyle>; progress: SharedValue<number>; origin: SharedValue<number>; settling: SharedValue<boolean>;
  onPageSelected: (event: { nativeEvent: { position: number } }) => void; onSettled: (index: number) => void;
  initialPage?: number; scrollEnabled?: boolean; keyboardDismissMode?: 'on-drag' | 'none';
};
export const CategoryPager = forwardRef<CategoryPagerHandle, Props>(function CategoryPager({ children, style, progress, origin, settling, onPageSelected, onSettled, initialPage = 0, scrollEnabled = true, keyboardDismissMode }, ref) {
  const pages = Children.toArray(children), count = pages.length;
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState(initialPage);
  useLayoutEffect(() => { progress.value = initialPage; origin.value = initialPage; }, []);
  const start = useSharedValue(0), engaged = useSharedValue(false);
  const dismissKeyboard = useCallback(() => Keyboard.dismiss(), []);
  const report = useCallback((position: number) => { setActive(position); onPageSelected({ nativeEvent: { position } }); onSettled(position); }, [onPageSelected, onSettled]);
  const settle = (index: number, velocity = 0) => {
    'worklet';
    const target = Math.max(0, Math.min(count - 1, index));
    settling.value = true;
    progress.value = withSpring(target, { damping: 25, stiffness: 220, mass: .85, velocity, overshootClamping: true }, finished => {
      if (finished) { progress.value = target; origin.value = target; settling.value = false; runOnJS(report)(target); }
    });
  };
  useImperativeHandle(ref, () => ({
    setPage(index, velocity = 0) { runOnUI((target: number, speed: number) => { 'worklet'; cancelAnimation(progress); origin.value = Math.round(progress.value); settle(target, speed); })(index, velocity); },
    setPageWithoutAnimation(index) { runOnUI((value: number) => { 'worklet'; cancelAnimation(progress); const target = Math.max(0, Math.min(count - 1, value)); progress.value = target; origin.value = target; settling.value = false; runOnJS(report)(target); })(index); },
  }));
  const pan = Gesture.Pan().enabled(scrollEnabled && width > 0 && count > 1).activeOffsetX([-12, 12]).failOffsetY([-10, 10])
    .onStart(() => { cancelAnimation(progress); start.value = progress.value; origin.value = Math.round(progress.value); engaged.value = true; settling.value = false; if (keyboardDismissMode === 'on-drag') runOnJS(dismissKeyboard)(); })
    .onUpdate(event => { progress.value = Math.max(Math.max(0, origin.value - 1), Math.min(Math.min(count - 1, origin.value + 1), start.value - event.translationX / width)); })
    .onEnd((event, success) => { if (!success) return; engaged.value = false; const velocity = -event.velocityX / width; settle(pageDestination(origin.value, progress.value, velocity, count), velocity); })
    .onFinalize((_event, success) => { if (!success && engaged.value) { engaged.value = false; settle(origin.value); } });
  const track = useAnimatedStyle(() => ({ transform: [{ translateX: -progress.value * width }] }));
  return <GestureDetector gesture={pan}><View style={[{ flex: 1, overflow: 'hidden' }, style]} onLayout={event => setWidth(event.nativeEvent.layout.width)}>
    <Animated.View style={[{ flex: 1, flexDirection: 'row', width: width * count }, track]}>
      {pages.map((page, index) => <View key={(page as { key?: string }).key || index} style={{ width, flexShrink: 0, height: '100%' }} accessibilityElementsHidden={index !== active} importantForAccessibility={index === active ? 'auto' : 'no-hide-descendants'}>{page}</View>)}
    </Animated.View>
  </View></GestureDetector>;
});
