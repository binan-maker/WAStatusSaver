import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import COLORS from "@/constants/colors";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { SubscriptionPlanId } from "@/shared/subscription-plans";

const FEATURES = [
  { icon: "block-helper", label: "Zero ads — completely removed" },
  { icon: "lightning-bolt", label: "Faster app experience" },
  { icon: "shield-check", label: "Payment verified server-side" },
  { icon: "cellphone-check", label: "Works on all your Android devices" },
  { icon: "refresh", label: "Subscription synced to your Google account" },
];

const WHY = [
  {
    icon: "emoticon-happy-outline",
    title: "Enjoy without interruptions",
    desc: "No banner, interstitial, or pop-up ads — ever.",
  },
  {
    icon: "lock-check",
    title: "Secure Razorpay checkout",
    desc: "UPI, cards, net banking. Never stored on our servers.",
  },
  {
    icon: "server-security",
    title: "Server-verified payment",
    desc: "Amount & signature verified on backend before activating.",
  },
];

function formatRemaining(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days} days remaining`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} hours remaining`;
  return "Active";
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, signInWithGoogle } = useFirebaseAuth();
  const {
    plans,
    status,
    isSubscribed,
    remainingSeconds,
    payingPlanId,
    loading,
    startPayment,
  } = useSubscriptionStatus();

  const pendingPlanRef = useRef<SubscriptionPlanId | null>(null);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (user && pendingPlanRef.current) {
      const plan = pendingPlanRef.current;
      pendingPlanRef.current = null;
      startPayment(plan);
    }
  }, [user]);

  const handlePay = async (planId: SubscriptionPlanId) => {
    if (!user) {
      pendingPlanRef.current = planId;
      setSigningIn(true);
      try {
        await signInWithGoogle();
      } finally {
        setSigningIn(false);
      }
      return;
    }
    await startPayment(planId);
  };

  const isBusy = Boolean(payingPlanId) || loading || signingIn || authLoading;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + SPACING.XXL },
      ]}
      showsVerticalScrollIndicator={false}
    >
      <TouchableOpacity
        style={[styles.backRow, { marginTop: insets.top + SPACING.SM }]}
        onPress={() => router.back()}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="arrow-back" size={20} color={COLORS.TEXT_SECONDARY} />
        <Text style={styles.backText}>Back</Text>
      </TouchableOpacity>

      <LinearGradient
        colors={["#031F16", "#063B2B", "#05070A"]}
        style={styles.hero}
      >
        <View style={styles.crownWrap}>
          <MaterialCommunityIcons name="crown" size={36} color={COLORS.PRIMARY} />
        </View>
        <Text style={styles.heroTitle}>Go Ad-Free</Text>
        <Text style={styles.heroSub}>
          Watch statuses without interruptions.{"\n"}One-time payment, no hidden charges.
        </Text>

        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="shield-check" size={13} color={COLORS.PRIMARY} />
            <Text style={styles.trustText}>Server Verified</Text>
          </View>
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="lock" size={13} color={COLORS.PRIMARY} />
            <Text style={styles.trustText}>Razorpay Secure</Text>
          </View>
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="google" size={13} color={COLORS.PRIMARY} />
            <Text style={styles.trustText}>Google Account</Text>
          </View>
        </View>
      </LinearGradient>

      {isSubscribed && (
        <View style={styles.activeBox}>
          <MaterialCommunityIcons name="shield-check" size={22} color={COLORS.PRIMARY} />
          <View style={{ flex: 1 }}>
            <Text style={styles.activeTitle}>Subscription Active</Text>
            <Text style={styles.activeSub}>
              {formatRemaining(remainingSeconds)}
            </Text>
          </View>
        </View>
      )}

      {user && (
        <View style={styles.accountRow}>
          <MaterialCommunityIcons name="google" size={16} color={COLORS.PRIMARY} />
          <Text style={styles.accountText} numberOfLines={1}>
            Signed in as {user.email}
          </Text>
        </View>
      )}

      <Text style={styles.sectionLabel}>What you get</Text>
      <View style={styles.featuresCard}>
        {FEATURES.map((f, i) => (
          <View key={f.label} style={[styles.featureRow, i > 0 && styles.featureRowBorder]}>
            <View style={styles.featureIcon}>
              <MaterialCommunityIcons name={f.icon as any} size={17} color={COLORS.PRIMARY} />
            </View>
            <Text style={styles.featureLabel}>{f.label}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionLabel}>Choose your plan</Text>
      <View style={styles.plans}>
        {plans.map((plan, index) => {
          const active = status.planId === plan.id && isSubscribed;
          const paying = payingPlanId === plan.id;
          const isPopular = index === 0;
          const isValue = index === 1;

          return (
            <View
              key={plan.id}
              style={[
                styles.planCard,
                active && styles.planCardActive,
                isValue && styles.planCardHighlight,
              ]}
            >
              {isValue && (
                <View style={styles.popularStrip}>
                  <Text style={styles.popularStripText}>⭐ Best Value</Text>
                </View>
              )}

              <View style={[styles.planTop, isValue && styles.planTopWithStrip]}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planDesc}>{plan.description}</Text>
                </View>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{plan.badge}</Text>
                </View>
              </View>

              <View style={styles.planPriceRow}>
                <Text style={styles.priceSymbol}>₹</Text>
                <Text style={styles.priceAmount}>{plan.amount}</Text>
                <Text style={styles.pricePer}>
                  {plan.durationDays ? ` / ${plan.durationDays} days` : " forever"}
                </Text>
              </View>

              <TouchableOpacity
                onPress={() => handlePay(plan.id)}
                disabled={isBusy || active}
                style={[
                  styles.payButton,
                  active && styles.payButtonActive,
                  isValue && !active && styles.payButtonHighlight,
                ]}
                activeOpacity={0.82}
              >
                {paying || (signingIn && pendingPlanRef.current === plan.id) ? (
                  <ActivityIndicator color="#06100C" size="small" />
                ) : active ? (
                  <>
                    <MaterialCommunityIcons name="check-circle" size={16} color={COLORS.PRIMARY} />
                    <Text style={[styles.payButtonText, styles.payButtonActiveText]}>Active Plan</Text>
                  </>
                ) : (
                  <>
                    <MaterialCommunityIcons name="credit-card-outline" size={16} color="#06100C" />
                    <Text style={styles.payButtonText}>Pay ₹{plan.amount}</Text>
                  </>
                )}
              </TouchableOpacity>

              {!user && !active && (
                <Text style={styles.signInHint}>
                  Tap to sign in with Google, then pay instantly
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Why subscribe?</Text>
      <View style={styles.whyCard}>
        {WHY.map((w, i) => (
          <View key={w.title} style={[styles.whyRow, i > 0 && styles.whyRowBorder]}>
            <View style={styles.whyIconWrap}>
              <MaterialCommunityIcons name={w.icon as any} size={20} color={COLORS.PRIMARY} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.whyTitle}>{w.title}</Text>
              <Text style={styles.whyDesc}>{w.desc}</Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.footer}>
        <MaterialCommunityIcons name="lock-check" size={14} color={COLORS.TEXT_MUTED} />
        <Text style={styles.footerText}>
          Payments are handled securely by Razorpay. StatusVault does not store or process your financial data. Amount & signature verified on our server before activation. Subscription synced to your Google account across reinstalls.{"\n\n"}
          Refund window: 48 hours for monthly & yearly plans, 7 days for the 2-year plan — only for verified app failures. All plans have a fixed expiry date; access continues until the end of your paid period.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  content: {
    paddingHorizontal: SPACING.LG,
    gap: SPACING.LG,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.XS,
    alignSelf: "flex-start",
  },
  backText: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_600SemiBold",
  },
  hero: {
    borderRadius: RADIUS.LG,
    padding: SPACING.XL,
    alignItems: "center",
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "40",
  },
  crownWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.PRIMARY + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.XS,
  },
  heroTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XXL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.5,
  },
  heroSub: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    lineHeight: 21,
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
  },
  trustRow: {
    flexDirection: "row",
    gap: SPACING.SM,
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: SPACING.XS,
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.PRIMARY + "14",
    paddingHorizontal: SPACING.SM,
    paddingVertical: 5,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "30",
  },
  trustText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
  },
  activeBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
    backgroundColor: COLORS.PRIMARY + "12",
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "44",
  },
  activeTitle: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  activeSub: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_400Regular",
    marginTop: 2,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SM,
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.MD,
    paddingHorizontal: SPACING.MD,
    paddingVertical: SPACING.SM + 2,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  accountText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_400Regular",
  },
  sectionLabel: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.LG,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: -SPACING.SM,
  },
  featuresCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: "hidden",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD + 2,
  },
  featureRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.PRIMARY + "14",
    alignItems: "center",
    justifyContent: "center",
  },
  featureLabel: {
    flex: 1,
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_600SemiBold",
  },
  plans: {
    gap: SPACING.MD,
  },
  planCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: "hidden",
  },
  planCardActive: {
    borderColor: COLORS.PRIMARY,
  },
  planCardHighlight: {
    borderColor: COLORS.PRIMARY + "55",
    backgroundColor: COLORS.SURFACE_2,
  },
  popularStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.PRIMARY + "1A",
    paddingVertical: 5,
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY + "30",
  },
  popularStripText: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },
  planTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.SM,
  },
  planTopWithStrip: {
    marginTop: 22,
  },
  planTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.LG,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  planDesc: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    marginTop: 3,
  },
  planBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.PRIMARY + "18",
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: RADIUS.FULL,
  },
  planBadgeText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 2,
  },
  priceSymbol: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.LG,
    fontFamily: "Nunito_600SemiBold",
    paddingBottom: 3,
  },
  priceAmount: {
    color: COLORS.TEXT,
    fontSize: 40,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
    lineHeight: 46,
  },
  pricePer: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_400Regular",
    paddingBottom: 6,
  },
  payButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.SM,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.FULL,
    paddingVertical: SPACING.MD + 2,
  },
  payButtonHighlight: {
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  payButtonActive: {
    backgroundColor: COLORS.SURFACE_3,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "55",
  },
  payButtonText: {
    color: "#06100C",
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  payButtonActiveText: {
    color: COLORS.PRIMARY,
  },
  signInHint: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    marginTop: -SPACING.XS,
  },
  whyCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    overflow: "hidden",
  },
  whyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.MD,
    paddingHorizontal: SPACING.LG,
    paddingVertical: SPACING.MD + 2,
  },
  whyRowBorder: {
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  whyIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.PRIMARY + "14",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  whyTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.SM,
    fontWeight: "900",
    fontFamily: "Nunito_700Bold",
    marginBottom: 3,
  },
  whyDesc: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    lineHeight: 17,
  },
  footer: {
    flexDirection: "row",
    gap: SPACING.SM,
    alignItems: "flex-start",
    paddingVertical: SPACING.SM,
  },
  footerText: {
    flex: 1,
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    lineHeight: 17,
    fontFamily: "Nunito_400Regular",
  },
});
