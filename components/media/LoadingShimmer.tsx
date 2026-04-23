import React, { useEffect, useMemo, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { CARD_SIZE, GRID_COLUMNS } from '@/constants/theme';

// Module-level shimmer driver shared across every mounted LoadingShimmer.
// Refcounted so the loop only stops when the LAST consumer unmounts. The
// previous version used a boolean flag and stopped the animation on ANY
// unmount, which froze the animation at value 0 for any other still-mounted
// shimmer instance — the cards then sat at their lowest opacity (effectively
// invisible against the dark surface), giving the "pure black, no skeleton"
// look the user reported.
const shimmerAnimation = new Animated.Value(0);
let shimmerRefCount = 0;
let shimmerLoop: Animated.CompositeAnimation | null = null;

function acquireShimmer() {
  shimmerRefCount += 1;
  if (shimmerLoop) return;
  shimmerLoop = Animated.loop(
    Animated.sequence([
      Animated.timing(shimmerAnimation, { toValue: 1, duration: 800, useNativeDriver: true }),
      Animated.timing(shimmerAnimation, { toValue: 0, duration: 800, useNativeDriver: true }),
    ])
  );
  shimmerLoop.start();
}

function releaseShimmer() {
  shimmerRefCount = Math.max(0, shimmerRefCount - 1);
  if (shimmerRefCount === 0 && shimmerLoop) {
    shimmerLoop.stop();
    shimmerLoop = null;
    shimmerAnimation.setValue(0);
  }
}

function ShimmerCard({ delay }: { delay: number }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  // Higher opacity floor so cards are clearly visible on dark theme even at
  // the dim end of the cycle (was 0.30–0.65, now 0.55–1.0).
  const opacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.55 + (delay % 3) * 0.05, 0.95 + (delay % 3) * 0.05],
  });
  return <Animated.View style={[styles.card, { opacity }]} />;
}

interface LoadingShimmerProps {
  count?: number;
}

export function LoadingShimmer({ count = GRID_COLUMNS * 4 }: LoadingShimmerProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  useEffect(() => {
    acquireShimmer();
    return () => { releaseShimmer(); };
  }, []);

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} delay={i} />
      ))}
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 1,
    paddingTop: 1,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    margin: 1,
    borderRadius: 6,
    backgroundColor: COLORS.SURFACE_2,
  },
});
