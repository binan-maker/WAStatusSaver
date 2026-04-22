import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';

const { width: SW, height: SH } = Dimensions.get('window');

const PROGRESS_STEPS = [
  { pct: 8, label: 'Starting up...' },
  { pct: 22, label: 'Loading fonts...' },
  { pct: 45, label: 'Preparing media engine...' },
  { pct: 68, label: 'Setting up storage...' },
  { pct: 85, label: 'Almost ready...' },
  { pct: 97, label: 'Finalizing...' },
  { pct: 100, label: 'Ready!' },
];

interface AppLoadingScreenProps {
  onDone?: () => void;
}

export function AppLoadingScreen({ onDone }: AppLoadingScreenProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [stepIndex, setStepIndex] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.7)).current;
  const iconPulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 7, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(iconPulse, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        Animated.timing(iconPulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();

    let idx = 0;
    const runStep = () => {
      if (idx >= PROGRESS_STEPS.length) {
        pulse.stop();
        if (onDone) onDone();
        return;
      }
      const step = PROGRESS_STEPS[idx];
      setStepIndex(idx);
      Animated.timing(progressAnim, {
        toValue: step.pct / 100,
        duration: idx === 0 ? 300 : idx === PROGRESS_STEPS.length - 1 ? 200 : 350,
        useNativeDriver: false,
      }).start(() => {
        const delay = idx === PROGRESS_STEPS.length - 1 ? 150 : 280;
        setTimeout(() => {
          idx++;
          runStep();
        }, delay);
      });
    };

    const initialDelay = setTimeout(runStep, 150);
    return () => {
      clearTimeout(initialDelay);
      pulse.stop();
    };
  }, []);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const step = PROGRESS_STEPS[stepIndex] || PROGRESS_STEPS[PROGRESS_STEPS.length - 1];
  const pct = step.pct;

  return (
    <LinearGradient
      colors={[COLORS.BACKGROUND, COLORS.SURFACE, COLORS.BACKGROUND]}
      locations={[0, 0.5, 1]}
      style={styles.container}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: scaleAnim }] }]}>
          <Animated.View style={{ transform: [{ scale: iconPulse }] }}>
            <View style={styles.iconGlow} />
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="shield-check" size={56} color={COLORS.PRIMARY} />
            </View>
          </Animated.View>
        </Animated.View>

        <Text style={styles.appName}>StatusVault</Text>
        <Text style={styles.tagline}>Save. Share. Secure.</Text>

        <View style={styles.progressArea}>
          <View style={styles.progressRow}>
            <Text style={styles.progressLabel}>{step.label}</Text>
            <Text style={styles.progressPct}>{pct}%</Text>
          </View>

          <View style={styles.progressTrack}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]}>
              <LinearGradient
                colors={[COLORS.PRIMARY_DARK, COLORS.PRIMARY, COLORS.PRIMARY_LIGHT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.progressGlow} />
            </Animated.View>
          </View>

          <View style={styles.dotRow}>
            {[8, 22, 45, 68, 85, 97, 100].map((dot, i) => (
              <View
                key={i}
                style={[styles.dot, pct >= dot && styles.dotActive]}
              />
            ))}
          </View>
        </View>

        <Text style={styles.bottomText}>Built for WhatsApp Statuses</Text>
      </Animated.View>
    </LinearGradient>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
    gap: 8,
  },
  iconWrap: {
    marginBottom: 16,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGlow: {
    position: 'absolute',
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: COLORS.PRIMARY,
    opacity: 0.08,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 24,
    backgroundColor: COLORS.SURFACE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + '55',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 32,
  },
  progressArea: {
    width: '100%',
    gap: 8,
    marginTop: 8,
  },
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  progressPct: {
    fontSize: 14,
    fontWeight: '800',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_800ExtraBold',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  progressGlow: {
    position: 'absolute',
    right: -2,
    top: -2,
    width: 12,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    opacity: 0.4,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: COLORS.SURFACE_3,
  },
  dotActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  bottomText: {
    marginTop: 40,
    fontSize: 11,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_600SemiBold',
    letterSpacing: 0.5,
  },
});
