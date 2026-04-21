import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import * as IAP from "react-native-iap";
import { apiRequest } from "@/lib/query-client";
import type { SubscriptionPlanId } from "@/shared/subscription-plans";
import type { PaymentProviderHookOptions, PaymentProviderHookResult } from "../../shared/types";
import { GOOGLE_PLAY_PLANS, getPlanByProductId } from "./plans";

export function useGooglePlayPayment(opts: PaymentProviderHookOptions): PaymentProviderHookResult {
  const { deviceId, user, getIdToken, onPaymentSuccess, refresh } = opts;

  // useIAP (v15) only provides State now, Actions are Standalone
  const {
    connected,
    currentPurchase,
    availablePurchases,
  } = IAP.useIAP();

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

  // Connection Management
  useEffect(() => {
    if (Platform.OS === 'android') {
      IAP.initConnection().catch(() => {});
    }
  }, []);

  // Handle successful purchase from the hook state
  useEffect(() => {
    const processPurchase = async () => {
      if (!currentPurchase || !deviceId || !user) return;

      try {
        const plan = getPlanByProductId(currentPurchase.productId);
        if (!plan) return;

        const freshToken = await getIdToken(true).catch(() => null);
        if (!freshToken) return;

        const res = await apiRequest(
          "POST",
          "/api/payments/google-play/verify",
          {
            purchaseToken: currentPurchase.purchaseToken,
            productId: currentPurchase.productId,
            planId: plan.id,
            deviceId,
          },
          { Authorization: `Bearer ${freshToken}` },
        );

        const data = await res.json();
        if (data.active) {
          await IAP.finishTransaction({ purchase: currentPurchase, isConsumable: false }).catch(() => {});
          onPaymentSuccess(plan.id, data);
          
          if (payingPlanId === plan.id) {
            safeSetPayingPlanId(null);
            safeSetSuccessPlanId(plan.id);
            safeSetPaymentJustSucceeded(true);
          }
        }
      } catch {}
    };

    processPurchase();
  }, [currentPurchase, deviceId, user, getIdToken, onPaymentSuccess]);

  // Check for available purchases (subscription restoration)
  useEffect(() => {
    if (!connected || !deviceId || !user) return;

    const checkRestoration = async () => {
      try {
        if (!availablePurchases || availablePurchases.length === 0) return;

        const freshToken = await getIdToken(true).catch(() => null);
        if (!freshToken) return;

        for (const purchase of availablePurchases) {
          const plan = getPlanByProductId(purchase.productId);
          if (!plan) continue;

          try {
            const res = await apiRequest(
              "POST",
              "/api/payments/google-play/verify",
              {
                purchaseToken: purchase.purchaseToken,
                productId: purchase.productId,
                planId: plan.id,
                deviceId,
              },
              { Authorization: `Bearer ${freshToken}` },
            );
            const data = await res.json();
            if (data.active) {
              onPaymentSuccess(plan.id, data);
              await IAP.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
              break;
            }
          } catch {}
        }
      } catch {}
    };

    checkRestoration();
  }, [connected, availablePurchases, deviceId, user, getIdToken, onPaymentSuccess]);

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
      await IAP.initConnection().catch(() => {});
    }

    const plan = GOOGLE_PLAY_PLANS.find((p) => p.id === planId);
    if (!plan) return false;

    safeSetPayingPlanId(planId);

    try {
      // Compatibility Shield: Try getSubscriptions, fall back to getProducts correctly
      const fetcher = (IAP as any).getSubscriptions || (IAP as any).getProducts;
      
      if (typeof fetcher === 'function') {
        await fetcher({ skus: [plan.googlePlayProductId] });
      }

      // Action: Try requestSubscription, fall back to requestPurchase
      const requester = (IAP as any).requestSubscription || (IAP as any).requestPurchase;
      
      if (typeof requester === 'function') {
        await requester({
          sku: plan.googlePlayProductId,
        });
      } else {
        throw new Error("Billing system not initialized in this build.");
      }

      return true;
    } catch (err: any) {
      safeSetPayingPlanId(null);
      const code = err?.code || (err as any)?.debugMessage;
      if (code === "E_USER_CANCELLED" || code === "USER_CANCELED") return false;
      Alert.alert("Purchase Failed", err?.message || "Something went wrong. Please try again.");
      return false;
    }
  }, [deviceId, payingPlanId, getIdToken, user, connected]);

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
