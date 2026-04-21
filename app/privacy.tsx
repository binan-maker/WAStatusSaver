import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface SectionProps {
  title: string;
  content: string;
}

function PolicySection({ title, content }: SectionProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();
  const lastUpdated = 'April 2026';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark" size={36} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>Privacy Policy</Text>
          <Text style={styles.heroSub}>Last updated: {lastUpdated}</Text>
        </View>

        <View style={styles.betaBadge}>
          <Ionicons name="flask-outline" size={16} color={COLORS.ACCENT_GOLD} />
          <Text style={styles.betaText}>
            StatusVault is currently in Beta. Features, pricing, and policies may evolve. By using this app, you acknowledge and accept its beta status.
          </Text>
        </View>

        <View style={styles.highlight}>
          <Ionicons name="lock-closed" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.highlightText}>
            StatusVault uses optional Google Sign-In and internet services for subscriptions, ads, and authentication. Your media always stays on your device.
          </Text>
        </View>

        <PolicySection
          title="1. Introduction"
          content="StatusVault ('we', 'our', 'the app', 'the Service') is a WhatsApp Status Saver application for Android devices. This Privacy Policy is a legally binding document explaining what data we collect, why we collect it, how it is used, and your rights as a user. By downloading, installing, or using StatusVault, you agree to this Privacy Policy in full. If you do not agree, you must immediately uninstall and cease use of the app.\n\nThis app is currently in Beta. All features, services, and policies are subject to change without prior notice beyond updating this document. Continued use of the app after updates constitutes acceptance of the revised policy."
        />

        <PolicySection
          title="2. Data We Collect"
          content="Depending on the features you use, we may collect the following information:\n\n• Google Account Information (if you sign in): Your email address, display name, and profile photo, provided via Google Sign-In (OAuth 2.0) and stored securely in Firebase Authentication.\n\n• Device Identifier: A unique anonymous device ID (UUID) generated on first launch, used for referral tracking and subscription verification.\n\n• Push Notification Token: If you enable notifications, your Expo push token is stored to send you status update alerts.\n\n• Subscription & Payment Records:\n  — Google Play Store build: Google Play purchase tokens, subscription tier, status, and expiry dates, stored in Firebase Firestore linked to your Firebase UID. We receive only a purchase token from Google — no card or UPI details.\n  — Indus App Store / other builds: Razorpay payment references, subscription tier, status, and expiry dates, stored in Firebase Firestore. We never receive your card number, UPI PIN, or bank credentials.\n\n• Referral Data: Your unique referral code, number of successful referrals, and ad-free reward expiry dates.\n\n• App Preferences: Language selection, notification preferences, and onboarding completion, stored locally on your device via AsyncStorage.\n\nWe do NOT collect: WhatsApp messages, chats, contacts, call logs, location data, or any biometric data."
        />

        <PolicySection
          title="3. How We Use Your Data"
          content="We use collected data strictly for the following purposes:\n\n• Authentication: To identify your account and maintain a persistent login session across app restarts.\n\n• Subscription Management: To validate your active subscription, prevent fraud, and unlock premium features. Validation is done server-side via the Google Play Developer API (Play Store build) or Razorpay signature verification (other builds).\n\n• Referral Rewards: To track referrals, verify new user installs, and grant ad-free reward periods.\n\n• Push Notifications: To alert you when new WhatsApp statuses are detected (only if you explicitly opt in).\n\n• Advertising: To display ads via Google AdMob when you do not have an active subscription or reward period. Ads are never shown to subscribed users.\n\n• Service Improvement: Anonymous, aggregated usage data may be reviewed internally to improve app stability and performance.\n\nWe do NOT sell, rent, trade, or share your personal data with any third party for marketing or advertising purposes beyond the services described in Section 5."
        />

        <PolicySection
          title="4. Storage Access"
          content="StatusVault requires storage access solely to:\n\n• Read WhatsApp status files from the WhatsApp .Statuses directory on your device.\n• Save selected statuses to your device gallery under the 'StatusVault' album.\n• Cache media files within the app's own private directory for performance.\n\nWe only access the WhatsApp .Statuses folder and the app's private storage directory. We cannot and do not access WhatsApp messages, chats, contacts, or any folders outside those explicitly granted by you through the system permissions dialog or Storage Access Framework (SAF)."
        />

        <PolicySection
          title="5. Internet Usage & Third-Party Services"
          content="StatusVault connects to the internet to provide the following features:\n\n• Firebase Authentication (Google): Manages secure user login and persistent session storage.\n• Firebase Firestore (Google): Stores subscription records, referral data, and device registries on Google's secure cloud infrastructure.\n• Firebase Cloud Messaging (Google): Delivers push notifications to your device.\n• Google AdMob: Serves advertisements. AdMob may collect your Advertising ID, device info, and app usage data per Google's Privacy Policy (policies.google.com/privacy).\n\n• Google Play Billing (Play Store build only): Processes subscription purchases entirely within the Google Play infrastructure. Google handles the payment transaction and sends us only a signed purchase token. Google's Privacy Policy (policies.google.com/privacy) governs this data.\n\n• Razorpay (Indus App Store / other builds only): Processes subscription payments. Razorpay collects name, email, and payment details per Razorpay's Privacy Policy (razorpay.com/privacy). Razorpay is PCI-DSS compliant and regulated by the Reserve Bank of India.\n\n• StatusVault Backend Server: Our server verifies subscription status, validates purchase tokens or payment signatures, manages referrals, and stores subscription records in Firebase.\n\nAll communications with our server and third-party services are encrypted using HTTPS/TLS. The app's core status-viewing features operate offline; internet is only required for sign-in, subscriptions, ads, and notifications."
        />

        <PolicySection
          title="6. Subscriptions & Payments"
          content="StatusVault offers subscription plans that remove advertisements and unlock premium features. How payments work depends on the store you installed from:\n\n— GOOGLE PLAY STORE BUILD —\nPurchases are made through Google Play Billing. You complete the purchase in Google's native payment sheet (using a saved UPI, card, or Google Pay method). Google issues a signed purchase token. Our server verifies that token with the Google Play Developer API before recording your subscription in Firebase Firestore. We never see your payment credentials. Refunds follow Google Play's refund policy — you can request a refund from the Play Store app within 48 hours.\n\n— INDUS APP STORE / OTHER STORE BUILDS —\nPurchases are made through Razorpay. You complete the payment in the Razorpay checkout sheet. Razorpay sends a cryptographic signature to our server, which verifies it using HMAC-SHA256 before recording your subscription in Firebase Firestore. StatusVault does not store or process your financial data directly.\n\n— APPLIES TO ALL BUILDS —\n• Subscriptions are personal and non-transferable. They apply to your account only.\n• All subscriptions have a fixed expiry date. There is no automatic renewal — when your plan expires, ads will resume automatically and no charge is made.\n• If you purchase a new plan while an existing one is active, the new duration is added on top of the remaining time. You never lose paid days.\n• Pro access is verified server-side and linked to your Firebase UID, enabling cross-device sync when you sign in with the same Google account."
        />

        <PolicySection
          title="7. Refund Policy"
          content="Refund policy depends on which store you purchased from:\n\n— GOOGLE PLAY STORE —\nRefunds are subject to Google Play's standard refund policy. You can request a refund directly in the Play Store app within 48 hours of purchase:\nPlay Store → Profile icon → Payments & subscriptions → Order history → StatusVault order → Request a refund.\nFor issues beyond 48 hours, contact us with your Google Order ID at ahmedsameerbinan2@gmail.com.\n\n— INDUS APP STORE / OTHER STORES (Razorpay) —\nREFUND WINDOWS BY PLAN:\n• 1 Month (₹29): No refund. The transaction amount is too small; payment gateway fees consume a significant portion of the revenue.\n• 3 Months (₹79) / 1 Year (₹149): Full refund within 48 hours of purchase, only if a verified technical failure prevents core app usage.\n\nHOW TO REQUEST (Razorpay): Contact us at ahmedsameerbinan2@gmail.com with your Razorpay Payment ID, registered email, and description of the issue. Refunds are processed within 5–7 business days via the original payment method.\n\nEXCLUSIONS (both stores): Refunds will NOT be provided for change of mind, incompatibility with custom ROMs, or loss of access due to changes to your own Google account.\n\nANTI-ABUSE: Users who initiate a bank chargeback will be permanently banned from future purchases."
        />

        <PolicySection
          title="8. Advertising"
          content="StatusVault displays advertisements via Google AdMob when no active subscription or reward period is in effect. Google AdMob may collect:\n\n• Android Advertising ID (AAID)\n• Device model, manufacturer, and OS version\n• App usage and session data for frequency capping\n• Approximate location at country or region level\n\nSubscribed users and users with an active ad-free reward period will not see advertisements.\n\nYou can opt out of personalized advertisements in your Android device settings:\nSettings → Google → Ads → Opt out of Ads Personalization.\n\nAll advertising is served in compliance with Google's EU User Consent Policy where applicable."
        />

        <PolicySection
          title="9. Account Management & Ad State Behaviour"
          content="StatusVault maintains strict separation of ad-free status, subscription benefits, and reward periods between user accounts. The following rules apply:\n\nSIGN-IN:\n• No advertisement is displayed immediately when you sign in with Google. Any interstitial ad that may appear is deliberately suppressed during the sign-in transition to avoid interrupting your experience.\n• Once you are signed in and using the app, advertisements will follow the standard rules: hidden for Pro subscribers and hidden during an active reward period.\n\nSIGN-OUT:\n• Signing out fully resets the app's ad and subscription state on your device. The cached subscription status is immediately cleared so that no Pro-only ad-free state carries over to another account or anonymous session.\n• Any ad-free benefit from your subscription ends on the device the moment you sign out. If you sign back in with the same Pro account, your subscription status is re-verified from the server and your benefits are restored.\n\nREWARD AD TIMING:\n• When a free-tier user earns an ad-free period by watching a rewarded advertisement, that timer is saved and linked to their specific account on the device.\n• If the user signs out and signs back in to the same account, the remaining reward time is preserved.\n• Pro subscribers are always ad-free regardless of any reward timer."
        />

        <PolicySection
          title="10. Data Retention & Deletion"
          content="• Account data (email, display name, push tokens, subscription records) is retained for as long as your account remains active.\n\n• If you sign out and wish your data deleted, contact us via the Play Store developer page. Firebase Authentication entries are removed promptly; Firestore subscription records are retained for 90 days for audit and legal compliance before permanent deletion.\n\n• Device identifiers and push notification tokens are automatically purged after 180 days of inactivity.\n\n• Local app data (preferences, saved status list, SAF permission URIs) is permanently and automatically deleted when you uninstall the app.\n\n• We do not retain any payment card details. All payment data is held exclusively by Google Play (Play Store purchases) or Razorpay (Indus/other store purchases) under their respective data retention policies."
        />

        <PolicySection
          title="11. Permissions Explained"
          content="STORAGE ACCESS FRAMEWORK (SAF — Android 10+):\nUsed to read WhatsApp status files. The user manually grants access only to the WhatsApp .Statuses folder through the system folder picker. No broad photo or video library access is requested or required.\n\nWRITE_EXTERNAL_STORAGE (Android < 10):\nRequired to save statuses to the gallery on devices running Android 9 or below.\n\nGALLERY SAVE PERMISSION (Android 10+):\nWrite-only access to save statuses to your gallery. This does NOT grant access to view or read your existing photos or videos.\n\nINTERNET:\nRequired for Google Sign-In, Firebase (Auth, Firestore, FCM), Google AdMob, and payment processing (Google Play Billing or Razorpay, depending on the build).\n\nBILLING (Play Store build only):\nThe BILLING permission is required by Google Play to enable in-app purchases through Google Play Billing.\n\nPOST_NOTIFICATIONS (Android 13+):\nOptional. Required only if you choose to enable status-detection push notifications.\n\nNo permissions are requested or used beyond their explicitly stated purpose."
        />

        <PolicySection
          title="12. Children's Privacy"
          content="StatusVault is not directed to children under the age of 13. We do not knowingly collect personal information from children. Google Sign-In requires a valid Google Account, which mandates a minimum age of 13 (or the applicable minimum in your jurisdiction). If you believe a child under the minimum age is using this app, please contact us immediately and we will take steps to remove their data."
        />

        <PolicySection
          title="13. Account Security"
          content="• Sign-in is optional. Core features (viewing, saving, sharing statuses) remain available without an account.\n\n• Google Sign-In is handled entirely by Google's OAuth 2.0 infrastructure. We never store, see, or have access to your Google password.\n\n• Your Firebase UID serves as the primary key for all account-linked data. It is never shared externally.\n\n• All data in transit between the app and our servers or third-party services is encrypted with HTTPS/TLS.\n\n• In the event of a data breach materially affecting your personal data, we will notify affected users within 72 hours of becoming aware of the breach, as required by applicable law."
        />

        <PolicySection
          title="14. Disclaimer of Warranties & Individual Developer Liability"
          content="StatusVault is provided 'as is' and 'as available' without any warranty, express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement. As a beta application, the service may experience interruptions, bugs, crashes, or data inconsistencies at any time.\n\nThis application is a personal project of an individual developer. It is not a corporate product. By using this app, you expressly acknowledge this and waive any right to hold the developer personally liable for any damages, losses, or claims arising from your use of the app.\n\nWe do not warrant that:\n• The app will operate without error or interruption.\n• Statuses will always be accessible (access depends on WhatsApp's folder structure and Android OS policies which are beyond our control).\n• All subscription or ad-free features will be available 100% of the time.\n\nUse of StatusVault is entirely at your own risk. Since all media processing happens locally on your device and no user files are ever transmitted to our servers, the developer cannot be held liable for any media-related data loss."
        />

        <PolicySection
          title="15. Limitation of Liability"
          content="To the maximum extent permitted by applicable law, StatusVault, its developers, and its affiliates shall not be liable for:\n\n• Any indirect, incidental, special, consequential, or punitive damages.\n• Loss of data, revenue, or profits.\n• Any harm to your device or data resulting from use of the app.\n• Any failure or downtime of third-party services (Google Firebase, Google Play Billing, Razorpay, Google AdMob).\n• Any WhatsApp policy changes that restrict or remove access to the .Statuses folder.\n\nOur total aggregate liability to you for any claim arising from use of the Service shall not exceed the total subscription fees paid by you in the 30 days immediately preceding the claim giving rise to such liability."
        />

        <PolicySection
          title="16. WhatsApp & Meta Disclaimer"
          content="StatusVault is an independent, third-party application. It is NOT affiliated with, endorsed by, sponsored by, authorized by, or in any way connected to WhatsApp LLC, Meta Platforms Inc., or any of their subsidiaries or affiliates. 'WhatsApp' and 'WhatsApp Business' are registered trademarks of WhatsApp LLC. This app merely reads files that WhatsApp makes available in the device's storage as part of normal Android operating system behaviour. Use of this app is governed solely by this Privacy Policy."
        />

        <PolicySection
          title="17. Governing Law & Disputes"
          content="This Privacy Policy, along with any disputes, claims, or proceedings arising from your use of StatusVault, shall be exclusively governed by and construed in accordance with the laws of India, without regard to conflict-of-law principles.\n\nBy using the app, you irrevocably consent to the exclusive jurisdiction of the competent courts located in India for the resolution of any disputes.\n\nWe strongly encourage users to contact us directly to resolve any disputes informally before pursuing formal legal action."
        />

        <PolicySection
          title="18. Changes to This Policy"
          content="We may update this Privacy Policy from time to time to reflect changes in the app's features, applicable legal requirements, or our data practices. We will notify you of material changes by updating the 'Last updated' date at the top of this page. Where required by law or where changes are significant, we may provide additional notice such as a push notification or an in-app alert. Your continued use of the app after the effective date of any revision constitutes your acceptance of the updated Privacy Policy."
        />

        <PolicySection
          title="19. Contact Us"
          content="For questions, concerns, data deletion requests, or refund requests related to this Privacy Policy:\n\n• Google Play Store purchases: Use the Play Store app's built-in refund and support system, or contact Google Play Support.\n• Razorpay / other store purchases: Email ahmedsameerbinan2@gmail.com with your Razorpay Payment ID and order details.\n• All other inquiries: Contact us through the in-app support page or via the Play Store developer page. We aim to respond to all legitimate inquiries within 5 business days."
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} StatusVault. All rights reserved.{'\n'}
            Compliant with GDPR, Indian IT Act 2000, Google Play Store Policies, and Indus App Store requirements.{'\n'}
            StatusVault Beta — Policies subject to change.
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://binan-maker.github.io/StatusVault/privacy-policy/')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Read full Privacy Policy online</Text>
            </TouchableOpacity>
            <Text style={styles.footerLinkSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://binan-maker.github.io/StatusVault/terms/')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Terms &amp; Conditions</Text>
            </TouchableOpacity>
          </View>
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
    gap: SPACING.LG,
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
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    fontFamily: 'Nunito_400Regular',
  },
  betaBadge: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.SM,
    backgroundColor: COLORS.ACCENT_GOLD + '18',
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_GOLD + '44',
    padding: SPACING.MD,
  },
  betaText: {
    flex: 1,
    fontSize: FONT_SIZE.SM,
    color: COLORS.ACCENT_GOLD,
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 20,
  },
  highlight: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.SM,
    backgroundColor: COLORS.PRIMARY + '18',
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '44',
    padding: SPACING.MD,
  },
  highlightText: {
    flex: 1,
    fontSize: FONT_SIZE.MD,
    color: COLORS.TEXT,
    fontFamily: 'Nunito_600SemiBold',
    lineHeight: 22,
  },
  section: {
    gap: SPACING.SM,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  sectionContent: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 21,
    fontFamily: 'Nunito_400Regular',
  },
  footer: {
    paddingVertical: SPACING.XL,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    gap: SPACING.MD,
  },
  footerText: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Nunito_400Regular',
  },
  footerLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  footerLink: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_600SemiBold',
    textDecorationLine: 'underline',
  },
  footerLinkSep: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    fontFamily: 'Nunito_400Regular',
  },
});
