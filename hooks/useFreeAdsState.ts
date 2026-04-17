import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSubscriptionStatus } from '@/hooks/useSubscriptionStatus';
import { useFirebaseAuth } from '@/contexts/AuthContext';
import { REWARD_ADS_KEY_PREFIX } from '@/contexts/AuthContext';

export function useFreeAdsState() {
  const {
    isSubscribed,
    remainingSeconds: subscriptionRemainingSeconds,
    status,
    loading: subscriptionLoading,
  } = useSubscriptionStatus();

  const { user } = useFirebaseAuth();
  const uid = user?.uid ?? null;

  const [isRewardFreeAds, setIsRewardFreeAds] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const getStorageKey = (currentUid: string | null) =>
    currentUid ? `${REWARD_ADS_KEY_PREFIX}_${currentUid}` : REWARD_ADS_KEY_PREFIX;

  const uidRef = useRef(uid);

  useEffect(() => {
    uidRef.current = uid;
    checkFreeAdsStatus(uid);
  }, [uid]);

  useEffect(() => {
    checkFreeAdsStatus(uidRef.current);
    const interval = setInterval(() => checkFreeAdsStatus(uidRef.current), 1000);
    return () => clearInterval(interval);
  }, []);

  const checkFreeAdsStatus = async (currentUid: string | null) => {
    try {
      const key = getStorageKey(currentUid);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const freeUntil = parseInt(stored, 10);
        const now = Date.now();
        if (now < freeUntil) {
          setIsRewardFreeAds(true);
          setTimeRemaining(Math.ceil((freeUntil - now) / 1000));
        } else {
          setIsRewardFreeAds(false);
          setTimeRemaining(0);
          await AsyncStorage.removeItem(key);
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
      const key = getStorageKey(uidRef.current);
      const freeUntil = Date.now() + 30 * 24 * 60 * 60 * 1000;
      await AsyncStorage.setItem(key, freeUntil.toString());
      setIsRewardFreeAds(true);
      setTimeRemaining(30 * 24 * 60 * 60);
    } catch (error) {
      console.error('Error setting free ads:', error);
    }
  };

  const setFreeAdsFor5Hours = async () => {
    try {
      const key = getStorageKey(uidRef.current);
      const freeUntil = Date.now() + 2 * 60 * 60 * 1000;
      await AsyncStorage.setItem(key, freeUntil.toString());
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

  const isFreeAds = isSubscribed || isRewardFreeAds;

  return {
    loading: subscriptionLoading,
    isFreeAds,
    isSubscribed,
    subscriptionPlanId: status.planId || null,
    timeRemaining: isSubscribed ? subscriptionRemainingSeconds : timeRemaining,
    setFreeAdsFor30Days,
    setFreeAdsFor5Hours,
    formatTimeRemaining,
  };
}
