import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { getAdUnitId, getGoogleMobileAdsModule } from "@/lib/ads";
import { useAds } from "@/contexts/AdsContext";
import { useThemeColors, type ThemePalette } from "@/contexts/ThemeContext";
import { CARD_SIZE, RADIUS, SPACING } from "@/constants/theme";

export function NativeAdCard() {
  const COLORS = useThemeColors();
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);
  const { isPremium, nativeAdEligible, markNativeAdShown } = useAds();
  const [loaded, setLoaded] = useState(false);
  const [adAttempted, setAdAttempted] = useState(false);
  const ads = getGoogleMobileAdsModule();
  const NativeAdView = ads?.NativeAdView;
  const NativeMediaView = ads?.NativeMediaView;
  const NativeAsset = ads?.NativeAsset;
  const NativeAssetType = ads?.NativeAssetType;
  const [nativeAd, setNativeAd] = useState<any>(null);

  useEffect(() => {
    if (isPremium || !nativeAdEligible || adAttempted || !ads?.NativeAd) return;
    setAdAttempted(true);
    let active = true;
    let loadedAd: any = null;

    const loadNativeAd = async () => {
      try {
        loadedAd = await ads.NativeAd.createForAdRequest(getAdUnitId("native"), {
          requestNonPersonalizedAdsOnly: true,
        });
        if (!active) {
          loadedAd.destroy();
          return;
        }
        setNativeAd(loadedAd);
        setLoaded(true);
        await markNativeAdShown();
      } catch {
        if (active) setLoaded(false);
      }
    };

    loadNativeAd();
    return () => {
      active = false;
      loadedAd?.destroy?.();
    };
  }, [adAttempted, ads, isPremium, markNativeAdShown, nativeAdEligible]);

  if (isPremium || !nativeAd || !NativeAdView || !loaded) return null;

  return (
    <View style={styles.tile}>
      <NativeAdView nativeAd={nativeAd} style={styles.adView}>
        <View style={styles.sponsored}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>
        {NativeMediaView && (
          <NativeMediaView style={styles.media} resizeMode="cover" />
        )}
        {NativeAsset && NativeAssetType && (
          <NativeAsset assetType={NativeAssetType.HEADLINE}>
            <Text style={styles.headline}>{nativeAd.headline}</Text>
          </NativeAsset>
        )}
        {NativeAsset && NativeAssetType && (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.tagline}>{nativeAd.body}</Text>
          </NativeAsset>
        )}
        {NativeAsset && NativeAssetType && (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        )}
      </NativeAdView>
    </View>
  );
}

const createStyles = (COLORS: ThemePalette) =>
  StyleSheet.create({
    tile: {
      width: CARD_SIZE,
      height: CARD_SIZE,
      margin: 1,
      padding: 6,
      borderRadius: RADIUS.SM,
      overflow: "hidden",
      backgroundColor: COLORS.SURFACE,
      borderWidth: 1,
      borderColor: COLORS.BORDER,
    },
    adView: {
      flex: 1,
    },
    sponsored: {
      alignSelf: "flex-start",
      paddingHorizontal: 5,
      paddingVertical: 2,
      borderRadius: 4,
      backgroundColor: COLORS.ACCENT_GOLD + "22",
    },
    sponsoredText: {
      color: COLORS.ACCENT_GOLD,
      fontSize: 8,
      fontWeight: "800",
    },
    media: {
      width: "100%",
      height: 68,
      marginTop: 5,
    },
    headline: {
      color: COLORS.TEXT,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 4,
    },
    tagline: {
      color: COLORS.TEXT_SECONDARY,
      fontSize: 9,
      marginTop: 2,
    },
    cta: {
      color: COLORS.PRIMARY,
      fontSize: 10,
      fontWeight: "800",
      marginTop: 4,
    },
  });
