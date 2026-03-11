import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import { AppOpenAd, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = AD_UNIT_IDS.APP_OPEN;

// Use global singleton to persist across hook mounts
let globalAppOpenAd: AppOpenAd | null = null;
let isShowingAd = false;
let isLoaded = false;
let loadRetries = 0;
const MAX_RETRIES = 3;

export function useAppOpenAd() {
  const appState = useRef(AppState.currentState);
  const [loaded, setLoaded] = useState(isLoaded);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (appState.current.match(/inactive|background/) && nextState === 'active') {
        if (isLoaded && !isShowingAd) {
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
  }, []);

  const loadAppOpenAd = () => {
    if (globalAppOpenAd || isShowingAd) return;

    try {
      globalAppOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      globalAppOpenAd.addAdEventListener(AdEventType.LOADED, () => {
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
        loadAppOpenAd();
      });

      globalAppOpenAd.addAdEventListener(AdEventType.ERROR, (error) => {
        console.error('App open ad error:', error);
        isLoaded = false;
        setLoaded(false);
        globalAppOpenAd = null;
        
        loadRetries++;
        if (loadRetries < MAX_RETRIES) {
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
    if (!ADS_ENABLED || Platform.OS === 'web') return;
    
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
