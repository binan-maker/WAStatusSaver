import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';
import { useFreeAdsState } from '@/hooks/useFreeAdsState';

const adUnitId = AD_UNIT_IDS.APP_OPEN;

let globalAppOpenAd: AppOpenAd | null = null;
let isShowingAd = false;
let isLoaded = false;
let loadRetries = 0;
const MAX_RETRIES = 3;

function destroyGlobalAd() {
  globalAppOpenAd = null;
  isLoaded = false;
  isShowingAd = false;
  loadRetries = 0;
}

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);
  const [loaded, setLoaded] = useState(isLoaded);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  useEffect(() => {
    // Do NOT load or show ads while subscription status is still being fetched.
    // This is the primary fix for the race condition where AppOpen ads fire
    // before the server confirms Pro status, making Pro users see ads.
    if (!ADS_ENABLED || Platform.OS === 'web' || adsLoading) return;

    // Pro user confirmed — destroy any already-loaded ad so it can't show.
    if (isFreeAds) {
      if (globalAppOpenAd) {
        destroyGlobalAd();
        setLoaded(false);
      }
      return;
    }

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (isLoaded && !isShowingAd && !isFreeAds && !adsLoading) {
          showAppOpenAd();
        }
      }
      appState.current = nextState;
    });

    if (!globalAppOpenAd) {
      loadAppOpenAd();
    }

    return () => {
      subscription.remove();
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
    };
  }, [isFreeAds, adsLoading]);

  const loadAppOpenAd = () => {
    if (globalAppOpenAd || isShowingAd) return;

    try {
      globalAppOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      globalAppOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        // Final guard: if Pro was confirmed while the ad was loading, discard it.
        if (isFreeAds) {
          destroyGlobalAd();
          setLoaded(false);
          return;
        }
        isLoaded = true;
        loadRetries = 0;
        setLoaded(true);
      });

      globalAppOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        isShowingAd = false;
        isLoaded = false;
        setLoaded(false);
        globalAppOpenAd = null;
        loadRetries = 0;
        if (!isFreeAds) loadAppOpenAd();
      });

      globalAppOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('App open ad error:', error);
        isLoaded = false;
        setLoaded(false);
        globalAppOpenAd = null;

        loadRetries++;
        if (loadRetries < MAX_RETRIES && !isFreeAds) {
          const retryDelay = Math.min(5000 * Math.pow(2, loadRetries), 30000);
          loadTimeoutRef.current = setTimeout(loadAppOpenAd, retryDelay);
        }
      });

      globalAppOpenAd.load();
    } catch (e) {
      console.error('Error creating AppOpenAd:', e);
      globalAppOpenAd = null;
    }
  };

  const showAppOpenAd = async () => {
    if (!ADS_ENABLED || Platform.OS === 'web' || isFreeAds || adsLoading) return;

    if (!globalAppOpenAd || !isLoaded || isShowingAd) {
      return;
    }

    try {
      isShowingAd = true;
      await globalAppOpenAd.show();
    } catch (error) {
      console.error('App open ad show error:', error);
      isShowingAd = false;
      globalAppOpenAd = null;
      loadAppOpenAd();
    }
  };

  return { loaded };
}
