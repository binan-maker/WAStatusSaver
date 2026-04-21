import React, { useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { FONT_SIZE, RADIUS, SPACING } from '@/constants/theme';

const { width: W, height: H } = Dimensions.get('window');

const buildParticles = (COLORS: ThemePalette) => [
  { angle: 0,   dist: 120, size: 6,  color: COLORS.PRIMARY },
  { angle: 45,  dist: 100, size: 4,  color: COLORS.ACCENT_BLUE },
  { angle: 90,  dist: 130, size: 5,  color: COLORS.PRIMARY },
  { angle: 135, dist: 95,  size: 4,  color: '#FFB800' },
  { angle: 180, dist: 115, size: 6,  color: COLORS.PRIMARY },
  { angle: 225, dist: 105, size: 4,  color: COLORS.ACCENT_BLUE },
  { angle: 270, dist: 125, size: 5,  color: COLORS.PRIMARY },
  { angle: 315, dist: 90,  size: 4,  color: '#FFB800' },
  { angle: 22,  dist: 155, size: 3,  color: COLORS.PRIMARY_LIGHT },
  { angle: 67,  dist: 145, size: 3,  color: COLORS.PRIMARY_LIGHT },
  { angle: 112, dist: 160, size: 3,  color: COLORS.PRIMARY_LIGHT },
  { angle: 157, dist: 140, size: 3,  color: COLORS.PRIMARY_LIGHT },
];
const PARTICLE_COUNT = 12;

interface PaymentSuccessModalProps {
  visible: boolean;
  planTitle: string;
  remainingDays: number;
  onDismiss: () => void;
}

export function PaymentSuccessModal({
  visible,
  planTitle,
  remainingDays,
  onDismiss,
}: PaymentSuccessModalProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const PARTICLES = useMemo(() => buildParticles(COLORS), [COLORS]);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const cardScale = useRef(new Animated.Value(0.5)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const crownScale = useRef(new Animated.Value(0)).current;
  const crownRotate = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef(PARTICLES.map(() => ({
    progress: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }))).current;
  const btnScale = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  const runEntrance = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    Animated.timing(backdropOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    Animated.spring(cardScale, {
      toValue: 1, damping: 14, stiffness: 200, useNativeDriver: true,
    }).start();
    Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }).start();

    setTimeout(() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      Animated.spring(crownScale, {
        toValue: 1, damping: 8, stiffness: 180, useNativeDriver: true,
      }).start();
      Animated.timing(crownRotate, {
        toValue: 1, duration: 500, easing: Easing.out(Easing.back(2)), useNativeDriver: true,
      }).start();

      particleAnims.forEach((p, i) => {
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(p.progress, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.sequence([
              Animated.timing(p.opacity, { toValue: 1, duration: 100, useNativeDriver: true }),
              Animated.timing(p.opacity, { toValue: 0, duration: 450, delay: 150, useNativeDriver: true }),
            ]),
          ]).start();
        }, i * 25);
      });
    }, 200);

    setTimeout(() => {
      Animated.spring(btnScale, {
        toValue: 1, damping: 12, stiffness: 160, useNativeDriver: true,
      }).start();
    }, 500);

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2000, useNativeDriver: true })
    ).start();
  }, []);

  const resetAnims = useCallback(() => {
    backdropOpacity.setValue(0);
    cardScale.setValue(0.5);
    cardOpacity.setValue(0);
    crownScale.setValue(0);
    crownRotate.setValue(0);
    glowAnim.setValue(0);
    btnScale.setValue(0);
    shimmer.setValue(0);
    particleAnims.forEach(p => { p.progress.setValue(0); p.opacity.setValue(0); });
  }, []);

  useEffect(() => {
    if (visible) {
      resetAnims();
      runEntrance();
    }
  }, [visible]);

  const crownRotateInterp = crownRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['-20deg', '0deg'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.75],
  });

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onDismiss} statusBarTranslucent>
      <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
        <LinearGradient
          colors={['rgba(0,15,10,0.96)', 'rgba(0,5,8,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        {PARTICLES.map((p, i) => {
          const rad = (p.angle * Math.PI) / 180;
          const tx = particleAnims[i].progress.interpolate({
            inputRange: [0, 1], outputRange: [0, Math.cos(rad) * p.dist],
          });
          const ty = particleAnims[i].progress.interpolate({
            inputRange: [0, 1], outputRange: [0, Math.sin(rad) * p.dist],
          });
          return (
            <Animated.View
              key={i}
              style={[
                styles.particle,
                {
                  width: p.size,
                  height: p.size,
                  borderRadius: p.size / 2,
                  backgroundColor: p.color,
                  opacity: particleAnims[i].opacity,
                  transform: [{ translateX: tx }, { translateY: ty }],
                },
              ]}
            />
          );
        })}

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ scale: cardScale }],
            },
          ]}
        >
          <LinearGradient
            colors={['#031F16', '#042A1E', '#031018']}
            style={styles.cardGradient}
          >
            <Animated.View style={[styles.glowRing, { opacity: glowOpacity }]} />

            <Animated.View
              style={[
                styles.crownWrap,
                { transform: [{ scale: crownScale }, { rotate: crownRotateInterp }] },
              ]}
            >
              <LinearGradient
                colors={[COLORS.PRIMARY + '30', COLORS.PRIMARY + '10']}
                style={styles.crownBg}
              >
                <MaterialCommunityIcons name="crown" size={52} color={COLORS.PRIMARY} />
              </LinearGradient>
            </Animated.View>

            <View style={styles.proBadge}>
              <MaterialCommunityIcons name="check-circle" size={12} color="#06100C" />
              <Text style={styles.proBadgeText}>Pro Activated</Text>
            </View>

            <Text style={styles.title}>You're a Pro Member!</Text>
            <Text style={styles.subtitle}>StatusVault will remember you forever</Text>

            <View style={styles.daysCard}>
              <LinearGradient
                colors={[COLORS.PRIMARY + '18', COLORS.PRIMARY + '08']}
                style={styles.daysCardGrad}
              >
                <Text style={styles.daysNumber}>
                  {remainingDays > 9999 ? '∞' : remainingDays}
                </Text>
                <Text style={styles.daysLabel}>days of ad-free access</Text>
              </LinearGradient>
            </View>

            <View style={styles.planRow}>
              <MaterialCommunityIcons name="star-circle" size={15} color={COLORS.PRIMARY} />
              <Text style={styles.planText}>{planTitle} Plan</Text>
              <View style={styles.planDot} />
              <MaterialCommunityIcons name="shield-check" size={15} color={COLORS.PRIMARY} />
              <Text style={styles.planText}>Verified</Text>
            </View>

            <View style={styles.perksRow}>
              {['block-helper', 'lightning-bolt', 'sync-off'].map((icon, i) => (
                <View key={i} style={styles.perkItem}>
                  <MaterialCommunityIcons name={icon as any} size={16} color={COLORS.PRIMARY} />
                  <Text style={styles.perkText}>
                    {['Zero Ads', 'Faster', 'No Auto-Renew'][i]}
                  </Text>
                </View>
              ))}
            </View>

            <Animated.View style={{ transform: [{ scale: btnScale }], width: '100%' }}>
              <TouchableOpacity
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                  onDismiss();
                }}
                activeOpacity={0.85}
                style={styles.ctaBtn}
              >
                <LinearGradient
                  colors={[COLORS.PRIMARY, COLORS.PRIMARY_DARK]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.ctaBtnGrad}
                >
                  <MaterialCommunityIcons name="play-circle" size={20} color="#06100C" />
                  <Text style={styles.ctaText}>Start Enjoying StatusVault</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>

            <Text style={styles.footnote}>
              Synced to your Google account · No auto-renewal
            </Text>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    alignSelf: 'center',
    top: H / 2,
  },
  card: {
    width: W - SPACING.LG * 2,
    borderRadius: RADIUS.XL,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
  },
  cardGradient: {
    padding: SPACING.XL,
    alignItems: 'center',
    gap: SPACING.MD,
  },
  glowRing: {
    position: 'absolute',
    top: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: COLORS.PRIMARY,
    opacity: 0.4,
    transform: [{ scaleX: 1.6 }, { scaleY: 0.5 }],
  },
  crownWrap: {
    marginTop: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  crownBg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY + '44',
  },
  proBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.MD,
    paddingVertical: 5,
    borderRadius: RADIUS.FULL,
    marginTop: -SPACING.SM,
  },
  proBadgeText: {
    color: '#06100C',
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_800ExtraBold',
    fontWeight: '900',
  },
  title: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XXL,
    fontWeight: '900',
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginTop: SPACING.XS,
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: -SPACING.XS,
  },
  daysCard: {
    width: '100%',
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '33',
    marginTop: SPACING.XS,
  },
  daysCardGrad: {
    paddingVertical: SPACING.LG,
    alignItems: 'center',
  },
  daysNumber: {
    color: COLORS.PRIMARY,
    fontSize: 58,
    fontWeight: '900',
    fontFamily: 'Nunito_800ExtraBold',
    lineHeight: 64,
    letterSpacing: -2,
  },
  daysLabel: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_600SemiBold',
    marginTop: 2,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  planText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_600SemiBold',
  },
  planDot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: COLORS.TEXT_MUTED,
  },
  perksRow: {
    flexDirection: 'row',
    gap: SPACING.LG,
    marginVertical: SPACING.XS,
  },
  perkItem: {
    alignItems: 'center',
    gap: 4,
  },
  perkText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: 10,
    fontFamily: 'Nunito_600SemiBold',
  },
  ctaBtn: {
    width: '100%',
    borderRadius: RADIUS.FULL,
    overflow: 'hidden',
    marginTop: SPACING.XS,
  },
  ctaBtnGrad: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    paddingVertical: SPACING.MD + 4,
  },
  ctaText: {
    color: '#06100C',
    fontSize: FONT_SIZE.MD,
    fontWeight: '900',
    fontFamily: 'Nunito_800ExtraBold',
  },
  footnote: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    marginTop: -SPACING.XS,
  },
});
