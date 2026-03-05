import React from 'react';
import {
  View,
  StyleSheet,
  Platform,
} from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import COLORS from '@/constants/colors';
import { ADMOB } from '@/constants/theme';
import { ADS_ENABLED, AD_UNIT_IDS } from '@/constants/admob';

interface AdBannerProps {
  style?: object;
}

const adUnitId = __DEV__ ? TestIds.ADAPTIVE_BANNER : AD_UNIT_IDS.BANNER;

export function AdBanner({ style }: AdBannerProps) {
  if (!ADS_ENABLED || Platform.OS === 'web') return null;

  return (
    <View style={[styles.container, style]}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
        onAdFailedToLoad={(error) => {
          console.error('Banner ad failed to load: ', error);
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
});
