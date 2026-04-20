import React, { useEffect, useState, useRef } from 'react';
import { Platform } from 'react-native';
import { InterstitialAd, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';
import { useFreeAdsState } from '@/hooks/useFreeAdsState';

const adUnitId = AD_UNIT_IDS.INTERSTITIAL;

let interstitial: InterstitialAd | null = null;
let loadRetries = 0;
const MAX_RETRIES = 3;

function destroyInterstitial() {
  interstitial = null;
  loadRetries = 0;
}

export function useInterstitialAd() {
  const [loaded, setLoaded] = useState(false);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  useEffect(() => {
    // Wait until subscription status is confirmed before loading any ads.
    // This prevents interstitials from firing in the window before Pro is confirmed.
    if (!ADS_ENABLED || Platform.OS === 'web' || adsLoading) return;

    // Pro user confirmed — destroy any already-loaded interstitial immediately.
    if (isFreeAds) {
      if (interstitial) {
        destroyInterstitial();
        setLoaded(false);
      }
      return;
    }

    if (!interstitial) {
      const loadAd = () => {
        if (interstitial) return;

        try {
          interstitial = InterstitialAd.createForAdRequest(adUnitId, {
            requestNonPersonalizedAdsOnly: true,
          });

          const unsubscribeLoaded = interstitial.addAdEventListener(AdEventType.LOADED, () => {
            // Final guard: if Pro was confirmed while the ad was loading, discard it.
            if (isFreeAds) {
              destroyInterstitial();
              setLoaded(false);
              return;
            }
            loadRetries = 0;
            setLoaded(true);
          });

          const unsubscribeClosed = interstitial.addAdEventListener(AdEventType.CLOSED, () => {
            setLoaded(false);
            interstitial = null;
            loadRetries = 0;
            if (!isFreeAds) loadAd();
          });

          const unsubscribeError = interstitial.addAdEventListener(AdEventType.ERROR, (error) => {
            console.error('Interstitial ad error:', error);
            interstitial = null;
            setLoaded(false);
            loadRetries++;
            if (loadRetries < MAX_RETRIES && !isFreeAds) {
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
  }, [isFreeAds, adsLoading]);

  const showAd = () => {
    // Hard guard: never show an ad if the user is subscribed or we are still loading.
    if (isFreeAds || adsLoading) return;
    if (loaded && interstitial) {
      interstitial.show();
    } else {
      interstitial?.load();
    }
  };

  return { loaded, showAd };
}

export function AdInterstitial({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { loaded, showAd } = useInterstitialAd();

  useEffect(() => {
    if (visible && loaded) {
      showAd();
      onClose();
    } else if (visible && !loaded) {
      onClose();
    }
  }, [visible, loaded]);

  return null;
}
