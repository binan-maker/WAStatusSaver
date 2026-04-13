import React, { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';
import { useFreeAdsState } from '@/hooks/useFreeAdsState';

const adUnitId = AD_UNIT_IDS.INTERSTITIAL;

let interstitial: InterstitialAd | null = null;
let loadRetries = 0;
const MAX_RETRIES = 3;

export function useInterstitialAd() {
  const [loaded, setLoaded] = useState(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();
  const { isFreeAds } = useFreeAdsState();

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web' || isFreeAds) return;

    if (!interstitial) {
      const loadAd = () => {
        if (interstitial) return;
        
        try {
          interstitial = InterstitialAd.createForAdRequest(adUnitId, {
            requestNonPersonalizedAdsOnly: true,
          });

          const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            loadRetries = 0;
            setLoaded(true);
          });

          const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            setLoaded(false);
            interstitial = null;
            loadRetries = 0;
            loadAd();
          });

          const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
            console.error('Interstitial ad error:', error);
            interstitial = null;
            setLoaded(false);
            loadRetries++;
            if (loadRetries < MAX_RETRIES) {
              const retryDelay = Math.min(5000 * Math.pow(2, loadRetries), 30000);
              loadTimeoutRef.current = setTimeout(loadAd, retryDelay);
            }
          });

          interstitial.load();

          return () => {
            unsubscribeLoaded();
            unsubscribeClosed();
            unsubscribeError();
          };
        } catch (e) {
          console.error('Error creating interstitial ad:', e);
          interstitial = null;
        }
      };

      const cleanup = loadAd();
      return () => {
        cleanup?.();
        if (loadTimeoutRef.current) {
          clearTimeout(loadTimeoutRef.current);
        }
      };
    }
  }, [isFreeAds]);

  const showAd = () => {
    if (isFreeAds) return;
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
