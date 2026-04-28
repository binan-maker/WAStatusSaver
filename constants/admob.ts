import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

// ─────────────────────────────────────────────────────────────────────────────
// Live AdMob unit IDs (used ONLY in production builds).
// Editing these in dev has no effect — dev always uses Google's TestIds below.
// ─────────────────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────────────────
// Single source of truth for runtime ad-unit selection.
//
// In development (__DEV__ === true) we return Google's official TestIds.
// Test IDs are required during development per AdMob policy — using live
// ad units in dev triggers click-fraud detection and can permanently
// suspend the publisher account.
//
// In production (__DEV__ === false) we return the real AD_UNIT_IDS above.
// The __DEV__ flag is hard-baked by Metro/Hermes at bundle time — it
// CANNOT be overridden at runtime, which is exactly what AdMob policy
// requires.
// ─────────────────────────────────────────────────────────────────────────────
export type AdSlot = 'BANNER' | 'INTERSTITIAL' | 'APP_OPEN' | 'REWARDED';

export function getAdUnitId(slot: AdSlot): string {
  if (__DEV__) {
    switch (slot) {
      case 'BANNER':       return TestIds.BANNER;
      case 'INTERSTITIAL': return TestIds.INTERSTITIAL;
      case 'APP_OPEN':     return TestIds.APP_OPEN;
      case 'REWARDED':     return TestIds.REWARDED;
    }
  }
  return AD_UNIT_IDS[slot];
}

// Neutralized ad pacing — generous to avoid "this app is full of ads" reviews.
// Show an interstitial only every Nth video open / image swipe AND only after
// a global cooldown (see INTERSTITIAL_COOLDOWN_MS). Tune here, not in code.
export const VIDEO_AD_FREQUENCY = 25;
export const IMAGE_SWIPE_AD_FREQUENCY = 30;
export const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000; // min 3 min between ads
export const APP_OPEN_AD_COOLDOWN_MS = 30 * 60 * 1000; // min 30 min between app-open ads
export const ADS_ENABLED = false;
