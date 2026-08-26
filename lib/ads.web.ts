import { Platform } from "react-native";

export type AdUnitType = "banner" | "interstitial" | "rewarded" | "native";

export type AdResult =
  | { success: true; kind: "earned" | "shown" }
  | {
      success: false;
      kind:
        | "unsupported"
        | "not_configured"
        | "load_failed"
        | "show_failed"
        | "dismissed"
        | "timeout";
      message: string;
      code?: string;
    };

/**
 * Google Mobile Ads is native-only. Keeping this web implementation separate
 * prevents Metro from bundling native codegen modules into the web preview.
 */
export function getGoogleMobileAdsModule(): null {
  return null;
}

export function isNativeAdsAvailable(): boolean {
  return false;
}

export function getAdUnitId(type: AdUnitType): string {
  const envKey = `EXPO_PUBLIC_ADMOB_${type.toUpperCase()}_UNIT_ID`;
  const configuredId = (process.env as Record<string, string | undefined>)[
    envKey
  ]?.trim();
  if (configuredId) return configuredId;
  throw new Error(
    `AdMob ${type} ads are only available in the native app.`,
  );
}

export async function initializeGoogleMobileAds(): Promise<string | null> {
  return Platform.OS === "web"
    ? null
    : "Google Mobile Ads are unavailable on this platform.";
}

export async function showInterstitialAd(): Promise<AdResult> {
  return {
    success: false,
    kind: "unsupported",
    message: "Interstitial ads are only available in the native app.",
  };
}

export async function showRewardedAd(): Promise<AdResult> {
  return {
    success: false,
    kind: "unsupported",
    message: "Rewarded ads are only available in the native app.",
  };
}