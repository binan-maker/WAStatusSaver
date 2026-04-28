import React, { useState, useEffect, useMemo } from 'react';
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
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Device from 'expo-device';
import * as Haptics from 'expo-haptics';
import { useMedia, SavedItem } from '@/contexts/MediaContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useFirebaseAuth } from '@/contexts/AuthContext';
import { useSubscriptionStatus } from '@/hooks/subscription/useSubscriptionStatus';
import { AdBanner } from '@/components/ads/AdBanner';
import { RewardAdButton } from '@/components/ads/RewardAdButton';
import { SubscriptionPlansCard } from '@/components/subscription/SubscriptionPlansCard';
import { Share } from 'react-native';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS, ADMOB } from '@/constants/theme';
import { LANGUAGES } from '@/lib/i18n';
import { getCachedShareLink } from '@/lib/share-link';

// Per-screen error boundary: a crash on this tab shows a recovery UI
// instead of white-screening the whole app.
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

function SettingRow({ icon, iconBg, label, sublabel, value, onPress, showArrow = true, danger }: SettingRowProps) {
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
  return (
    <Text style={styles.sectionHeader}>{title}</Text>
  );
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
  const { language, setLanguage, t } = useLanguage();
  const { user, signInWithGoogle, signOut, deleteAccount } = useFirebaseAuth();
  const { isSubscribed, status, remainingSeconds, refresh: refreshSubscription, loading: subLoading } = useSubscriptionStatus();
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [versionClickCount, setVersionClickCount] = useState(0);
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState(false);

  const handleShareApp = async () => {
    try {
      // Personal short link if signed in (e.g. https://svault.me/K3T8N2),
      // otherwise the bare Play Store install URL.
      const shortLink = await getCachedShareLink();
      await Share.share({
        message: `Check out StatusVault — save WhatsApp statuses without screenshots!\n\n${shortLink}`,
        title: 'Share StatusVault',
        url: Platform.OS === 'ios' ? shortLink : undefined,
      });
    } catch (e) {
      __DEV__ && console.log('Share error:', e);
    }
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

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    const proWarning = isSubscribed
      ? '\n\n⚠️ YOU ARE A PRO MEMBER\n• Your active Pro subscription will be PERMANENTLY LOST.\n• Remaining paid days CANNOT be transferred or refunded.\n• Past payments are non-refundable once the account is deleted.\n• Re-installing the app will NOT restore your Pro access.'
      : '';
    Alert.alert(
      'Delete Account',
      `Your account and all associated data will be scheduled for permanent deletion after 30 days. During this 30-day grace period you can cancel by signing in again.${proWarning}\n\nWhat will be deleted:\n• Google sign-in link & profile\n• Subscription records & payment history\n• Referral progress & earned free-Pro days\n• Push notification token\n\nWhat is kept on your device:\n• Statuses already saved to your gallery's "StatusVault" album.\n\nThis action cannot be undone after 30 days.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Are you absolutely sure?',
              isSubscribed
                ? 'You will lose your active Pro subscription with no refund. Your subscription, referral history, and all account data will be erased permanently after 30 days.'
                : 'Your subscription, referral history, and all account data will be erased permanently after 30 days.',
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

  const handleRestorePurchase = async () => {
    setRestoring(true);
    try {
      await refreshSubscription();
      setRestoreSuccess(isSubscribed);
      setShowRestoreModal(true);
    } finally {
      setRestoring(false);
    }
  };

  const handleCopyPaymentId = async () => {
    if (!status.lastPaymentId) return;
    await Clipboard.setStringAsync(status.lastPaymentId);
    setCopiedId(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTimeout(() => setCopiedId(false), 2000);
  };

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

        {!isSubscribed && (
          <>
            <SectionHeader title="Get Free Ads Access" />
            <RewardAdButton variant="row" />
          </>
        )}

        <SectionHeader title="Subscription" />
        <SubscriptionPlansCard />
        <View style={styles.section}>
          <SettingRow
            icon="gift-outline"
            iconBg={COLORS.ACCENT_PINK + '22'}
            label="Invite & Earn Free Pro"
            sublabel="3 friends → 48hr · 10 → 1wk · 50 → 1mo · 100 → 3mo · 500 → Lifetime"
            onPress={() => router.push('/invite')}
            showArrow
          />
          <SettingRow
            icon="refresh-circle-outline"
            iconBg={COLORS.PRIMARY + '22'}
            label={restoring || subLoading ? 'Checking...' : 'Restore Purchase'}
            sublabel="Paid but still seeing ads? Tap to re-sync"
            onPress={restoring || subLoading ? undefined : handleRestorePurchase}
            showArrow={!restoring && !subLoading}
          />
        </View>

        {isSubscribed && (
          <View style={styles.membershipCard}>
            <LinearGradient
              colors={[COLORS.PRIMARY + '18', COLORS.SURFACE]}
              style={styles.membershipGradient}
            >
              <View style={styles.membershipHeader}>
                <View style={styles.membershipBadge}>
                  <MaterialCommunityIcons name="crown" size={14} color={COLORS.PRIMARY} />
                  <Text style={styles.membershipBadgeText}>Pro Member</Text>
                </View>
                <Text style={styles.membershipActive}>Active</Text>
              </View>

              {status.paidUntil && (
                <View style={styles.membershipRow}>
                  <Ionicons name="calendar-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.membershipLabel}>Valid Until</Text>
                  <Text style={styles.membershipValue}>
                    {new Date(status.paidUntil).toLocaleDateString('en-IN', {
                      year: 'numeric', month: 'short', day: 'numeric',
                    })}
                  </Text>
                </View>
              )}

              {remainingSeconds > 0 && remainingSeconds !== Number.MAX_SAFE_INTEGER && (
                <View style={styles.membershipRow}>
                  <Ionicons name="time-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.membershipLabel}>Days Left</Text>
                  <Text style={[styles.membershipValue, { color: COLORS.PRIMARY }]}>
                    {Math.ceil(remainingSeconds / 86400)} days
                  </Text>
                </View>
              )}

              {status.lastPaymentId ? (
                <View style={styles.membershipRow}>
                  <Ionicons name="receipt-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.membershipLabel}>Payment ID</Text>
                  <TouchableOpacity
                    style={styles.membershipCopyRow}
                    onPress={handleCopyPaymentId}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.membershipPaymentId} numberOfLines={1}>
                      {status.lastPaymentId}
                    </Text>
                    <View style={styles.copyBadge}>
                      <Ionicons
                        name={copiedId ? 'checkmark' : 'copy-outline'}
                        size={12}
                        color={copiedId ? COLORS.SUCCESS : COLORS.PRIMARY}
                      />
                      <Text style={[styles.copyBadgeText, copiedId && { color: COLORS.SUCCESS }]}>
                        {copiedId ? 'Copied!' : 'Copy'}
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.membershipRow}>
                  <Ionicons name="receipt-outline" size={15} color={COLORS.TEXT_SECONDARY} />
                  <Text style={styles.membershipLabel}>Payment ID</Text>
                  <Text style={styles.membershipValueMuted}>Tap "Restore Purchase" to load</Text>
                </View>
              )}

              <Text style={styles.membershipHint}>
                Save your Payment ID for any refund or support request.
              </Text>
            </LinearGradient>
          </View>
        )}

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
            icon="document-text-outline"
            iconBg={COLORS.ACCENT_GOLD + '22'}
            label="Terms & Conditions"
            sublabel="Pricing, refund policy & legal terms"
            onPress={() => router.push('/terms')}
          />
          <SettingRow
            icon="information-circle-outline"
            label="App Version"
            value="1.3.3"
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
            100% Offline Processing: Your media never leaves your device.{'\n'}
            The developer has zero access to your files.
          </Text>
          <Text style={styles.footerNote}>
            WhatsApp is a registered trademark of WhatsApp LLC.{'\n'}
            StatusVault is not affiliated with or endorsed by WhatsApp LLC or Meta Platforms Inc.{'\n'}
            This is a personal project by an individual developer.
          </Text>
        </View>
      </ScrollView>


      {/* ── Branded Restore Purchase Modal ───────────────────────── */}
      <Modal
        visible={showRestoreModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRestoreModal(false)}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowRestoreModal(false)} />
          <View
            style={[
              styles.restoreCard,
              {
                backgroundColor: COLORS.SURFACE,
                borderColor: (restoreSuccess ? COLORS.PRIMARY : COLORS.ERROR) + '55',
              },
            ]}
          >
            <View style={styles.restoreInner}>
              <View
                style={[
                  styles.restoreIconWrap,
                  {
                    borderColor: restoreSuccess ? COLORS.PRIMARY + '55' : COLORS.ERROR + '55',
                    backgroundColor: COLORS.SURFACE_2,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={restoreSuccess ? 'crown' : 'information-outline'}
                  size={32}
                  color={restoreSuccess ? COLORS.PRIMARY : COLORS.ERROR}
                />
              </View>
              <Text style={styles.restoreTitle}>
                {restoreSuccess ? 'Pro Active' : 'No Subscription Found'}
              </Text>
              <Text style={styles.restoreMsg}>
                {restoreSuccess
                  ? 'Your StatusVault Pro is active and synced. All ads have been removed — enjoy!'
                  : 'No active subscription was found on this account. If you paid and still see ads, contact us via the Play Store with your Payment ID.'}
              </Text>
              <TouchableOpacity
                style={[styles.restoreCloseBtn, { backgroundColor: restoreSuccess ? COLORS.PRIMARY : COLORS.ERROR }]}
                onPress={() => setShowRestoreModal(false)}
                activeOpacity={0.82}
              >
                <Text style={styles.restoreCloseBtnText}>Got It</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Binan Easter Egg Modal ────────────────────────────────── */}
      <Modal
        visible={showEasterEgg}
        transparent
        animationType="fade"
        onRequestClose={() => setShowEasterEgg(false)}
      >
        <View style={styles.centeredOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowEasterEgg(false)} />
          <View style={[styles.easterEggCard, { backgroundColor: COLORS.SURFACE }]}>
            <View style={styles.easterEggGradient}>
              {/* Monogram */}
              <View style={styles.eggMonogramWrap}>
                <Text style={styles.eggMonogram}>B</Text>
              </View>

              {/* Name */}
              <Text style={styles.eggMadeBy}>Made by</Text>
              <Text style={styles.eggName}>Binan</Text>

              {/* Divider */}
              <View style={styles.eggDivider} />

              {/* Title */}
              <Text style={styles.eggTitle}>Founder & Developer</Text>
              <Text style={styles.eggAppName}>StatusVault</Text>

              {/* Blessing */}
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

      <AdBanner />
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
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
  themePickerWrap: {
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD,
  },
  themePickerCaption: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: 'Nunito_400Regular',
    marginBottom: SPACING.SM,
  },
  themePickerRow: {
    flexDirection: 'row',
    gap: SPACING.SM,
  },
  themeChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: RADIUS.MD,
    borderWidth: 1.5,
  },
  themeChipLabel: {
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_700Bold',
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
  centeredOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  /* Restore Purchase Modal */
  restoreCard: {
    marginHorizontal: SPACING.XL,
    borderRadius: RADIUS.LG,
    overflow: 'hidden',
    borderWidth: 1.5,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  restoreGradient: {
    padding: SPACING.XL,
    alignItems: 'center',
    gap: SPACING.MD,
  },
  restoreInner: {
    padding: SPACING.XL,
    alignItems: 'center',
    gap: SPACING.MD,
  },
  restoreIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    marginBottom: SPACING.XS,
  },
  restoreTitle: {
    fontSize: FONT_SIZE.XXL,
    fontFamily: 'Nunito_800ExtraBold',
    color: COLORS.TEXT,
    textAlign: 'center',
  },
  restoreMsg: {
    fontSize: FONT_SIZE.SM,
    fontFamily: 'Nunito_400Regular',
    color: COLORS.TEXT_SECONDARY,
    textAlign: 'center',
    lineHeight: 20,
  },
  restoreCloseBtn: {
    marginTop: SPACING.SM,
    paddingHorizontal: SPACING.XXL,
    paddingVertical: SPACING.MD,
    borderRadius: RADIUS.FULL,
  },
  restoreCloseBtnText: {
    fontSize: FONT_SIZE.MD,
    fontFamily: 'Nunito_800ExtraBold',
    color: '#06100C',
  },

  /* Easter Egg / Binan Card */
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
    position: 'relative',
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
  membershipCard: {
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
  },
  membershipGradient: {
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  membershipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.XS,
  },
  membershipBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.PRIMARY + '22',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  membershipBadgeText: {
    fontSize: FONT_SIZE.XS,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_700Bold',
  },
  membershipActive: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.SUCCESS,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
  },
  membershipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.SM,
  },
  membershipLabel: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
    width: 78,
  },
  membershipValue: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    fontWeight: '700',
    flex: 1,
  },
  membershipValueMuted: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
    flex: 1,
  },
  membershipCopyRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  membershipPaymentId: {
    fontSize: 11,
    color: COLORS.TEXT,
    fontFamily: 'Nunito_400Regular',
    flex: 1,
    letterSpacing: 0.3,
  },
  copyBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.PRIMARY + '18',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
  },
  copyBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_700Bold',
  },
  membershipHint: {
    fontSize: 10,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
    marginTop: SPACING.XS,
    fontStyle: 'italic',
  },
});
