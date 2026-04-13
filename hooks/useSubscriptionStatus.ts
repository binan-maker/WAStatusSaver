import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Platform } from "react-native";
import { apiRequest } from "@/lib/query-client";
import { getPaymentDeviceId } from "@/lib/device-identity";
import { SUBSCRIPTION_PLANS, SubscriptionPlanId } from "@/shared/subscription-plans";

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
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus>({ active: false });
  const [loading, setLoading] = useState(true);
  const [payingPlanId, setPayingPlanId] = useState<SubscriptionPlanId | null>(null);

  useEffect(() => {
    getPaymentDeviceId()
      .then(setDeviceId)
      .catch(() => setStatus({ active: false, message: "Device setup failed" }));
  }, []);

  const refresh = useCallback(async () => {
    if (!deviceId) return;

    try {
      setLoading(true);
      const response = await apiRequest("GET", `/api/subscriptions/status/${deviceId}`);
      setStatus(await response.json());
    } catch (error) {
      setStatus({
        active: false,
        configured: false,
        message: error instanceof Error ? error.message : "Unable to check subscription",
      });
    } finally {
      setLoading(false);
    }
  }, [deviceId]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  const startPayment = useCallback(
    async (planId: SubscriptionPlanId) => {
      if (!deviceId || payingPlanId) return false;

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
        const orderResponse = await apiRequest("POST", "/api/payments/razorpay/create-order", {
          planId,
          deviceId,
        });
        const order = (await orderResponse.json()) as CreateOrderResponse;

        const result = (await RazorpayCheckout.open({
          key: order.keyId,
          amount: order.amount,
          currency: order.currency,
          name: "StatusVault",
          description: order.plan.title,
          order_id: order.orderId,
          prefill: {},
          theme: { color: "#00FFA3" },
          notes: {
            deviceId,
            planId,
          },
        })) as RazorpaySuccess;

        const verifyResponse = await apiRequest("POST", "/api/payments/razorpay/verify", {
          planId,
          deviceId,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_order_id: result.razorpay_order_id,
          razorpay_signature: result.razorpay_signature,
        });

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
    [deviceId, payingPlanId, refresh],
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