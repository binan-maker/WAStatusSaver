import React from "react";
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { SubscriptionPlanId } from "@/shared/subscription-plans";

function formatRemaining(seconds: number, lifetime?: boolean) {
  if (lifetime) return "Lifetime active";
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days} days remaining`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} hours remaining`;
  return "Active now";
}

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const { user, loading: authLoading, configured, signInWithGoogle, signOut } = useFirebaseAuth();
  const { plans, status, isSubscribed, remainingSeconds, payingPlanId, loading, startPayment } = useSubscriptionStatus();

  const handlePay = async (planId: SubscriptionPlanId) => {
    if (!configured) {
      Alert.alert("Setup required", "Add Firebase and Google OAuth values to your .env file before taking payments.");
      return;
    }

    if (!user) {
      Alert.alert("Sign in required", "Please sign in with Google first so your subscription is saved safely in Firebase.");
      return;
    }

    await startPayment(planId);
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.XXL }]}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient colors={["#031F16", "#063B2B", "#0F131A"]} style={styles.hero}>
        <MaterialCommunityIcons name="crown" size={42} color={COLORS.PRIMARY} />
        <Text style={styles.heroTitle}>Remove Ads</Text>
        <Text style={styles.heroSubtitle}>Start with ₹30 for 1 month. Secure Razorpay checkout, verified on the server, saved in Firebase Firestore.</Text>
      </LinearGradient>

      <View style={styles.authCard}>
        <View style={styles.authTop}>
          <View style={styles.authIcon}>
            <MaterialCommunityIcons name="google" size={22} color={COLORS.PRIMARY} />
          </View>
          <View style={styles.authInfo}>
            <Text style={styles.cardTitle}>Google Sign In</Text>
            <Text style={styles.cardSubtitle}>
              {user ? user.email || "Signed in safely" : "Required before payment so your subscription follows your account."}
            </Text>
          </View>
        </View>
        {!configured && (
          <View style={styles.warningBox}>
            <MaterialCommunityIcons name="alert-circle-outline" size={18} color={COLORS.WARNING} />
            <Text style={styles.warningText}>Firebase and Google OAuth dummy values are present. Replace them before live payments.</Text>
          </View>
        )}
        <TouchableOpacity
          onPress={user ? signOut : signInWithGoogle}
          disabled={authLoading}
          style={[styles.googleButton, !configured && styles.disabledButton]}
          activeOpacity={0.8}
        >
          {authLoading ? (
            <ActivityIndicator color="#06100C" size="small" />
          ) : (
            <Text style={styles.googleButtonText}>{user ? "Sign Out" : "Continue with Google"}</Text>
          )}
        </TouchableOpacity>
      </View>

      {isSubscribed && (
        <View style={styles.activeBox}>
          <MaterialCommunityIcons name="shield-check" size={24} color={COLORS.PRIMARY} />
          <View style={styles.activeInfo}>
            <Text style={styles.activeTitle}>Subscription Active</Text>
            <Text style={styles.activeSubtitle}>{formatRemaining(remainingSeconds, status.lifetime)}</Text>
          </View>
        </View>
      )}

      <View style={styles.securityBox}>
        <MaterialCommunityIcons name="lock-check" size={22} color={COLORS.PRIMARY} />
        <Text style={styles.securityText}>Money-safe flow: order is created on backend, Razorpay signature is verified on backend, payment amount is checked, capture status is checked, then Firestore is updated.</Text>
      </View>

      <Text style={styles.sectionTitle}>Choose Subscription</Text>
      <View style={styles.plans}>
        {plans.map((plan) => {
          const active = status.planId === plan.id && isSubscribed;
          const paying = payingPlanId === plan.id;

          return (
            <View key={plan.id} style={[styles.planCard, active && styles.planCardActive]}>
              <View style={styles.planHeader}>
                <View style={styles.planTitleBlock}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <Text style={styles.planDescription}>{plan.description}</Text>
                </View>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              </View>
              <View style={styles.planBottom}>
                <View>
                  <Text style={styles.price}>₹{plan.amount}</Text>
                  <Text style={styles.priceNote}>{plan.durationDays ? `${plan.durationDays} days` : "Forever"}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handlePay(plan.id)}
                  disabled={Boolean(payingPlanId) || active || loading}
                  style={[styles.payButton, active && styles.activeButton]}
                  activeOpacity={0.8}
                >
                  {paying ? (
                    <ActivityIndicator color="#06100C" size="small" />
                  ) : (
                    <Text style={styles.payButtonText}>{active ? "Active" : user ? "Pay with Razorpay" : "Sign in first"}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
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
    padding: SPACING.LG,
    gap: SPACING.LG,
  },
  hero: {
    borderRadius: RADIUS.LG,
    padding: SPACING.XL,
    alignItems: "center",
    gap: SPACING.SM,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "55",
  },
  heroTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XXL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  heroSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    lineHeight: 20,
    textAlign: "center",
    fontFamily: "Nunito_400Regular",
  },
  authCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  authTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
  },
  authIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.PRIMARY + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  authInfo: {
    flex: 1,
  },
  cardTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  cardSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    lineHeight: 17,
    marginTop: 3,
    fontFamily: "Nunito_400Regular",
  },
  warningBox: {
    flexDirection: "row",
    gap: SPACING.SM,
    backgroundColor: COLORS.WARNING + "12",
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.WARNING + "33",
  },
  warningText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    lineHeight: 17,
    fontFamily: "Nunito_400Regular",
  },
  googleButton: {
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.FULL,
    alignItems: "center",
    paddingVertical: SPACING.MD,
  },
  disabledButton: {
    opacity: 0.75,
  },
  googleButtonText: {
    color: "#06100C",
    fontSize: FONT_SIZE.SM,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
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
  activeInfo: {
    flex: 1,
  },
  activeTitle: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  activeSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    fontFamily: "Nunito_400Regular",
  },
  securityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.SURFACE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  securityText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    lineHeight: 18,
    fontFamily: "Nunito_400Regular",
  },
  sectionTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  plans: {
    gap: SPACING.MD,
  },
  planCard: {
    backgroundColor: COLORS.SURFACE,
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    gap: SPACING.LG,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  planCardActive: {
    borderColor: COLORS.PRIMARY,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.MD,
  },
  planTitleBlock: {
    flex: 1,
  },
  planTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.LG,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  planDescription: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.SM,
    marginTop: 4,
    fontFamily: "Nunito_400Regular",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.PRIMARY + "18",
    paddingHorizontal: SPACING.SM,
    paddingVertical: 5,
    borderRadius: RADIUS.FULL,
  },
  badgeText: {
    color: COLORS.PRIMARY,
    fontSize: 10,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  planBottom: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.MD,
  },
  price: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.XXXL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  priceNote: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    fontFamily: "Nunito_400Regular",
  },
  payButton: {
    flex: 1,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: RADIUS.FULL,
    paddingVertical: SPACING.MD,
    alignItems: "center",
  },
  activeButton: {
    backgroundColor: COLORS.PRIMARY + "55",
  },
  payButtonText: {
    color: "#06100C",
    fontSize: FONT_SIZE.SM,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
});