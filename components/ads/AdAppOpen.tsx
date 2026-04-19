import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';
import { useFreeAdsState } from '@/hooks/ads/useFreeAdsState';

const adUnitId = __DEV__ ? TestIds.APP_OPEN : AD_UNIT_IDS.APP_OPEN;

let appOpenAd: AppOpenAd | null = null;

export function useAppOpenAd() {
  const [loaded, setLoaded] = useState(false);
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web' || adsLoading || isFreeAds) {
      if (isFreeAds && appOpenAd) {
        appOpenAd = null;
        setLoaded(false);
      }
      return;
    }

    if (!appOpenAd) {
      appOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = appOpenAd.addAdEventListener(
        AdEventType.LOADED,
        () => {
          if (isFreeAds) {
            appOpenAd = null;
            setLoaded(false);
            return;
          }
          setLoaded(true);
        }
      );

      const unsubscribeClosed = appOpenAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          setLoaded(false);
          appOpenAd = null;
          if (!isFreeAds) appOpenAd?.load();
        }
      );

      appOpenAd.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
      };
    }
  }, [isFreeAds, adsLoading]);

  const showAd = () => {
    if (isFreeAds || adsLoading) return;
    if (loaded && appOpenAd) {
      appOpenAd.show();
    } else {
      appOpenAd?.load();
    }
  };

  return { loaded, showAd };
}
