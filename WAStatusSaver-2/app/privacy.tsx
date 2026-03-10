import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '@/constants/colors';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface SectionProps {
  title: string;
  content: string;
}

function PolicySection({ title, content }: SectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );
}

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const lastUpdated = 'February 2025';

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

        <View style={styles.highlight}>
          <Ionicons name="lock-closed" size={18} color={COLORS.PRIMARY} />
          <Text style={styles.highlightText}>
            StatusVault is a fully offline application. We do not collect, store, or transmit any personal data.
          </Text>
        </View>

        <PolicySection
          title="1. Introduction"
          content="StatusVault ('we', 'our', 'app') is a WhatsApp Status Saver application for Android. This Privacy Policy explains how we handle information when you use our app. By using StatusVault, you agree to this policy."
        />

        <PolicySection
          title="2. Data We Do NOT Collect"
          content="StatusVault does not collect any personal information. We do not collect:\n\n• Your name, email, or contact information\n• WhatsApp messages, calls, or chats\n• Contacts or phone numbers\n• Location data\n• Device identifiers or analytics\n• Usage statistics or behavior data\n\nAll media is processed locally on your device only."
        />

        <PolicySection
          title="3. Storage Access"
          content="StatusVault requires storage access solely to:\n\n• Read WhatsApp status files from the .Statuses directory\n• Save selected statuses to your device gallery\n• Create a local backup of saved statuses\n\nWe only access the WhatsApp .Statuses folder. We cannot and do not access WhatsApp messages, chats, or any other folders."
        />

        <PolicySection
          title="4. Local Data Storage"
          content="StatusVault stores the following data locally on your device only:\n\n• A list of statuses you have saved (stored in app's private directory)\n• The SAF (Storage Access Framework) folder URI you granted\n• User preferences (stored in app's private storage)\n\nThis data never leaves your device and is deleted when you uninstall the app."
        />

        <PolicySection
          title="5. Advertising"
          content="StatusVault displays advertisements via Google AdMob. AdMob may collect certain data in accordance with Google's Privacy Policy. This may include:\n\n• Advertising ID (Android)\n• Device information for ad targeting\n• App usage for frequency capping\n\nYou can opt out of personalized ads in your device settings:\nSettings → Google → Ads → Opt out of Ads Personalization.\n\nFor Google's full privacy policy, visit: policies.google.com/privacy"
        />

        <PolicySection
          title="6. Third-Party Services"
          content="StatusVault uses the following third-party services:\n\n• Google AdMob — for displaying advertisements\n\nAll other functionality is performed locally on your device without any network requests."
        />

        <PolicySection
          title="7. Permissions Explained"
          content="READ_EXTERNAL_STORAGE / READ_MEDIA_IMAGES / READ_MEDIA_VIDEO:\nRequired to detect and display WhatsApp statuses from the .Statuses folder.\n\nWRITE_EXTERNAL_STORAGE (Android < 10):\nRequired to save statuses to the gallery on older devices.\n\nSTORAGE ACCESS FRAMEWORK (Android 11+):\nRequired for the user to manually grant access to the WhatsApp .Statuses folder on newer Android versions.\n\nNo permissions are used beyond their stated purpose."
        />

        <PolicySection
          title="8. Children's Privacy"
          content="StatusVault is not directed to children under the age of 13. We do not knowingly collect any information from children. If you believe a child is using this app inappropriately, please contact us."
        />

        <PolicySection
          title="9. Play Store Compliance"
          content="This app complies with Google Play Store Developer Program Policies, including:\n\n• Honest disclosure of permissions usage\n• No collection of sensitive user data\n• Compliance with Families Policy\n• No deceptive behavior\n\nThis app is also compliant with Indus App Store (IndiStore) privacy requirements."
        />

        <PolicySection
          title="10. Disclaimer"
          content="StatusVault is an independent application and is NOT affiliated with, endorsed by, or connected to WhatsApp LLC, Meta Platforms Inc., or any of their subsidiaries. 'WhatsApp' is a trademark of WhatsApp LLC. Use of this app is at your own risk."
        />

        <PolicySection
          title="11. Changes to This Policy"
          content="We may update this Privacy Policy from time to time. We will notify you of any significant changes by updating the 'Last updated' date at the top of this page. Continued use of the app after changes constitutes acceptance of the updated policy."
        />

        <PolicySection
          title="12. Contact Us"
          content="If you have questions about this Privacy Policy or the app, you can reach us through the Play Store developer page or the app's support page."
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} StatusVault. All rights reserved.{'\n'}
            This policy is compliant with GDPR, Google Play Store, and Indus App Store requirements.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
    alignItems: 'center',
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
  },
  footerText: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 18,
    fontFamily: 'Nunito_400Regular',
  },
});
