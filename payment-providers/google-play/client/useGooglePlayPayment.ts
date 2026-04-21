import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { apiRequest } from "@/lib/query-client";
import type { SubscriptionPlanId } from "@/shared/subscription-plans";
import type { PaymentProviderHookOptions, PaymentProviderHookResult } from "../../shared/types";
import { GOOGLE_PLAY_PLANS, getPlanByProductId } from "./plans";

const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

// Lazy-load react-native-iap so Expo Go (which has no native module)
// never even imports it. Resolved once and cached.
function loadIAP(): typeof import("react-native-iap") | null {
  if (IS_EXPO_GO || Platform.OS !== "android") return null;
  try {
    return require("react-native-iap");
  } catch {
    return null;
  }
}
const IAP = loadIAP();

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

  const dismissPaymentSuccess = useCallback(() => {
    safeSetPaymentJustSucceeded(false);
    safeSetSuccessPlanId(null);
  }, [safeSetPaymentJustSucceeded, safeSetSuccessPlanId]);

  const startPaymentStub = useCallback(async (): Promise<boolean> => {
    Alert.alert(
      "Payments need a real build",
      Platform.OS !== "android"
        ? "Google Play purchases are only available in the Android app build."
        : "Google Play Billing isn't available in Expo Go. Build the Android app (development or production build) to test payments.",
    );
    return false;
  }, []);

  // ── Expo Go / non-android: stub so the screen still renders. ──
  if (!IAP) {
    return {
      plans: GOOGLE_PLAY_PLANS,
      payingPlanId,
      paymentJustSucceeded,
      successPlanId,
      isRecoveringPayment: false,
      providerName: "google-play",
      startPayment: startPaymentStub,
      dismissPaymentSuccess,
    };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useGooglePlayPaymentNative({
    opts,
    payingPlanId, paymentJustSucceeded, successPlanId,
    safeSetPayingPlanId, safeSetPaymentJustSucceeded, safeSetSuccessPlanId,
    dismissPaymentSuccess,
  });
}

// ──────────────────────────────────────────────────────────────────────────
//  Native-only implementation (only invoked when IAP module loaded)
// ──────────────────────────────────────────────────────────────────────────
function useGooglePlayPaymentNative(args: {
  opts: PaymentProviderHookOptions;
  payingPlanId: SubscriptionPlanId | null;
  paymentJustSucceeded: boolean;
  successPlanId: SubscriptionPlanId | null;
  safeSetPayingPlanId: (v: SubscriptionPlanId | null) => void;
  safeSetPaymentJustSucceeded: (v: boolean) => void;
  safeSetSuccessPlanId: (v: SubscriptionPlanId | null) => void;
  dismissPaymentSuccess: () => void;
}): PaymentProviderHookResult {
  const {
    opts: { deviceId, user, getIdToken, onPaymentSuccess },
    payingPlanId, paymentJustSucceeded, successPlanId,
    safeSetPayingPlanId, safeSetPaymentJustSucceeded, safeSetSuccessPlanId,
    dismissPaymentSuccess,
  } = args;

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

  const verifyAndFinish = useCallback(async (purchase: any): Promise<boolean> => {
    const dId = deviceIdRef.current;
    const u = userRef.current;
    if (!dId || !u) return false;

    const plan = getPlanByProductId(purchase.productId);
    if (!plan) return false;

    const purchaseToken = purchase.purchaseToken ?? purchase.purchaseTokenAndroid ?? "";
    if (!purchaseToken) return false;

    const freshToken = await getIdTokenRef.current(true).catch(() => null);
    if (!freshToken) return false;

    try {
      const res = await apiRequest(
        "POST",
        "/api/payments/google-play/verify",
        { purchaseToken, productId: purchase.productId, planId: plan.id, deviceId: dId },
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
  }, [safeSetPayingPlanId, safeSetSuccessPlanId, safeSetPaymentJustSucceeded]);

  const {
    connected,
    availablePurchases,
    requestPurchase,
    finishTransaction,
    fetchProducts,
    getAvailablePurchases,
  } = IAP!.useIAP({
    onPurchaseSuccess: (purchase: any) => {
      verifyAndFinish(purchase).catch(() => {});
    },
    onPurchaseError: (err: any) => {
      const code = err?.code;
      safeSetPayingPlanId(null);
      if (code === "E_USER_CANCELLED" || code === "USER_CANCELED") return;
      Alert.alert("Purchase Failed", err?.message || "Something went wrong. Please try again.");
    },
  });

  useEffect(() => {
    finishTransactionRef.current = finishTransaction;
  }, [finishTransaction]);

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

  useEffect(() => {
    if (!connected) return;
    getAvailablePurchases().catch(() => {});
  }, [connected, getAvailablePurchases]);

  const startPayment = useCallback(async (planId: SubscriptionPlanId): Promise<boolean> => {
    if (!deviceId || payingPlanId) return false;

    const token = await getIdToken();
    if (!user || !token) {
      Alert.alert("Sign in required", "Please sign in with Google first so your subscription is safely saved.");
      return false;
    }

    if (!connected) {
      Alert.alert(
        "Store not ready",
        "Could not connect to Google Play. Make sure you are signed in to the Play Store and try again.",
      );
      return false;
    }

    const plan = GOOGLE_PLAY_PLANS.find((p) => p.id === planId);
    if (!plan) return false;

    safeSetPayingPlanId(planId);

    try {
      await fetchProducts({
        skus: [plan.googlePlayProductId],
        type: "subs",
      }).catch(() => {});

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
      const code = err?.code || err?.debugMessage;
      if (code === "E_USER_CANCELLED" || code === "USER_CANCELED") return false;
      Alert.alert("Purchase Failed", err?.message || "Something went wrong. Please try again.");
      return false;
    }
  }, [deviceId, payingPlanId, getIdToken, user, connected, fetchProducts, requestPurchase, safeSetPayingPlanId]);

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
