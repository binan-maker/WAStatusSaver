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
  const lastUpdated = 'June 17, 2026';

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
            StatusVault is currently in Beta. Features and policies may evolve. By using this app, you acknowledge and accept its beta status.
          </Text>
        </View>

        <View style={styles.highlight}>
          <Ionicons name="lock-closed" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.highlightText}>
            Your media always stays on your device. StatusVault is free, contains no ads, and requires no account to use core features.
          </Text>
        </View>

        <PolicySection
          title="1. Introduction"
          content="StatusVault ('we', 'our', 'the app', 'the Service') is a WhatsApp Status Saver application for Android devices. This Privacy Policy explains what data we collect, why we collect it, how it is used, and your rights as a user. By downloading, installing, or using StatusVault, you agree to this Privacy Policy. If you do not agree, you must immediately uninstall and cease use of the app.\n\nThis app is currently in Beta. All features, services, and policies are subject to change without prior notice beyond updating this document. Continued use of the app after updates constitutes acceptance of the revised policy."
        />

        <PolicySection
          title="2. Data We Collect"
          content="Depending on the features you use, we may collect the following information:\n\n• Google Account Information (if you sign in): Your email address, display name, and profile photo, provided via Google Sign-In (OAuth 2.0) and stored securely in Firebase Authentication.\n\n• Device Identifier: A unique anonymous device ID (UUID) generated on first launch, used for referral tracking and verification.\n\n• App Preferences: Language selection, notification preferences, and onboarding completion, stored locally on your device via AsyncStorage.\n\nWe do NOT collect: WhatsApp messages, chats, contacts, call logs, location data, or any biometric data."
        />

        <PolicySection
          title="3. How We Use Your Data"
          content="We use collected data strictly for the following purposes:\n\n• Authentication: To identify your account and maintain a persistent login session across app restarts.\n\n• Service Improvement: Anonymous, aggregated usage data may be reviewed internally to improve app stability and performance.\n\nWe do NOT sell, rent, trade, or share your personal data with any third party for marketing or advertising purposes."
        />

        <PolicySection
          title="4. Storage Access"
          content="StatusVault requires storage access solely to:\n\n• Read WhatsApp status files from the WhatsApp .Statuses directory on your device.\n• Save selected statuses to your device gallery under the 'StatusVault' album.\n• Cache media files within the app's own private directory for performance.\n\nWe only access the WhatsApp .Statuses folder and the app's private storage directory. We cannot and do not access WhatsApp messages, chats, contacts, or any folders outside those explicitly granted by you through the system permissions dialog or Storage Access Framework (SAF)."
        />

        <PolicySection
          title="5. Internet Usage & Third-Party Services"
          content="StatusVault's core features (viewing, saving, sharing statuses) work fully offline. Internet is only used for the optional Google Sign-In feature:\n\n• Firebase Authentication (Google): Manages secure user login and persistent session storage.\n\nAll communications with third-party services are encrypted using HTTPS/TLS."
        />

        <PolicySection
          title="6. Data Retention & Deletion"
          content="• Account data (email, display name) is retained for as long as your account remains active.\n\n• If you sign out and wish your data deleted, contact us via the Play Store developer page. Firebase Authentication entries are removed promptly.\n\n• Local app data (preferences, saved status list, SAF permission URIs) is permanently and automatically deleted when you uninstall the app.\n\nSign-in is optional. Core features (viewing, saving, sharing statuses) remain fully available without an account."
        />

        <PolicySection
          title="7. Permissions Explained"
          content="The following is the COMPLETE list of permissions StatusVault uses. Anything not listed here is NOT requested by the app.\n\nSTORAGE ACCESS FRAMEWORK (SAF — Android 10+):\nNot a permission per se but the standard user-driven mechanism by which you grant access to the WhatsApp Media folder via the system folder picker. StatusVault explicitly DOES NOT request the broad media-library permissions READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, or READ_MEDIA_VISUAL_USER_SELECTED — those are blocked at the manifest level so the app cannot, even in principle, access your full gallery.\n\nWRITE_EXTERNAL_STORAGE (Android < 10):\nRequired to save statuses to the gallery on devices running Android 9 or below. On Android 10+ this is silently ignored — gallery saves use scoped MediaStore APIs.\n\nINTERNET (always granted):\nRequired for optional Google Sign-In and Firebase Authentication only.\n\nVIBRATE:\nUsed for short haptic taps on a few buttons; never used for any tracking purpose.\n\nNo permissions are requested or used beyond their explicitly stated purpose. The app explicitly BLOCKS the following permissions at the manifest level so they cannot be granted even by accident: READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, READ_MEDIA_AUDIO, READ_MEDIA_VISUAL_USER_SELECTED, RECORD_AUDIO, SYSTEM_ALERT_WINDOW."
        />

        <PolicySection
          title="8. Children's Privacy"
          content="StatusVault is not directed to children under the age of 13. We do not knowingly collect personal information from children. Google Sign-In requires a valid Google Account, which mandates a minimum age of 13 (or the applicable minimum in your jurisdiction). If you believe a child under the minimum age is using this app, please contact us immediately and we will take steps to remove their data."
        />

        <PolicySection
          title="9. Account Security"
          content="• Sign-in is optional. Core features (viewing, saving, sharing statuses) remain available without an account.\n\n• Google Sign-In is handled entirely by Google's OAuth 2.0 infrastructure. We never store, see, or have access to your Google password.\n\n• Your Firebase UID serves as the primary key for all account-linked data. It is never shared externally.\n\n• All data in transit between the app and our servers or third-party services is encrypted with HTTPS/TLS.\n\n• In the event of a data breach materially affecting your personal data, we will notify affected users within 72 hours of becoming aware of the breach, as required by applicable law."
        />

        <PolicySection
          title="10. Disclaimer of Warranties & Individual Developer Liability"
          content="StatusVault is provided 'as is' and 'as available' without any warranty, express or implied. As a beta application, the service may experience interruptions, bugs, crashes, or data inconsistencies at any time.\n\nThis application is a personal project of an individual developer. It is not a corporate product. By using this app, you expressly acknowledge this and waive any right to hold the developer personally liable for any damages, losses, or claims arising from your use of the app.\n\nWe do not warrant that the app will operate without error or interruption, or that statuses will always be accessible (access depends on WhatsApp's folder structure and Android OS policies which are beyond our control).\n\nUse of StatusVault is entirely at your own risk."
        />

        <PolicySection
          title="11. Limitation of Liability"
          content="To the maximum extent permitted by applicable law, StatusVault, its developers, and its affiliates shall not be liable for:\n\n• Any indirect, incidental, special, consequential, or punitive damages.\n• Loss of data, revenue, or profits.\n• Any harm to your device or data resulting from use of the app.\n• Any failure or downtime of third-party services (Google Firebase).\n• Any WhatsApp policy changes that restrict or remove access to the .Statuses folder."
        />

        <PolicySection
          title="12. WhatsApp & Meta Disclaimer"
          content="StatusVault is an independent, third-party application. It is NOT affiliated with, endorsed by, sponsored by, authorized by, or in any way connected to WhatsApp LLC, Meta Platforms Inc., or any of their subsidiaries or affiliates. 'WhatsApp' and 'WhatsApp Business' are registered trademarks of WhatsApp LLC. This app merely reads files that WhatsApp makes available in the device's storage as part of normal Android operating system behaviour. Use of this app is governed solely by this Privacy Policy."
        />

        <PolicySection
          title="13. Governing Law & Disputes"
          content="This Privacy Policy, along with any disputes, claims, or proceedings arising from your use of StatusVault, shall be exclusively governed by and construed in accordance with the laws of India, without regard to conflict-of-law principles.\n\nBy using the app, you irrevocably consent to the exclusive jurisdiction of the competent courts located in India for the resolution of any disputes.\n\nWe strongly encourage users to contact us directly to resolve any disputes informally before pursuing formal legal action."
        />

        <PolicySection
          title="14. Changes to This Policy"
          content="We may update this Privacy Policy from time to time to reflect changes in the app's features, applicable legal requirements, or our data practices. We will notify you of material changes by updating the 'Last updated' date at the top of this page. Your continued use of the app after the effective date of any revision constitutes your acceptance of the updated Privacy Policy."
        />

        <PolicySection
          title="15. Contact Us"
          content="For questions, concerns, or data deletion requests related to this Privacy Policy:\n\n• Email: ahmedsameerbinan2@gmail.com\n• Response time: Within 7 working days\n• Grievance Officer (India): Binan — reachable at the above email per the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021."
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} StatusVault. All rights reserved.{'\n'}
            Compliant with GDPR, Indian IT Act 2000, and Google Play Store Policies.{'\n'}
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
