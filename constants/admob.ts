import { Platform } from 'react-native';

export const AD_UNIT_IDS = {
  BANNER: Platform.OS === 'android'
    ? 'ca-app-pub-7313264435552019/3651971676'
    : 'ca-app-pub-7313264435552019/3651971676',

  INTERSTITIAL: Platform.OS === 'android'
    ? 'ca-app-pub-7313264435552019/7483405473'
    : 'ca-app-pub-7313264435552019/7483405473',

  REWARDED: Platform.OS === 'android'
    ? 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX'
    : 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
};

export const VIDEO_AD_FREQUENCY = 3;
export const ADS_ENABLED = true;
