import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { useFreeAdsState } from '@/hooks/useFreeAdsState';
import COLORS from '@/constants/colors';
import { ADMOB, RADIUS } from '@/constants/theme';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/admob';

interface AdBannerProps {
  style?: any;
  size?: BannerAdSize | string;
}

const adUnitId = AD_UNIT_IDS.BANNER;

export function AdBanner({ style, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: AdBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const { isFreeAds } = useFreeAdsState();

  if (!ADS_ENABLED || Platform.OS === 'web' || isFreeAds) return null;

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
  const { isFreeAds } = useFreeAdsState();
  
  if (!ADS_ENABLED || Platform.OS === 'web' || isFreeAds) return null;
  
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
  gridContainer: {
    width: '100%',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  fullRowAdContainer: {
    width: '100%',
    marginVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    // Ensure it spans full width by taking up the space of all columns
    paddingHorizontal: 0,
  },
  gridAd: {
    width: '100%',
    backgroundColor: COLORS.SURFACE_2,
    overflow: 'hidden',
  }
});
