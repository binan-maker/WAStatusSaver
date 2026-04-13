import { Platform } from 'react-native';

export const AD_UNIT_IDS = {
  BANNER: Platform.OS === 'android'
    ? 'ca-app-pub-2087467559495393/4866886317'
    : 'ca-app-pub-2087467559495393/4866886317',

  INTERSTITIAL: Platform.OS === 'android'
    ? 'ca-app-pub-2087467559495393/9245115025'
    : 'ca-app-pub-2087467559495393/9245115025',

  APP_OPEN: Platform.OS === 'android'
    ? 'ca-app-pub-2087467559495393/1236206025'
    : 'ca-app-pub-2087467559495393/1236206025',

  NATIVE: Platform.OS === 'android'
    ? 'ca-app-pub-2087467559495393/5913817638'
    : 'ca-app-pub-2087467559495393/5913817638',

  REWARDED: Platform.OS === 'android'
    ? 'ca-app-pub-2087467559495393/1974572625'
    : 'ca-app-pub-2087467559495393/1974572625',
};

export const VIDEO_AD_FREQUENCY = 10;
export const ADS_ENABLED = true;
