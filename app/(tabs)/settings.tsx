import React, { useState, useMemo } from 'react';
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
  Share,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useMedia } from '@/contexts/MediaContext';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

export { ScreenErrorFallback as ErrorBoundary } from '@/components/common/ScreenErrorFallback';

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

function SettingRow({
  icon,
  iconBg,
  label,
  sublabel,
  value,
  onPress,
  showArrow = true,
  danger,
}: SettingRowProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <TouchableOpacity
      onPress={onPress}
      style={styles.settingRow}
      activeOpacity={onPress ? 0.7 : 1}
      disabled={!onPress}
      accessibilityLabel={sublabel ? `${label}: ${sublabel}` : label}
      accessibilityRole={onPress ? 'button' : 'none'}
      accessibilityState={onPress ? undefined : { disabled: true }}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconBg || COLORS.SURFACE_2 }]}>
        <Ionicons name={icon} size={18} color={danger ? COLORS.ERROR : COLORS.TEXT} />
      </View>
      <View style={styles.settingInfo}>
        <Text style={[styles.settingLabel, danger && { color: COLORS.ERROR }]}>{label}</Text>
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
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return <Text style={styles.sectionHeader}>{title}</Text>;
}


export default function SettingsScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
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
  const [versionClickCount, setVersionClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleShareApp = async () => {
    try {
      const storeUrl =
        'https://play.google.com/store/apps/details?id=com.binan.statussaver';
      await Share.share({
        message: `Check out StatusVault — save WhatsApp statuses without screenshots!\n\n${storeUrl}`,
        title: 'Share StatusVault',
        url: Platform.OS === 'ios' ? storeUrl : undefined,
      });
    } catch {}
  };

  const handleVersionPress = () => {
    const newCount = versionClickCount + 1;
    if (newCount >= 3) {
      setVersionClickCount(0);
      setShowEasterEgg(true);
    } else {
      setVersionClickCount(newCount);
    }
  };

  const deviceName = (Platform.constants as Record<string, string>).Model || 'Unknown Device';
  const osVersion =
    Platform.OS === 'android' ? `Android ${androidVersion}` : `iOS ${Platform.Version}`;

  // Memoised so the JS thread never re-filters the entire statuses array
  // on an unrelated re-render (e.g. a context update from MediaContextSAF).
  const imageCount = useMemo(() => statuses.filter(s => s.type === 'image').length, [statuses]);
  const videoCount = useMemo(() => statuses.filter(s => s.type === 'video').length, [statuses]);

  const storageMethodLabel = {
    legacy: 'Legacy (Android < 10)',
    scoped: 'Scoped Storage (Android 10+)',
    saf: 'SAF (Android 11+)',
    unknown: 'Unknown',
  }[storageMethod];

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[COLORS.SURFACE, COLORS.BACKGROUND]}
        style={[styles.header, { paddingTop: headerPaddingTop + 8 }]}
      >
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Settings</Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="image-multiple" size={26} color={COLORS.PRIMARY} />
            <Text style={styles.statNum}>{imageCount}</Text>
            <Text style={styles.statLabel}>Images</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons
              name="video-outline"
              size={26}
              color={COLORS.ACCENT_BLUE}
            />
            <Text style={styles.statNum}>{videoCount}</Text>
            <Text style={styles.statLabel}>Videos</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="bookmark" size={26} color={COLORS.ACCENT_GOLD} />
            <Text style={styles.statNum}>{savedItems.length}</Text>
            <Text style={styles.statLabel}>Saved</Text>
          </View>
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
            sublabel={
              storageMethod === 'saf'
                ? 'SAF folder access granted'
                : storageMethod === 'legacy'
                ? 'Direct file access'
                : 'Scoped storage'
            }
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
              sublabel={
                safGranted ? 'Folder access granted' : 'Required for Android 11+'
              }
              onPress={!safGranted ? requestSAF : undefined}
              showArrow={!safGranted}
            />
          )}
        </View>

        <SectionHeader title="Share" />
        <View style={styles.section}>
          <SettingRow
            icon="share-social-outline"
            iconBg={COLORS.PRIMARY + '22'}
            label="Share StatusVault"
            sublabel="Tell your friends about this app"
            onPress={handleShareApp}
          />
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
          <SettingRow
            icon="language-outline"
            iconBg={COLORS.ACCENT_BLUE + '22'}
            label="Select Language"
            sublabel="Change app language"
            onPress={() => router.push('/languages')}
          />
        </View>

        <SectionHeader title="About" />
        <View style={styles.section}>
          <SettingRow
            icon="shield-outline"
            iconBg={COLORS.PRIMARY + '22'}
            label="Privacy Policy"
            sublabel="GDPR & Google Play Store compliant"
            onPress={() => router.push('/privacy')}
          />
          <SettingRow
            icon="document-text-outline"
            iconBg={COLORS.ACCENT_GOLD + '22'}
            label="Terms & Conditions"
            sublabel="Legal terms"
            onPress={() => router.push('/terms')}
          />
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            value="1.4.0"
            showArrow={false}
            onPress={handleVersionPress}
          />
          <SettingRow
            icon="star-outline"
            iconBg={COLORS.ACCENT_GOLD + '22'}
            label="Rate StatusVault"
            sublabel="Support us with a 5-star review"
            onPress={() =>
              Linking.openURL(
                'https://play.google.com/store/apps/details?id=com.binan.statussaver',
              ).catch(() => {})
            }
          />
        </View>

        <SectionHeader title="Data" />
        <View style={styles.section}>
          <SettingRow
            icon="trash-outline"
            danger
            label="Clear Cache"
            sublabel="Remove temporary files"
            onPress={() =>
              Alert.alert(
                'Clear Cache',
                'This will clear temporarily cached files. Your saved statuses will not be affected.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Clear', onPress: () => {} },
                ],
              )
            }
          />
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="shield-check" size={28} color={COLORS.PRIMARY} />
          <Text style={styles.footerTitle}>StatusVault</Text>
          <Text style={styles.footerSub}>
            100% Offline Processing: Your media never leaves your device.{'\n'}
            The developer has zero access to your files.
          </Text>
          <Text style={styles.footerNote}>
            WhatsApp is a registered trademark of WhatsApp LLC.{'\n'}
            StatusVault is not affiliated with or endorsed by WhatsApp LLC or Meta Platforms
            Inc.{'\n'}
            This is a personal project by an individual developer.
          </Text>
        </View>
      </ScrollView>

      {/* ── Easter Egg Modal ───────────────────────────────────── */}
      <Modal
        visible={showEasterEgg}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEasterEgg(false)}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setShowEasterEgg(false)}
          />
          <View style={[styles.easterEggCard, { backgroundColor: COLORS.SURFACE }]}>
            <View style={styles.easterEggGradient}>
              <View style={styles.eggMonogramWrap}>
                <Text style={styles.eggMonogram}>B</Text>
              </View>
              <Text style={styles.eggMadeBy}>Made by</Text>
              <Text style={styles.eggName}>Binan</Text>
              <View style={styles.eggDivider} />
              <Text style={styles.eggTitle}>Founder & Developer</Text>
              <Text style={styles.eggAppName}>StatusVault</Text>
              <View style={styles.eggBlessingWrap}>
                <Text style={styles.eggBlessing}>
                  May الله bless him, his family,{'\n'}and all who use this app.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeEggBtn}
                onPress={() => setShowEasterEgg(false)}
                activeOpacity={0.82}
              >
                <Text style={styles.closeEggText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

const createStyles = (COLORS: ThemePalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: COLORS.BACKGROUND,
    },
    header: {
      paddingHorizontal: SPACING.LG,
      paddingBottom: SPACING.LG,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    headerTitle: {
      fontSize: 26,
      fontWeight: '800',
      color: COLORS.TEXT,
      fontFamily: 'Nunito_800ExtraBold',
    },
    scroll: { flex: 1 },
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
    centeredOverlay: {
      flex: 1,
      justifyContent: 'center',
      backgroundColor: 'rgba(0,0,0,0.85)',
    },
    easterEggCard: {
      marginHorizontal: SPACING.XL,
      borderRadius: RADIUS.LG,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: COLORS.BORDER,
      elevation: 6,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.2,
      shadowRadius: 12,
    },
    easterEggGradient: {
      padding: SPACING.XL,
      alignItems: 'center',
      gap: SPACING.MD,
    },
    eggMonogramWrap: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: COLORS.PRIMARY + '14',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1.5,
      borderColor: COLORS.PRIMARY + '55',
      marginBottom: SPACING.SM,
    },
    eggMonogram: {
      fontSize: 38,
      fontFamily: 'Nunito_800ExtraBold',
      color: COLORS.PRIMARY,
      lineHeight: 44,
      letterSpacing: -1,
    },
    eggMadeBy: {
      fontSize: 11,
      fontFamily: 'Nunito_700Bold',
      color: COLORS.TEXT_MUTED,
      letterSpacing: 2,
      textTransform: 'uppercase',
    },
    eggName: {
      fontSize: 36,
      fontFamily: 'Nunito_800ExtraBold',
      color: COLORS.TEXT,
      letterSpacing: -0.5,
      lineHeight: 42,
    },
    eggDivider: {
      width: 40,
      height: 2,
      backgroundColor: COLORS.PRIMARY,
      borderRadius: 1,
      marginVertical: SPACING.SM,
    },
    eggTitle: {
      fontSize: 11,
      fontFamily: 'Nunito_700Bold',
      color: COLORS.TEXT_SECONDARY,
      textTransform: 'uppercase',
      letterSpacing: 1.5,
    },
    eggAppName: {
      fontSize: FONT_SIZE.LG,
      fontFamily: 'Nunito_800ExtraBold',
      color: COLORS.PRIMARY,
      marginTop: 2,
    },
    eggBlessingWrap: {
      paddingHorizontal: SPACING.MD,
      paddingVertical: SPACING.SM,
      marginTop: SPACING.SM,
    },
    eggBlessing: {
      fontSize: FONT_SIZE.SM,
      fontFamily: 'Nunito_400Regular',
      color: COLORS.TEXT_SECONDARY,
      textAlign: 'center',
      lineHeight: 20,
    },
    closeEggBtn: {
      marginTop: SPACING.MD,
      backgroundColor: COLORS.PRIMARY,
      paddingHorizontal: SPACING.XXL,
      paddingVertical: SPACING.SM,
      borderRadius: RADIUS.FULL,
    },
    closeEggText: {
      color: '#04140C',
      fontFamily: 'Nunito_800ExtraBold',
      fontSize: FONT_SIZE.SM,
      letterSpacing: 0.5,
    },
  });
