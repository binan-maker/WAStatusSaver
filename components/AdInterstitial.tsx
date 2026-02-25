import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Modal,
  StatusBar,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';

const { width: SW, height: SH } = Dimensions.get('window');

interface AdInterstitialProps {
  visible: boolean;
  onClose: () => void;
  countdown?: number;
}

export function AdInterstitial({ visible, onClose, countdown = 5 }: AdInterstitialProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const [secondsLeft, setSecondsLeft] = React.useState(countdown);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setSecondsLeft(countdown);
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
      ]).start();

      Animated.timing(progressAnim, {
        toValue: 1,
        duration: countdown * 1000,
        useNativeDriver: false,
      }).start();

      timerRef.current = setInterval(() => {
        setSecondsLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.85);
      progressAnim.setValue(0);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [visible]);

  if (!visible) return null;

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Modal visible={visible} transparent animationType="none" statusBarTranslucent>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View style={[styles.card, { transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.header}>
            <View style={styles.adBadge}>
              <Text style={styles.adBadgeText}>Advertisement</Text>
            </View>
            {secondsLeft === 0 ? (
              <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                <Ionicons name="close" size={20} color={COLORS.TEXT} />
              </TouchableOpacity>
            ) : (
              <View style={styles.countdown}>
                <Text style={styles.countdownText}>{secondsLeft}s</Text>
              </View>
            )}
          </View>

          <View style={styles.adContent}>
            <View style={styles.adIconWrap}>
              <MaterialCommunityIcons name="shield-lock-outline" size={64} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.adTitle}>Stay Protected Online</Text>
            <Text style={styles.adDesc}>
              Replace this with your AdMob interstitial unit ID in constants/admob.ts.
              This placeholder shows every {countdown} seconds between videos.
            </Text>
            <TouchableOpacity style={styles.adCta} activeOpacity={0.85}>
              <Text style={styles.adCtaText}>Learn More</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.progressBar}>
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>

          {secondsLeft === 0 && (
            <TouchableOpacity style={styles.skipBtn} onPress={onClose}>
              <Ionicons name="play-circle" size={18} color={COLORS.TEXT} />
              <Text style={styles.skipText}>Continue watching</Text>
            </TouchableOpacity>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: 20,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  adBadge: {
    backgroundColor: COLORS.ACCENT_GOLD,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  adBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.5,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdown: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_700Bold',
  },
  adContent: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
    gap: 12,
  },
  adIconWrap: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  adTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.TEXT,
    textAlign: 'center',
    fontFamily: 'Nunito_800ExtraBold',
  },
  adDesc: {
    fontSize: 13,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 19,
    fontFamily: 'Nunito_400Regular',
  },
  adCta: {
    marginTop: 8,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 25,
  },
  adCtaText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  progressBar: {
    height: 3,
    backgroundColor: COLORS.SURFACE_2,
  },
  progressFill: {
    height: 3,
    backgroundColor: COLORS.PRIMARY,
  },
  skipBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    backgroundColor: COLORS.SURFACE_2,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_600SemiBold',
  },
});
