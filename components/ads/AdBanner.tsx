import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useFreeAdsState } from '@/hooks/ads/useFreeAdsState';
import { useThemeColors } from '@/contexts/ThemeContext';
import { ADMOB, RADIUS } from '@/constants/theme';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/admob';

interface AdBannerProps {
  style?: any;
  size?: BannerAdSize | string;
}

const adUnitId = AD_UNIT_IDS.BANNER;

export function AdBanner({ style, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: AdBannerProps) {
  const COLORS = useThemeColors();
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { isFreeAds, loading: adsLoading } = useFreeAdsState();

  // Do not render at all until subscription status is confirmed, and never for Pro users.
  if (!ADS_ENABLED || Platform.OS === 'web' || adsLoading || isFreeAds) return null;

  const handleAdFailedToLoad = (err: any) => {
    console.error('Banner ad failed to load: ', err);
    if (retryCount < 2) {
      setTimeout(() => setRetryCount(retryCount + 1), 5000);
    } else {
      setError(true);
    }
  };

  return (
    <View style={[styles.container, style]} key={`banner-${retryCount}`}>
      {!loaded && !error && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY} />
        </View>
      )}
      {!error && (
        <BannerAd
          unitId={adUnitId}
          size={size as BannerAdSize}
          requestOptions={{
            requestNonPersonalizedAdsOnly: true,
          }}
          onAdLoaded={() => setLoaded(true)}
          onAdFailedToLoad={handleAdFailedToLoad}
        />
      )}
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
          console.error('Grid ad failed to load: ', err);
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
  placeholder: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
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
