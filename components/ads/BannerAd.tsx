import React, { useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";
import { useAds } from "@/contexts/AdsContext";
import { getAdUnitId, getGoogleMobileAdsModule } from "@/lib/ads";
import { useThemeColors, type ThemePalette } from "@/contexts/ThemeContext";
import { SPACING } from "@/constants/theme";

export function BannerAdSlot() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { isAdFree } = useAds();
  const [loaded, setLoaded] = useState(false);
  const ads = getGoogleMobileAdsModule();
  const BannerAd = ads?.BannerAd;
  const BannerAdSize = ads?.BannerAdSize;

  if (
    Platform.OS === "web" ||
    isAdFree ||
    !BannerAd ||
    !BannerAdSize
  ) {
    return null;
  }

  let unitId: string;
  try {
    unitId = getAdUnitId("banner");
  } catch {
    return null;
  }

  return (
    <View style={[styles.container, loaded && styles.visible]}>
      <BannerAd
        unitId={unitId}
        size={BannerAdSize.BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={() => setLoaded(false)}
      />
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) =>
  StyleSheet.create({
    container: {
      minHeight: 0,
      alignItems: "center",
      overflow: "hidden",
      backgroundColor: COLORS.BACKGROUND,
    },
    visible: {
      minHeight: 50,
      paddingVertical: SPACING.XS,
    },
  });