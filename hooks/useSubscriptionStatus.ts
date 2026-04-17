import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, AppState, AppStateStatus, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { getPaymentDeviceId } from "@/lib/device-identity";
import { SUBSCRIPTION_PLANS, SubscriptionPlanId } from "@/shared/subscription-plans";
import { useFirebaseAuth } from "@/contexts/AuthContext";

const SUBSCRIPTION_CACHE_KEY = "@statusvault_subscription_status";
const PENDING_PAYMENT_KEY = "@statusvault_pending_payment";
// Saved BEFORE opening Razorpay checkout — covers the crash window between
// "money taken" and "pending record written". On next startup we query the
// server for the order's status and recover the subscription automatically.
const PAYMENT_INTENT_KEY = "@statusvault_payment_intent";

// Smart cache TTLs — skip the Firebase read entirely when the cache is fresh.
// Pro users: 6 hours (subscription doesn't change spontaneously).
// Free users: 30 minutes (enough precision without burning reads).
const CACHE_TTL_PRO_MS  = 6 * 60 * 60 * 1000;
const CACHE_TTL_FREE_MS = 30 * 60 * 1000;

type SubscriptionStatus = {
  active: boolean;
  configured?: boolean;
  lifetime?: boolean;
  planId?: string | null;
  paidUntil?: string | null;
  lastPaymentId?: string | null;
  message?: string;
  cachedAt?: number;
};

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
  const [paymentJustSucceeded, setPaymentJustSucceeded] = useState(false);
  const [successPlanId, setSuccessPlanId] = useState<SubscriptionPlanId | null>(null);

  // Fix #3 — Unmounted State Crash: guard every state update with this ref so
  // React never receives a setState call after the subscriber screen unmounts.
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
  const safeSetPayingPlanId = useCallback((v: SubscriptionPlanId | null) => {
    if (isMountedRef.current) setPayingPlanId(v);
  }, []);
  const safeSetPaymentJustSucceeded = useCallback((v: boolean) => {
    if (isMountedRef.current) setPaymentJustSucceeded(v);
  }, []);
  const safeSetSuccessPlanId = useCallback((v: SubscriptionPlanId | null) => {
    if (isMountedRef.current) setSuccessPlanId(v);
  }, []);

  // On mount: restore last-known subscription so Pro users see no ad flash.
  // Ghost Pro fix: also verify paidUntil hasn't already passed before restoring.
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

  // Core verify helper — used by both startPayment and the pending-payment retry.
  const verifyPaymentDetails = useCallback(async (
    pending: PendingPayment,
    freshToken: string,
  ): Promise<SubscriptionStatus | null> => {
    try {
      const verifyResponse = await apiRequest(
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
      if (!verifyResponse.ok) return null;
      return (await verifyResponse.json()) as SubscriptionStatus;
    } catch {
      return null;
    }
  }, []);

  // Fix #1 — Retry any pending payment that was interrupted by a network drop.
  // Runs automatically when the device ID and user are both ready (app open).
  useEffect(() => {
    if (!deviceId || !user) return;

    const retryPending = async () => {
      const raw = await AsyncStorage.getItem(PENDING_PAYMENT_KEY).catch(() => null);
      if (!raw) return;

      let pending: PendingPayment;
      try {
        pending = JSON.parse(raw);
      } catch {
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        return;
      }

      // Discard records older than 24 hours — the Razorpay payment window
      // itself will have expired by then, so verification would fail anyway.
      if (Date.now() - pending.savedAt > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        return;
      }

      // Fix #4 — Stale Token: always force-refresh before calling verify.
      const freshToken = await getIdToken(true).catch(() => null);
      if (!freshToken) return;

      const result = await verifyPaymentDetails(pending, freshToken);
      if (result?.active) {
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(result)).catch(() => {});
        safeSetStatus(result);
        Alert.alert(
          "Pro Access Activated",
          "Your previous payment has been verified. Ads are now removed!",
        );
      }
    };

    retryPending().catch(() => {});
  }, [deviceId, user, getIdToken, verifyPaymentDetails, safeSetStatus]);

  // Intent recovery: if the app crashed in the 1-2 second window between
  // Razorpay capturing the payment and Phase 3 writing the pending record,
  // the server-side recover-order endpoint queries Razorpay directly and
  // activates the subscription without needing a client signature.
  useEffect(() => {
    if (!deviceId || !user) return;

    const recoverPaymentIntent = async () => {
      const intentRaw = await AsyncStorage.getItem(PAYMENT_INTENT_KEY).catch(() => null);
      if (!intentRaw) return;

      // If a full pending record already exists, the normal retry handles it —
      // just clear the intent so we don't run this path redundantly.
      const pendingRaw = await AsyncStorage.getItem(PENDING_PAYMENT_KEY).catch(() => null);
      if (pendingRaw) {
        await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        return;
      }

      let intent: PaymentIntent;
      try {
        intent = JSON.parse(intentRaw);
      } catch {
        await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        return;
      }

      // Discard stale intents — Razorpay orders expire after 24 hours anyway.
      if (Date.now() - intent.savedAt > 24 * 60 * 60 * 1000) {
        await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        return;
      }

      const freshToken = await getIdToken(true).catch(() => null);
      if (!freshToken) return;

      try {
        const response = await apiRequest(
          "POST",
          "/api/payments/razorpay/recover-order",
          { orderId: intent.orderId, planId: intent.planId, deviceId: intent.deviceId },
          { Authorization: `Bearer ${freshToken}` },
        );
        const data = await response.json();

        if (data.active) {
          await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
          const withTimestamp = { ...data, cachedAt: Date.now() };
          await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(withTimestamp)).catch(() => {});
          safeSetStatus(withTimestamp);
          Alert.alert(
            "Pro Access Activated",
            "Your payment has been verified and Pro is now active. Ads are removed!",
          );
        } else if (data.status === "no_payment") {
          // User probably cancelled Razorpay without paying — clear the intent.
          await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});
        }
        // Any other status: keep intent, try again on next startup.
      } catch {}
    };

    recoverPaymentIntent().catch(() => {});
  }, [deviceId, user, getIdToken, safeSetStatus]);

  // force=true bypasses the smart cache (used right after a payment or app foreground).
  const refresh = useCallback(async (force = false) => {
    if (!deviceId) return;

    // ── Smart cache guard ─────────────────────────────────────────────────
    // Skip the Firebase read if the locally cached status is still fresh.
    // Pro status is trusted for 6 h; Free status for 30 min.
    // This is the primary lever that keeps Firestore reads near-zero for most
    // sessions — a user who opens the app every hour costs 1 read/day instead
    // of 288 reads/day (old 5-min polling × 24 h × 12 polls/h).
    if (!force) {
      const raw = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY).catch(() => null);
      if (raw) {
        try {
          const cached: SubscriptionStatus = JSON.parse(raw);
          // Ghost Pro fix: even when cache is fresh, a timed subscription must be
          // checked against the current time. If paidUntil has passed, bypass
          // the cache and hit the server to get the real (expired) status.
          if (cached.active && !cached.lifetime && cached.paidUntil) {
            const expiresAt = new Date(cached.paidUntil).getTime();
            if (expiresAt <= Date.now()) {
              // Subscription expired — fall through to server call
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
      // Local shield: if the server is unreachable, keep any cached Pro status
      // that hasn't expired yet rather than wiping the user's Pro access.
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

  // Safety-net polling every 30 min. In practice the smart cache means most
  // of these fire are no-ops (cache hit → instant return, 0 Firebase reads).
  useEffect(() => {
    refresh();
    const interval = setInterval(() => refresh(false), 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [refresh]);

  // Cross-device Pro restore: when the user signs in (or switches accounts),
  // immediately force-refresh subscription from the server using their Firebase
  // UID. Without this, a user who reinstalls and signs back in would see no Pro
  // status until the next 30-minute polling cycle.
  const prevUidRef = useRef<string | null>(null);
  useEffect(() => {
    const uid = user?.uid ?? null;
    if (uid && uid !== prevUidRef.current) {
      refresh(true);
    }
    prevUidRef.current = uid;
  }, [user?.uid, refresh]);

  // Foreground refresh: whenever the app comes back from background, re-sync
  // subscription so ads disappear immediately for Pro users without a restart.
  useEffect(() => {
    const appStateRef = { current: AppState.currentState };
    const sub = AppState.addEventListener("change", (next: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        next === "active"
      ) {
        refresh();
      }
      appStateRef.current = next;
    });
    return () => sub.remove();
  }, [refresh]);

  const startPayment = useCallback(
    async (planId: SubscriptionPlanId) => {
      if (!deviceId || payingPlanId) return false;

      // Pre-flight: token check before showing anything to the user.
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

      // ── PHASE 1: Create order ────────────────────────────────────────────────
      // Fix #2 — Order Creation Panic: isolated try/catch so the user ONLY sees
      // a "server busy" message — never a scary "money may have been taken" alert
      // at a stage where no payment has even been attempted yet.
      let order: CreateOrderResponse;
      try {
        const orderResponse = await apiRequest(
          "POST",
          "/api/payments/razorpay/create-order",
          { planId, deviceId },
          { Authorization: `Bearer ${token}` },
        );
        if (!orderResponse.ok) {
          const errBody = await orderResponse.json().catch(() => ({})) as any;
          const msg = errBody?.message || "Could not create payment order";
          throw new Error(msg);
        }
        order = (await orderResponse.json()) as CreateOrderResponse;
      } catch (orderError) {
        safeSetPayingPlanId(null);
        Alert.alert(
          "Server Busy",
          "Could not start payment. No money has been charged. Please try again in a moment.",
        );
        return false;
      }

      // ── PHASE 1.5: Save payment intent BEFORE opening checkout ──────────────
      // Race-condition shield: if the app crashes or loses power after Razorpay
      // captures the payment but before Phase 3 writes the pending record, the
      // intent lets us recover on the next startup by querying the server for
      // the order's status and activating the subscription server-side.
      const paymentIntent: PaymentIntent = {
        orderId: order.orderId,
        planId,
        deviceId,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(PAYMENT_INTENT_KEY, JSON.stringify(paymentIntent)).catch(() => {});

      // ── PHASE 2: Open Razorpay checkout ─────────────────────────────────────
      let razorpayResult: RazorpaySuccess;
      try {
        razorpayResult = (await RazorpayCheckout.open({
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
      } catch (checkoutError: any) {
        safeSetPayingPlanId(null);
        // Razorpay error code 0 = user dismissed/cancelled — no alert needed.
        const code = checkoutError?.code ?? checkoutError?.error?.code;
        if (code !== 0 && code !== "0") {
          Alert.alert("Payment Cancelled", "No payment was made.");
        }
        return false;
      }

      // ── PHASE 3: Persist payment before verifying (Fix #1) ──────────────────
      // The payment IS complete at this point — Razorpay has the money.
      // We MUST save details locally first so no payment is ever "lost" if the
      // network drops in the next step.
      const pendingPayment: PendingPayment = {
        planId,
        deviceId,
        razorpay_payment_id: razorpayResult.razorpay_payment_id,
        razorpay_order_id: razorpayResult.razorpay_order_id,
        razorpay_signature: razorpayResult.razorpay_signature,
        savedAt: Date.now(),
      };
      await AsyncStorage.setItem(PENDING_PAYMENT_KEY, JSON.stringify(pendingPayment)).catch(() => {});
      // Intent fulfilled — full pending record is now safely on disk
      await AsyncStorage.removeItem(PAYMENT_INTENT_KEY).catch(() => {});

      // ── PHASE 4: Force-refresh token before verification (Fix #4) ───────────
      // Razorpay checkout can take several minutes (UPI OTP, card entry, etc.).
      // Firebase tokens expire after 60 minutes — force a fresh token so the
      // /verify call never fails with 401 Unauthorized.
      const freshToken = await getIdToken(true).catch(() => null);
      if (!freshToken) {
        safeSetPayingPlanId(null);
        Alert.alert(
          "Payment Received — Activating...",
          "Your payment was received but we lost your session. Reopen the app and your Pro access will activate automatically.",
        );
        return false;
      }

      // ── PHASE 5: Verify with server ─────────────────────────────────────────
      const verifiedStatus = await verifyPaymentDetails(pendingPayment, freshToken);

      if (verifiedStatus?.active) {
        // Payment verified successfully — clear the pending record.
        await AsyncStorage.removeItem(PENDING_PAYMENT_KEY).catch(() => {});
        await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(verifiedStatus)).catch(() => {});
        safeSetStatus(verifiedStatus);
        safeSetPayingPlanId(null);
        safeSetSuccessPlanId(planId);
        safeSetPaymentJustSucceeded(true);
        return true;
      } else {
        // Server call failed but payment WAS taken — pending record stays so
        // the next app open will retry automatically. Reassure the user clearly.
        safeSetPayingPlanId(null);
        Alert.alert(
          "Payment Received — Activating...",
          "Your payment was received successfully. Your Pro access will activate automatically the next time you open the app. You will NOT be charged again.",
        );
        await refresh(true); // Force-bypass cache after payment to get fresh status
        return false;
      }
    },
    [deviceId, getIdToken, payingPlanId, refresh, user, safeSetPayingPlanId, safeSetStatus, verifyPaymentDetails],
  );

  const remainingSeconds = useMemo(() => getRemainingSeconds(status), [status]);

  const dismissPaymentSuccess = useCallback(() => {
    safeSetPaymentJustSucceeded(false);
    safeSetSuccessPlanId(null);
  }, [safeSetPaymentJustSucceeded, safeSetSuccessPlanId]);

  return {
    deviceId,
    status,
    loading,
    isSubscribed: Boolean(status.active),
    remainingSeconds,
    payingPlanId,
    paymentJustSucceeded,
    successPlanId,
    plans: SUBSCRIPTION_PLANS,
    refresh,
    startPayment,
    dismissPaymentSuccess,
  };
}
