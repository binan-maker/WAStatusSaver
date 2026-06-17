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
import { router } from 'expo-router';
import { useThemeColors, type ThemePalette } from '@/contexts/ThemeContext';
import { SPACING, FONT_SIZE, RADIUS } from '@/constants/theme';

interface SectionProps {
  title: string;
  content: string;
}

function Section({ title, content }: SectionProps) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionContent}>{content}</Text>
    </View>
  );
}

export default function TermsScreen() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={22} color={COLORS.TEXT} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms &amp; Conditions</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Ionicons name="document-text-outline" size={18} color={COLORS.PRIMARY} />
            <Text style={styles.heroBadgeText}>Legal Document</Text>
          </View>
          <Text style={styles.heroTitle}>Terms &amp; Conditions</Text>
          <Text style={styles.heroMeta}>Last updated: June 17, 2026 · App version 1.4.0</Text>
        </View>

        <View style={styles.highlight}>
          <Text style={styles.highlightText}>
            By downloading or using StatusVault, you agree to these Terms. Please read them carefully.
          </Text>
        </View>

        <Section
          title="1. Who We Are"
          content="StatusVault is an independent Android application developed by Binan. The app allows users to view and save WhatsApp and WhatsApp Business status media on Android devices. StatusVault is not affiliated with, endorsed by, or connected to WhatsApp LLC or Meta Platforms Inc."
        />

        <Section
          title="2. Permitted Use"
          content="You may use StatusVault for personal, non-commercial purposes only. You agree not to copy, modify, distribute, or reverse-engineer the app. You are solely responsible for ensuring you have permission to save and share any status media, and for complying with WhatsApp's Terms of Service and applicable copyright laws."
        />

        <Section
          title="3. Disclaimer of Warranties"
          content={"StatusVault is provided 'as is' without warranties of any kind. We do not guarantee uninterrupted or error-free operation. The app's ability to access WhatsApp statuses depends on WhatsApp's storage behaviour, which is outside our control and may change with WhatsApp updates."}
        />

        <Section
          title="4. Limitation of Liability"
          content="To the maximum extent permitted by law, the Developer shall not be liable for any indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid to us in the 12 months preceding the claim."
        />

        <Section
          title="5. Governing Law"
          content="These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of Indian courts. Consumer disputes may also be addressed through India's National Consumer Disputes Redressal Commission (NCDRC)."
        />

        <Section
          title="6. Contact Us"
          content={"Developer: Binan\nApp: StatusVault (com.binan.statussaver)\nEmail: ahmedsameerbinan2@gmail.com\nResponse time: Within 7 working days\n\nGrievance Officer (India): Binan — reachable at the above email per the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021."}
        />

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            © 2026 StatusVault · Not affiliated with WhatsApp LLC or Meta Platforms Inc.
          </Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={() => Linking.openURL('https://binan-maker.github.io/StatusVault/terms/')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Read full Terms online</Text>
            </TouchableOpacity>
            <Text style={styles.footerLinkSep}>·</Text>
            <TouchableOpacity onPress={() => Linking.openURL('https://binan-maker.github.io/StatusVault/privacy-policy/')} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Privacy Policy</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
    backgroundColor: COLORS.SURFACE,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: FONT_SIZE.LG,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
  },
  content: {
    padding: SPACING.LG,
    paddingBottom: 60,
  },
  hero: {
    alignItems: 'center',
    marginBottom: SPACING.XL,
  },
  heroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.PRIMARY + '18',
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + '30',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 12,
  },
  heroBadgeText: {
    fontSize: FONT_SIZE.XS,
    fontWeight: '700',
    color: COLORS.PRIMARY,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    textAlign: 'center',
    marginBottom: 6,
  },
  heroMeta: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
  },
  highlight: {
    backgroundColor: COLORS.PRIMARY + '12',
    borderLeftWidth: 3,
    borderLeftColor: COLORS.PRIMARY,
    borderRadius: RADIUS.SM,
    padding: SPACING.MD,
    marginBottom: SPACING.XL,
  },
  highlightText: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT,
    lineHeight: 20,
  },
  section: {
    marginBottom: SPACING.XL,
  },
  sectionTitle: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '800',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_800ExtraBold',
    marginBottom: SPACING.SM,
  },
  sectionContent: {
    fontSize: FONT_SIZE.SM,
    color: COLORS.TEXT_SECONDARY,
    lineHeight: 22,
  },
  footer: {
    marginTop: SPACING.XL,
    paddingTop: SPACING.LG,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
    alignItems: 'center',
    gap: SPACING.MD,
  },
  footerText: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 18,
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
  },
});
