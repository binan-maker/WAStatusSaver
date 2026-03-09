import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.APP_OPEN : AD_UNIT_IDS.APP_OPEN;

let appOpenAd: AppOpenAd | null = null;
let isShowingAd = false;

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);

  let appOpenAd: AppOpenAd | null = null;
let isShowingAd = false;
let isLoaded = false;

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    loadAppOpenAd();

    return () => {
      subscription.remove();
    };
  }, []);

  const loadAppOpenAd = async () => {
    if (appOpenAd) return;

    appOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
      requestNonPersonalizedAdsOnly: true,
    });

   appOpenAd.addAdEventListener(AdEventType.LOADED, () => {
  isLoaded = true;
});

appOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
  isShowingAd = false;
  isLoaded = false;
  appOpenAd = null;
  loadAppOpenAd();
});

appOpenAd.addAdEventListener(AdEventType.ERROR, () => {
  appOpenAd = null;
});

    appOpenAd.load();
  };

  const showAppOpenAd = async () => {
  if (!appOpenAd || !isLoaded || isShowingAd) return;

  try {
    isShowingAd = true;
    await appOpenAd.show();
  } catch (error) {
    console.log('App open ad error:', error);
  }
};

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (!isShowingAd && isLoaded && appOpenAd) {
        showAppOpenAd();
      }
    }
    appState.current = nextAppState;
  };
}
