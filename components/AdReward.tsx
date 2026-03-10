import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { RewardedAd, RewardedAdEventType, TestIds, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.REWARDED : AD_UNIT_IDS.REWARDED;

// Persistent singleton state
let globalRewardedAd: RewardedAd | null = null;
let isLoaded = false;
let isShowing = false;

export function useRewardedAd() {
  const [loaded, setLoaded] = useState(isLoaded);
  const listenersRef = useRef<(() => void)[]>([]);

  const loadAd = useCallback(() => {
    if (globalRewardedAd || isShowing) return;

    try {
      globalRewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      globalRewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        isLoaded = true;
        setLoaded(true);
      });

      globalRewardedAd.addAdEventListener(AdEventType.ERROR, (err) => {
        console.error('Rewarded ad load error:', err);
        globalRewardedAd = null;
        isLoaded = false;
        setLoaded(false);
        // Retry after 30s
        setTimeout(loadAd, 30000);
      });

      globalRewardedAd.load();
    } catch (e) {
      console.error('Error creating rewarded ad:', e);
    }
  }, []);

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;
    if (!globalRewardedAd) loadAd();
    
    return () => {
      // Clear local component state if needed, but keep global ad
    };
  }, [loadAd]);

  const showAd = async (): Promise<boolean> => {
    if (!globalRewardedAd || !isLoaded || isShowing) {
      if (!globalRewardedAd) loadAd();
      return false;
    }

    return new Promise((resolve) => {
      let earnedReward = false;
      isShowing = true;

      const unsubscribeEarned = globalRewardedAd!.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          earnedReward = true;
        }
      );

      const unsubscribeClosed = globalRewardedAd!.addAdEventListener(
        AdEventType.CLOSED,
        () => {
          unsubscribeEarned();
          unsubscribeClosed();
          isShowing = false;
          isLoaded = false;
          setLoaded(false);
          globalRewardedAd = null;
          loadAd(); // Preload next
          resolve(earnedReward);
        }
      );

      globalRewardedAd!.show().catch(err => {
        console.error('Error showing rewarded ad:', err);
        isShowing = false;
        resolve(false);
      });
    });
  };

  return { loaded, showAd };
}
