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
import { PaymentSuccessModal } from "@/components/PaymentSuccessModal";

const PERKS = [
  { icon: "block-helper", label: "Zero ads" },
  { icon: "lightning-bolt", label: "Faster experience" },
  { icon: "cellphone-check", label: "All your devices" },
  { icon: "shield-check", label: "Secure payment" },
];

function formatRemaining(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days}`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours}h`;
  return "Active";
}

function formatRemainingUnit(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return days === 1 ? "day left" : "days left";
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return "hours left";
  return "";
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
    paymentJustSucceeded,
    successPlanId,
    isRecoveringPayment,
    dismissPaymentSuccess,
    providerName,
  } = useSubscriptionStatus();

  const isGooglePlay = providerName === "google-play";

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

  const successPlan = plans.find(p => p.id === successPlanId);
  const successRemainingDays = Math.floor(remainingSeconds / 86400);

  return (
    <>
      <PaymentSuccessModal
        visible={paymentJustSucceeded}
        planTitle={successPlan?.title ?? "Pro"}
        remainingDays={successRemainingDays}
        onDismiss={dismissPaymentSuccess}
      />
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

        {/* ── Recovering payment banner ─────────────────────────────── */}
        {isRecoveringPayment && !isSubscribed && (
          <View style={styles.recoveryBanner}>
            <ActivityIndicator size="small" color={COLORS.ACCENT_GOLD} />
            <View style={styles.recoveryTextWrap}>
              <Text style={styles.recoveryTitle}>Payment Activating…</Text>
              <Text style={styles.recoverySub}>
                Your previous payment was received. Pro access will activate automatically — you will NOT be charged again.
              </Text>
            </View>
          </View>
        )}

        {/* ── Hero ──────────────────────────────────────────────────── */}
        <LinearGradient
          colors={["#031F16", "#063B2B", "#05070A"]}
          style={styles.hero}
        >
          <View style={styles.crownWrap}>
            <MaterialCommunityIcons name="crown" size={40} color={COLORS.PRIMARY} />
          </View>
          <Text style={styles.heroTitle}>StatusVault Pro</Text>
          <Text style={styles.heroSub}>
            No ads. No interruptions.{"\n"}One payment, unlimited peace.
          </Text>

          {/* Perks pills */}
          <View style={styles.perksRow}>
            {PERKS.map(p => (
              <View key={p.label} style={styles.perkPill}>
                <MaterialCommunityIcons name={p.icon as any} size={12} color={COLORS.PRIMARY} />
                <Text style={styles.perkText}>{p.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* ── Active Pro card ───────────────────────────────────────── */}
        {isSubscribed && (
          <LinearGradient
            colors={["#041E14", "#073D2C", "#041E14"]}
            style={styles.activeCard}
          >
            <View style={styles.activeCardInner}>
              <View style={styles.activeLeft}>
                <View style={styles.activeCrownWrap}>
                  <MaterialCommunityIcons name="crown" size={28} color={COLORS.PRIMARY} />
                </View>
                <View>
                  <Text style={styles.activeLabel}>Pro Member</Text>
                  <Text style={styles.activeName}>StatusVault Pro</Text>
                </View>
              </View>
              <View style={styles.activeRight}>
                <Text style={styles.activeBigNum}>{formatRemaining(remainingSeconds)}</Text>
                <Text style={styles.activeDayUnit}>{formatRemainingUnit(remainingSeconds)}</Text>
              </View>
            </View>
            <Text style={styles.activeNote}>Ads removed · Stacks when you extend</Text>
          </LinearGradient>
        )}

        {/* ── Signed-in account ────────────────────────────────────── */}
        {user && (
          <View style={styles.accountRow}>
            <MaterialCommunityIcons name="google" size={15} color={COLORS.PRIMARY} />
            <Text style={styles.accountText} numberOfLines={1} ellipsizeMode="middle">
              {user.email}
            </Text>
          </View>
        )}

        {/* ── Plans ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>Choose a plan</Text>
        <View style={styles.plans}>
          {plans.map((plan, index) => {
            const isCurrentPlan = status.planId === plan.id && isSubscribed;
            const paying = payingPlanId === plan.id;
            const isValue = index === 1;
            const periodLabel =
              plan.id === "monthly" ? "/mo" : plan.id === "yearly" ? "/yr" : `/${plan.durationDays}d`;

            return (
              <View
                key={plan.id}
                style={[
                  styles.planCard,
                  isCurrentPlan && styles.planCardActive,
                  isValue && styles.planCardHighlight,
                ]}
              >
                {isValue && (
                  <View style={styles.bestStrip}>
                    <MaterialCommunityIcons name="star-four-points" size={10} color={COLORS.PRIMARY} />
                    <Text style={styles.bestStripText}>Best Value</Text>
                  </View>
                )}

                <View style={[styles.planBody, isValue && { marginTop: 34 }]}>
                  {/* Left: title + price */}
                  <View style={styles.planLeft}>
                    <Text style={styles.planTitle} numberOfLines={1}>{plan.title}</Text>
                    <View style={styles.priceRow}>
                      <Text style={styles.priceSymbol}>₹</Text>
                      <Text style={styles.priceAmount}>{plan.amount}</Text>
                      <Text style={styles.pricePeriod}>{periodLabel}</Text>
                    </View>
                  </View>

                  {/* Right: badge or current indicator */}
                  {isCurrentPlan ? (
                    <View style={styles.activeBadge}>
                      <MaterialCommunityIcons name="check-circle" size={11} color={COLORS.PRIMARY} />
                      <Text style={styles.activeBadgeText}>Active</Text>
                    </View>
                  ) : (
                    <View style={styles.planBadge}>
                      <Text style={styles.planBadgeText}>{plan.badge}</Text>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  onPress={() => handlePay(plan.id)}
                  disabled={isBusy}
                  style={[
                    styles.payBtn,
                    isSubscribed && styles.payBtnExtend,
                    isValue && !isSubscribed && styles.payBtnHighlight,
                  ]}
                  activeOpacity={0.82}
                >
                  {paying || (signingIn && pendingPlanRef.current === plan.id) ? (
                    <ActivityIndicator
                      color={isSubscribed ? COLORS.PRIMARY : "#06100C"}
                      size="small"
                    />
                  ) : isSubscribed ? (
                    <>
                      <MaterialCommunityIcons name="plus-circle-outline" size={15} color={COLORS.PRIMARY} />
                      <Text style={[styles.payBtnText, { color: COLORS.PRIMARY }]}>
                        Extend · +{plan.durationDays} days
                      </Text>
                    </>
                  ) : (
                    <>
                      <MaterialCommunityIcons name="credit-card-outline" size={15} color="#06100C" />
                      <Text style={styles.payBtnText}>Get Pro · ₹{plan.amount}</Text>
                    </>
                  )}
                </TouchableOpacity>

                {!user && !isSubscribed && (
                  <Text style={styles.hintText}>Sign in with Google, then pay instantly</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Trust footer ─────────────────────────────────────────── */}
        <View style={styles.trustRow}>
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="lock" size={12} color={COLORS.TEXT_MUTED} />
            <Text style={styles.trustText}>{isGooglePlay ? "Google Play Secure" : "Razorpay Secure"}</Text>
          </View>
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="shield-check" size={12} color={COLORS.TEXT_MUTED} />
            <Text style={styles.trustText}>Server Verified</Text>
          </View>
          <View style={styles.trustBadge}>
            <MaterialCommunityIcons name="refresh" size={12} color={COLORS.TEXT_MUTED} />
            <Text style={styles.trustText}>No Auto-Renewal</Text>
          </View>
        </View>

        <Text style={styles.legalText}>
          {isGooglePlay
            ? "Payments handled by Google Play. Fixed expiry, no auto-renewal. Refunds subject to Google Play refund policy."
            : "Payments handled by Razorpay. Fixed expiry, no auto-renewal. 48-hour refund window on yearly plan for verified app failures only."}
        </Text>
      </ScrollView>
    </>
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

  /* Hero */
  hero: {
    borderRadius: RADIUS.LG,
    paddingVertical: SPACING.XL + 4,
    paddingHorizontal: SPACING.XL,
    alignItems: "center",
    gap: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "35",
  },
  crownWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.PRIMARY + "18",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.XS,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "30",
  },
  heroTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XXL,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.5,
  },
  heroSub: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
  },
  perksRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.SM,
    justifyContent: "center",
    marginTop: SPACING.XS,
  },
  perkPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.PRIMARY + "12",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "28",
  },
  perkText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
  },

  /* Active Pro card */
  activeCard: {
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    borderWidth: 1.5,
    borderColor: COLORS.PRIMARY + "55",
    gap: SPACING.SM,
  },
  activeCardInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  activeLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
    flex: 1,
  },
  activeCrownWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.PRIMARY + "18",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "40",
  },
  activeLabel: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_700Bold",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  activeName: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.LG,
    fontFamily: "Nunito_800ExtraBold",
  },
  activeRight: {
    alignItems: "flex-end",
  },
  activeBigNum: {
    color: COLORS.PRIMARY,
    fontSize: 42,
    fontFamily: "Nunito_800ExtraBold",
    lineHeight: 46,
    letterSpacing: -1,
  },
  activeDayUnit: {
    color: COLORS.PRIMARY + "AA",
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_600SemiBold",
    textAlign: "right",
  },
  activeNote: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
  },

  /* Account */
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

  /* Section label */
  sectionLabel: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.LG,
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: -SPACING.XS,
  },

  /* Plan cards */
  plans: {
    gap: SPACING.MD,
  },
  planCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    paddingHorizontal: SPACING.LG,
    paddingBottom: SPACING.LG,
    paddingTop: SPACING.LG,
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

  /* Best value strip */
  bestStrip: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    backgroundColor: COLORS.PRIMARY + "1C",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.PRIMARY + "30",
  },
  bestStripText: {
    color: COLORS.PRIMARY,
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
  },

  /* Plan body */
  planBody: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.SM,
  },
  planLeft: {
    flex: 1,
    gap: 2,
  },
  planTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.LG,
    fontFamily: "Nunito_800ExtraBold",
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 1,
  },
  priceSymbol: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.MD,
    fontFamily: "Nunito_600SemiBold",
    paddingBottom: 4,
  },
  priceAmount: {
    color: COLORS.TEXT,
    fontSize: 38,
    fontFamily: "Nunito_800ExtraBold",
    lineHeight: 42,
    letterSpacing: -1,
  },
  pricePeriod: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_400Regular",
    paddingBottom: 5,
  },
  planBadge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.PRIMARY + "14",
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "30",
  },
  planBadgeText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
  },
  activeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: COLORS.PRIMARY + "18",
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "50",
  },
  activeBadgeText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontFamily: "Nunito_700Bold",
  },

  /* Pay button */
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.SM,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.FULL,
    paddingVertical: SPACING.MD + 2,
  },
  payBtnHighlight: {
    shadowColor: COLORS.PRIMARY,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 10,
  },
  payBtnExtend: {
    backgroundColor: COLORS.SURFACE_3,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "55",
  },
  payBtnText: {
    color: "#06100C",
    fontSize: FONT_SIZE.MD,
    fontFamily: "Nunito_800ExtraBold",
  },
  hintText: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    marginTop: -SPACING.XS,
  },

  /* Trust row */
  trustRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.SM,
    flexWrap: "wrap",
  },
  trustBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: COLORS.SURFACE,
    paddingHorizontal: SPACING.SM,
    paddingVertical: 5,
    borderRadius: RADIUS.FULL,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  trustText: {
    color: COLORS.TEXT_MUTED,
    fontSize: 10,
    fontFamily: "Nunito_600SemiBold",
  },

  /* Legal */
  legalText: {
    color: COLORS.TEXT_MUTED,
    fontSize: FONT_SIZE.XS,
    lineHeight: 17,
    fontFamily: "Nunito_400Regular",
    textAlign: "center",
    paddingHorizontal: SPACING.SM,
    marginTop: -SPACING.SM,
  },

  /* Payment recovery banner */
  recoveryBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.SM,
    backgroundColor: COLORS.ACCENT_GOLD + "18",
    borderRadius: RADIUS.MD,
    borderWidth: 1,
    borderColor: COLORS.ACCENT_GOLD + "55",
    padding: SPACING.MD,
    marginBottom: SPACING.SM,
  },
  recoveryTextWrap: {
    flex: 1,
    gap: 3,
  },
  recoveryTitle: {
    color: COLORS.ACCENT_GOLD,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_700Bold",
  },
  recoverySub: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
    lineHeight: 18,
  },
});
