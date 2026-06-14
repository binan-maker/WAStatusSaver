/**
 * MediaContext — thin version router.
 *
 * Picks the right provider based on Android API level:
 *   • Android 11+ (API 30+) → MediaProviderSAF   (SAF folder access)
 *   • Android 10 and below  → MediaProviderLegacy (direct file paths)
 *
 * All imports from @/contexts/MediaContext continue to work unchanged.
 */
import React, { ReactNode } from 'react';
import { Platform } from 'react-native';
import { MediaProviderSAF } from './MediaContextSAF';
import { MediaProviderLegacy } from './MediaContextLegacy';

export * from './media/types';
export {
  logSafMountTime,
  logDirectPlaySuccess,
  logFallbackCopyTriggered,
  getTelemetrySnapshot,
} from './MediaContextSAF';

export function MediaProvider({ children }: { children: ReactNode }) {
  const androidVersion =
    Platform.OS === 'android' ? (Platform.Version as number) : 0;

  if (androidVersion >= 30) {
    return <MediaProviderSAF>{children}</MediaProviderSAF>;
  }
  return <MediaProviderLegacy>{children}</MediaProviderLegacy>;
}
