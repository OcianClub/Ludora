import React, { memo, useEffect, useRef } from 'react';
import { Animated, Easing, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme, type ThemeColors } from '@/src/contexts/ThemeContext';

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
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
  const { colors } = useTheme();
  const styles = createStyles(colors);
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
  const { colors } = useTheme();
  const styles = createStyles(colors);
  return (
    <SkeletonPulse style={[style, styles.homeContent]}>
      <View style={styles.homeHero}>
        <View style={styles.cardTop}>
          <Skeleton width="32%" height={12} radius={4} />
          <Skeleton width={58} height={24} radius={8} />
        </View>
        <View style={styles.homeTeams}>
          <View style={styles.homeTeam}><Skeleton width={58} height={58} radius={16} /><Skeleton width="90%" height={13} radius={4} /></View>
          <Skeleton width={38} height={18} radius={5} />
          <View style={styles.homeTeam}><Skeleton width={58} height={58} radius={16} /><Skeleton width="90%" height={13} radius={4} /></View>
        </View>
        <View style={styles.homeMeta}><Skeleton width="42%" height={34} radius={6} /><Skeleton width="42%" height={34} radius={6} /></View>
        <Skeleton width="100%" height={46} radius={10} />
      </View>

      <View style={styles.homeSectionCard}>
        <Skeleton width="42%" height={16} radius={4} />
        <Skeleton width="62%" height={11} radius={4} />
        <View style={styles.heroBottom}>
          {Array.from({ length: 5 }, (_, index) => <Skeleton key={index} width={34} height={34} radius={17} />)}
        </View>
        <Skeleton width="54%" height={12} radius={4} />
      </View>

      <View style={styles.homeHistory}>
        <View style={styles.cardTop}><Skeleton width="34%" height={16} radius={4} /><Skeleton width={82} height={12} radius={4} /></View>
        {Array.from({ length: 3 }, (_, index) => <View key={index} style={styles.homeHistoryRow}>
          <Skeleton width={32} height={32} radius={12} />
          <View style={styles.rowText}><Skeleton width="72%" height={13} radius={4} /><Skeleton width="45%" height={10} radius={4} /></View>
          <Skeleton width={28} height={20} radius={5} />
        </View>)}
      </View>
    </SkeletonPulse>
  );
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    backgroundColor: colors.card,
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
  homeHero: {
    padding: 20,
    gap: 18,
    backgroundColor: colors.card,
    borderRadius: 10,
  },
  homeTeams: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  homeTeam: { flex: 1, alignItems: 'center', gap: 10 },
  homeMeta: { flexDirection: 'row', justifyContent: 'space-between' },
  homeSectionCard: { padding: 18, gap: 14, backgroundColor: colors.card, borderRadius: 10 },
  homeHistory: { gap: 12 },
  homeHistoryRow: { padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 10, backgroundColor: colors.card },
  separator: {
    marginVertical: 4
  },
  heroBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between'
  },
});
