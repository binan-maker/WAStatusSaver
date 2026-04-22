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

// Neutralized ad pacing — generous to avoid "this app is full of ads" reviews.
// Show an interstitial only every Nth video open / image swipe AND only after
// a global cooldown (see INTERSTITIAL_COOLDOWN_MS). Tune here, not in code.
export const VIDEO_AD_FREQUENCY = 25;
export const IMAGE_SWIPE_AD_FREQUENCY = 30;
export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000; // min 3 min between ads
export const APP_OPEN_AD_COOLDOWN_MS = 30 * 60 * 1000; // min 30 min between app-open ads
export const ADS_ENABLED = true;
