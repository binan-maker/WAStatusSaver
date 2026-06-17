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

type TagColorKey = 'PRIMARY' | 'ACCENT_GOLD' | 'ACCENT_BLUE' | 'ACCENT_PINK' | 'ERROR';

interface AccordionItem {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  content: string[];
  tag?: string;
  tagColor?: TagColorKey;
}

const FAQ_ITEMS: AccordionItem[] = [
  {
    title: 'Saved statuses survive app uninstall',
    icon: 'shield-checkmark-outline',
    tag: 'Important',
    tagColor: 'PRIMARY',
    content: [
      'Every status you save through StatusVault is written to your phone\'s public gallery, inside an album called "StatusVault" (located at /Pictures/StatusVault/).',
      '',
      'Because the file lives in your gallery — not inside the app\'s private storage — your saved photos and videos are NOT deleted when you:',
      '   • Uninstall and re-install StatusVault',
      '   • Clear the app\'s data or cache',
      '   • Delete your StatusVault account',
      '   • Factory-reset is the only thing that wipes the album.',
      '',
      'After re-installing, open the Saved tab once. StatusVault automatically scans the "StatusVault" album in your gallery and re-attaches any items it finds there, so they show up again under Saved without you doing anything.',
      '',
      'If you ever want a saved item gone, delete it from the Saved tab inside the app (or from your gallery directly).',
      '',
      '⚠ IMPORTANT — Folder access after reinstall:',
      'Your SAVED FILES stay in the gallery (as above), but the WhatsApp folder PERMISSION is tied to the app\'s installation. Android revokes it on uninstall.',
      '→ After reinstalling, go to Home → "Grant Access" and re-grant access to the WhatsApp Media folder. This is an Android OS requirement — StatusVault cannot bypass it.',
      '→ You will NOT need to re-save any files — they are already in your gallery.',
    ],
  },
  {
    title: 'Deleting your account — what happens to Pro?',
    icon: 'warning-outline',
    tag: 'Pro Warning',
    tagColor: 'ERROR',
    content: [
      'Deleting your account from Settings → Delete Account is permanent and cannot be undone after the 30-day grace period.',
      '',
      'IF YOU ARE A PRO MEMBER:',
      '   • Your active Pro subscription is forfeited immediately.',
      '   • Remaining paid days CANNOT be refunded or transferred.',
      '   • Past payments are non-refundable once you confirm deletion.',
      '   • Re-installing the app or signing back in with the same Google account will NOT bring Pro back. You would have to purchase again.',
      '',
      'WHAT GETS DELETED:',
      '   • Google sign-in & profile, subscription records, payment history, referral progress, push token.',
      '',
      'WHAT IS KEPT ON YOUR DEVICE:',
      '   • Your saved statuses (the "StatusVault" gallery album) stay in your phone\'s gallery.',
      '',
      'You have 30 days after tapping Delete to change your mind — just sign in again to cancel the deletion.',
    ],
  },
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
    title: 'Initial Setup — Android 11, 12, 13, 14, 15+',
    icon: 'shield-outline',
    tag: 'Android 11+',
    tagColor: 'PRIMARY',
    content: [
      'Android 11+ uses strict scoped storage (Storage Access Framework). You must grant access to the WhatsApp Media folder ONCE.',
      '',
      '1. Open StatusVault. The Home screen shows a top source selector with two chips: "WhatsApp" (default) and "WhatsApp Business".',
      '2. Tap "Grant Access" on the empty state, or open the source chip you want.',
      '3. The Android folder picker opens AT the correct Media folder automatically. You should NOT have to navigate.',
      '4. Tap "USE THIS FOLDER" and accept the permission prompt.',
      '5. Statuses appear within 1–2 seconds. If you see an empty grid, tap the refresh icon — Android sometimes needs a moment to mount the folder.',
      '',
      'Note: Permission persists across reboots, app updates, and app restarts — Android remembers your choice. You only re-grant if you UNINSTALL the app (Android ties the permission to the installation). After a reinstall, just repeat Step 3–4 above once.',
      '',
      'If your phone has WhatsApp under a Work Profile or Dual-App / Clone-App slot, the picker may open at the wrong Media folder. Use Settings → "Browse manually" to pick the folder yourself.',
      '',
      'Folders the picker opens at:',
      '   Android → media → com.whatsapp → WhatsApp → Media',
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
    title: 'Subscription Plans (Pro)',
    icon: 'star-outline',
    tag: 'Premium',
    tagColor: 'ACCENT_GOLD',
    content: [
      'StatusVault offers three Pro plans — all one-time, non-renewing payments. When a plan expires, ads simply return; you are NEVER auto-charged.',
      '',
      'Pricing (Indian Rupees, all taxes included):',
      '→ Monthly  — ₹29  · 30 days ad-free',
      '→ 3 Months — ₹79  · 90 days ad-free',
      '→ Yearly   — ₹149 · 365 days ad-free + priority support',
      '',
      'Stacking: if you buy a new plan while another is still active, the new days are ADDED on top of your remaining time. You never lose a paid day.',
      '',
      'How to subscribe:',
      '1. Settings → "Get Premium" (or tap the subscription banner anywhere).',
      '2. Choose Monthly, 3 Months, or Yearly.',
      '3. The store payment sheet opens (Google Play Billing on Play Store builds; Razorpay on Indus / other store builds).',
      '4. Confirm. Ads disappear within seconds after server-side verification.',
      '',
      'Cross-device sync:',
      '→ Sign in with Google, then your Pro status follows your account to any Android phone.',
      '→ No need to repurchase — Firestore re-validates when you sign in.',
      '',
      'Internet is required ONLY for subscription verification, sign-in, and notifications. Viewing and saving statuses works fully offline.',
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
    title: 'Invite & Earn — Personal Referral Code',
    icon: 'people-outline',
    tag: 'Free Pro',
    tagColor: 'PRIMARY',
    content: [
      'Every signed-in user gets a unique 6-character code (e.g. K3T8N2). Share it with friends — when they install and sign in using your link, your reward ladder advances.',
      '',
      'Reward Ladder (rewards STACK on top of any existing Pro time):',
      '→ 3 friends   = 48 hours of Pro',
      '→ 10 friends  = 1 week of Pro',
      '→ 50 friends  = 1 month of Pro',
      '→ 100 friends = 3 months of Pro',
      '→ 500 friends = 1.5 years of Pro (548 days)',
      '',
      'How to share:',
      '1. Settings or Home → "Invite friends" → opens the Invite screen.',
      '2. Tap "Share" — sends a Play Store link with your code attached, plus the code in plain text.',
      '3. After your friend installs and signs in with Google, the credit lands on your account automatically.',
      '',
      'A friend who already has the app can also open Subscription → "Have a referral code?" and paste your code manually.',
      '',
      'Anti-fraud: must be signed in with Google · one referrer per user (cannot be changed later) · self-referral is blocked · one device per attribution.',
    ],
  },
  {
    title: 'Influencer / Giveaway Codes',
    icon: 'gift-outline',
    tag: 'Free Pro',
    tagColor: 'ACCENT_PINK',
    content: [
      'Separate from personal invite codes, StatusVault supports campaign codes shared by influencers and partners. These give a flat free-Pro period to anyone who redeems.',
      '',
      'How to redeem:',
      '1. Open the Subscription screen.',
      '2. Scroll to "Have a referral code?" and paste the code.',
      '3. Sign in with Google when prompted (required to lock the code to your account).',
      '4. Pro is activated for the duration set by the campaign (commonly 90 days).',
      '',
      'Rules:',
      '→ Each code has a fixed slot count; once exhausted you will see a CODE_EXHAUSTED message and a CTA to use the personal Invite & Earn ladder instead.',
      '→ One code per user — you cannot redeem twice.',
      '→ Cannot be redeemed if you already have an active Pro subscription.',
      '→ One device fingerprint per code. Reinstalls on the same phone count as the same device.',
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
    title: 'Theme — Follows Your System',
    icon: 'contrast-outline',
    tag: 'Dark / Light',
    tagColor: 'ACCENT_BLUE',
    content: [
      'StatusVault automatically matches your phone\'s system theme. There is no in-app theme picker.',
      '',
      '→ Phone is in Dark mode → StatusVault is dark (deep navy + emerald).',
      '→ Phone is in Light mode → StatusVault is light.',
      '→ Switching your system theme updates StatusVault instantly — including the Android status bar and navigation bar.',
      '',
      'To change the theme:',
      '→ Android Settings → Display → Dark theme (toggle on/off), or',
      '→ Use the system Dark Mode quick tile from your notification shade.',
    ],
  },
  {
    title: 'Statuses Not Showing?',
    icon: 'help-circle-outline',
    content: [
      'Common solutions, in order of likelihood:',
      '',
      '→ Open WhatsApp and view/tap on statuses first.',
      '   WhatsApp only writes a status file to disk AFTER you view it inside WhatsApp.',
      '',
      '→ Pull down to refresh the StatusVault home screen, or tap the refresh icon in the header.',
      '',
      '→ For Android 11+: confirm you granted SAF access at the WhatsApp Media folder, not at a parent folder. Settings → Grant Access → re-pick the folder if unsure.',
      '',
      '→ Just reinstalled the app? Android wipes folder permissions on uninstall. Go to Home → "Grant Access" and re-grant access to the WhatsApp Media folder.',
      '',
      '→ Use the source chip at the top to switch between WhatsApp and WhatsApp Business — each source has its own permission and grid.',
      '',
      '→ If you use a Work Profile, Dual-App, or Clone-App slot, your statuses live in a non-standard path. Use Settings → "Browse manually" to pick that folder yourself.',
      '',
      '→ Some custom ROMs (MIUI, ColorOS, HyperOS, OxygenOS) sandbox folder access. If statuses still don\'t appear after a refresh, try: Android Settings → Apps → StatusVault → Permissions → enable any storage-related toggles, then re-grant access in StatusVault.',
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
      '',
      '✓ Compliant with Google Play Store, GDPR, and Indian IT Act policies.',
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
