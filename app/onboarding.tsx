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

  const translations: Record<string, Record<string, string>> = {
    en: { title: 'Welcome to StatusVault', subtitle: 'Your Privacy-First WhatsApp Status Saver', select: 'Select Your Language', continue: 'Continue' },
    hi: { title: 'StatusVault में आपका स्वागत है', subtitle: 'आपकी गोपनीयता-पहली WhatsApp स्टेटस सेवर', select: 'अपनी भाषा चुनें', continue: 'जारी रखें' },
    ml: { title: 'StatusVault-ലേക്ക് സ്വാഗതം', subtitle: 'നിങ്ങളുടെ ഗോപ്യതയ്ക്കുമാധ്യമ വാട്സഅപ്പ് സ്റ്റാറ്റസ് സേവർ', select: 'നിങ്ങളുടെ ഭാഷ തിരഞ്ഞെടുക്കുക', continue: 'തുടരുക' },
    ru: { title: 'Добро пожаловать в StatusVault', subtitle: 'Ваш приватный сохранитель статусов WhatsApp', select: 'Выберите язык', continue: 'Продолжить' },
    es: { title: 'Bienvenido a StatusVault', subtitle: 'Tu guardador de estados de WhatsApp que respeta la privacidad', select: 'Selecciona tu idioma', continue: 'Continuar' },
    fr: { title: 'Bienvenue à StatusVault', subtitle: 'Votre enregistreur d\'états WhatsApp respectueux de la vie privée', select: 'Sélectionnez votre langue', continue: 'Continuer' },
    pt: { title: 'Bem-vindo ao StatusVault', subtitle: 'Seu protetor de status do WhatsApp que respeita a privacidade', select: 'Selecione seu idioma', continue: 'Continuar' },
    de: { title: 'Willkommen bei StatusVault', subtitle: 'Ihr datenschutzfreundlicher WhatsApp Status Saver', select: 'Wählen Sie Ihre Sprache', continue: 'Weiter' },
    ja: { title: 'StatusVaultへようこそ', subtitle: 'プライバシーを重視するWhatsAppステータスセーバー', select: '言語を選択してください', continue: '続行' },
    ar: { title: 'مرحبا بك في StatusVault', subtitle: 'محفوظ حالة WhatsApp الذي يحترم الخصوصية', select: 'اختر لغتك', continue: 'متابعة' },
  };

  const t = translations[selectedLang] || translations.en;

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
