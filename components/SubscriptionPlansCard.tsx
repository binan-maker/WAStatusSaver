import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";

function formatRemaining(seconds: number) {
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days} days left`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} hours left`;
  return "Active";
}

export function SubscriptionPlansCard() {
  const { plans, isSubscribed, remainingSeconds, loading } = useSubscriptionStatus();
  const monthlyPlan = plans.find((plan) => plan.id === "monthly");

  return (
    <TouchableOpacity activeOpacity={0.85} onPress={() => router.push("/subscription")}>
      <LinearGradient colors={["#031F16", "#063B2B", "#0F131A"]} style={styles.banner}>
        <View style={styles.bannerIcon}>
          <MaterialCommunityIcons name="crown" size={26} color={COLORS.PRIMARY} />
        </View>
        <View style={styles.bannerContent}>
          <Text style={styles.bannerTitle}>{isSubscribed ? "Ad-Free Active" : "Remove Ads"}</Text>
          <Text style={styles.bannerSubtitle}>
            {isSubscribed ? formatRemaining(remainingSeconds) : `Only ₹${monthlyPlan?.amount || 30} for 1 month`}
          </Text>
        </View>
        {loading ? <ActivityIndicator color={COLORS.PRIMARY} size="small" /> : <Text style={styles.bannerCta}>{isSubscribed ? "Manage" : "Subscribe"}</Text>}
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: RADIUS.LG,
    padding: SPACING.LG,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "66",
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.PRIMARY + "18",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  bannerSubtitle: {
    color: COLORS.PRIMARY_LIGHT,
    fontSize: FONT_SIZE.MD,
    fontWeight: "900",
    fontFamily: "Nunito_700Bold",
    marginTop: 2,
  },
  bannerCta: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.SM,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
});