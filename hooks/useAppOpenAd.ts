import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.APP_OPEN : AD_UNIT_IDS.APP_OPEN;

// Use global singleton to persist across hook mounts
let globalAppOpenAd: AppOpenAd | null = null;
let isShowingAd = false;
let isLoaded = false;

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);
  const [loaded, setLoaded] = useState(isLoaded);

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        showAppOpenAd();
      }
      appState.current = nextState;
    });
    
    if (!globalAppOpenAd) {
      loadAppOpenAd();
    }

    return () => {
      subscription.remove();
    };
  }, []);

  const loadAppOpenAd = () => {
    if (globalAppOpenAd) return;

    try {
      globalAppOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      globalAppOpenAd.addAdEventListener(AdEventType.LOADED, () => {
        isLoaded = true;
        setLoaded(true);
      });

      globalAppOpenAd.addAdEventListener(AdEventType.CLOSED, () => {
        isShowingAd = false;
        isLoaded = false;
        setLoaded(false);
        globalAppOpenAd = null;
        // Preload next ad
        loadAppOpenAd();
      });

      globalAppOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.log('App open ad failed to load:', error);
        isLoaded = false;
        setLoaded(false);
        globalAppOpenAd = null;
        // Retry after delay
        setTimeout(loadAppOpenAd, 30000);
      });

      globalAppOpenAd.load();
    } catch (e) {
      console.error('Error creating AppOpenAd:', e);
    }
  };

  const showAppOpenAd = async () => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;
    
    if (!globalAppOpenAd || !isLoaded || isShowingAd) {
      console.log('App open ad not ready:', { adExists: !!globalAppOpenAd, isLoaded, isShowingAd });
      if (!globalAppOpenAd) loadAppOpenAd();
      return;
    }

    try {
      isShowingAd = true;
      await globalAppOpenAd.show();
    } catch (error) {
      console.log('App open ad show error:', error);
      isShowingAd = false;
    }
  };

  const handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      showAppOpenAd();
    }
    appState.current = nextAppState;
  };

  return { loaded };
}
