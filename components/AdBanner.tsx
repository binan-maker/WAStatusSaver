import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { ADMOB } from '@/constants/theme';
import { ADS_ENABLED } from '@/constants/admob';

interface AdBannerProps {
  style?: object;
}

export function AdBanner({ style }: AdBannerProps) {
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const shimmer = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration: 2000, useNativeDriver: true }),
      ])
    );
    shimmer.start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.05, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1500, useNativeDriver: true }),
      ])
    );
    pulse.start();

    return () => {
      shimmer.stop();
      pulse.stop();
    };
  }, []);

  if (!ADS_ENABLED || Platform.OS === 'web') return null;

  const shimmerOpacity = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>Ad</Text>
      </View>
      <TouchableOpacity activeOpacity={0.8} style={styles.inner}>
        <View style={styles.iconWrap}>
          <Animated.View style={{ opacity: shimmerOpacity }}>
            <MaterialCommunityIcons
              name="shield-check-outline"
              size={28}
              color={COLORS.PRIMARY}
            />
          </Animated.View>
        </View>
        <View style={styles.textWrap}>
          <Text style={styles.headline} numberOfLines={1}>
            Protect your privacy online
          </Text>
          <Text style={styles.subtext} numberOfLines={1}>
            Replace with your AdMob unit ID
          </Text>
        </View>
        <Animated.View style={[styles.ctaBtn, { transform: [{ scale: pulseAnim }] }]}>
          <Text style={styles.ctaText}>Install</Text>
        </Animated.View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: ADMOB.BANNER_HEIGHT,
    backgroundColor: COLORS.SURFACE,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  adLabel: {
    position: 'absolute',
    top: 4,
    left: 6,
    backgroundColor: COLORS.ACCENT_GOLD,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
    zIndex: 1,
  },
  adLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  inner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  textWrap: {
    flex: 1,
    marginRight: 8,
  },
  headline: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  subtext: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 1,
    fontFamily: 'Nunito_400Regular',
  },
  ctaBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  ctaText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
});
