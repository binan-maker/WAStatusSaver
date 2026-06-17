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
          <Text style={styles.heroSub}>Last updated: June 17, 2026</Text>
        </View>

        <View style={styles.highlight}>
          <Ionicons name="lock-closed" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.highlightText}>
            StatusVault is 100% offline. No accounts. No ads. No data collection. Everything stays on your device.
          </Text>
        </View>

        <PolicySection
          title="1. Introduction"
          content="StatusVault is a WhatsApp Status Saver app for Android developed by Binan. This Privacy Policy explains how the app works with respect to your data. The short version: we collect nothing, store nothing on any server, and never send your data anywhere."
        />

        <PolicySection
          title="2. Data We Collect"
          content="None.\n\nStatusVault does not collect, transmit, store, or share any personal data. There are no accounts, no sign-in, no analytics, no crash reporting, and no tracking of any kind.\n\nYour preferences (language, onboarding status) are stored only on your own device using Android's local storage and are never sent anywhere."
        />

        <PolicySection
          title="3. Internet Access"
          content="StatusVault does not require an internet connection and does not make any network requests.\n\nThe INTERNET permission is declared in the manifest only as a technical requirement for certain Android system APIs and will not be used to transmit any data from your device."
        />

        <PolicySection
          title="4. Storage Access"
          content="StatusVault requires storage access solely to:\n\n• Read WhatsApp status files from the WhatsApp .Statuses folder on your device.\n• Save selected statuses to your device gallery under the 'StatusVault' album.\n• Cache media thumbnails in the app's own private storage folder for faster loading.\n\nThe app only accesses the WhatsApp .Statuses folder and its own private app directory. It cannot and does not access your messages, chats, contacts, photos, or any other storage locations."
        />

        <PolicySection
          title="5. Permissions Explained"
          content="STORAGE ACCESS FRAMEWORK (Android 11+):\nYou grant access to the WhatsApp Media folder through the standard Android system folder-picker. The app explicitly does NOT request READ_MEDIA_IMAGES, READ_MEDIA_VIDEO, or READ_MEDIA_VISUAL_USER_SELECTED — those are blocked in the manifest so the app cannot access your general photo gallery.\n\nWRITE_EXTERNAL_STORAGE (Android 9 and below only):\nUsed to save statuses to your gallery on older Android versions. Ignored on Android 10+.\n\nINTERNET:\nDeclared for technical Android API reasons only. No network requests are made.\n\nVIBRATE:\nUsed for short haptic taps on buttons only."
        />

        <PolicySection
          title="6. Third-Party Services"
          content="None.\n\nStatusVault does not use any third-party SDKs, analytics services, advertising networks, or crash-reporting tools. No data leaves your device."
        />

        <PolicySection
          title="7. Children's Privacy"
          content="StatusVault does not collect any data from any user, including children. The app is safe for all ages in that regard. However, users should ensure they have permission from a parent or guardian before downloading any app."
        />

        <PolicySection
          title="8. Disclaimer of Warranties"
          content={"StatusVault is provided 'as is' without warranties of any kind. The app's ability to access WhatsApp statuses depends on WhatsApp's storage behavior and Android OS policies, which are outside our control and may change with updates to either. Use of the app is entirely at your own risk."}
        />

        <PolicySection
          title="9. WhatsApp & Meta Disclaimer"
          content="StatusVault is an independent, third-party application. It is NOT affiliated with, endorsed by, or connected to WhatsApp LLC or Meta Platforms Inc. 'WhatsApp' is a registered trademark of WhatsApp LLC. This app only reads files that WhatsApp makes available in device storage as part of normal Android behavior."
        />

        <PolicySection
          title="10. Governing Law"
          content="This Privacy Policy is governed by the laws of India. Any disputes shall be subject to the jurisdiction of Indian courts."
        />

        <PolicySection
          title="11. Changes to This Policy"
          content="We may update this policy if the app's features change. The 'Last updated' date at the top will always reflect the most recent version. Continued use of the app after an update means you accept the revised policy."
        />

        <PolicySection
          title="12. Contact"
          content={"Developer: Binan\nApp: StatusVault (com.binan.statussaver)\nEmail: ahmedsameerbinan2@gmail.com\nResponse time: Within 7 working days"}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} StatusVault. All rights reserved.{'\n'}
            Compliant with GDPR, Indian IT Act 2000, and Google Play Store Policies.
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://binan-maker.github.io/StatusVault/privacy-policy/')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Read online</Text>
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
    alignItems: 'center',
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
