import { Platform } from 'react-native';

export const AD_UNIT_IDS = {
  BANNER: Platform.OS === 'android'
    ? 'ca-app-pub-7313264435552019/3364238531'
    : 'ca-app-pub-7313264435552019/3364238531',

  INTERSTITIAL: Platform.OS === 'android'
    ? 'ca-app-pub-7313264435552019/9990879231'
    : 'ca-app-pub-7313264435552019/9990879231',

  APP_OPEN: Platform.OS === 'android'
    ? 'ca-app-pub-7313264435552019/7350702672'
    : 'ca-app-pub-7313264435552019/7350702672',

  NATIVE: Platform.OS === 'android'
    ? 'ca-app-pub-7313264435552019/8499298440'
    : 'ca-app-pub-7313264435552019/8499298440',
};

export const VIDEO_AD_FREQUENCY = 3;
export const ADS_ENABLED = true;
