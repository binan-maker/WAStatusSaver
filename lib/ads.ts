import { Platform } from "react-native";
import mobileAds, { InterstitialAd, RewardedAd, AdEventType, RewardedAdEventType } from 'react-native-google-mobile-ads';

/**
 * Google test IDs are intentionally used until the app's AdMob account IDs
 * are supplied. They are safe for development and must be replaced before
 * publishing a production build.
 */
export const ADMOB_TEST_APP_IDS = {
  android: "ca-app-pub-3940256099942544~3347511713",
  ios: "ca-app-pub-3940256099942544~1458002511",
} as const;

export const ADMOB_TEST_UNIT_IDS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917",
  native: "ca-app-pub-3940256099942544/2247696110",
} as const;

export type AdUnitType = keyof typeof ADMOB_TEST_UNIT_IDS;

/**
 * This is an optional bridge. Expo web does not ship
 * the native Google Mobile Ads module, so the app must remain usable there.
 */
export function getGoogleMobileAdsModule(): any | null {
  if (Platform.OS === "web") return null;
  
  // Return the statically imported components packaged safely
  return {
    mobileAds,
    InterstitialAd,
    RewardedAd,
    AdEventType,
    RewardedAdEventType
  };
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
  ];
  return configuredId || ADMOB_TEST_UNIT_IDS[type];
}

export async function initializeGoogleMobileAds(): Promise<void> {
  const ads = getGoogleMobileAdsModule();
  if (!ads?.mobileAds) return;

  try {
    await ads.mobileAds().initialize();
  } catch {
    // Ad initialization must never block media access or app startup.
  }
}

export async function showInterstitialAd(): Promise<boolean> {
  const ads = getGoogleMobileAdsModule();
  if (!ads?.InterstitialAd || !ads?.AdEventType) return false;

  return new Promise((resolve) => {
    let completed = false;
    let loaded = false;
    const interstitial = ads.InterstitialAd.createForAdRequest(
      getAdUnitId("interstitial"),
      { requestNonPersonalizedAdsOnly: true },
    );
    const subscriptions: Array<() => void> = [];

    const finish = (shown: boolean) => {
      if (completed) return;
      completed = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      resolve(shown);
    };

    const eventTypes = ads.AdEventType;
    if (eventTypes.LOADED) {
      subscriptions.push(
        interstitial.addAdEventListener(eventTypes.LOADED, () => {
          loaded = true;
          interstitial.show().catch(() => finish(false));
        }),
      );
    }
    if (eventTypes.CLOSED) {
      subscriptions.push(
        interstitial.addAdEventListener(eventTypes.CLOSED, () =>
          finish(loaded),
        ),
      );
    }
    if (eventTypes.ERROR) {
      subscriptions.push(
        interstitial.addAdEventListener(eventTypes.ERROR, () => finish(false)),
      );
    }

    interstitial.load();
    setTimeout(() => finish(false), 20000);
  });
}

export async function showRewardedAd(): Promise<boolean> {
  const ads = getGoogleMobileAdsModule();
  if (!ads?.RewardedAd || !ads?.RewardedAdEventType) return false;

  return new Promise((resolve) => {
    let completed = false;
    let earnedReward = false;
    const rewarded = ads.RewardedAd.createForAdRequest(
      getAdUnitId("rewarded"),
      { requestNonPersonalizedAdsOnly: true },
    );
    const subscriptions: Array<() => void> = [];

    const finish = (rewardedSuccessfully: boolean) => {
      if (completed) return;
      completed = true;
      subscriptions.forEach((unsubscribe) => unsubscribe());
      resolve(rewardedSuccessfully);
    };

    const eventTypes = ads.RewardedAdEventType;
    if (eventTypes.LOADED) {
      subscriptions.push(
        rewarded.addAdEventListener(eventTypes.LOADED, () => {
          rewarded.show().catch(() => finish(false));
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
          finish(earnedReward),
        ),
      );
    }
    if (eventTypes.ERROR) {
      subscriptions.push(
        rewarded.addAdEventListener(eventTypes.ERROR, () => finish(false)),
      );
    }

    rewarded.load();
    setTimeout(() => finish(false), 30000);
  });
}
