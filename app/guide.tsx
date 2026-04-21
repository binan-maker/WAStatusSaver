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
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

type TagColorKey = 'PRIMARY' | 'ACCENT_GOLD' | 'ACCENT_BLUE' | 'ACCENT_PINK';

interface AccordionItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string[];
  tag?: string;
  tagColor?: TagColorKey;
}

const FAQ_ITEMS: AccordionItem[] = [
  {
    title: 'Initial Setup — Android 5 to 9',
    icon: 'phone-portrait-outline',
    tag: 'Legacy',
    tagColor: 'ACCENT_GOLD',
    content: [
      '1. Open StatusVault and tap "Grant Access".',
      '2. Allow media/storage permission when prompted.',
      '3. StatusVault can now directly read WhatsApp statuses.',
      '4. Open WhatsApp → Status tab and view statuses to load them.',
      '5. Return to StatusVault and pull down to refresh.',
      '',
      'WhatsApp Status folder:',
      '/storage/emulated/0/WhatsApp/Media/.Statuses',
    ],
  },
  {
    title: 'Initial Setup — Android 10',
    icon: 'phone-portrait-outline',
    tag: 'Android 10',
    tagColor: 'ACCENT_BLUE',
    content: [
      '1. Open StatusVault → Grant Access → Allow media permission.',
      '2. StatusVault uses scoped storage but can still read the status folder.',
      '3. Open WhatsApp, view statuses, then refresh StatusVault.',
      '',
      'If statuses don\'t load:',
      '→ Go to Settings → Grant Access → Select Statuses Folder.',
      '',
      'WhatsApp Status folder:',
      '/storage/emulated/0/WhatsApp/Media/.Statuses',
    ],
  },
  {
    title: 'Initial Setup — Android 11, 12, 13, 14+',
    icon: 'shield-outline',
    tag: 'Android 11+',
    tagColor: 'PRIMARY',
    content: [
      'Android 11+ uses strict scoped storage (SAF). You must manually select the WhatsApp Media folder:',
      '',
      '1. Open StatusVault → Settings → Grant Access.',
      '2. Tap "Select Media Folder".',
      '3. In the system file picker, navigate to:',
      '   Android → media → com.whatsapp → WhatsApp → Media',
      '4. Tap "USE THIS FOLDER" and confirm.',
      '5. Return to StatusVault — statuses will appear.',
      '',
      'Note: You only need to do this ONCE.',
      '',
      'WhatsApp Business folder:',
      '   Android → media → com.whatsapp.w4b → WhatsApp Business → Media',
    ],
  },
  {
    title: 'Google Sign-In (Optional)',
    icon: 'logo-google',
    tag: 'Account',
    tagColor: 'ACCENT_BLUE',
    content: [
      'Signing in with Google is optional but unlocks account features:',
      '',
      '→ Subscription synced across all your Android devices.',
      '→ Referral rewards tied to your account.',
      '→ Personalized settings backup.',
      '',
      'How to sign in:',
      '1. Go to the Settings tab.',
      '2. Tap the person icon in the top-right corner.',
      '3. Tap "Sign in with Google".',
      '4. Choose your Google account from the picker.',
      '5. Your profile photo and name will appear in Settings.',
      '',
      'How to sign out:',
      '→ Settings → Account section → Sign Out.',
      '',
      'Note: Your WhatsApp status files are never uploaded to Google. Only your account info (email, name, photo) is used for authentication.',
    ],
  },
  {
    title: 'Subscription & Ad-Free Access',
    icon: 'star-outline',
    tag: 'Premium',
    tagColor: 'ACCENT_GOLD',
    content: [
      'StatusVault offers subscription plans to remove all advertisements.',
      '',
      '— Google Play Store (Play Store build) —',
      'Payments are handled entirely by Google Play Billing.',
      'How to subscribe (Play Store):',
      '1. Go to Settings → "Get Premium" or tap the subscription banner.',
      '2. Choose your plan (Monthly, 3 Months, or Yearly).',
      '3. Google Play\'s native payment sheet opens — use any saved UPI, card, or Google Pay method.',
      '4. Confirm the purchase. Ads are removed within seconds.',
      '',
      '→ Refunds for Play Store purchases follow Google Play\'s refund policy.',
      '→ You can request a refund directly from the Play Store app within 48 hours of purchase.',
      '→ For billing issues, contact Google Play Support or the developer.',
      '',
      '— Indus App Store / Other Stores (non-Play builds) —',
      'Payments are processed by Razorpay (RBI-licensed payment aggregator).',
      'Accepted methods: UPI, credit/debit cards, net banking, wallets.',
      '',
      'How to subscribe (Indus / other stores):',
      '1. Go to Settings → "Get Premium" or tap the subscription banner.',
      '2. Choose your plan.',
      '3. Complete payment via the Razorpay checkout sheet.',
      '4. Ads are removed immediately after server-side verification.',
      '',
      '→ Refund requests: Email ahmedsameerbinan2@gmail.com with your Razorpay Payment ID.',
      '',
      '— Applies to ALL builds —',
      '→ Watch a reward ad to get 30 minutes of ad-free access for free.',
      '→ Refer friends to earn longer ad-free periods.',
      '→ Purchasing while a plan is active adds time on top — you never lose paid days.',
      '→ Internet is required for subscription verification.',
    ],
  },
  {
    title: 'How Google Play Billing Works',
    icon: 'card-outline',
    tag: 'Play Store',
    tagColor: 'PRIMARY',
    content: [
      'When you install StatusVault from the Google Play Store, all in-app purchases go through Google Play Billing — the same secure system used by every major Android app.',
      '',
      'What this means for you:',
      '→ No entering card details inside the app. Google handles the payment sheet.',
      '→ Use any payment method saved to your Google account: UPI, Google Pay, debit/credit card, net banking.',
      '→ Google issues the purchase receipt and sends it to your Gmail.',
      '',
      'How your Pro access is verified:',
      '1. You complete the Google Play purchase.',
      '2. Google Play sends a signed purchase token to StatusVault\'s server.',
      '3. Our server verifies the token with the Google Play Developer API.',
      '4. Firebase Firestore records your active subscription.',
      '5. Pro access is unlocked on your device within seconds.',
      '',
      'Cross-device sync:',
      '→ Sign in with the same Google account on any device.',
      '→ Pro status is fetched from Firebase — no need to repurchase.',
      '',
      'Refunds (Play Store):',
      '→ Request within 48 hours directly from the Play Store app.',
      '→ Go to Play Store → your profile icon → Payments & subscriptions → Order history → tap your StatusVault order → Request a refund.',
      '→ For issues beyond 48 hours, email ahmedsameerbinan2@gmail.com with your Google Order ID.',
    ],
  },
  {
    title: 'How Razorpay Payments Work (Indus / Other Stores)',
    icon: 'wallet-outline',
    tag: 'Indus Store',
    tagColor: 'ACCENT_GOLD',
    content: [
      'If you installed StatusVault from the Indus App Store or another non-Play distribution, payments are processed by Razorpay — an RBI-licensed payment aggregator.',
      '',
      'Accepted payment methods:',
      '→ UPI: PhonePe, Google Pay, Paytm, BHIM, and all UPI apps',
      '→ Credit/Debit cards: Visa, Mastercard, RuPay',
      '→ Net banking: all major Indian banks',
      '→ Digital wallets: Paytm, Amazon Pay, etc.',
      '',
      'How payment verification works:',
      '1. You tap a plan and the Razorpay checkout opens.',
      '2. You complete the payment.',
      '3. Razorpay sends a cryptographic signature to our server.',
      '4. Our server verifies the signature using HMAC-SHA256.',
      '5. Firebase Firestore records your subscription.',
      '6. Pro access is unlocked instantly.',
      '',
      'Security:',
      '→ We never see or store your card number, UPI PIN, or bank credentials.',
      '→ All payment data is handled exclusively by Razorpay.',
      '→ Razorpay is PCI-DSS compliant and regulated by the Reserve Bank of India.',
      '',
      'Refunds (Razorpay):',
      '→ Email ahmedsameerbinan2@gmail.com with your Razorpay Payment ID, registered email, and issue description.',
      '→ Refund requests are reviewed within 5 business days.',
      '→ Approved refunds are returned to the original payment method in 7–10 business days.',
    ],
  },
  {
    title: 'Referral Program',
    icon: 'people-outline',
    tag: 'Rewards',
    tagColor: 'PRIMARY',
    content: [
      'Invite friends to earn ad-free days:',
      '',
      'Reward tiers:',
      '→ 1 referral  = 3 days ad-free',
      '→ 5 referrals = 15 days ad-free',
      '→ 10 referrals = 30 days ad-free',
      '→ 25 referrals = 90 days ad-free',
      '→ 50 referrals = 180 days ad-free',
      '→ 100 referrals = 365 days ad-free',
      '',
      'How it works:',
      '1. Go to Settings or Home → tap "Share Referral Code".',
      '2. Your friend installs StatusVault using your link.',
      '3. When they open the app for the first time, your reward is credited.',
      '',
      'Anti-cheat: Each device can only be counted once. Installing and reinstalling on the same device does not count as a new referral.',
    ],
  },
  {
    title: 'How to Save a Status',
    icon: 'download-outline',
    content: [
      '1. On the Home tab, browse images and videos.',
      '2. Tap any image or video to open the fullscreen viewer.',
      '3. Tap the "Save" button at the bottom of the viewer.',
      '4. Or tap the download icon (⬇) directly on the grid card.',
      '5. Saved statuses appear in the Saved tab.',
      '6. They are also saved to your Gallery under the "StatusVault" album.',
    ],
  },
  {
    title: 'How to Share a Status',
    icon: 'share-social-outline',
    content: [
      '1. Tap any status to open it in the fullscreen viewer.',
      '2. Tap the "Share" button to share to any installed app.',
      '3. Tap the "WhatsApp" button to share directly back to WhatsApp.',
      '4. You can also tap the share icon (↑) on any card in the grid.',
      '5. To share saved statuses, go to the Saved tab and tap share.',
    ],
  },
  {
    title: 'WhatsApp Business Statuses',
    icon: 'briefcase-outline',
    content: [
      'StatusVault supports both WhatsApp and WhatsApp Business.',
      '',
      'If you have WhatsApp Business installed:',
      '→ Business statuses are automatically detected.',
      '→ They are marked with a briefcase icon.',
      '',
      'Business Status path (Android < 11):',
      '/storage/emulated/0/WhatsApp Business/Media/.Statuses',
      '',
      'For Android 11+, select this folder using SAF:',
      '   Android → media → com.whatsapp.w4b → WhatsApp Business → Media',
    ],
  },
  {
    title: 'Push Notifications',
    icon: 'notifications-outline',
    content: [
      'StatusVault can notify you when new WhatsApp statuses are available.',
      '',
      'How to enable:',
      '1. Go to Settings → Notifications toggle → turn ON.',
      '2. Allow notification permission if prompted by Android.',
      '',
      'How to disable:',
      '→ Settings → Notifications toggle → turn OFF.',
      '→ Or go to Android Settings → Apps → StatusVault → Notifications.',
      '',
      'Note: Push notifications require an internet connection. Your notification token is stored on our servers to deliver alerts and is deleted after 180 days of inactivity.',
    ],
  },
  {
    title: 'Statuses Not Showing?',
    icon: 'help-circle-outline',
    content: [
      'Common solutions:',
      '',
      '→ Open WhatsApp and view/tap on statuses first.',
      '   WhatsApp only saves a status file after you view it.',
      '',
      '→ Pull down to refresh the StatusVault home screen.',
      '',
      '→ For Android 11+: Make sure you have selected the correct SAF folder (see setup above).',
      '',
      '→ Check that WhatsApp is installed at the standard location.',
      '',
      '→ Some custom ROMs (MIUI, ColorOS, HyperOS) may restrict folder access.',
      '   Go to Android Settings → Privacy → Special app access → Files and media.',
    ],
  },
  {
    title: 'Privacy & Data Safety',
    icon: 'lock-closed-outline',
    content: [
      'Your media always stays on your device:',
      '',
      '✓ Status files are never uploaded to our servers.',
      '✓ We do not read WhatsApp messages or chats.',
      '✓ We do not access your contacts.',
      '✓ Core features (viewing, saving, sharing) work fully offline.',
      '',
      'Internet is used only for:',
      '✓ Google Sign-In (optional)',
      '✓ Google Play Billing (Play Store build) — subscription purchase & verification',
      '✓ Razorpay (Indus/other builds) — subscription purchase & verification',
      '✓ Push notifications (Firebase Cloud Messaging)',
      '✓ Displaying ads (Google AdMob — free users only)',
      '',
      '✓ Compliant with Google Play Store, Indus App Store, GDPR, and Indian IT Act policies.',
      '',
      'StatusVault is NOT affiliated with WhatsApp LLC or Meta.',
      '',
      'StatusVault is currently in Beta. Features and policies may change.',
    ],
  },
];

