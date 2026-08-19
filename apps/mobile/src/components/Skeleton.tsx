import { colors } from '@ludora/design-tokens';
import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type SkeletonProps = {
  width?: number | `${number}%`;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export const Skeleton = memo(function Skeleton({
  width = '100%',
  height,
  radius = 8,
  style,
}: SkeletonProps) {
  return <View style={[styles.block, { width, height, borderRadius: radius }, style]} />;
});

function SkeletonPulse({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.48)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.48,
          duration: 720,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]}>{children}</Animated.View>;
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonPulse style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={48} height={48} radius={24} />
          <View style={styles.rowText}>
            <Skeleton width="62%" height={14} radius={5} />
            <Skeleton width="38%" height={10} radius={4} />
          </View>
          <Skeleton width={72} height={30} radius={6} />
        </View>
      ))}
    </SkeletonPulse>
  );
}

export function CardsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <SkeletonPulse style={styles.cards}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.card}>
          <View style={styles.cardTop}>
            <Skeleton width="34%" height={11} radius={4} />
            <Skeleton width={58} height={20} radius={10} />
          </View>
          <Skeleton width="72%" height={18} radius={5} />
          <Skeleton width="48%" height={12} radius={4} />
        </View>
      ))}
    </SkeletonPulse>
  );
}

type HomeSkeletonProps = {
  style?: StyleProp<ViewStyle>;
};

export function HomeSkeleton({ style }: HomeSkeletonProps) {
  return (
    <SkeletonPulse style={[style, styles.homeContent]}>
      <Skeleton width="35%" height={11} radius={4} />
      <Skeleton width="72%" height={22} radius={6} />

      <Skeleton
        width="100%"
        height={1}
        radius={0}
        style={styles.separator}
      />

      <View style={styles.heroBottom}>
        <Skeleton width="28%" height={34} radius={5} />
        <Skeleton width="28%" height={34} radius={5} />
        <Skeleton width="28%" height={34} radius={5} />
      </View>
    </SkeletonPulse>
  );
}

const styles = StyleSheet.create({
  block: { 
    backgroundColor: colors.cardClaro,
    overflow: 'hidden'
  },
  list: { 
    paddingHorizontal: 24,
    gap: 12 
  },
  row: {
    minHeight: 78,
    padding: 15,
    borderRadius: 10,
    backgroundColor: '#1D1E21',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowText: {
    flex: 1,
    gap: 9
  },
  cards: {
    gap: 12
  },
  card: {
    padding: 16,
    minHeight: 112,
    borderRadius: 12,
    backgroundColor: colors.card,
    gap: 14
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  homeContent: {
    gap: 16,
  },
  separator: {
    marginVertical: 4
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
});
