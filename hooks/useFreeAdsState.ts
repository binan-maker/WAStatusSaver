import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const FREE_ADS_UNTIL_KEY = 'free_ads_until_timestamp';

export function useFreeAdsState() {
  const [isFreeAds, setIsFreeAds] = useState(false);
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
          setIsFreeAds(true);
          setTimeRemaining(Math.ceil((freeUntil - now) / 1000));
        } else {
          setIsFreeAds(false);
          setTimeRemaining(0);
          await AsyncStorage.removeItem(FREE_ADS_UNTIL_KEY);
        }
      } else {
        setIsFreeAds(false);
        setTimeRemaining(0);
      }
    } catch (error) {
      console.error('Error checking free ads status:', error);
    }
  };

  const setFreeAdsFor24Hours = async () => {
    try {
      const freeUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await AsyncStorage.setItem(FREE_ADS_UNTIL_KEY, freeUntil.toString());
      setIsFreeAds(true);
      setTimeRemaining(24 * 60 * 60);
    } catch (error) {
      console.error('Error setting free ads:', error);
    }
  };

  const formatTimeRemaining = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  return {
    isFreeAds,
    timeRemaining,
    setFreeAdsFor24Hours,
    formatTimeRemaining,
  };
}
