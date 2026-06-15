import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  Linking,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useMedia } from '@/contexts/MediaContext';
import { SAFGuideOverlay } from '@/components/media/SAFGuideOverlay';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';
import { useLanguage } from '@/contexts/LanguageContext';

interface StepCardProps {
  step: number;
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  done?: boolean;
  action?: { label: string; onPress: () => void };
  tag?: string;
}

function StepCard({ step, title, desc, icon, done, action, tag }: StepCardProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={[styles.stepCard, done && styles.stepCardDone]}>
      <View style={styles.stepLeft}>
        <View style={[styles.stepNum, done && styles.stepNumDone]}>
          {done ? (
            <Ionicons name="checkmark" size={16} color="#fff" />
          ) : (
            <Text style={styles.stepNumText}>{step}</Text>
          )}
        </View>
        <View style={styles.stepLine} />
      </View>
      <View style={styles.stepContent}>
        <View style={styles.stepHeader}>
          <Ionicons name={icon} size={18} color={done ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} />
          <Text style={[styles.stepTitle, done && styles.stepTitleDone]}>{title}</Text>
          {tag && (
            <View style={styles.tag}>
              <Text style={styles.tagText}>{tag}</Text>
            </View>
          )}
        </View>
        <Text style={styles.stepDesc}>{desc}</Text>
        {action && !done && (
          <TouchableOpacity style={styles.stepBtn} onPress={action.onPress} activeOpacity={0.85}>
            <Text style={styles.stepBtnText}>{action.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export default function PermissionsScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const {
    hasPermission,
    safGranted,
    androidVersion,
    requestPermissions,
    requestSAF,
    isRequestingSAF,
  } = useMedia();

  const { t } = useLanguage();

  const [requesting, setRequesting] = useState(false);

  const needsSAF = Platform.OS === 'android' && androidVersion >= 30;
  const allDone = hasPermission && (!needsSAF || safGranted);

  const handleRequestPermission = async () => {
    setRequesting(true);
    await requestPermissions();
    setRequesting(false);
  };

  return (
    <View style={styles.root}>
      {!isRequestingSAF && (
      <><LinearGradient
          colors={['#0A1F15', COLORS.BACKGROUND]}
          style={[styles.heroArea, { paddingTop: insets.top + 8 }]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backBtn}
            hitSlop={{ top: 8, right: 8, bottom: 8, left: 8 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.TEXT} />
          </TouchableOpacity>

          <View style={styles.heroContent}>
            <View style={styles.heroIcon}>
              <MaterialCommunityIcons name="folder-key-network-outline" size={48} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.heroTitle}>{t('grant_access')}</Text>
            <Text style={styles.heroSub}>
              {androidVersion >= 30 
                ? 'StatusVault needs two permissions: gallery save access (write-only) and WhatsApp folder access (for reading statuses).'
                : 'StatusVault needs gallery access to save statuses. On this Android version, statuses are scanned automatically once permission is granted.'}
              {'\n'}Android {androidVersion}
              {androidVersion >= 30 ? ' (Android 11+) — both steps required.' : ' — simple setup mode.'}
            </Text>
          </View>
        </LinearGradient><ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
        >
            <View style={styles.stepsContainer}>
              <StepCard
                step={1}
                icon={hasPermission ? 'shield-checkmark' : 'shield-outline'}
                title="Gallery & Media Access"
                desc={hasPermission
                  ? 'Access granted successfully.'
                  : 'Tap "Allow" on the system prompt to let StatusVault read and save statuses. This is required for the app to function on this device.'}
                done={hasPermission}
                action={!hasPermission
                  ? {
                    label: requesting ? 'Requesting...' : 'Grant Access',
                    onPress: handleRequestPermission,
                  }
                  : undefined}
                tag={androidVersion >= 33 ? 'Android 13+' : androidVersion >= 29 ? 'Android 10+' : 'All versions'} />

              {needsSAF && (
                <>
                <StepCard
                  step={2}
                  icon={safGranted ? 'folder-open' : 'folder-outline'}
                  title="WhatsApp Folder Access"
                  desc={safGranted
                    ? 'Android/media folder access granted — all WhatsApp variants covered.'
                    : 'A folder picker will open at the Android\u200b/\u200bmedia folder.\n\n1. The picker opens inside the "media" folder\n2. Tap "Use this folder" at the bottom\n3. Tap "Allow" to confirm\n\nOne grant covers WhatsApp, WhatsApp Business, and other variants automatically.'}
                  done={safGranted}
                  action={!safGranted
                    ? {
                      label: 'Grant Folder Access',
                      onPress: () => requestSAF('whatsapp', false),
                    }
                    : undefined}
                  tag="Android 11+" />
                {!safGranted && (
                  <TouchableOpacity
                    style={styles.manualBrowseBtn}
                    onPress={() => requestSAF('whatsapp', true)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="folder-open-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                    <Text style={styles.manualBrowseText}>
                      Picker opened at wrong folder? Try manual browse
                    </Text>
                    <Ionicons name="chevron-forward" size={14} color={COLORS.TEXT_SECONDARY} />
                  </TouchableOpacity>
                )}
                </>
              )}

              <StepCard
                step={needsSAF ? 3 : 2}
                icon="images-outline"
                title="Open WhatsApp & View Statuses"
                desc="Go to WhatsApp, open the Status tab, and view the statuses you want to save. WhatsApp must write the status files before StatusVault can see them."
                done={false} />
            </View>

            {allDone && (
              <View style={styles.successBanner}>
                <Ionicons name="checkmark-circle" size={24} color={COLORS.PRIMARY} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.successTitle}>All set!</Text>
                  <Text style={styles.successSub}>StatusVault is ready to use.</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push('/')}
                  style={styles.successBtn}
                  activeOpacity={0.85}
                >
                  <Text style={styles.successBtnText}>Open App</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.infoBox}>
              <Ionicons name="lock-closed-outline" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.infoText}>
                StatusVault works entirely offline. Your media never leaves your device.
                We do not access your WhatsApp messages or contacts.
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => router.push('/guide')}
              style={styles.guideLink}
            >
              <Ionicons name="book-outline" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.guideLinkText}>Read Full Setup Guide</Text>
            </TouchableOpacity>
          </ScrollView><SAFGuideOverlay visible={isRequestingSAF} /></>
      )}
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  heroArea: {
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.XL,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.LG,
  },
  heroContent: {
    alignItems: 'center',
    gap: SPACING.MD,
  },
  heroIcon: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY + '22',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  heroSub: {
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: 'Nunito_400Regular',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  stepsContainer: {
    gap: SPACING.SM,
  },
  stepCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACING.MD,
    gap: SPACING.MD,
  },
  stepCardDone: {
    borderColor: COLORS.PRIMARY + '44',
    backgroundColor: COLORS.PRIMARY + '08',
  },
  stepLeft: {
    alignItems: 'center',
    width: 32,
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.BORDER,
  },
  stepNumDone: {
    backgroundColor: COLORS.PRIMARY,
    borderColor: COLORS.PRIMARY,
  },
  stepNumText: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  stepLine: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.BORDER,
    marginTop: 6,
    marginBottom: -4,
    borderRadius: 1,
  },
  stepContent: {
    flex: 1,
    gap: SPACING.SM,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    flexWrap: 'wrap',
  },
  stepTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_700Bold',
    flex: 1,
  },
  stepTitleDone: {
    color: COLORS.PRIMARY,
  },
  tag: {
    backgroundColor: COLORS.ACCENT_BLUE + '22',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.FULL,
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.ACCENT_BLUE,
    fontFamily: 'Nunito_700Bold',
  },
  stepDesc: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 19,
    fontFamily: 'Nunito_400Regular',
  },
  stepBtn: {
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.SM + 2,
    borderRadius: RADIUS.FULL,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  stepBtnText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
    backgroundColor: COLORS.PRIMARY + '18',
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
    padding: SPACING.MD,
  },
  successTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  successSub: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  successBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.PRIMARY,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.FULL,
  },
  successBtnText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: '#fff',
    fontFamily: 'Nunito_700Bold',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.SM,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    padding: SPACING.MD,
  },
  infoText: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 19,
    fontFamily: 'Nunito_400Regular',
  },
  guideLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    padding: SPACING.MD,
  },
  guideLinkText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '600',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_600SemiBold',
    textDecorationLine: 'underline',
  },
  manualBrowseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
    paddingVertical: SPACING.SM,
    paddingHorizontal: SPACING.MD,
    marginTop: 4,
    marginBottom: SPACING.SM,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderStyle: 'dashed',
  },
  manualBrowseText: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
});
