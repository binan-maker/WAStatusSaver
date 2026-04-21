import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRewardedAd } from '@/components/ads/AdReward';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

export function SupportDeveloperAd() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { loaded, showAd } = useRewardedAd('ca-app-pub-2087467559495393/3096082603');
  const [isLoading, setIsLoading] = useState(false);
  const [watchCompleted, setWatchCompleted] = useState(false);

  const handleWatchAd = async () => {
    if (isLoading || watchCompleted) return;
    setIsLoading(true);
    try {
      const rewarded = await showAd();
      if (rewarded) {
        setWatchCompleted(true);
        Alert.alert(
          'Thank You!',
          "Your support means everything to us! This helps us keep building amazing features for StatusVault.\n\nYou've made a real difference today.",
          [{ text: 'Close', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Error showing support ad:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (watchCompleted) {
    return (
      <View style={styles.card}>
        <LinearGradient
          colors={[COLORS.PRIMARY + '18', COLORS.PRIMARY + '08']}
          style={styles.cardInner}
        >
          <View style={styles.headerRow}>
            <View style={[styles.iconWrap, { backgroundColor: COLORS.PRIMARY + '22' }]}>
              <MaterialCommunityIcons name="check-circle" size={22} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Thank You!</Text>
              <Text style={styles.subtitle}>Your support means a lot to us</Text>
            </View>
          </View>
        </LinearGradient>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <LinearGradient
        colors={[COLORS.ACCENT_GOLD + '18', COLORS.ACCENT_GOLD + '06']}
        style={styles.cardInner}
      >
        <View style={styles.headerRow}>
          <View style={[styles.iconWrap, { backgroundColor: COLORS.ACCENT_GOLD + '25' }]}>
            <MaterialCommunityIcons name="heart" size={22} color={COLORS.ACCENT_GOLD} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Support App Development</Text>
            <Text style={styles.subtitle}>Watch an ad — it costs you nothing</Text>
          </View>
        </View>

        <Text style={styles.message}>
          Watching one ad helps us keep StatusVault free and add new features. Your support makes a real difference!
        </Text>

        <TouchableOpacity
          onPress={handleWatchAd}
          disabled={isLoading}
          style={styles.btn}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={[COLORS.ACCENT_GOLD, '#E6A800']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.btnGradient}
          >
            {isLoading ? (
              <ActivityIndicator color="#06100C" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons name="play-circle" size={20} color="#06100C" />
                <Text style={styles.btnText}>Watch Ad to Support</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </LinearGradient>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  card: {
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.ACCENT_GOLD + '30',
  },
  cardInner: {
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  subtitle: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  message: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
  btn: {
    borderRadius: RADIUS.FULL,
    overflow: 'hidden',
  },
  btnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.MD,
    gap: SPACING.SM,
  },
  btnText: {
    color: '#06100C',
    fontSize: FONT_SIZE.MD,
    fontWeight: '800',
    fontFamily: 'Nunito_800ExtraBold',
  },
});
