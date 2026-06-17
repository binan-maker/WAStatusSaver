import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

export default function OnboardingScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();

  const handleContinue = async () => {
    try {
      await AsyncStorage.setItem('onboarding_completed', 'true');
    } catch {}
    router.replace('/(tabs)');
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
        style={styles.header}
      >
        <MaterialCommunityIcons name="shield-check" size={56} color={COLORS.PRIMARY} />
        <Text style={styles.headerTitle}>StatusVault</Text>
        <Text style={styles.headerSubtitle}>
          Save and share WhatsApp statuses instantly — photos and videos, all in one place.
        </Text>
      </LinearGradient>

      <View style={styles.features}>
        {[
          { icon: 'image-multiple', label: 'Save photos & videos before they expire' },
          { icon: 'share-variant', label: 'Share directly to any app' },
          { icon: 'shield-lock-outline', label: 'Fully offline — no data leaves your phone' },
        ].map((f) => (
          <View key={f.label} style={styles.featureRow}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name={f.icon as any} size={22} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.featureText}>{f.label}</Text>
          </View>
        ))}
      </View>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.LG }]}>
        <TouchableOpacity
          style={styles.continueBtn}
          onPress={handleContinue}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[COLORS.PRIMARY, COLORS.PRIMARY_DARK]}
            style={styles.continueBtnGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
          >
            <Text style={styles.continueBtnText}>Get Started</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.XXL,
    alignItems: 'center',
    gap: SPACING.MD,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 300,
  },
  features: {
    flex: 1,
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.XL,
    gap: SPACING.MD,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    gap: SPACING.MD,
  },
  featureIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT,
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.MD,
    backgroundColor: COLORS.BACKGROUND,
  },
  continueBtn: {
    overflow: 'hidden',
    borderRadius: RADIUS.LG,
  },
  continueBtnGradient: {
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.MD + 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
  },
  continueBtnText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
});
