import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import { LANGUAGES } from '@/lib/i18n';

export default function LanguagesScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const { language, setLanguage } = useLanguage();
  const headerPaddingTop = Platform.OS === 'web' ? 67 : insets.top;

  const flagMap: { [key: string]: string } = {
    en: '🇬🇧',
    es: '🇪🇸',
    fr: '🇫🇷',
    de: '🇩🇪',
    hi: '🇮🇳',
    ml: '🇮🇳',
    ru: '🇷🇺',
    pt: '🇵🇹',
    ja: '🇯🇵',
    ar: '🇸🇦',
  };

  const languageList = LANGUAGES.map((lang) => ({
    code: lang.code,
    name: lang.name,
    nativeName: lang.nativeName,
    flag: flagMap[lang.code] || '🌐',
  }));

  return (
    <View style={styles.root}>
      <View style={[styles.header, { paddingTop: headerPaddingTop + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={28} color={COLORS.TEXT} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Select Language</Text>
          <Text style={styles.headerSub}>Choose your preferred language</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.languageList}>
          {languageList.map((lang) => (
            <TouchableOpacity
              key={lang.code}
              style={[
                styles.languageItem,
                language === lang.code && styles.languageItemActive,
              ]}
              onPress={() => setLanguage(lang.code)}
              activeOpacity={0.7}
            >
              <View style={styles.languageItemLeft}>
                <Text style={styles.languageFlag}>{lang.flag}</Text>
                <View style={styles.languageInfo}>
                  <Text style={[styles.languageName, language === lang.code && styles.languageNameActive]}>
                    {lang.nativeName}
                  </Text>
                  <Text style={styles.languageSubtext}>{lang.name}</Text>
                </View>
              </View>
              {language === lang.code && (
                <View style={styles.checkmark}>
                  <Ionicons name="checkmark-circle" size={24} color={COLORS.PRIMARY} />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.infoText}>
            Your language preference will be applied immediately across the entire app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.PADDING,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
    marginLeft: -8,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONT_SIZE.LARGE,
    fontWeight: '800',
    color: COLORS.TEXT,
    marginBottom: 4,
  },
  headerSub: {
    fontSize: 11,
    color: COLORS.TEXT_SECONDARY,
  },
  languageList: {
    marginBottom: 24,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.BUTTON,
    paddingHorizontal: SPACING.PADDING,
    paddingVertical: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  languageItemActive: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY + '08',
  },
  languageItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  languageFlag: {
    fontSize: 28,
    marginRight: 12,
  },
  languageInfo: {
    flex: 1,
  },
  languageName: {
    fontSize: FONT_SIZE.MEDIUM,
    fontWeight: '600',
    color: COLORS.TEXT,
  },
  languageNameActive: {
    color: COLORS.PRIMARY,
    fontWeight: '700',
  },
  languageSubtext: {
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  checkmark: {
    marginLeft: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: COLORS.PRIMARY + '12',
    borderRadius: RADIUS.BUTTON,
    padding: SPACING.PADDING,
    alignItems: 'flex-start',
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.SMALL,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 18,
  },
});