function AccordionCard({ item }: { item: AccordionItem }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.card}>
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        style={styles.cardHeader}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeaderLeft}>
          <View style={[styles.cardIcon, expanded && { backgroundColor: COLORS.PRIMARY + '22' }]}>
            <Ionicons name={item.icon} size={18} color={expanded ? COLORS.PRIMARY : COLORS.TEXT_SECONDARY} />
          </View>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            {item.tag && (() => {
              const tagHex = item.tagColor ? COLORS[item.tagColor] : COLORS.PRIMARY;
              return (
                <View style={[styles.cardTag, { backgroundColor: tagHex + '22' }]}>
                  <Text style={[styles.cardTagText, { color: tagHex }]}>{item.tag}</Text>
                </View>
              );
            })()}
          </View>
        </View>
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={COLORS.TEXT_MUTED}
        />
      </TouchableOpacity>
      {expanded && (
        <View style={styles.cardBody}>
          {item.content.map((line, i) => {
            if (line === '') return <View key={i} style={{ height: 6 }} />;
            const isPath = line.startsWith('/storage');
            const isStep = /^\d+\./.test(line);
            const isNote = line.startsWith('Note:') || line.startsWith('→') || line.startsWith('✓');
            const isSeparator = line.startsWith('—') && line.endsWith('—');
            return (
              <Text
                key={i}
                style={[
                  styles.bodyLine,
                  isPath && styles.pathLine,
                  isStep && styles.stepLine,
                  isNote && styles.noteLine,
                  isSeparator && styles.separatorLine,
                ]}
              >
                {line}
              </Text>
            );
          })}
        </View>
      )}
    </View>
  );
}

