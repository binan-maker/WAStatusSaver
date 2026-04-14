import React, { useState, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useMedia, SavedItem } from '@/contexts/MediaContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFirebaseAuth } from '@/contexts/AuthContext';
import { AdBanner } from '@/components/AdBanner';
import { RewardAdButton } from '@/components/RewardAdButton';
import { SubscriptionPlansCard } from '@/components/SubscriptionPlansCard';
import { Share } from 'react-native';
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
  const { user, signInWithGoogle, signOut, deleteAccount } = useFirebaseAuth();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [versionClickCount, setVersionClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: 'Check out StatusVault - Save WhatsApp Statuses instantly!\n\nhttps://play.google.com/store/apps/details?id=com.binan.statussaver',
        title: 'Share StatusVault',
        url: Platform.OS === 'ios' ? 'https://play.google.com/store/apps/details?id=com.binan.statussaver' : undefined,
      });
    } catch (e) {
      console.log('Share error:', e);
    }
  };

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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Your account and all associated data will be permanently deleted after 30 days. During this period you can cancel by signing in again.\n\nThis action cannot be undone after 30 days.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              'Your subscription, referral history, and all account data will be erased permanently after 30 days.',
              [
                { text: 'Go Back', style: 'cancel' },
                {
                  text: 'Yes, Delete',
                  style: 'destructive',
                  onPress: deleteAccount,
                },
              ]
            );
          },
        },
      ]
    );
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
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>{t('settings')}</Text>
          <TouchableOpacity
            style={styles.signInBtn}
            onPress={user ? handleSignOut : signInWithGoogle}
            activeOpacity={0.8}
          >
            {user?.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.profileAvatar} />
            ) : (
              <View style={styles.signInIconWrap}>
                <Ionicons name={user ? 'person' : 'person-outline'} size={18} color={user ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} />
              </View>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 70 }]}
        showsVerticalScrollIndicator={false}
      >
        {user && (
          <View style={styles.profileCard}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.profileCardAvatar} />
            ) : (
              <View style={styles.profileCardAvatarPlaceholder}>
                <Ionicons name="person" size={28} color={COLORS.PRIMARY} />
              </View>
            )}
            <View style={styles.profileCardInfo}>
              <Text style={styles.profileCardName} numberOfLines={1}>
                {user.displayName || 'User'}
              </Text>
              <Text style={styles.profileCardEmail} numberOfLines={1}>
                {user.email || ''}
              </Text>
            </View>
            <View style={styles.profileBadge}>
              <MaterialCommunityIcons name="google" size={14} color={COLORS.PRIMARY} />
            </View>
          </View>
        )}

        {!user && (
          <TouchableOpacity style={styles.signInCard} onPress={signInWithGoogle} activeOpacity={0.85}>
            <View style={styles.signInCardIcon}>
              <MaterialCommunityIcons name="google" size={20} color={COLORS.PRIMARY} />
            </View>
            <View style={styles.signInCardInfo}>
              <Text style={styles.signInCardTitle}>Sign in with Google</Text>
              <Text style={styles.signInCardSub}>Sync your subscription across devices</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={COLORS.TEXT_MUTED} />
          </TouchableOpacity>
        )}

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

        <SectionHeader title="Get Free Ads Access" />
        <RewardAdButton variant="row" />

        <SectionHeader title="Subscription" />
        <SubscriptionPlansCard />

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

        <SectionHeader title="Support" />
        <View style={styles.section}>
          <SettingRow
            icon="chatbubble-ellipses-outline"
            iconBg={COLORS.PRIMARY + '22'}
            label="Feedback & Contact Us"
            sublabel="Send feedback, report bugs, or reach us directly"
            onPress={() => router.push('/contact')}
          />
        </View>

        {user && (
          <>
            <SectionHeader title="Account" />
            <View style={styles.section}>
              <SettingRow
                icon="log-out-outline"
                iconBg={COLORS.ERROR + '18'}
                danger
                label="Sign Out"
                sublabel={user.email || 'Signed in with Google'}
                onPress={handleSignOut}
              />
              <SettingRow
                icon="trash-outline"
                iconBg={COLORS.ERROR + '18'}
                danger
                label="Delete Account"
                sublabel="Permanently deleted after 30 days"
                onPress={handleDeleteAccount}
              />
            </View>
          </>
        )}

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

        {user && (
          <TouchableOpacity style={styles.signOutBottomBtn} onPress={handleSignOut} activeOpacity={0.8}>
            <Ionicons name="log-out-outline" size={18} color={COLORS.ERROR} />
            <Text style={styles.signOutBottomText}>Sign Out</Text>
          </TouchableOpacity>
        )}

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
  signInBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
  },
  signInIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.SURFACE_2,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    marginBottom: SPACING.SM,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '33',
  },
  profileCardAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: COLORS.PRIMARY,
  },
  profileCardAvatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY + '18',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: COLORS.PRIMARY + '44',
  },
  profileCardInfo: {
    flex: 1,
  },
  profileCardName: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  profileCardEmail: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
  },
  profileBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.PRIMARY + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    marginBottom: SPACING.SM,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  signInCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInCardInfo: {
    flex: 1,
  },
  signInCardTitle: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  signInCardSub: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    marginTop: 2,
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
  signOutBottomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.SM,
    marginTop: SPACING.LG,
    marginBottom: SPACING.SM,
    backgroundColor: COLORS.ERROR + '15',
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.ERROR + '33',
    paddingVertical: SPACING.MD,
  },
  signOutBottomText: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.ERROR,
    fontFamily: 'Nunito_700Bold',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
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
    maxHeight: '50%',
    backgroundColor: COLORS.SURFACE,
    borderTopLeftRadius: RADIUS.LG,
    borderTopRightRadius: RADIUS.LG,
    overflow: 'hidden',
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
