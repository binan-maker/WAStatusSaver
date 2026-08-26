import React, { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAds } from "@/contexts/AdsContext";
import { useThemeColors, type ThemePalette } from "@/contexts/ThemeContext";
import { RADIUS, SPACING } from "@/constants/theme";

export function RewardedAdOffer() {
  const COLORS = useThemeColors();
  const styles = createStyles(COLORS);
  const { isPremium, isAdsReady, canWatchRewarded, watchRewardedAd } = useAds();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  if (isPremium || !isAdsReady || !canWatchRewarded) return null;

  const handleWatch = async () => {
    if (loading) return;
    setLoading(true);
    setMessage("");
    const success = await watchRewardedAd();
    setLoading(false);
    setMessage(
      success ? "Premium unlocked for 24 hours" : "Ad unavailable right now",
    );
  };

  return (
    <View style={styles.card}>
      <View style={styles.iconWrap}>
        <Ionicons name="sparkles" size={18} color={COLORS.ACCENT_GOLD} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>
          Watch an ad, unlock Premium for 24 hours
        </Text>
        <Text style={styles.subtitle}>
          Optional. Enjoy ad-free saving for the rest of today.
        </Text>
        {!!message && <Text style={styles.message}>{message}</Text>}
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={handleWatch}
        disabled={loading}
        activeOpacity={0.82}
        accessibilityRole="button"
        accessibilityLabel="Watch an ad to unlock premium for 24 hours"
      >
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.BACKGROUND} />
        ) : (
          <Ionicons name="play" size={14} color={COLORS.BACKGROUND} />
        )}
      </TouchableOpacity>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) =>
  StyleSheet.create({
    card: {
      marginHorizontal: SPACING.LG,
      marginBottom: SPACING.SM,
      padding: SPACING.MD,
      borderRadius: RADIUS.MD,
      borderWidth: 1,
      borderColor: COLORS.ACCENT_GOLD + "55",
      backgroundColor: COLORS.SURFACE,
      flexDirection: "row",
      alignItems: "center",
      gap: SPACING.SM,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.ACCENT_GOLD + "18",
    },
    copy: {
      flex: 1,
      gap: 2,
    },
    title: {
      color: COLORS.TEXT,
      fontSize: 13,
      fontWeight: "800",
    },
    subtitle: {
      color: COLORS.TEXT_SECONDARY,
      fontSize: 11,
      lineHeight: 15,
    },
    message: {
      color: COLORS.SUCCESS,
      fontSize: 11,
      fontWeight: "700",
    },
    button: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: COLORS.ACCENT_GOLD,
    },
  });
