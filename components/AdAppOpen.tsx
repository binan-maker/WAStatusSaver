import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { AppOpenAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.APP_OPEN : AD_UNIT_IDS.APP_OPEN;

let appOpenAd: AppOpenAd | null = null;

export function useAppOpenAd() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;

    if (!appOpenAd) {
      appOpenAd = AppOpenAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = appOpenAd.addAdEventListener(
        AdEventType.LOADED,
        () => {
          setLoaded(true);
        }
      );

      const unsubscribeClosed = appOpenAd.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          setLoaded(false);
          appOpenAd?.load();
        }
      );

      appOpenAd.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeClosed();
      };
    }
  }, []);

  const showAd = () => {
    if (loaded && appOpenAd) {
      appOpenAd.show();
    } else {
      appOpenAd?.load();
    }
  };

  return { loaded, showAd };
}
