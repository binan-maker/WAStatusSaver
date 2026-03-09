import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Dimensions,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdBanner } from '@/components/AdBanner';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import { LANGUAGES } from '@/lib/i18n';

const { width } = Dimensions.get('window');
const isSmallScreen = width < 380;

export default function OnboardingScreen() {
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const [selectedLang, setSelectedLang] = useState(language);
  const [showAd, setShowAd] = useState(true);

  const handleContinue = async () => {
    await setLanguage(selectedLang);
    router.replace('/(tabs)');
  };

  const { t: translate } = useLanguage();
  
  const t = {
    title: translate('onboarding_title'),
    subtitle: translate('onboarding_subtitle'),
    select: translate('select_language'),
    continue: translate('continue'),
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
        style={styles.header}
      >
        <MaterialCommunityIcons name="shield-check" size={48} color={COLORS.PRIMARY} />
        <Text style={styles.headerTitle}>{t.title}</Text>
        <Text style={styles.headerSubtitle}>{t.subtitle}</Text>
      </LinearGradient>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionTitle}>{t.select}</Text>

        <View style={styles.languageGrid}>
          {LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageCard,
                selectedLang === lang.code && styles.languageCardActive,
                isSmallScreen && styles.languageCardSmall,
              ]}
              onPress={() => setSelectedLang(lang.code)}
            >
              {selectedLang === lang.code && (
                <View style={styles.checkmark}>
                  <MaterialCommunityIcons name="check-circle" size={24} color={COLORS.PRIMARY} />
                </View>
              )}
              <Text style={[styles.languageName, selectedLang === lang.code && { color: COLORS.PRIMARY }]}>
                {lang.nativeName}
              </Text>
              <Text style={styles.languageEnglishName}>{lang.name}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <MaterialCommunityIcons name="information-outline" size={20} color={COLORS.TEXT_SECONDARY} />
          <Text style={styles.infoText}>You can change this language anytime in Settings</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.LG }]}>
        {showAd && <AdBanner />}
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
            <Text style={styles.continueBtnText}>{t.continue}</Text>
            <MaterialCommunityIcons name="arrow-right" size={20} color="#fff" />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    fontSize: isSmallScreen ? FONT_SIZE.XXL : 28,
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
    lineHeight: 18,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: SPACING.LG,
    paddingTop: SPACING.LG,
    paddingBottom: SPACING.LG,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    marginBottom: SPACING.MD,
  },
  languageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.SM,
    marginBottom: SPACING.XXL,
  },
  languageCard: {
    flex: 1,
    minWidth: isSmallScreen ? '48%' : '30%',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
    position: 'relative',
  },
  languageCardSmall: {
    minWidth: '48%',
  },
  languageCardActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.SURFACE,
  },
  checkmark: {
    position: 'absolute',
    top: SPACING.XS,
    right: SPACING.XS,
  },
  languageName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    textAlign: 'center',
    marginBottom: SPACING.XS,
  },
  languageEnglishName: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    gap: SPACING.SM,
    alignItems: 'flex-start',
    marginBottom: SPACING.XXL,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  footer: {
    paddingHorizontal: SPACING.LG,
    gap: SPACING.MD,
    backgroundColor: COLORS.BACKGROUND,
  },
  continueBtn: {
    overflow: 'hidden',
    borderRadius: RADIUS.LG,
  },
  continueBtnGradient: {
    paddingHorizontal: SPACING.XL,
    paddingVertical: SPACING.MD,
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
