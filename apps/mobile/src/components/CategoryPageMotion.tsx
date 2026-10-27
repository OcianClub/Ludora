import type { ReactNode } from 'react';
import Animated, { useAnimatedStyle, useReducedMotion, type SharedValue } from 'react-native-reanimated';

export function CategoryPageMotion({ index, progress, origin, settling, children }: {
  index: number; progress: SharedValue<number>; origin: SharedValue<number>; settling: SharedValue<boolean>; children: ReactNode;
}) {
  const reduced = useReducedMotion();
  const motion = useAnimatedStyle(() => {
    if (reduced) return { opacity: 1, transform: [{ scale: 1 }] };
    const distance = Math.min(1, Math.abs(index - progress.value));
    const outgoing = index === origin.value;
    const scale = 1 - distance * (outgoing ? .08 : .14);
    const opacity = 1 - distance * (outgoing ? .1 : .18);
    return { opacity, transform: [{ scale }] };
  });
  // One progress signal owns the spring; the visual effects follow it without a second delayed animation.
  return <Animated.View style={[{ flex: 1 }, motion]}>{children}</Animated.View>;
}
