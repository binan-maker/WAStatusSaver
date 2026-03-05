import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.INTERSTITIAL : AD_UNIT_IDS.INTERSTITIAL;

let interstitial: InterstitialAd | null = null;

export function useInterstitialAd() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;

    if (!interstitial) {
      interstitial = InterstitialAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
        setLoaded(true);
      });

      const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
        setLoaded(false);
        interstitial?.load();
      });

      interstitial.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
      };
    }
  }, []);

  const showAd = () => {
    if (loaded && interstitial) {
      interstitial.show();
    } else {
      interstitial?.load();
    }
  };

  return { loaded, showAd };
}

// Keep the component for backward compatibility if needed, but the hook is preferred
export function AdInterstitial({ visible, onClose, countdown = 3 }: { visible: boolean; onClose:  () => void; countdown?: number; }) {
  const { loaded, showAd } = useInterstitialAd();

  useEffect(() => {
    if (visible && loaded) {
      showAd();
      onClose(); // Close the "visible" state once ad is triggered
    } else if (visible && !loaded) {
       // If not loaded, just skip to avoid blocking user
       onClose();
    }
  }, [visible, loaded]);

  return null;
}
