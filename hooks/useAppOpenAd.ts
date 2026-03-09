import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AppOpenAd, AppOpenAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.APP_OPEN : AD_UNIT_IDS.APP_OPEN;

let appOpenAd: AppOpenAd | null = null;
let isShowingAd = false;

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);

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

    appOpenAd.addAdEventListener(AppOpenAdEventType.LOADED, () => {
      showAppOpenAd();
    });

    appOpenAd.addAdEventListener(AppOpenAdEventType.CLOSED, () => {
      appOpenAd = null;
      loadAppOpenAd();
    });

    appOpenAd.load();
  };

  const showAppOpenAd = async () => {
    if (!appOpenAd || isShowingAd) return;

    try {
      isShowingAd = true;
      await appOpenAd.show();
    } catch (error) {
      console.error('Error showing app open ad:', error);
    } finally {
      isShowingAd = false;
    }
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      if (!isShowingAd && appOpenAd) {
        showAppOpenAd();
      }
    }
    appState.current = nextAppState;
  };
}
