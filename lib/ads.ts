import { Platform } from "react-native";
import mobileAds, {
  AdEventType,
  BannerAd,
  BannerAdSize,
  InterstitialAd,
  NativeAd,
  NativeAsset,
  NativeAssetType,
  NativeAdEventType,
  NativeAdView,
  NativeMediaView,
  RewardedAd,
  RewardedAdEventType,
} from "react-native-google-mobile-ads";

const GOOGLE_TEST_AD_UNIT_IDS = new Set([
  "ca-app-pub-3940256099942544/6300978111",
  "ca-app-pub-3940256099942544/1033173712",
  "ca-app-pub-3940256099942544/5224354917",
  "ca-app-pub-3940256099942544/2247696110",
]);

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

const googleMobileAdsModule =
  Platform.OS === "web"
    ? null
    : {
        mobileAds,
        BannerAd,
        BannerAdSize,
        InterstitialAd,
        RewardedAd,
        AdEventType,
        RewardedAdEventType,
        NativeAd,
        NativeAdEventType,
        NativeAdView,
        NativeMediaView,
        NativeAsset,
        NativeAssetType,
      };

/**
 * This is an optional bridge. Expo web does not ship
 * the native Google Mobile Ads module, so the app must remain usable there.
 */
export function getGoogleMobileAdsModule(): typeof googleMobileAdsModule {
  return googleMobileAdsModule;
}

export function isNativeAdsAvailable(): boolean {
  if (Platform.OS === "web") return false;
  const ads = getGoogleMobileAdsModule();
  return Boolean(ads && ads.mobileAds);
}

export function getAdUnitId(type: AdUnitType): string {
  const envKey = `EXPO_PUBLIC_ADMOB_${type.toUpperCase()}_UNIT_ID`;
  const configuredId = (process.env as Record<string, string | undefined>)[
    envKey
  ]?.trim();
  if (configuredId && GOOGLE_TEST_AD_UNIT_IDS.has(configuredId)) {
    throw new Error(
      `Google test AdMob ${type} unit ID is not allowed. Replace ${envKey} with a real AdMob unit ID.`,
    );
  }
  if (configuredId) return configuredId;
  throw new Error(
    `AdMob ${type} ad unit is not configured. Add a real ${envKey} before building.`,
  );
}

export async function initializeGoogleMobileAds(): Promise<string | null> {
  const ads = getGoogleMobileAdsModule();
  if (!ads?.mobileAds) return null;

  try {
    await ads.mobileAds().initialize();
    return null;
  } catch {
    return "Google Mobile Ads could not initialize. Check the native AdMob app ID and network connection.";
  }
}

export async function showInterstitialAd(): Promise<AdResult> {
  const ads = getGoogleMobileAdsModule();
  if (!ads?.InterstitialAd || !ads?.AdEventType) {
    return {
      success: false,
      kind: "unsupported",
      message: "Interstitial ads are only available in the native app.",
    };
  }

  return new Promise((resolve) => {
    let completed = false;
    let loaded = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let interstitial: ReturnType<
      typeof ads.InterstitialAd.createForAdRequest
    >;
    try {
      interstitial = ads.InterstitialAd.createForAdRequest(
        getAdUnitId("interstitial"),
        { requestNonPersonalizedAdsOnly: true },
      );
    } catch (error) {
      resolve({
        success: false,
        kind: "not_configured",
        message:
          error instanceof Error
            ? error.message
            : "The interstitial ad is not configured.",
      });
      return;
    }
    const subscriptions: Array<() => void> = [];

    const finish = (result: AdResult) => {
      if (completed) return;
      completed = true;
      if (timeout) clearTimeout(timeout);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      resolve(result);
    };

    const eventTypes = ads.AdEventType;
    if (eventTypes.LOADED) {
      subscriptions.push(
        interstitial.addAdEventListener(eventTypes.LOADED, () => {
          loaded = true;
          interstitial
            .show()
            .catch(() =>
              finish({
                success: false,
                kind: "show_failed",
                message: "The interstitial ad could not be shown.",
              }),
            );
        }),
      );
    }
    if (eventTypes.CLOSED) {
      subscriptions.push(
        interstitial.addAdEventListener(eventTypes.CLOSED, () =>
          finish(
            loaded
              ? { success: true, kind: "shown" }
              : {
                  success: false,
                  kind: "load_failed",
                  message: "The interstitial ad closed before it loaded.",
                },
          ),
        ),
      );
    }
    if (eventTypes.ERROR) {
      subscriptions.push(
        interstitial.addAdEventListener(eventTypes.ERROR, (error: unknown) =>
          finish({
            success: false,
            kind: "load_failed",
            message: "No interstitial ad is available right now.",
            code: getAdErrorCode(error),
          }),
        ),
      );
    }

    try {
      interstitial.load();
    } catch {
      finish({
        success: false,
        kind: "load_failed",
        message: "The interstitial ad could not start loading.",
      });
    }
    timeout = setTimeout(
      () =>
        finish({
          success: false,
          kind: "timeout",
          message: "The interstitial ad took too long to load.",
        }),
      20000,
    );
  });
}

