import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useFreeAdsState } from '@/hooks/ads/useFreeAdsState';
import { ADMOB, RADIUS } from '@/constants/theme';
import { ADS_ENABLED, getAdUnitId } from '@/constants/admob';

interface AdBannerProps {
  style?: any;
  size?: BannerAdSize | string;
}

const adUnitId = getAdUnitId('BANNER');

export function AdBanner({ style, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: AdBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  // Do not render at all until subscription status is confirmed, and never for Pro users.
  if (!ADS_ENABLED || Platform.OS === 'web' || adsLoading || isFreeAds) return null;

  const handleAdFailedToLoad = (err: any) => {
    __DEV__ && console.error('Banner ad failed to load: ', err);
    if (retryCount < 2) {
      setTimeout(() => setRetryCount(retryCount + 1), 5000);
    } else {
      setError(true);
    }
  };

  // POLICY: Do NOT render any placeholder, spinner, or reserved space until
  // the ad has actually loaded. Google Play rejects apps that show empty
  // boxes or "Ad loading…" UI when AdMob fill is unavailable.
  // The container collapses to nothing if !loaded, and unmounts on error.
  if (error) return null;

  return (
    <View
      style={[loaded ? styles.container : styles.collapsed, style]}
      key={`banner-${retryCount}`}
    >
      <BannerAd
        unitId={adUnitId}
        size={size as BannerAdSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={handleAdFailedToLoad}
      />
    </View>
  );
}

export function GridAd() {
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  if (!ADS_ENABLED || Platform.OS === 'web' || adsLoading || isFreeAds) return null;

  return (
    <View style={styles.fullRowAdContainer}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(err) => {
          __DEV__ && console.error('Grid ad failed to load: ', err);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: ADMOB.BANNER_HEIGHT,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  collapsed: {
    height: 0,
    width: '100%',
    overflow: 'hidden',
  },
  fullRowAdContainer: {
    width: '100%',
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
  },
});
