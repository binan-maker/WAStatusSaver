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
  const HeadlineView = ads?.HeadlineView;
  const TaglineView = ads?.TaglineView;
  const CallToActionView = ads?.CallToActionView;
  const MediaView = ads?.MediaView;
  const nativeAd = useMemo(() => {
    if (isPremium || !ads?.NativeAd || (!nativeAdEligible && !adAttempted))
      return null;
    return ads.NativeAd.createForAdRequest(getAdUnitId("native"), {
      requestNonPersonalizedAdsOnly: true,
    });
  }, [adAttempted, ads, isPremium, nativeAdEligible]);

  useEffect(() => {
    if (!nativeAd || adAttempted) return;
    setAdAttempted(true);
    const loadedEvent = ads.NativeAdEventType?.LOADED;
    const errorEvent = ads.NativeAdEventType?.ERROR;
    const subscriptions: Array<() => void> = [];

    if (loadedEvent) {
      subscriptions.push(
        nativeAd.addAdEventListener(loadedEvent, () => {
          setLoaded(true);
          markNativeAdShown();
        }),
      );
    }
    if (errorEvent) {
      subscriptions.push(
        nativeAd.addAdEventListener(errorEvent, () => setLoaded(false)),
      );
    }
    nativeAd.load();

    return () => subscriptions.forEach((unsubscribe) => unsubscribe());
  }, [adAttempted, ads, markNativeAdShown, nativeAd]);

  if (isPremium || !nativeAd || !NativeAdView || !loaded) return null;

  return (
    <View style={styles.tile}>
      <NativeAdView nativeAd={nativeAd} style={styles.adView}>
        <View style={styles.sponsored}>
          <Text style={styles.sponsoredText}>Sponsored</Text>
        </View>
        {MediaView && <MediaView style={styles.media} />}
        {HeadlineView && <HeadlineView style={styles.headline} />}
        {TaglineView && <TaglineView style={styles.tagline} />}
        {CallToActionView && <CallToActionView style={styles.cta} />}
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
