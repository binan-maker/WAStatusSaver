import { Platform } from 'react-native';

export const AD_UNIT_IDS = {
  BANNER: Platform.OS === 'android'
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'
    : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',

  INTERSTITIAL: Platform.OS === 'android'
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'
    : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',

  REWARDED: Platform.OS === 'android'
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'
    : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

export const VIDEO_AD_FREQUENCY = 3;
export const ADS_ENABLED = true;
