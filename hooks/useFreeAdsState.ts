import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';

const FREE_ADS_UNTIL_KEY = 'free_ads_until_timestamp';

export function useFreeAdsState() {
  const { isSubscribed, remainingSeconds: subscriptionRemainingSeconds, status } = useSubscriptionStatus();
  const [isRewardFreeAds, setIsRewardFreeAds] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  // Check free ads status on mount and periodically
  useEffect(() => {
    checkFreeAdsStatus();
    const interval = setInterval(checkFreeAdsStatus, 1000);
    return () => clearInterval(interval);
  }, []);

  const checkFreeAdsStatus = async () => {
    try {
      const stored = await AsyncStorage.getItem(FREE_ADS_UNTIL_KEY);
      if (stored) {
        const freeUntil = parseInt(stored, 10);
        const now = Date.now();
        if (now < freeUntil) {
          setIsRewardFreeAds(true);
          setTimeRemaining(Math.ceil((freeUntil - now) / 1000));
        } else {
          setIsRewardFreeAds(false);
          setTimeRemaining(0);
          await AsyncStorage.removeItem(FREE_ADS_UNTIL_KEY);
        }
      } else {
        setIsRewardFreeAds(false);
        setTimeRemaining(0);
      }
    } catch (error) {
      console.error('Error checking free ads status:', error);
    }
  };

  const setFreeAdsFor30Days = async () => {
    try {
      const freeUntil = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
      await AsyncStorage.setItem(FREE_ADS_UNTIL_KEY, freeUntil.toString());
      setIsRewardFreeAds(true);
      setTimeRemaining(30 * 24 * 60 * 60);
    } catch (error) {
      console.error('Error setting free ads:', error);
    }
  };

  const setFreeAdsFor5Hours = async () => {
    try {
      const freeUntil = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
      await AsyncStorage.setItem(FREE_ADS_UNTIL_KEY, freeUntil.toString());
      setIsRewardFreeAds(true);
      setTimeRemaining(2 * 60 * 60);
    } catch (error) {
      console.error('Error setting free ads:', error);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return {
    isFreeAds: isSubscribed || isRewardFreeAds,
    isSubscribed,
    subscriptionPlanId: status.planId || null,
    timeRemaining: isSubscribed ? subscriptionRemainingSeconds : timeRemaining,
    setFreeAdsFor30Days,
    setFreeAdsFor5Hours,
    formatTimeRemaining,
  };
}
