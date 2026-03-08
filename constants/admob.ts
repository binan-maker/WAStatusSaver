import { Platform } from 'react-native';

export const AD_UNIT_IDS = {
  BANNER: Platform.OS === 'android'
    ? 'ca-app-pub-8785278012936203/9814176453'
    : 'ca-app-pub-8785278012936203/9814176453',

  INTERSTITIAL: Platform.OS === 'android'
    ? 'ca-app-pub-8785278012936203/8006746126'
    : 'ca-app-pub-8785278012936203/8006746126',

  APP_OPEN: Platform.OS === 'android'
    ? 'ca-app-pub-8785278012936203/8469780552'
    : 'ca-app-pub-8785278012936203/8469780552',

  NATIVE: Platform.OS === 'android'
    ? 'ca-app-pub-8785278012936203/5380582780'
    : 'ca-app-pub-8785278012936203/5380582780',
};

export const VIDEO_AD_FREQUENCY = 3;
export const ADS_ENABLED = true;
