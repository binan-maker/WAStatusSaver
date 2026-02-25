import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import COLORS from '@/constants/colors';
import { CARD_SIZE, GRID_COLUMNS } from '@/constants/theme';

function ShimmerCard() {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = shimmer.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0.9] });

  return (
    <Animated.View style={[styles.card, { opacity }]} />
  );
}

interface LoadingShimmerProps {
  count?: number;
}

export function LoadingShimmer({ count = 9 }: LoadingShimmerProps) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <ShimmerCard key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 2,
    paddingTop: 2,
  },
  card: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    margin: 1,
    borderRadius: 8,
    backgroundColor: COLORS.SURFACE_2,
  },
});
