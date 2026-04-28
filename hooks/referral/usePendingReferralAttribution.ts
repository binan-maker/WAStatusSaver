import { useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFirebaseAuth } from '@/contexts/AuthContext';
import { apiRequest } from '@/lib/query-client';
import { getPaymentDeviceId } from '@/lib/device-identity';
import {
  normalizeReferralCode,
  type AttributeInstallResponse,
} from '@/shared/referral-types';

const PENDING_REF_KEY = 'pending_referral_code';

/**
 * After the user signs in, if a pending referral code was captured from a
 * deep-link (or Play Install Referrer in the future), attribute the install.
 * Runs at most once per signed-in session per pending code.
 */
export function usePendingReferralAttribution() {
  const { user, getIdToken } = useFirebaseAuth();
  const triedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!user) return;
    // Avoid retrying for the same uid
    if (triedRef.current === user.uid) return;
    triedRef.current = user.uid;

    (async () => {
      try {
        const pending = await AsyncStorage.getItem(PENDING_REF_KEY);
        const code = normalizeReferralCode(pending);
        if (!code || code.length < 3) return;

        const token = await getIdToken().catch(() => null);
        if (!token) return;

        const deviceId = await getPaymentDeviceId();
        const res = await apiRequest(
          'POST',
          '/api/referrals/attribute-install',
          { code, deviceId },
          { Authorization: `Bearer ${token}` },
        );

        // On success OR a "permanent failure" (already attributed, self-refer,
        // device used, invalid code) we MUST clear the pending key so we don't
        // keep retrying on every sign-in.
        await AsyncStorage.removeItem(PENDING_REF_KEY).catch(() => {});

        const body = (await res.json()) as AttributeInstallResponse;
        if (body.success) {
          // Silent success — Invite screen will show the updated count next time.
          __DEV__ && console.log('[referral] install attributed to', code);
        }
      } catch (err) {
        // Body parse error / network error — keep the key for next session retry,
        // but only if it really was network-ish. If apiRequest threw because the
        // server returned a 4xx with JSON body, the code is bad — clear it.
        const msg = err instanceof Error ? err.message : '';
        if (/^4\d\d/.test(msg)) {
          await AsyncStorage.removeItem(PENDING_REF_KEY).catch(() => {});
        }
        __DEV__ && console.log('[referral] attribute-install failed:', msg);
      }
    })();
  }, [user]);
}
