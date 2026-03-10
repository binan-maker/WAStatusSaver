import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import COLORS from '@/constants/colors';
import { CARD_SIZE, GRID_COLUMNS } from '@/constants/theme';

const shimmerAnimation = new Animated.Value(0);
let shimmerStarted = false;

function startGlobalShimmer() {
  if (shimmerStarted) return;
  shimmerStarted = true;
  Animated.loop(
    Animated.sequence([
      Animated.timing(shimmerAnimation, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(shimmerAnimation, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
    ])
  ).start();
}

function ShimmerCard({ delay }: { delay: number }) {
  const opacity = shimmerAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3 + (delay % 3) * 0.05, 0.65 + (delay % 3) * 0.05],
  });
  return <Animated.View style={[styles.card, { opacity }]} />;
}

interface LoadingShimmerProps {
  count?: number;
}

export function LoadingShimmer({ count = 9 }: LoadingShimmerProps) {
  useEffect(() => {
    startGlobalShimmer();
    return () => {
      shimmerStarted = false;
      shimmerAnimation.stopAnimation();
      shimmerAnimation.setValue(0);
    };
  }, []);

  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} delay={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
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
