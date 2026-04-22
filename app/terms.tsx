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

function PricingRow({ plan, duration, price, note }: { plan: string; duration: string; price: string; note?: string }) {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  return (
    <View style={styles.priceRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.priceRowPlan}>{plan}</Text>
        <Text style={styles.priceRowDuration}>{duration}</Text>
        {note && <Text style={styles.priceRowNote}>{note}</Text>}
      </View>
      <Text style={styles.priceRowAmount}>{price}</Text>
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
          <Text style={styles.heroMeta}>Last updated: April 22, 2026 · App version 1.3.7</Text>
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

        <Text style={styles.sectionTitle}>3. Subscription Pricing</Text>
        <Text style={[styles.sectionContent, { marginBottom: SPACING.SM }]}>
          All prices are in Indian Rupees (INR), inclusive of taxes. Subscriptions are one-time payments — nothing auto-renews.
        </Text>
        <View style={styles.pricingCard}>
          <PricingRow plan="Monthly" duration="30 days" price="₹29" note="Remove all ads" />
          <View style={styles.priceRowDivider} />
          <PricingRow plan="3 Months" duration="90 days" price="₹79" note="Ad-free for 3 months" />
          <View style={styles.priceRowDivider} />
          <PricingRow plan="Yearly" duration="365 days" price="₹149" note="Full year + priority support" />
        </View>
        <Text style={[styles.sectionContent, { marginTop: SPACING.SM }]}>
          If you purchase while an existing subscription is active, the new duration stacks on top — you never lose a day you paid for.
        </Text>

        <Section
          title="4. Refund & Cancellation Policy"
          content={"All sales are final as digital goods cannot be returned.\n\nGoogle Play Store purchases: Refunds are subject to Google Play's standard refund policy. You can request a refund directly from the Play Store app within 48 hours of purchase (Play Store → Profile → Payments & subscriptions → Order history). For issues beyond 48 hours, contact us with your Google Order ID.\n\nIndus App Store / other store purchases (Razorpay): We will issue a refund if:\n• You were charged but Pro was not activated (contact us within 7 days with your Razorpay Payment ID)\n• You were charged twice for the same period\n• The app is non-functional on your device and we cannot resolve it within 14 days\n\nRefund requests (Razorpay): Email ahmedsameerbinan2@gmail.com with your order ID, payment ID, and reason. Approved refunds are processed within 7–10 business days."}
        />

        <Section
          title="5. Payment Processing"
          content={"StatusVault uses different payment systems depending on which app store you installed it from:\n\n• Google Play Store: Payments are handled entirely by Google Play Billing. Google processes the transaction and issues a receipt to your Gmail. We never receive your card or UPI details. Purchases appear on your Google Play account.\n\n• Indus App Store / Other stores: Payments are processed by Razorpay Software Private Limited, an RBI-licensed payment aggregator. We never store your card number, UPI PIN, or bank credentials. Accepted methods: UPI, credit/debit cards, net banking, and wallets.\n\nIn both cases, subscription status is verified server-side and stored in Firebase Firestore linked to your Firebase UID."}
        />

        <Section
          title="6. Advertisements"
          content="The free tier displays advertisements served by Google AdMob. By using the free tier, you acknowledge and consent to ad display. Ads are fully removed for the duration of an active Pro subscription, an active rewarded-ad bonus period, or any free-Pro time earned through the Invite & Earn ladder or an influencer / giveaway code."
        />

        <Section
          title="7. Invite & Earn and Influencer Codes"
          content={"Personal invite codes: Every signed-in user automatically receives a unique 6-character invite code. Inviting friends advances you up the Reward Ladder — 3 friends grant 48 hours of free Pro, 10 friends grant 1 week, 50 friends grant 1 month, 100 friends grant 3 months, and 500 friends grant 1.5 years (548 days). Earned days STACK on top of any existing Pro time and are credited automatically once the friend signs in.\n\nInfluencer / giveaway codes: Limited-quantity codes distributed by partners can be redeemed once per user from the Subscription screen. Each code grants the duration set by the campaign (commonly 90 days). Codes cannot be redeemed if you already have an active Pro subscription, and one device fingerprint can only redeem a given code once.\n\nFraud protection: Self-referral, duplicate-account abuse, and chargeback abuse will result in revocation of any free-Pro time granted and may lead to a permanent ban from future code redemption. We reserve the right to retire, suspend, or change reward thresholds at any time; existing earned-Pro days are not retroactively reduced."}
        />

        <Section
          title="8. Disclaimer of Warranties"
          content={"StatusVault is provided 'as is' without warranties of any kind. We do not guarantee uninterrupted or error-free operation. The app's ability to access WhatsApp statuses depends on WhatsApp's storage behaviour, which is outside our control and may change with WhatsApp updates."}
        />

        <Section
          title="9. Limitation of Liability"
          content="To the maximum extent permitted by law, the Developer shall not be liable for any indirect, incidental, or consequential damages. Our total liability for any claim shall not exceed the amount you paid to us in the 12 months preceding the claim."
        />

        <Section
          title="10. Governing Law"
          content="These Terms are governed by the laws of India. Disputes shall be subject to the exclusive jurisdiction of Indian courts. Consumer disputes may also be addressed through India's National Consumer Disputes Redressal Commission (NCDRC)."
        />

        <Section
          title="11. Contact Us"
          content={"Developer: Binan\nApp: StatusVault (com.binan.statussaver)\nEmail: ahmedsameerbinan2@gmail.com\nResponse time: Within 7 working days\n\nGrievance Officer (India): Binan — reachable at the above email per the IT (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021.\n\nFor Google Play billing disputes: Use the Play Store app or contact Google Play Support.\nFor Razorpay billing disputes: Contact Razorpay Support at razorpay.com/support."}
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
  pricingCard: {
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
    marginVertical: SPACING.SM,
  },
  priceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.MD,
  },
  priceRowDivider: {
    height: 1,
    backgroundColor: COLORS.BORDER,
  },
  priceRowPlan: {
    fontSize: FONT_SIZE.MD,
    fontWeight: '700',
    color: COLORS.TEXT,
    fontFamily: 'Nunito_700Bold',
  },
  priceRowDuration: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_MUTED,
    marginTop: 1,
  },
  priceRowNote: {
    fontSize: FONT_SIZE.XS,
    color: COLORS.TEXT_SECONDARY,
    marginTop: 2,
  },
  priceRowAmount: {
    fontSize: 22,
    fontWeight: '900',
    color: COLORS.PRIMARY,
    fontFamily: 'Nunito_800ExtraBold',
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
