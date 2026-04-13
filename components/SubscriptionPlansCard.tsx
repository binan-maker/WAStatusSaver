import React, { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import COLORS from "@/constants/colors";
import { FONT_SIZE, RADIUS, SPACING } from "@/constants/theme";
import { useSubscriptionStatus } from "@/hooks/useSubscriptionStatus";
import { SubscriptionPlanId } from "@/shared/subscription-plans";

function formatRemaining(seconds: number, lifetime?: boolean) {
  if (lifetime) return "Lifetime active";
  const days = Math.floor(seconds / 86400);
  if (days > 0) return `${days} days left`;
  const hours = Math.floor(seconds / 3600);
  if (hours > 0) return `${hours} hours left`;
  return "Active";
}

export function SubscriptionPlansCard() {
  const [modalVisible, setModalVisible] = useState(false);
  const { plans, status, isSubscribed, remainingSeconds, payingPlanId, loading, startPayment } = useSubscriptionStatus();
  const monthlyPlan = plans.find((plan) => plan.id === "monthly");

  const handlePlanPress = async (planId: SubscriptionPlanId) => {
    const success = await startPayment(planId);
    if (success) setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity activeOpacity={0.85} onPress={() => setModalVisible(true)}>
        <LinearGradient colors={["#00FFA3", "#00D185", "#111827"]} style={styles.banner}>
          <View style={styles.bannerIcon}>
            <MaterialCommunityIcons name="crown" size={26} color="#06100C" />
          </View>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerTitle}>{isSubscribed ? "Ad-Free Active" : "Remove Ads"}</Text>
            <Text style={styles.bannerSubtitle}>
              {isSubscribed ? formatRemaining(remainingSeconds, status.lifetime) : `Only ₹${monthlyPlan?.amount || 30} for 1 month`}
            </Text>
          </View>
          {loading ? <ActivityIndicator color="#06100C" size="small" /> : <Text style={styles.bannerCta}>{isSubscribed ? "Manage" : "Subscribe"}</Text>}
        </LinearGradient>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setModalVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>Choose Subscription</Text>
                <Text style={styles.sheetSubtitle}>Payments are verified on server and saved in Firebase Firestore.</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeButton}>
                <MaterialCommunityIcons name="close" size={20} color={COLORS.TEXT} />
              </TouchableOpacity>
            </View>

            <View style={styles.securityBox}>
              <MaterialCommunityIcons name="shield-check" size={20} color={COLORS.PRIMARY} />
              <Text style={styles.securityText}>Ads unlock only after Razorpay signature, amount, order, currency, and capture status are verified.</Text>
            </View>

            {plans.map((plan) => {
              const active = status.planId === plan.id && isSubscribed;
              const paying = payingPlanId === plan.id;

              return (
                <View key={plan.id} style={[styles.planCard, active && styles.planCardActive]}>
                  <View style={styles.planTop}>
                    <View>
                      <Text style={styles.planTitle}>{plan.title}</Text>
                      <Text style={styles.planDescription}>{plan.description}</Text>
                    </View>
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{plan.badge}</Text>
                    </View>
                  </View>
                  <View style={styles.planBottom}>
                    <Text style={styles.price}>₹{plan.amount}</Text>
                    <TouchableOpacity
                      onPress={() => handlePlanPress(plan.id)}
                      disabled={Boolean(payingPlanId) || active}
                      style={[styles.payButton, active && styles.activeButton]}
                      activeOpacity={0.8}
                    >
                      {paying ? (
                        <ActivityIndicator color="#06100C" size="small" />
                      ) : (
                        <Text style={styles.payButtonText}>{active ? "Active" : "Pay with Razorpay"}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </Modal>
    </>
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
    borderColor: COLORS.BORDER_BRIGHT,
  },
  bannerIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.75)",
    alignItems: "center",
    justifyContent: "center",
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: "#06100C",
    fontSize: FONT_SIZE.XL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  bannerSubtitle: {
    color: "rgba(6,16,12,0.78)",
    fontSize: FONT_SIZE.SM,
    fontWeight: "700",
    fontFamily: "Nunito_700Bold",
    marginTop: 2,
  },
  bannerCta: {
    color: "#06100C",
    fontSize: FONT_SIZE.SM,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  sheet: {
    backgroundColor: COLORS.SURFACE,
    borderTopLeftRadius: RADIUS.LG,
    borderTopRightRadius: RADIUS.LG,
    padding: SPACING.LG,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.MD,
  },
  sheetTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.XL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
  },
  sheetSubtitle: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    lineHeight: 17,
    marginTop: 4,
    maxWidth: 280,
    fontFamily: "Nunito_400Regular",
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.SURFACE_2,
  },
  securityBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.SM,
    padding: SPACING.MD,
    borderRadius: RADIUS.MD,
    backgroundColor: COLORS.PRIMARY + "12",
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "30",
  },
  securityText: {
    flex: 1,
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    lineHeight: 17,
    fontFamily: "Nunito_400Regular",
  },
  planCard: {
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.MD,
    padding: SPACING.MD,
    gap: SPACING.MD,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  planCardActive: {
    borderColor: COLORS.PRIMARY,
  },
  planTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: SPACING.MD,
  },
  planTitle: {
    color: COLORS.TEXT,
    fontSize: FONT_SIZE.MD,
    fontWeight: "800",
    fontFamily: "Nunito_800ExtraBold",
  },
  planDescription: {
    color: COLORS.TEXT_SECONDARY,
    fontSize: FONT_SIZE.XS,
    marginTop: 3,
    fontFamily: "Nunito_400Regular",
  },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: COLORS.PRIMARY + "18",
    paddingHorizontal: SPACING.SM,
    paddingVertical: 4,
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
    justifyContent: "space-between",
    gap: SPACING.MD,
  },
  price: {
    color: COLORS.PRIMARY,
    fontSize: FONT_SIZE.XXL,
    fontWeight: "900",
    fontFamily: "Nunito_800ExtraBold",
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