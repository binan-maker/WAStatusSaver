import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { apiRequest } from "@/lib/query-client";
import type { SubscriptionPlanId } from "@/shared/subscription-plans";
import type { PaymentProviderHookOptions, PaymentProviderHookResult } from "../../shared/types";
import { GOOGLE_PLAY_PLANS, getPlanByProductId } from "./plans";

function getIAP() {
  try {
    return require("react-native-iap");
  } catch {
    return null;
  }
}

export function useGooglePlayPayment(opts: PaymentProviderHookOptions): PaymentProviderHookResult {
  const { deviceId, user, getIdToken, onPaymentSuccess, refresh } = opts;

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const iap = getIAP();
      if (iap) iap.endConnection().catch(() => {});
    };
  }, []);

  const [payingPlanId, setPayingPlanId] = useState<SubscriptionPlanId | null>(null);
  const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);
  const [successPlanId, setSuccessPlanId] = useState<SubscriptionPlanId | null>(null);

  const safe = <T>(setter: (v: T) => void) =>
    (v: T) => { if (isMountedRef.current) setter(v); };

  const safeSetPayingPlanId = safe(setPayingPlanId);
  const safeSetPaymentJustSucceeded = safe(setPaymentJustSucceeded);
  const safeSetSuccessPlanId = safe(setSuccessPlanId);

  useEffect(() => {
    if (!deviceId || !user) return;
    const iap = getIAP();
    if (!iap) return;

    const checkUnfinished = async () => {
      try {
        await iap.initConnection();
        const purchases = await iap.getAvailablePurchases();
        if (!purchases || purchases.length === 0) return;

        const freshToken = await getIdToken(true).catch(() => null);
        if (!freshToken) return;

        for (const purchase of purchases) {
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
              Alert.alert("Pro Access Activated", "Your Google Play purchase has been verified. Ads are removed!");
              await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
              break;
            }
          } catch {}
        }
      } catch {}
    };

    checkUnfinished();
  }, [deviceId, user, getIdToken, onPaymentSuccess]);

  const startPayment = useCallback(async (planId: SubscriptionPlanId): Promise<boolean> => {
    if (!deviceId || payingPlanId) return false;

    const token = await getIdToken();
    if (!user || !token) {
      Alert.alert("Sign in required", "Please sign in with Google first so your subscription is safely saved.");
      return false;
    }

    if (Platform.OS === "web") {
      Alert.alert("Open on phone", "Google Play purchases are only available in the Android app build.");
      return false;
    }

    const iap = getIAP();
    if (!iap) {
      Alert.alert("Purchase unavailable", "Google Play Billing is not available in this build.");
      return false;
    }

    const plan = GOOGLE_PLAY_PLANS.find((p) => p.id === planId);
    if (!plan) return false;

    safeSetPayingPlanId(planId);

    try {
      await iap.initConnection();

      const products = await iap.getSubscriptions({
        skus: [plan.googlePlayProductId],
      });

      if (!products || products.length === 0) {
        safeSetPayingPlanId(null);
        Alert.alert("Product not found", "This subscription plan is not available in the Play Store right now.");
        return false;
      }

      const purchase = await iap.requestSubscription({
        sku: plan.googlePlayProductId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });

      if (!purchase || !purchase.purchaseToken) {
        safeSetPayingPlanId(null);
        return false;
      }

      const freshToken = await getIdToken(true).catch(() => null);
      if (!freshToken) {
        safeSetPayingPlanId(null);
        Alert.alert(
          "Payment Received — Activating...",
          "Your purchase was recorded but we lost your session. Reopen the app and your Pro access will activate automatically.",
        );
        return false;
      }

      const res = await apiRequest(
        "POST",
        "/api/payments/google-play/verify",
        {
          purchaseToken: purchase.purchaseToken,
          productId: plan.googlePlayProductId,
          planId: plan.id,
          deviceId,
        },
        { Authorization: `Bearer ${freshToken}` },
      );

      const data = await res.json();

      if (data.active) {
        await iap.finishTransaction({ purchase, isConsumable: false }).catch(() => {});
        onPaymentSuccess(planId, data);
        safeSetPayingPlanId(null);
        safeSetSuccessPlanId(planId);
        safeSetPaymentJustSucceeded(true);
        return true;
      } else {
        safeSetPayingPlanId(null);
        Alert.alert(
          "Payment Received — Activating...",
          "Your purchase was recorded. Your Pro access will activate automatically the next time you open the app.",
        );
        await refresh(true);
        return false;
      }
    } catch (err: any) {
      safeSetPayingPlanId(null);
      const code = err?.code;
      if (code === "E_USER_CANCELLED") return false;
      Alert.alert("Purchase Failed", err?.message || "Something went wrong. Please try again.");
      return false;
    }
  }, [deviceId, payingPlanId, getIdToken, user, onPaymentSuccess, refresh, safeSetPayingPlanId, safeSetSuccessPlanId, safeSetPaymentJustSucceeded]);

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
