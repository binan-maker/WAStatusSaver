import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useMedia } from '@/contexts/MediaContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { AdBanner } from '@/components/AdBanner';
import { RewardAdButton } from '@/components/RewardAdButton';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS, ADMOB } from '@/constants/theme';
import { LANGUAGES } from '@/lib/i18n';

interface SettingRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconBg?: string;
  label: string;
  sublabel?: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
  danger?: boolean;
}

function SettingRow({ icon, iconBg, label, sublabel, value, onPress, showArrow = true, danger }: SettingRowProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.settingRow}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconBg || COLORS.SURFACE_2 }]}>
        <Ionicons name={icon} size={18} color={danger ? COLORS.ACCENT_RED : COLORS.TEXT} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, danger && { color: COLORS.ACCENT_RED }]}>{label}</Text>
        {sublabel && <Text style={styles.settingSubLabel}>{sublabel}</Text>}
      </View>
      {value ? (
        <Text style={styles.settingValue}>{value}</Text>
      ) : showArrow && onPress ? (
        <Ionicons name="chevron-forward" size={16} color={COLORS.TEXT_MUTED} />
      ) : null}
    </TouchableOpacity>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const headerPaddingTop = Platform.OS === 'web' ? 67 : insets.top;
  const {
    androidVersion,
    storageMethod,
    statuses,
    savedItems,
    hasPermission,
    safGranted,
    requestPermissions,
    requestSAF,
  } = useMedia();
  const { language, setLanguage, t } = useLanguage();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [versionClickCount, setVersionClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleVersionPress = () => {
    const newCount = versionClickCount + 1;
    if (newCount >= 3) {
      setVersionClickCount(0);
      setShowEasterEgg(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      setVersionClickCount(newCount);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const deviceName = Device.modelName || Device.deviceName || 'Unknown Device';
  const osVersion = Platform.OS === 'android' ? `Android ${androidVersion}` : `iOS ${Platform.Version}`;

  const storageMethodLabel = {
    legacy: 'Legacy (Android < 10)',
    scoped: 'Scoped Storage (Android 10+)',
    saf: 'SAF (Android 11+)',
    unknown: 'Unknown',
  }[storageMethod];

  const handleClearCache = () => {
    Alert.alert(
      'Clear Cache',
      'This will clear temporarily cached files. Your saved statuses will not be affected.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', onPress: () => {} },
      ]
    );
  };

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
        style={[styles.header, { paddingTop: headerPaddingTop + 8 }]}
      >
        <Text style={styles.headerTitle}>{t('settings')}</Text>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="image-multiple" size={26} color={COLORS.PRIMARY} />
            <Text style={styles.statNum}>{statuses.filter(s => s.type === 'image').length}</Text>
            <Text style={styles.statLabel}>{t('images')}</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="video-outline" size={26} color={COLORS.ACCENT_BLUE} />
            <Text style={styles.statNum}>{statuses.filter(s => s.type === 'video').length}</Text>
            <Text style={styles.statLabel}>{t('videos')}</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bookmark" size={26} color={COLORS.ACCENT_GOLD} />
            <Text style={styles.statNum}>{savedItems.length}</Text>
            <Text style={styles.statLabel}>{t('saved')}</Text>
          </View>
        </View>

        <SectionHeader title={t('preferences')} />
        <View style={styles.section}>
          <SettingRow
            icon="globe"
            iconBg={COLORS.ACCENT_BLUE + '22'}
            label="Language"
            value={LANGUAGES.find(l => l.code === language)?.nativeName}
            onPress={() => setShowLanguageModal(true)}
            showArrow={true}
          />
        </View>

        <SectionHeader title="Storage & Permissions" />
        <View style={styles.section}>
          <SettingRow
            icon="phone-portrait-outline"
            label="Device"
            value={deviceName}
            showArrow={false}
          />
          <SettingRow
            icon="logo-android"
            iconBg={COLORS.SUCCESS + '22'}
            label="Android Version"
            value={osVersion}
            showArrow={false}
          />
          <SettingRow
            icon="folder-open-outline"
            label="Storage Method"
            sublabel={storageMethod === 'saf' ? 'SAF folder access granted' : storageMethod === 'legacy' ? 'Direct file access' : 'Scoped storage'}
            value={storageMethodLabel}
            showArrow={false}
          />
          <SettingRow
            icon={hasPermission ? 'shield-checkmark' : 'shield-outline'}
            iconBg={hasPermission ? COLORS.PRIMARY + '22' : COLORS.SURFACE_2}
            label="Media Permission"
            sublabel={hasPermission ? 'Access granted' : 'Tap to grant'}
            onPress={!hasPermission ? () => requestPermissions() : undefined}
            showArrow={!hasPermission}
          />
          {Platform.OS === 'android' && androidVersion >= 30 && (
            <SettingRow
              icon={safGranted ? 'checkmark-circle' : 'folder-outline'}
              iconBg={safGranted ? COLORS.PRIMARY + '22' : COLORS.SURFACE_2}
              label="WhatsApp Folder Access"
              sublabel={safGranted ? 'Folder access granted' : 'Required for Android 11+'}
              onPress={!safGranted ? requestSAF : undefined}
              showArrow={!safGranted}
            />
          )}
        </View>

        <SectionHeader title="Help & Guide" />
        <View style={styles.section}>
          <SettingRow
            icon="book-outline"
            iconBg={COLORS.ACCENT_BLUE + '22'}
            label="Setup Guide"
            sublabel="Step-by-step setup instructions"
            onPress={() => router.push('/guide')}
          />
          <SettingRow
            icon="help-circle-outline"
            iconBg={COLORS.ACCENT_GOLD + '22'}
            label="How to Use"
            sublabel="Learn all features"
            onPress={() => router.push('/guide')}
          />
          <SettingRow
            icon="folder-outline"
            iconBg={COLORS.SURFACE_2}
            label="WhatsApp Paths"
            sublabel="View supported status locations"
            onPress={() => router.push('/guide')}
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.section}>
          <SettingRow
            icon="shield-outline"
            iconBg={COLORS.PRIMARY + '22'}
            label="Privacy Policy"
            sublabel="GDPR, Play Store & Indus App Store compliant"
            onPress={() => router.push('/privacy')}
          />
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            value="1.0.0"
            showArrow={false}
            onPress={handleVersionPress}
          />
          <SettingRow
            icon="star-outline"
            iconBg={COLORS.ACCENT_GOLD + '22'}
            label="Rate StatusVault"
            sublabel="Support us with a 5-star review"
            onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.binan.statussaver').catch(() => {})}
          />
        </View>

        <SectionHeader title="Data" />
        <View style={styles.section}>
          <SettingRow
            icon="trash-outline"
            danger
            label="Clear Cache"
            sublabel="Remove temporary files"
            onPress={handleClearCache}
          />
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="shield-check" size={28} color={COLORS.PRIMARY} />
          <Text style={styles.footerTitle}>StatusVault</Text>
          <Text style={styles.footerSub}>
            Your privacy-first WhatsApp Status Saver.{'\n'}
            Works 100% offline. No data leaves your device.
          </Text>
          <Text style={styles.footerNote}>
            This app is not affiliated with WhatsApp Inc. or Meta Platforms Inc.
          </Text>
        </View>
      </ScrollView>

      <Modal
        visible={showLanguageModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowLanguageModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.languageModal, { paddingTop: insets.top + SPACING.MD }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Language</Text>
              <TouchableOpacity onPress={() => setShowLanguageModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.TEXT} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang.code}
                  style={[styles.languageOption, language === lang.code && styles.languageOptionActive]}
                  onPress={async () => {
                    await setLanguage(lang.code);
                    setShowLanguageModal(false);
                  }}
                >
                  <View>
                    <Text style={[styles.languageOptionName, language === lang.code && { color: COLORS.PRIMARY }]}>
                      {lang.nativeName}
                    </Text>
                    <Text style={styles.languageOptionEnglish}>{lang.name}</Text>
                  </View>
                  {language === lang.code && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.PRIMARY} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showEasterEgg}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEasterEgg(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setShowEasterEgg(false)}
        >
          <View style={styles.easterEggCard}>
            <LinearGradient
              colors={[COLORS.PRIMARY, COLORS.PRIMARY_DARK]}
              style={styles.easterEggHeader}
            >
              <MaterialCommunityIcons name="crown" size={40} color="#fff" />
            </LinearGradient>
            <View style={styles.easterEggContent}>
              <Text style={styles.easterEggName}>Binan</Text>
              <Text style={styles.easterEggTitle}>The Creator of This App</Text>
              <Text style={styles.easterEggBlessing}>May الله Bless Him & His Family</Text>
              <TouchableOpacity 
                style={styles.closeEggBtn} 
                onPress={() => setShowEasterEgg(false)}
              >
                <Text style={styles.closeEggText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  stickyAd: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.BACKGROUND,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    paddingBottom: 4,
  },
  header: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.LG,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: SPACING.LG,
    gap: SPACING.SM,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
    marginBottom: SPACING.SM,
  },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  statNum: {
    fontSize: FONT_SIZE.XXL,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  statLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  sectionHeader: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_700Bold',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: SPACING.LG,
    marginBottom: 4,
    marginLeft: 4,
  },
  section: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.MD,
    gap: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  settingIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.SM,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingInfo: {
    flex: 1,
    gap: 2,
  },
  settingLabel: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_600SemiBold',
  },
  settingSubLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  settingValue: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    maxWidth: 120,
    textAlign: 'right',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.XXL,
    gap: SPACING.SM,
    marginTop: SPACING.LG,
  },
  footerTitle: {
    fontSize: FONT_SIZE.XL,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  footerSub: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
  footerNote: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    fontFamily: 'Nunito_400Regular',
    marginTop: SPACING.SM,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.XL,
  },
  easterEggCard: {
    width: '100%',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  easterEggHeader: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  easterEggContent: {
    padding: SPACING.XL,
    alignItems: 'center',
    gap: SPACING.SM,
  },
  easterEggName: {
    fontSize: 32,
    fontWeight: '900',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_800ExtraBold',
  },
  easterEggTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  easterEggBlessing: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    fontFamily: 'Nunito_600SemiBold',
    fontStyle: 'italic',
    marginTop: SPACING.XS,
  },
  closeEggBtn: {
    marginTop: SPACING.LG,
    backgroundColor: COLORS.PRIMARY + '22',
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.FULL,
  },
  closeEggText: {
    color: COLORS.PRIMARY,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  languageModal: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  modalTitle: {
    fontSize: FONT_SIZE.XL,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  languageList: {
    flex: 1,
  },
  languageOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  languageOptionActive: {
    backgroundColor: COLORS.SURFACE,
  },
  languageOptionName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    marginBottom: SPACING.XS,
  },
  languageOptionEnglish: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
});