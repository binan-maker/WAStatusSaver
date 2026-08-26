import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  type AdResult,
  getGoogleMobileAdsModule,
  initializeGoogleMobileAds,
  isNativeAdsAvailable,
  showInterstitialAd,
  showRewardedAd,
} from "@/lib/ads";
import {
  getOfferingPackage,
  hasPremiumEntitlement,
  isRevenueCatSupported,
  loadRevenueCatSnapshot,
  purchasePremium as purchasePremiumFromStore,
  restorePremium as restorePremiumFromStore,
  subscribeToCustomerInfo,
  type PurchaseResult,
} from "@/lib/revenuecat";

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
  adsError: string | null;
  purchaseReady: boolean;
  purchaseLoading: boolean;
  purchaseError: string | null;
  premiumPrice: string | null;
  dailyDownloads: number;
  rewardedAccessExpiresAt: number;
  canWatchRewarded: boolean;
  nativeAdEligible: boolean;
  watchRewardedAd: () => Promise<AdResult>;
  purchasePremium: () => Promise<PurchaseResult>;
  restorePurchases: () => Promise<PurchaseResult>;
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

function parseStoredState(value: string | null): Partial<StoredAdsState> | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as Partial<StoredAdsState>;
  } catch {
    return null;
  }
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
  const [adsError, setAdsError] = useState<string | null>(null);
  const [purchaseReady, setPurchaseReady] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState(true);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const [premiumPrice, setPremiumPrice] = useState<string | null>(null);
  const adFreeRef = useRef(false);

  useEffect(() => {
    let active = true;
    let unsubscribeCustomerInfo = () => {};

    const hydrate = async () => {
      const [stored, adInitialization, revenueCat] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY).catch(() => null),
        initializeGoogleMobileAds()
          .then((error) => ({ error, snapshot: null }))
          .catch((error: unknown) => ({
            error:
              error instanceof Error
                ? error.message
                : "Google Mobile Ads could not initialize.",
            snapshot: null,
          })),
        loadRevenueCatSnapshot()
          .then((snapshot) => ({ error: null, snapshot }))
          .catch((error: unknown) => ({
            error:
              error instanceof Error
                ? error.message
                : "RevenueCat could not initialize.",
            snapshot: null,
          })),
      ]);

      if (!active) return;

      setAdsError(adInitialization.error);
      setAdsReady(
        Boolean(getGoogleMobileAdsModule()) && !adInitialization.error,
      );

      if (revenueCat.snapshot) {
        setPurchaseReady(
          isRevenueCatSupported() &&
            Boolean(
              revenueCat.snapshot.offering &&
                getOfferingPackage(revenueCat.snapshot.offering),
            ),
        );
        const verifiedPremium = hasPremiumEntitlement(
          revenueCat.snapshot.customerInfo,
        );
        const packageToPurchase = getOfferingPackage(
          revenueCat.snapshot.offering,
        );
        setPremiumPrice(packageToPurchase?.product.priceString || null);

        const localState = normalizeStoredState(parseStoredState(stored));
        setState({
          ...localState,
          isPremium:
            verifiedPremium ||
            (__DEV__ &&
              localState.isPremium &&
              localState.premiumSource === "development"),
          premiumSource: verifiedPremium
            ? "purchase"
            : __DEV__ &&
                localState.isPremium &&
                localState.premiumSource === "development"
              ? "development"
              : undefined,
        });
        unsubscribeCustomerInfo = subscribeToCustomerInfo((customerInfo) => {
          if (!active) return;
          const hasPremium = hasPremiumEntitlement(customerInfo);
          setState((previous) => ({
            ...previous,
            isPremium:
              hasPremium ||
              (__DEV__ && previous.premiumSource === "development"),
            premiumSource: hasPremium
              ? "purchase"
              : __DEV__ && previous.premiumSource === "development"
                ? "development"
                : undefined,
          }));
        });
      } else {
        setPurchaseReady(false);
        setPurchaseError(revenueCat.error);
        const localState = normalizeStoredState(parseStoredState(stored));
        setState({
          ...localState,
          isPremium:
            __DEV__ &&
            localState.isPremium &&
            localState.premiumSource === "development",
          premiumSource:
            __DEV__ && localState.premiumSource === "development"
              ? "development"
              : undefined,
        });
      }

      setPurchaseLoading(false);
      setHydrated(true);
    };

    hydrate().catch((error: unknown) => {
      if (!active) return;
      setAdsReady(false);
      setAdsError(
        error instanceof Error
          ? error.message
          : "Ads could not initialize. Try again when you have a connection.",
      );
      setPurchaseReady(false);
      setPurchaseLoading(false);
      setState(normalizeStoredState(null));
      setHydrated(true);
    });

    return () => {
      active = false;
      unsubscribeCustomerInfo();
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const isRewardedAccessActive = state.rewardedAccessExpiresAt > Date.now();
  const isAdFree = state.isPremium || isRewardedAccessActive;
  useEffect(() => {
    adFreeRef.current = isAdFree;
  }, [isAdFree]);

  const watchRewardedAd = useCallback(async (): Promise<AdResult> => {
    if (
      !hydrated ||
      state.isPremium ||
      state.daily.rewardedShown ||
      state.daily.totalAds >= 2 ||
      isRewardedAccessActive
    ) {
      return {
        success: false,
        kind: "dismissed",
        message: "A rewarded ad has already unlocked access for today.",
      };
    }
    if (!adsReady || !isNativeAdsAvailable()) {
      return {
        success: false,
        kind: "unsupported",
        message:
          adsError ||
          "Rewarded ads are still loading. Check your connection and try again.",
      };
    }

    const result = await showRewardedAd();
    if (!result.success) {
      setAdsError(result.message);
      return result;
    }

    setState((previous) => ({
      ...previous,
      rewardedAccessExpiresAt: Date.now() + REWARDED_ACCESS_MS,
      daily: {
        ...previous.daily,
        rewardedShown: true,
        totalAds: previous.daily.totalAds + 1,
      },
    }));
    setAdsError(null);
    return result;
  }, [
    adsError,
    hydrated,
    adsReady,
    isRewardedAccessActive,
    state.daily.rewardedShown,
    state.daily.totalAds,
    state.isPremium,
  ]);

  const purchasePremium = useCallback(async (): Promise<PurchaseResult> => {
    setPurchaseError(null);
    const result = await purchasePremiumFromStore();
    if (result.success) {
      setState((previous) => ({
        ...previous,
        isPremium: true,
        premiumSource: "purchase",
      }));
      setPurchaseError(null);
    } else {
      setPurchaseError(result.message);
    }
    return result;
  }, []);

  const restorePurchases = useCallback(async (): Promise<PurchaseResult> => {
    setPurchaseError(null);
    const result = await restorePremiumFromStore();
    if (result.success) {
      const restoredPremium = hasPremiumEntitlement(result.customerInfo);
      setState((previous) => ({
        ...previous,
        isPremium: restoredPremium,
        premiumSource: restoredPremium ? "purchase" : undefined,
      }));
      if (!restoredPremium) {
        setPurchaseError("No active Premium purchase was found for this Google Play account.");
      }
    } else {
      setPurchaseError(result.message);
    }
    return result;
  }, []);

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
      if (adFreeRef.current) return;
      const result = await showInterstitialAd();
      if (!result.success) setAdsError(result.message);
    }
  }, [
    hydrated,
    isAdFree,
    state.daily.downloads,
    state.daily.interstitials,
  ]);

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
      adsError,
      purchaseReady,
      purchaseLoading,
      purchaseError,
      premiumPrice,
      dailyDownloads: state.daily.downloads,
      rewardedAccessExpiresAt: state.rewardedAccessExpiresAt,
      canWatchRewarded:
        hydrated &&
        !state.isPremium &&
        !isRewardedAccessActive &&
        !state.daily.rewardedShown &&
        state.daily.totalAds < 2,
      nativeAdEligible:
        hydrated &&
        adsReady &&
        isNativeAdsAvailable() &&
        !isAdFree &&
        !state.daily.nativeShown &&
        state.daily.totalAds < 2,
      watchRewardedAd,
      purchasePremium,
      restorePurchases,
      trackDownload,
      markNativeAdShown,
      enablePremiumForDevelopment,
      disablePremiumForDevelopment,
    }),
    [
      adsReady,
      adsError,
      disablePremiumForDevelopment,
      enablePremiumForDevelopment,
      hydrated,
      isAdFree,
      isRewardedAccessActive,
      markNativeAdShown,
      premiumPrice,
      purchaseError,
      purchaseLoading,
      purchasePremium,
      purchaseReady,
      restorePurchases,
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
