import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons, Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.binan.statussaver';

interface Props {
  visible: boolean;
  type: 'share' | 'save';
  count: number;
  onRate: () => void;
  onLater: () => void;
  onNever: () => void;
}

export function MilestoneRatingCard({ visible, type, count, onRate, onLater, onNever }: Props) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const starScales = useRef([
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
    new Animated.Value(1),
  ]).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
    }
  }, [visible]);

  const handleStarPress = (starIndex: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Animated.sequence([
      Animated.spring(starScales[starIndex], { toValue: 1.5, useNativeDriver: true, tension: 200, friction: 5 }),
      Animated.spring(starScales[starIndex], { toValue: 1, useNativeDriver: true, tension: 200, friction: 5 }),
    ]).start();
    setTimeout(() => {
      onRate();
      Linking.openURL(PLAY_STORE_URL).catch(() => {});
    }, 300);
  };

  const handleLater = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onLater();
  };

  const handleNever = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    onNever();
  };

  const isShare = type === 'share';
  const emoji = isShare ? '🚀' : '🎉';
  const actionWord = isShare ? 'shared' : 'saved';
  const icon = isShare ? 'share-variant' : 'bookmark-check';

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={handleLater}>
      <Animated.View style={[styles.backdrop, { opacity: opacityAnim }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={handleLater} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
          <LinearGradient
            colors={['#041E14', '#073D2C', '#05070A']}
            style={styles.gradient}
          >
            {/* Glow accent */}
            <View style={styles.glowDot} />

            {/* Header icon */}
            <View style={styles.iconRow}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={icon} size={26} color={COLORS.PRIMARY} />
              </View>
              <View style={styles.countBadge}>
                <Text style={styles.countBadgeText}>{count} {actionWord}</Text>
              </View>
            </View>

            {/* Headline */}
            <Text style={styles.emoji}>{emoji}</Text>
            <Text style={styles.title}>
              You&apos;ve {actionWord}{'\n'}{count} statuses!
            </Text>
            <Text style={styles.subtitle}>
              Enjoying Status Saver? A quick rating helps us grow and keeps the app free.
            </Text>

            {/* Stars */}
            <View style={styles.starsRow}>
              {[0, 1, 2, 3, 4].map((i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleStarPress(i)}
                  activeOpacity={0.75}
                  hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
                >
                  <Animated.View style={{ transform: [{ scale: starScales[i] }] }}>
                    <Ionicons name="star" size={40} color={COLORS.ACCENT_GOLD} />
                  </Animated.View>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.tapHint}>Tap a star to rate on Play Store</Text>

            {/* Buttons */}
            <View style={styles.buttonRow}>
              <TouchableOpacity style={styles.laterBtn} onPress={handleLater} activeOpacity={0.75}>
                <Text style={styles.laterText}>Maybe Later</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.neverBtn} onPress={handleNever} activeOpacity={0.75}>
                <Text style={styles.neverText}>Never</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: RADIUS.LG,
    borderTopRightRadius: RADIUS.LG,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: COLORS.PRIMARY + '40',
  },
  gradient: {
    paddingTop: SPACING.XL,
    paddingBottom: SPACING.XXL + 8,
    paddingHorizontal: SPACING.XL,
    alignItems: 'center',
    gap: SPACING.MD,
    position: 'relative',
  },
  glowDot: {
    position: 'absolute',
    top: -40,
    alignSelf: 'center',
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: COLORS.PRIMARY + '18',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    marginBottom: SPACING.XS,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY + '20',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + '45',
  },
  countBadge: {
    backgroundColor: COLORS.PRIMARY + '18',
    paddingHorizontal: SPACING.MD,
    paddingVertical: 5,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '35',
  },
  countBadgeText: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_700Bold',
  },
  emoji: {
    fontSize: 42,
    marginBottom: -SPACING.SM,
  },
  title: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XXL,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  subtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: SPACING.SM,
  },
  starsRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginVertical: SPACING.SM,
  },
  tapHint: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_400Regular',
    marginTop: -SPACING.SM,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.MD,
    marginTop: SPACING.SM,
    width: '100%',
  },
  laterBtn: {
    flex: 1,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.FULL,
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE_3,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  laterText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_700Bold',
  },
  neverBtn: {
    flex: 1,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.FULL,
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE_2,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  neverText: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_600SemiBold',
  },
});