export async function showRewardedAd(): Promise<AdResult> {
  const ads = getGoogleMobileAdsModule();
  if (!ads?.RewardedAd || !ads?.RewardedAdEventType) {
    return {
      success: false,
      kind: "unsupported",
      message: "Rewarded ads are only available in the native app.",
    };
  }

  return new Promise((resolve) => {
    let completed = false;
    let earnedReward = false;
    let rewarded: any;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      rewarded = ads.RewardedAd.createForAdRequest(getAdUnitId("rewarded"), {
        requestNonPersonalizedAdsOnly: true,
      });
    } catch (error) {
      resolve({
        success: false,
        kind: "not_configured",
        message:
          error instanceof Error
            ? error.message
            : "The rewarded ad is not configured.",
      });
      return;
    }
    const subscriptions: Array<() => void> = [];

    const finish = (result: AdResult) => {
      if (completed) return;
      completed = true;
      if (timeout) clearTimeout(timeout);
      subscriptions.forEach((unsubscribe) => unsubscribe());
      resolve(result);
    };

    const eventTypes = {
      ...ads.RewardedAdEventType,
      CLOSED: ads.AdEventType.CLOSED,
      ERROR: ads.AdEventType.ERROR,
    };
    if (eventTypes.LOADED) {
      subscriptions.push(
        rewarded.addAdEventListener(eventTypes.LOADED, () => {
          rewarded.show().catch(() =>
            finish({
              success: false,
              kind: "show_failed",
              message: "The rewarded ad could not be shown.",
            }),
          );
        }),
      );
    }
    if (eventTypes.EARNED_REWARD) {
      subscriptions.push(
        rewarded.addAdEventListener(eventTypes.EARNED_REWARD, () => {
          earnedReward = true;
        }),
      );
    }
    if (eventTypes.CLOSED) {
      subscriptions.push(
        rewarded.addAdEventListener(eventTypes.CLOSED, () =>
          finish(
            earnedReward
              ? { success: true, kind: "earned" }
              : {
                  success: false,
                  kind: "dismissed",
                  message: "The ad was closed before the reward was earned.",
                },
          ),
        ),
      );
    }
    if (eventTypes.ERROR) {
      subscriptions.push(
        rewarded.addAdEventListener(eventTypes.ERROR, (error: unknown) =>
          finish({
            success: false,
            kind: "load_failed",
            message: "No rewarded ad is available right now.",
            code: getAdErrorCode(error),
          }),
        ),
      );
    }

    try {
      rewarded.load();
    } catch {
      finish({
        success: false,
        kind: "load_failed",
        message: "The rewarded ad could not start loading.",
      });
    }
    timeout = setTimeout(
      () =>
        finish({
          success: false,
          kind: "timeout",
          message: "The rewarded ad took too long to load.",
        }),
      30000,
    );
  });
}

function getAdErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}
