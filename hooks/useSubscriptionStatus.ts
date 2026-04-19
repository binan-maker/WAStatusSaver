import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { getPaymentDeviceId } from "@/lib/device-identity";
import { useFirebaseAuth } from "@/contexts/AuthContext";
import { usePaymentProvider } from "@/payment-providers";
import type { SubscriptionStatus } from "@/payment-providers/_shared/types";
import type { SubscriptionPlanId } from "@/shared/subscription-plans";

export type { SubscriptionStatus };

const SUBSCRIPTION_CACHE_KEY = "@statusvault_subscription_status";

const CACHE_TTL_PRO_MS  = 6 * 60 * 60 * 1000;
const CACHE_TTL_FREE_MS = 30 * 60 * 1000;

function getRemainingSeconds(status: SubscriptionStatus) {
  if (!status.active) return 0;
  if (status.lifetime) return Number.MAX_SAFE_INTEGER;
  if (!status.paidUntil) return 0;
  return Math.max(0, Math.ceil((new Date(status.paidUntil).getTime() - Date.now()) / 1000));
}

export function useSubscriptionStatus() {
  const { user, getIdToken } = useFirebaseAuth();
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>({ active: false });
  const [loading, setLoading] = useState(true);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const safeSetStatus = useCallback((s: SubscriptionStatus) => {
    if (isMountedRef.current) setStatus(s);
  }, []);
  const safeSetLoading = useCallback((v: boolean) => {
    if (isMountedRef.current) setLoading(v);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY)
      .then((cached) => {
        if (cached) {
          const parsed: SubscriptionStatus = JSON.parse(cached);
          if (parsed.active) {
            if (!parsed.lifetime && parsed.paidUntil) {
              const expiresAt = new Date(parsed.paidUntil).getTime();
              if (expiresAt > Date.now()) safeSetStatus(parsed);
            } else {
              safeSetStatus(parsed);
            }
          }
        }
      })
      .catch(() => {});
  }, [safeSetStatus]);

  useEffect(() => {
    getPaymentDeviceId()
      .then(setDeviceId)
      .catch(() => safeSetStatus({ active: false, message: "Device setup failed" }));
  }, [safeSetStatus]);

  const refresh = useCallback(async (force = false) => {
    if (!deviceId) return;

    if (!force) {
      const raw = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY).catch(() => null);
      if (raw) {
        try {
          const cached: SubscriptionStatus = JSON.parse(raw);
          if (cached.active && !cached.lifetime && cached.paidUntil) {
            const expiresAt = new Date(cached.paidUntil).getTime();
            if (expiresAt <= Date.now()) {
              // expired — fall through to server
            } else {
              const age = Date.now() - (cached.cachedAt ?? 0);
              if (age < CACHE_TTL_PRO_MS) {
                safeSetStatus(cached);
                safeSetLoading(false);
                return;
              }
            }
          } else {
            const ttl = cached.active ? CACHE_TTL_PRO_MS : CACHE_TTL_FREE_MS;
            const age = Date.now() - (cached.cachedAt ?? 0);
            if (age < ttl) {
              safeSetStatus(cached);
              safeSetLoading(false);
              return;
            }
          }
        } catch {}
      }
    }

    try {
      safeSetLoading(true);
      const token = await getIdToken();
      const response = await apiRequest(
        "GET",
        `/api/subscriptions/status/${deviceId}`,
        undefined,
        token ? { Authorization: `Bearer ${token}` } : undefined,
      );
      const freshStatus: SubscriptionStatus = await response.json();
      const withTimestamp = { ...freshStatus, cachedAt: Date.now() };
      safeSetStatus(withTimestamp);
      AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(withTimestamp)).catch(() => {});
    } catch (error) {
      const cached = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY).catch(() => null);
      if (cached) {
        try {
          const parsed: SubscriptionStatus = JSON.parse(cached);
          if (parsed.active && parsed.paidUntil) {
            const expiresAt = new Date(parsed.paidUntil).getTime();
            if (expiresAt > Date.now()) {
              safeSetStatus(parsed);
              return;
            }
          }
        } catch {}
      }
      safeSetStatus({
        active: false,
        configured: false,
        message: error instanceof Error ? error.message : "Unable to check subscription",
      });
    } finally {
      safeSetLoading(false);
    }
  }, [deviceId, getIdToken, safeSetLoading, safeSetStatus]);

  useEffect(() => {
    refresh();
    const interval = setInterval(() => refresh(false), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const prevUidRef = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (uid && uid !== prevUidRef.current) {
      refresh(true);
    }
    prevUidRef.current = uid;
  }, [user?.uid, refresh]);

  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && next === "active") {
        refresh();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  const onPaymentSuccess = useCallback((planId: SubscriptionPlanId, newStatus: SubscriptionStatus) => {
    const withTimestamp = { ...newStatus, cachedAt: Date.now() };
    safeSetStatus(withTimestamp);
    AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(withTimestamp)).catch(() => {});
  }, [safeSetStatus]);

  const provider = usePaymentProvider({
    deviceId,
    user,
    getIdToken,
    onPaymentSuccess,
    refresh,
  });

  const remainingSeconds = useMemo(() => getRemainingSeconds(status), [status]);

  return {
    deviceId,
    status,
    loading,
    isSubscribed: Boolean(status.active),
    remainingSeconds,
    payingPlanId: provider.payingPlanId,
    paymentJustSucceeded: provider.paymentJustSucceeded,
    successPlanId: provider.successPlanId,
    isRecoveringPayment: provider.isRecoveringPayment,
    plans: provider.plans,
    providerName: provider.providerName,
    refresh,
    startPayment: provider.startPayment,
    dismissPaymentSuccess: provider.dismissPaymentSuccess,
  };
}