export default function GuideScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="book-outline" size={36} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>Complete Guide</Text>
          <Text style={styles.heroSub}>
            Everything you need to know to set up and use StatusVault on any Android device.
          </Text>
        </View>

        <View style={styles.quickInfo}>
          {[
            { icon: 'phone-portrait-outline' as const, text: 'Android 5+' },
            { icon: 'wifi-outline' as const, text: 'Optional Online' },
            { icon: 'lock-closed-outline' as const, text: 'Media Stays Local' },
            { icon: 'flask-outline' as const, text: 'Beta' },
          ].map((item, i) => (
            <View key={i} style={styles.quickChip}>
              <Ionicons name={item.icon} size={14} color={COLORS.PRIMARY} />
              <Text style={styles.quickChipText}>{item.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.accordionList}>
          {FAQ_ITEMS.map((item, i) => (
            <AccordionCard key={i} item={item} />
          ))}
        </View>

        <View style={styles.footer}>
          <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.PRIMARY} />
          <Text style={styles.footerText}>
            StatusVault Beta — Your privacy-first status saver.{'\n'}
            Not affiliated with WhatsApp or Meta.
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
    padding: SPACING.LG,
    gap: SPACING.MD,
  },
  hero: {
    alignItems: 'center',
    gap: SPACING.SM,
    paddingVertical: SPACING.LG,
  },
  heroIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: COLORS.PRIMARY + '22',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  heroTitle: {
    fontSize: 24,
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
  quickInfo: {
    flexDirection: 'row',
    gap: SPACING.SM,
    justifyContent: 'center',
    flexWrap: 'wrap',
  },
  quickChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.SURFACE_2,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  quickChipText: {
    fontSize: FONT_SIZE.SM,
    fontWeight: '600',
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  accordionList: {
    gap: SPACING.SM,
  },
  card: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.MD,
    gap: SPACING.SM,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.MD,
    flex: 1,
  },
  cardIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.SM,
    backgroundColor: COLORS.SURFACE_2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleWrap: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
    flexShrink: 1,
  },
  cardTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.FULL,
  },
  cardTagText: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Nunito_700Bold',
  },
  cardBody: {
    paddingHorizontal: SPACING.MD,
    paddingBottom: SPACING.LG,
    paddingTop: SPACING.SM,
    gap: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  bodyLine: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
  pathLine: {
    fontFamily: Platform.OS === 'android' ? 'monospace' : 'Courier',
    fontSize: FONT_SIZE.XS,
    color: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY + '11',
    padding: 6,
    borderRadius: RADIUS.XS,
    marginVertical: 2,
  },
  stepLine: {
    color: COLORS.TEXT,
    fontFamily: 'Nunito_600SemiBold',
  },
  noteLine: {
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_600SemiBold',
  },
  separatorLine: {
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_700Bold',
    fontSize: FONT_SIZE.XS,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginVertical: 4,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: SPACING.XL,
    gap: SPACING.SM,
  },
  footerText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    fontFamily: 'Nunito_400Regular',
  },
});
