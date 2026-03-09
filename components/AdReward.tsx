import React, { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { AD_UNIT_IDS, ADS_ENABLED } from '@/constants/admob';

const adUnitId = __DEV__ ? TestIds.REWARDED : AD_UNIT_IDS.REWARDED;

let rewarded: RewardedAd | null = null;

export function useRewardedAd() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!ADS_ENABLED || Platform.OS === 'web') return;

    if (!rewarded) {
      rewarded = RewardedAd.createForAdRequest(adUnitId, {
        requestNonPersonalizedAdsOnly: true,
      });

      const unsubscribeLoaded = rewarded.addAdEventListener(
        RewardedAdEventType.LOADED,
        () => {
          setLoaded(true);
        }
      );

      const unsubscribeEarned = rewarded.addAdEventListener(
        RewardedAdEventType.EARNED_REWARD,
        () => {
          // Reward earned - this is handled by the caller via onReward callback
        }
      );

      const unsubscribeClosed = rewarded.addAdEventListener(
        RewardedAdEventType.CLOSED,
        () => {
          setLoaded(false);
          rewarded?.load();
        }
      );

      rewarded.load();

      return () => {
        unsubscribeLoaded();
        unsubscribeEarned();
        unsubscribeClosed();
      };
    }
  }, []);

  const showAd = async (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (loaded && rewarded) {
        const unsubscribe = rewarded.addAdEventListener(
          RewardedAdEventType.EARNED_REWARD,
          () => {
            unsubscribe();
            rewarded?.load();
            resolve(true);
          }
        );

        const unsubscribeClosed = rewarded.addAdEventListener(
          RewardedAdEventType.CLOSED,
          () => {
            unsubscribeClosed();
            // User closed without earning - but we still reload
            rewarded?.load();
            resolve(false);
          }
        );

        rewarded.show();
      } else {
        resolve(false);
      }
    });
  };

  return { loaded, showAd };
}
