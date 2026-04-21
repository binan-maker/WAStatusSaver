import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as IAP from "react-native-iap";
import { apiRequest } from "@/lib/query-client";
import type { SubscriptionPlanId } from "@/shared/subscription-plans";
import type { PaymentProviderHookOptions, PaymentProviderHookResult } from "../../shared/types";
import { GOOGLE_PLAY_PLANS, GOOGLE_PLAY_PRODUCT_IDS, getPlanByProductId } from "./plans";

export function useGooglePlayPayment(opts: PaymentProviderHookOptions): PaymentProviderHookResult {
  const { deviceId, user, getIdToken, onPaymentSuccess } = opts;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  const [payingPlanId, setPayingPlanId] = useState<SubscriptionPlanId | null>(null);
  const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);
  const [successPlanId, setSuccessPlanId] = useState<SubscriptionPlanId | null>(null);

  const safe = <T>(setter: (v: T) => void) =>
    (v: T) => { if (isMountedRef.current) setter(v); };

  const safeSetPayingPlanId = safe(setPayingPlanId);
  const safeSetPaymentJustSucceeded = safe(setPaymentJustSucceeded);
  const safeSetSuccessPlanId = safe(setSuccessPlanId);

  // Refs to give the onPurchaseSuccess callback access to the latest values
  // (the callback identity is captured once by useIAP via optionsRef).
  const deviceIdRef = useRef(deviceId);
  const userRef = useRef(user);
  const getIdTokenRef = useRef(getIdToken);
  const onPaymentSuccessRef = useRef(onPaymentSuccess);
  const payingPlanIdRef = useRef<SubscriptionPlanId | null>(null);
  useEffect(() => { deviceIdRef.current = deviceId; }, [deviceId]);
  useEffect(() => { userRef.current = user; }, [user]);
  useEffect(() => { getIdTokenRef.current = getIdToken; }, [getIdToken]);
  useEffect(() => { onPaymentSuccessRef.current = onPaymentSuccess; }, [onPaymentSuccess]);
  useEffect(() => { payingPlanIdRef.current = payingPlanId; }, [payingPlanId]);

  const finishTransactionRef = useRef<((args: any) => Promise<void>) | null>(null);

  const verifyAndFinish = useCallback(async (purchase: IAP.Purchase): Promise<boolean> => {
    const dId = deviceIdRef.current;
    const u = userRef.current;
    if (!dId || !u) return false;

    const plan = getPlanByProductId(purchase.productId);
    if (!plan) return false;

    const purchaseToken = (purchase as any).purchaseToken
      ?? (purchase as any).purchaseTokenAndroid
      ?? "";
    if (!purchaseToken) return false;

    const freshToken = await getIdTokenRef.current(true).catch(() => null);
    if (!freshToken) return false;

    try {
      const res = await apiRequest(
        "POST",
        "/api/payments/google-play/verify",
        {
          purchaseToken,
          productId: purchase.productId,
          planId: plan.id,
          deviceId: dId,
        },
        { Authorization: `Bearer ${freshToken}` },
      );

      if (!res.ok) return false;
      const data = await res.json();
      if (!data?.active) return false;

      onPaymentSuccessRef.current(plan.id, data);

      try {
        if (finishTransactionRef.current) {
          await finishTransactionRef.current({ purchase, isConsumable: false });
        }
      } catch {}

      if (payingPlanIdRef.current === plan.id) {
        safeSetPayingPlanId(null);
        safeSetSuccessPlanId(plan.id);
        safeSetPaymentJustSucceeded(true);
      }
      return true;
    } catch {
      return false;
    }
  }, []);

  const {
    connected,
    availablePurchases,
    requestPurchase,
    finishTransaction,
    fetchProducts,
    getAvailablePurchases,
  } = IAP.useIAP({
    onPurchaseSuccess: (purchase) => {
      verifyAndFinish(purchase).catch(() => {});
    },
    onPurchaseError: (err) => {
      const code = (err as any)?.code;
      if (code === "E_USER_CANCELLED" || code === "USER_CANCELED") {
        safeSetPayingPlanId(null);
        return;
      }
      safeSetPayingPlanId(null);
      Alert.alert("Purchase Failed", err?.message || "Something went wrong. Please try again.");
    },
  });

  // Keep latest finishTransaction available to the verify helper.
  useEffect(() => {
    finishTransactionRef.current = finishTransaction;
  }, [finishTransaction]);

  // When subscription products are restorable (reinstall, re-login),
  // verify them with the server so Pro reactivates automatically.
  useEffect(() => {
    if (!connected || !deviceId || !user) return;
    if (!availablePurchases || availablePurchases.length === 0) return;

    (async () => {
      for (const purchase of availablePurchases) {
        if (!getPlanByProductId(purchase.productId)) continue;
        const ok = await verifyAndFinish(purchase);
        if (ok) break;
      }
    })().catch(() => {});
  }, [connected, availablePurchases, deviceId, user, verifyAndFinish]);

  // On mount: ask the store about any existing entitlements so the
  // availablePurchases listener above has data to work with.
  useEffect(() => {
    if (!connected || Platform.OS !== "android") return;
    getAvailablePurchases().catch(() => {});
  }, [connected, getAvailablePurchases]);

  const startPayment = useCallback(async (planId: SubscriptionPlanId): Promise<boolean> => {
    if (!deviceId || payingPlanId) return false;

    const token = await getIdToken();
    if (!user || !token) {
      Alert.alert("Sign in required", "Please sign in with Google first so your subscription is safely saved.");
      return false;
    }

    if (Platform.OS !== "android") {
      Alert.alert("Android Only", "Google Play purchases are only available in the Android app build.");
      return false;
    }

    if (!connected) {
      Alert.alert("Store not ready", "Could not connect to Google Play. Please make sure you are signed in to the Play Store and try again.");
      return false;
    }

    const plan = GOOGLE_PLAY_PLANS.find((p) => p.id === planId);
    if (!plan) return false;

    safeSetPayingPlanId(planId);

    try {
      // Make sure the SKU is loaded by Play Billing before requesting.
      await fetchProducts({
        skus: [plan.googlePlayProductId],
        type: "subs",
      }).catch(() => {});

      // requestPurchase is event-based: the purchaseUpdatedListener
      // (wired through useIAP onPurchaseSuccess) handles the result.
      await requestPurchase({
        type: "subs",
        request: {
          android: { skus: [plan.googlePlayProductId] },
          ios: { sku: plan.googlePlayProductId },
        },
      } as any);

      return true;
    } catch (err: any) {
      safeSetPayingPlanId(null);
      const code = err?.code || (err as any)?.debugMessage;
      if (code === "E_USER_CANCELLED" || code === "USER_CANCELED") return false;
      Alert.alert("Purchase Failed", err?.message || "Something went wrong. Please try again.");
      return false;
    }
  }, [deviceId, payingPlanId, getIdToken, user, connected, fetchProducts, requestPurchase, safeSetPayingPlanId]);

  const dismissPaymentSuccess = useCallback(() => {
    safeSetPaymentJustSucceeded(false);
    safeSetSuccessPlanId(null);
  }, [safeSetPaymentJustSucceeded, safeSetSuccessPlanId]);

  return {
    plans: GOOGLE_PLAY_PLANS,
    payingPlanId,
    paymentJustSucceeded,
    successPlanId,
    isRecoveringPayment: false,
    providerName: "google-play",
    startPayment,
    dismissPaymentSuccess,
  };
}
