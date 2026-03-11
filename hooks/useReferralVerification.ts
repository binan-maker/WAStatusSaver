import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFreeAdsState } from './useFreeAdsState';

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN || 'http://localhost:5000';

interface ReferralResponse {
  success: boolean;
  message: string;
  adFreeUntil?: number;
  friendsInvited?: number;
}

export function useReferralVerification() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [referralCode, setReferralCode] = useState<string>('');
  const [friendsInvited, setFriendsInvited] = useState(0);
  const { setFreeAdsFor30Days } = useFreeAdsState();

  useEffect(() => {
    loadReferralData();
    // Verify referral on app load
    verifyInstallReferrer();
  }, []);

  const loadReferralData = async () => {
    try {
      const code = await AsyncStorage.getItem('referralCode');
      const count = await AsyncStorage.getItem('friendsInvited');
      if (code) setReferralCode(code);
      if (count) setFriendsInvited(parseInt(count, 10));
    } catch (e) {
      console.log('Failed to load referral data:', e);
    }
  };

  const verifyInstallReferrer = async () => {
    // This will be called from native code via platform channels
    // For now, we listen for install referrer from Play Store
    try {
      const referrer = await AsyncStorage.getItem('installReferrer');
      if (referrer) {
        await verifyReferral(referrer);
      }
    } catch (e) {
      console.log('Install referrer check failed:', e);
    }
  };

  const verifyReferral = async (inviterCode: string) => {
    if (isVerifying || !inviterCode) return;
    
    try {
      setIsVerifying(true);
      const response = await fetch(`${API_BASE}/api/referrals/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inviterCode,
          deviceId: await AsyncStorage.getItem('deviceId'),
          timestamp: Date.now(),
        }),
      });

      if (!response.ok) throw new Error('Verification failed');

      const data = (await response.json()) as ReferralResponse;
      if (data.success && data.adFreeUntil) {
        // Grant 30 days free ads
        await setFreeAdsFor30Days();
        console.log('Referral verified! 30 days free ads granted');
      }
    } catch (e) {
      console.log('Referral verification error:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  return {
    isVerifying,
    referralCode,
    friendsInvited,
    verifyReferral,
  };
}
