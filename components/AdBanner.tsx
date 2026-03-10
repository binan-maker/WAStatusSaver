import React, { useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import COLORS from '@/constants/colors';
import { ADMOB, RADIUS } from '@/constants/theme';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/admob';

interface AdBannerProps {
  style?: any;
  size?: BannerAdSize | string;
}

const adUnitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : AD_UNIT_IDS.BANNER;

export function AdBanner({ style, size = BannerAdSize.ANCHORED_ADAPTIVE_BANNER }: AdBannerProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  if (!ADS_ENABLED || Platform.OS === 'web') return null;

  return (
    <View style={[styles.container, style]}>
      {!loaded && !error && (
        <View style={styles.placeholder}>
          <ActivityIndicator size="small" color={COLORS.PRIMARY} />
        </View>
      )}
      <BannerAd
        unitId={adUnitId}
        size={size as BannerAdSize}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdLoaded={() => setLoaded(true)}
        onAdFailedToLoad={(err) => {
          console.error('Banner ad failed to load: ', err);
          setError(true);
        }}
      />
    </View>
  );
}

export function GridAd() {
  if (!ADS_ENABLED || Platform.OS === 'web') return null;
  
  return (
    <View style={styles.gridContainer}>
      <AdBanner size={BannerAdSize.MEDIUM_RECTANGLE} style={styles.gridAd} />
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
    padding: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridAd: {
    width: 300,
    height: 250,
    backgroundColor: COLORS.SURFACE_2,
    borderRadius: RADIUS.MD,
    overflow: 'hidden',
  }
});
