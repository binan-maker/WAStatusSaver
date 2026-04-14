import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { getPaymentDeviceId } from "@/lib/device-identity";
import { SUBSCRIPTION_PLANS, SubscriptionPlanId } from "@/shared/subscription-plans";
import { useFirebaseAuth } from "@/contexts/AuthContext";

const SUBSCRIPTION_CACHE_KEY = "@statusvault_subscription_status";

type SubscriptionStatus = {
  active: boolean;
  configured?: boolean;
  lifetime?: boolean;
  planId?: string | null;
  paidUntil?: string | null;
  message?: string;
};

type CreateOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  plan: typeof SUBSCRIPTION_PLANS[number];
};

type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

function getRazorpayCheckout() {
  try {
    return require("react-native-razorpay").default;
  } catch {
    return null;
  }
}

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
  const [payingPlanId, setPayingPlanId] = useState<SubscriptionPlanId | null>(null);

  // On mount: load the last-known subscription status from cache so paid users
  // start in Pro Mode immediately — no ads flash while the server check runs.
  useEffect(() => {
    AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY)
      .then((cached) => {
        if (cached) {
          const parsed: SubscriptionStatus = JSON.parse(cached);
          // Only restore active subscriptions; expired/inactive can wait for server
          if (parsed.active) setStatus(parsed);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    getPaymentDeviceId()
      .then(setDeviceId)
      .catch(() => setStatus({ active: false, message: "Device setup failed" }));
  }, []);

  const refresh = useCallback(async () => {
    if (!deviceId) return;

    try {
      setLoading(true);
      const token = await getIdToken();
      const response = await apiRequest(
        "GET",
        `/api/subscriptions/status/${deviceId}`,
        undefined,
        token ? { Authorization: `Bearer ${token}` } : undefined,
      );
      const freshStatus: SubscriptionStatus = await response.json();
      setStatus(freshStatus);
      // Persist to cache so next launch is instant for Pro users
      AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(freshStatus)).catch(() => {});
    } catch (error) {
      setStatus({
        active: false,
        configured: false,
        message: error instanceof Error ? error.message : "Unable to check subscription",
      });
    } finally {
      setLoading(false);
    }
  }, [deviceId, getIdToken]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const startPayment = useCallback(
    async (planId: SubscriptionPlanId) => {
      if (!deviceId || payingPlanId) return false;

      const token = await getIdToken();
      if (!user || !token) {
        Alert.alert("Sign in required", "Please sign in with Google first so your subscription is saved safely in Firebase.");
        return false;
      }

      if (Platform.OS === "web") {
        Alert.alert("Open on phone", "Razorpay checkout is available in the Android app build.");
        return false;
      }

      const RazorpayCheckout = getRazorpayCheckout();
      if (!RazorpayCheckout) {
        Alert.alert("Payment setup needed", "Razorpay checkout is not available in this build. Create a development or production Android build after installing the payment module.");
        return false;
      }

      setPayingPlanId(planId);

      try {
        const orderResponse = await apiRequest(
          "POST",
          "/api/payments/razorpay/create-order",
          {
            planId,
            deviceId,
          },
          { Authorization: `Bearer ${token}` },
        );
        const order = (await orderResponse.json()) as CreateOrderResponse;

        const result = (await RazorpayCheckout.open({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "StatusVault",
          description: order.plan.title,
          order_id: order.orderId,
          prefill: {
            email: user?.email || "",
            name: user?.displayName || "",
          },
          theme: { color: "#00FFA3" },
          notes: {
            deviceId,
            planId,
            googleUid: user?.uid || "",
          },
        })) as RazorpaySuccess;

        const verifyResponse = await apiRequest(
          "POST",
          "/api/payments/razorpay/verify",
          {
            planId,
            deviceId,
            razorpay_payment_id: result.razorpay_payment_id,
            razorpay_order_id: result.razorpay_order_id,
            razorpay_signature: result.razorpay_signature,
          },
          { Authorization: `Bearer ${token}` },
        );

        setStatus(await verifyResponse.json());
        Alert.alert("Payment successful", "Ads are now removed for your selected plan.");
        return true;
      } catch (error) {
        Alert.alert("Payment not completed", error instanceof Error ? error.message : "Your subscription was not activated. If money was debited, contact support with your Razorpay payment ID.");
        await refresh();
        return false;
      } finally {
        setPayingPlanId(null);
      }
    },
    [deviceId, getIdToken, payingPlanId, refresh, user],
  );

  const remainingSeconds = useMemo(() => getRemainingSeconds(status), [status]);

  return {
    deviceId,
    status,
    loading,
    isSubscribed: Boolean(status.active),
    remainingSeconds,
    payingPlanId,
    plans: SUBSCRIPTION_PLANS,
    refresh,
    startPayment,
  };
}