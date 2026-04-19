import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import type { SubscriptionPlanId } from "@/shared/subscription-plans";
import type { PaymentProviderHookOptions, PaymentProviderHookResult, SubscriptionStatus } from "../../shared/types";
import { RAZORPAY_PLANS } from "./plans";

const PENDING_PAYMENT_KEY = "@statusvault_pending_payment";
const PAYMENT_INTENT_KEY = "@statusvault_payment_intent";

type PendingPayment = {
  planId: SubscriptionPlanId;
  deviceId: string;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
  savedAt: number;
};

type PaymentIntent = {
  orderId: string;
  planId: SubscriptionPlanId;
  deviceId: string;
  savedAt: number;
};

type CreateOrderResponse = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  plan: (typeof RAZORPAY_PLANS)[number];
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

export function useRazorpayPayment(opts: PaymentProviderHookOptions): PaymentProviderHookResult {
  const { deviceId, user, getIdToken, onPaymentSuccess, refresh } = opts;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const [payingPlanId, setPayingPlanId] = useState<SubscriptionPlanId | null>(null);
  const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);
  const [successPlanId, setSuccessPlanId] = useState<SubscriptionPlanId | null>(null);
  const [isRecoveringPayment, setIsRecoveringPayment] = useState(false);

  const safe = <T>(setter: (v: T) => void) =>
    (v: T) => { if (isMountedRef.current) setter(v); };

  const safeSetPayingPlanId = safe(setPayingPlanId);
  const safeSetPaymentJustSucceeded = safe(setPaymentJustSucceeded);
  const safeSetSuccessPlanId = safe(setSuccessPlanId);

  useEffect(() => {
    const check = async () => {
      const [pending, intent] = await Promise.all([
        AsyncStorage.getItem(PENDING_PAYMENT_KEY).catch(() => null),
        AsyncStorage.getItem(PAYMENT_INTENT_KEY).catch(() => null),
      ]);
      if (isMountedRef.current) setIsRecoveringPayment(Boolean(pending || intent));
    };
    check();
  }, []);

  const verifyPaymentDetails = useCallback(async (
    pending: PendingPayment,
    freshToken: string,
  ): Promise<SubscriptionStatus | null> => {
    try {
      const res = await apiRequest(
        "POST",
        "/api/payments/razorpay/verify",
        {
          planId: pending.planId,
          deviceId: pending.deviceId,
          razorpay_payment_id: pending.razorpay_payment_id,
          razorpay_order_id: pending.razorpay_order_id,
          razorpay_signature: pending.razorpay_signature,
        },
        { Authorization: `Bearer ${freshToken}` },
      );
      if (!res.ok) return null;
      return (await res.json()) as SubscriptionStatus;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!deviceId || !user) return;
    const retryPending = async () => {
      const raw = await AsyncStorage.getItem(PENDING_PAYMENT_KEY).catch(() => null);
      if (!raw) return;
      let pending: PendingPayment;
      try { pending = JSON.parse(raw); } catch {
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        return;
      }
      if (Date.now() - pending.savedAt > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        return;
      }
      const freshToken = await getIdToken(true).catch(() => null);
      if (!freshToken) return;
      const result = await verifyPaymentDetails(pending, freshToken);
      if (result?.active) {
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        onPaymentSuccess(pending.planId, result);
        Alert.alert("Pro Access Activated", "Your previous payment has been verified. Ads are now removed!");
      }
    };
    retryPending().catch(() => {});
  }, [deviceId, user, getIdToken, verifyPaymentDetails, onPaymentSuccess]);

  useEffect(() => {
    if (!deviceId || !user) return;
    const recoverIntent = async () => {
      const intentRaw = await AsyncStorage.getItem(PAYMENT_INTENT_KEY).catch(() => null);
      if (!intentRaw) return;
      const pendingRaw = await AsyncStorage.getItem(PENDING_PAYMENT_KEY).catch(() => null);
      if (pendingRaw) {
        await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        return;
      }
      let intent: PaymentIntent;
      try { intent = JSON.parse(intentRaw); } catch {
        await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        return;
      }
      if (Date.now() - intent.savedAt > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        return;
      }
      const freshToken = await getIdToken(true).catch(() => null);
      if (!freshToken) return;
      try {
        const res = await apiRequest(
          "POST",
          "/api/payments/razorpay/recover-order",
          { orderId: intent.orderId, planId: intent.planId, deviceId: intent.deviceId },
          { Authorization: `Bearer ${freshToken}` },
        );
        const data = await res.json();
        if (data.active) {
          await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
          onPaymentSuccess(intent.planId, { ...data, cachedAt: Date.now() });
          Alert.alert("Pro Access Activated", "Your payment has been verified and Pro is now active. Ads are removed!");
        } else if (data.status === "no_payment") {
          await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        }
      } catch {}
    };
    recoverIntent().catch(() => {});
  }, [deviceId, user, getIdToken, onPaymentSuccess]);

  const startPayment = useCallback(async (planId: SubscriptionPlanId): Promise<boolean> => {
    if (!deviceId || payingPlanId) return false;

    const token = await getIdToken();
    if (!user || !token) {
      Alert.alert("Sign in required", "Please sign in with Google first so your subscription is safely saved.");
      return false;
    }

    if (Platform.OS === "web") {
      Alert.alert("Open on phone", "Razorpay checkout is only available in the Android app build.");
      return false;
    }

    const RazorpayCheckout = getRazorpayCheckout();
    if (!RazorpayCheckout) {
      Alert.alert("Payment setup needed", "Razorpay is not available in this build. Create an Android development or production build first.");
      return false;
    }

    safeSetPayingPlanId(planId);

    let order: CreateOrderResponse;
    try {
      const orderRes = await apiRequest(
        "POST",
        "/api/payments/razorpay/create-order",
        { planId, deviceId },
        { Authorization: `Bearer ${token}` },
      );
      if (!orderRes.ok) {
        const errBody = await orderRes.json().catch(() => ({})) as any;
        throw new Error(errBody?.message || "Could not create payment order");
      }
      order = (await orderRes.json()) as CreateOrderResponse;
    } catch (err) {
      safeSetPayingPlanId(null);
      const reason = err instanceof Error ? err.message : String(err);
      Alert.alert("Could Not Start Payment", `No money has been charged. Please try again.\n\n${reason}`);
      return false;
    }

    const paymentIntent: PaymentIntent = { orderId: order.orderId, planId, deviceId, savedAt: Date.now() };
    await AsyncStorage.setItem(PAYMENT_INTENT_KEY, JSON.stringify(paymentIntent)).catch(() => {});

    let razorpayResult: RazorpaySuccess;
    try {
      razorpayResult = (await RazorpayCheckout.open({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: "StatusVault",
        description: order.plan.title,
        order_id: order.orderId,
        prefill: { email: user?.email || "", name: user?.displayName || "" },
        theme: { color: "#00FFA3" },
        notes: { deviceId, planId, googleUid: user?.uid || "" },
      })) as RazorpaySuccess;
    } catch (err: any) {
      safeSetPayingPlanId(null);
      const code = err?.code ?? err?.error?.code;
      if (code !== 0 && code !== "0") {
        Alert.alert("Payment Cancelled", "No payment was made.");
      }
      return false;
    }

    const pendingPayment: PendingPayment = {
      planId,
      deviceId,
      razorpay_payment_id: razorpayResult.razorpay_payment_id,
      razorpay_order_id: razorpayResult.razorpay_order_id,
      razorpay_signature: razorpayResult.razorpay_signature,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pendingPayment)).catch(() => {});
    await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});

    const freshToken = await getIdToken(true).catch(() => null);
    if (!freshToken) {
      safeSetPayingPlanId(null);
      Alert.alert("Payment Received — Activating...", "Your payment was received but we lost your session. Reopen the app and your Pro access will activate automatically.");
      return false;
    }

    const verifiedStatus = await verifyPaymentDetails(pendingPayment, freshToken);

    if (verifiedStatus?.active) {
      await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
      onPaymentSuccess(planId, verifiedStatus);
      safeSetPayingPlanId(null);
      safeSetSuccessPlanId(planId);
      safeSetPaymentJustSucceeded(true);
      return true;
    } else {
      safeSetPayingPlanId(null);
      Alert.alert(
        "Payment Received — Activating...",
        "Your payment was received successfully. Your Pro access will activate automatically the next time you open the app. You will NOT be charged again.",
      );
      await refresh(true);
      return false;
    }
  }, [deviceId, payingPlanId, getIdToken, user, verifyPaymentDetails, onPaymentSuccess, refresh, safeSetPayingPlanId, safeSetSuccessPlanId, safeSetPaymentJustSucceeded]);

  const dismissPaymentSuccess = useCallback(() => {
    safeSetPaymentJustSucceeded(false);
    safeSetSuccessPlanId(null);
  }, [safeSetPaymentJustSucceeded, safeSetSuccessPlanId]);

  return {
    plans: RAZORPAY_PLANS,
    payingPlanId,
    paymentJustSucceeded,
    successPlanId,
    isRecoveringPayment,
    providerName: "razorpay",
    startPayment,
    dismissPaymentSuccess,
  };
}
