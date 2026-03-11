import React, { useEffect, useState, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { RewardedAd, RewardedAdEventType, AdEventType } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = AD_UNIT_IDS.REWARDED;

// Persistent singleton state
let globalRewardedAd: RewardedAd | null = null;
let isLoaded = false;
let isShowing = false;
let loadRetries = 0;
const MAX_RETRIES = 3;

export function useRewardedAd() {
  const [loaded, setLoaded] = useState(isLoaded);
  const listenersRef = useRef<(() => void)[]>([]);
  const loadTimeoutRef = useRef<NodeJS.Timeout>();

  const loadAd = useCallback(() => {
    if (globalRewardedAd || isShowing) return;

    try {
      globalRewardedAd = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      globalRewardedAd.addAdEventListener(RewardedAdEventType.LOADED, () => {
        isLoaded = true;
        loadRetries = 0;
        setLoaded(true);
      });

      globalRewardedAd.addAdEventListener(AdEventType.ERROR, (err) => {
        console.error('Rewarded ad load error:', err);
        globalRewardedAd = null;
        isLoaded = false;
        setLoaded(false);
        
        loadRetries++;
        if (loadRetries < MAX_RETRIES) {
          const retryDelay = Math.min(5000 * Math.pow(2, loadRetries), 30000);
          loadTimeoutRef.current = setTimeout(loadAd, retryDelay);
        }
      });

      globalRewardedAd.load();
    } catch (e) {
      console.error('Error creating rewarded ad:', e);
      globalRewardedAd = null;
    }
  }, []);

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;
    if (!globalRewardedAd) loadAd();
    
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
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
          loadRetries = 0;
          loadAd(); // Preload next
          resolve(earnedReward);
        }
      );

      const unsubscribeError = globalRewardedAd!.addAdEventListener(
        AdEventType.ERROR,
        (error) => {
          console.error('Error showing rewarded ad:', error);
          unsubscribeEarned();
          unsubscribeClosed();
          unsubscribeError();
          isShowing = false;
          globalRewardedAd = null;
          resolve(false);
        }
      );

      globalRewardedAd!.show().catch(err => {
        console.error('Error showing rewarded ad:', err);
        unsubscribeEarned();
        unsubscribeClosed();
        unsubscribeError();
        isShowing = false;
        resolve(false);
      });
    });
  };

  return { loaded, showAd };
}
