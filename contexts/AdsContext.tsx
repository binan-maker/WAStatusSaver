import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getGoogleMobileAdsModule,
  initializeGoogleMobileAds,
  isNativeAdsAvailable,
  showInterstitialAd,
  showRewardedAd,
} from "@/lib/ads";

const STORAGE_KEY = "@statusvault_ads_state";
const DOWNLOADS_PER_INTERSTITIAL = 10;
const MAX_INTERSTITIALS_PER_DAY = 2;
const REWARDED_ACCESS_MS = 24 * 60 * 60 * 1000;

type DailyState = {
  date: string;
  downloads: number;
  interstitials: number;
  totalAds: number;
  rewardedShown: boolean;
  nativeShown: boolean;
};

type StoredAdsState = {
  isPremium: boolean;
  premiumSource?: "purchase" | "development";
  rewardedAccessExpiresAt: number;
  daily: DailyState;
};

type AdsContextValue = {
  isPremium: boolean;
  isAdFree: boolean;
  isAdsReady: boolean;
  dailyDownloads: number;
  rewardedAccessExpiresAt: number;
  canWatchRewarded: boolean;
  nativeAdEligible: boolean;
  watchRewardedAd: () => Promise<boolean>;
  trackDownload: () => Promise<void>;
  markNativeAdShown: () => Promise<void>;
  enablePremiumForDevelopment: () => Promise<void>;
  disablePremiumForDevelopment: () => Promise<void>;
};

const AdsContext = createContext<AdsContextValue | null>(null);

function dayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyDaily(): DailyState {
  return {
    date: dayKey(),
    downloads: 0,
    interstitials: 0,
    totalAds: 0,
    rewardedShown: false,
    nativeShown: false,
  };
}

function normalizeStoredState(
  value: Partial<StoredAdsState> | null,
): StoredAdsState {
  const daily = value?.daily?.date === dayKey() ? value.daily : emptyDaily();

  return {
    isPremium: value?.isPremium === true,
    premiumSource: value?.premiumSource,
    rewardedAccessExpiresAt: Number(value?.rewardedAccessExpiresAt || 0),
    daily: {
      ...emptyDaily(),
      ...daily,
    },
  };
}

export function AdsProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<StoredAdsState>(() =>
    normalizeStoredState(null),
  );
  const [hydrated, setHydrated] = useState(false);
  const [adsReady, setAdsReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY),
      initializeGoogleMobileAds(),
    ]).then(([stored]) => {
      if (!active) return;
      try {
        const parsed = stored
          ? (JSON.parse(stored) as Partial<StoredAdsState>)
          : null;
        setState(normalizeStoredState(parsed));
      } catch {
        setState(normalizeStoredState(null));
      }
      setAdsReady(Boolean(getGoogleMobileAdsModule()));
      setHydrated(true);
    });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const isRewardedAccessActive = state.rewardedAccessExpiresAt > Date.now();
  const isAdFree = state.isPremium || isRewardedAccessActive;

  const watchRewardedAd = useCallback(async () => {
    if (
      !hydrated ||
      state.isPremium ||
      state.daily.rewardedShown ||
      state.daily.totalAds >= 2
    )
      return false;

    const successful = await showRewardedAd();
    if (!successful) return false;

    setState((previous) => ({
      ...previous,
      rewardedAccessExpiresAt: Date.now() + REWARDED_ACCESS_MS,
      daily: {
        ...previous.daily,
        rewardedShown: true,
        totalAds: previous.daily.totalAds + 1,
      },
    }));
    return true;
  }, [hydrated, state.isPremium, state.daily.rewardedShown]);

  const trackDownload = useCallback(async () => {
    if (!hydrated || isAdFree) return;

    const nextDownloads = state.daily.downloads + 1;
    const shouldShowInterstitial =
      nextDownloads % DOWNLOADS_PER_INTERSTITIAL === 0 &&
      state.daily.interstitials < MAX_INTERSTITIALS_PER_DAY &&
      state.daily.totalAds < 2;
    setState((previous) => {
      return {
        ...previous,
        daily: {
          ...previous.daily,
          downloads: nextDownloads,
          interstitials: shouldShowInterstitial
            ? previous.daily.interstitials + 1
            : previous.daily.interstitials,
          totalAds: shouldShowInterstitial
            ? previous.daily.totalAds + 1
            : previous.daily.totalAds,
        },
      };
    });

    // Let the save interaction settle before interrupting it with an ad.
    if (shouldShowInterstitial) {
      await new Promise<void>((resolve) => setTimeout(resolve, 250));
      await showInterstitialAd();
    }
  }, [hydrated, isAdFree, state.daily.downloads, state.daily.interstitials]);

  const markNativeAdShown = useCallback(async () => {
    if (
      !hydrated ||
      isAdFree ||
      state.daily.nativeShown ||
      state.daily.totalAds >= 2
    )
      return;
    setState((previous) => ({
      ...previous,
      daily: {
        ...previous.daily,
        nativeShown: true,
        totalAds: previous.daily.totalAds + 1,
      },
    }));
  }, [hydrated, isAdFree, state.daily.nativeShown]);

  const enablePremiumForDevelopment = useCallback(async () => {
    if (!__DEV__) return;
    setState((previous) => ({
      ...previous,
      isPremium: true,
      premiumSource: "development",
    }));
  }, []);

  const disablePremiumForDevelopment = useCallback(async () => {
    if (!__DEV__) return;
    setState((previous) => ({
      ...previous,
      isPremium: false,
      premiumSource: undefined,
    }));
  }, []);

  const value = useMemo<AdsContextValue>(
    () => ({
      isPremium: state.isPremium,
      isAdFree,
      isAdsReady: adsReady && isNativeAdsAvailable(),
      dailyDownloads: state.daily.downloads,
      rewardedAccessExpiresAt: state.rewardedAccessExpiresAt,
      canWatchRewarded:
        hydrated && !state.isPremium && !state.daily.rewardedShown,
      nativeAdEligible:
        hydrated &&
        adsReady &&
        isNativeAdsAvailable() &&
        !isAdFree &&
        !state.daily.nativeShown &&
        state.daily.totalAds < 2,
      watchRewardedAd,
      trackDownload,
      markNativeAdShown,
      enablePremiumForDevelopment,
      disablePremiumForDevelopment,
    }),
    [
      adsReady,
      disablePremiumForDevelopment,
      enablePremiumForDevelopment,
      hydrated,
      isAdFree,
      markNativeAdShown,
      state,
      trackDownload,
      watchRewardedAd,
    ],
  );

  return <AdsContext.Provider value={value}>{children}</AdsContext.Provider>;
}

export function useAds(): AdsContextValue {
  const value = useContext(AdsContext);
  if (!value) {
    throw new Error("useAds must be used inside AdsProvider");
  }
  return value;
}
