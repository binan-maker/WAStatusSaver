import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { amountToPaise, getSubscriptionPlan, SUBSCRIPTION_PLANS } from "../shared/subscription-plans";
import { firestoreFieldValue, firestoreTimestamp, getFirebaseAuth, getFirebaseStatus, getFirestoreDb } from "./firebase-admin";

type RazorpayOrderResponse = {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
  status: string;
};

type RazorpayPaymentResponse = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  method?: string;
  email?: string;
  contact?: string;
};

type AuthenticatedUser = {
  uid: string;
  email?: string;
  name?: string;
};

function paymentUnavailable(res: Response) {
  return res.status(503).json({
    message: "Payments are not configured yet",
    missing: {
      razorpayKeyId: !process.env.RAZORPAY_KEY_ID,
      razorpayKeySecret: !process.env.RAZORPAY_KEY_SECRET,
      firebaseServiceAccount: !process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    },
  });
}

function getRazorpayAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}

function normalizeDeviceId(deviceId: unknown) {
  if (typeof deviceId !== "string") return "";
  return deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

async function getAuthenticatedUser(req: Request): Promise<AuthenticatedUser | null> {
  const auth = getFirebaseAuth();
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!auth || !token) return null;

  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : undefined,
      name: typeof decoded.name === "string" ? decoded.name : undefined,
    };
  } catch {
    return null;
  }
}

// Time-stacking: if the user already has an active subscription, add the new
// plan's duration on top of their existing expiry date so they never lose a
// single day they already paid for. A downgrade/same-plan re-purchase just
// extends from whichever is later: now or the current expiry.
async function computeStackedPaidUntil(
  planId: string,
  userId: string,
  db: ReturnType<typeof getFirestoreDb>,
): Promise<Date | null> {
  const plan = getSubscriptionPlan(planId);
  if (!plan) return null;

  const now = Date.now();
  let baseTime = now;

  try {
    const snap = await db.collection("subscriptions").doc(userId).get();
    if (snap.exists) {
      const data = snap.data() || {};
      const existingPaidUntil = data.paidUntil?.toDate?.();
      if (existingPaidUntil instanceof Date && existingPaidUntil.getTime() > now) {
        // Stack on top — every second of the old plan is preserved
        baseTime = existingPaidUntil.getTime();
      }
    }
  } catch {}

  return new Date(baseTime + plan.durationDays * 24 * 60 * 60 * 1000);
}

function buildReceiptNumber(planId: string): string {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const prefix = planId === "yearly" ? "SV-YR" : "SV-MO";
  return `${prefix}-${suffix}`;
}

async function notifyPaymentViaEmail(paymentId: string): Promise<void> {
  const auth = getRazorpayAuthHeader();
  if (!auth) return;
  try {
    await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/notify/email`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
    });
  } catch {
    // Non-critical — payment is already captured, receipt is a best-effort
  }
}

async function createRazorpayOrder(planId: string, deviceId: string, authUser: AuthenticatedUser) {
  const auth = getRazorpayAuthHeader();
  const plan = getSubscriptionPlan(planId);
  if (!auth || !plan) return null;

  const receipt = buildReceiptNumber(plan.id);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: amountToPaise(plan.amount),
      currency: plan.currency,
      receipt,
      notes: {
        deviceId,
        planId: plan.id,
        userId: authUser.uid,
        userEmail: authUser.email || "",
        app: "StatusVault",
        receipt,
      },
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay order creation failed: ${text}`);
  }

  return (await response.json()) as RazorpayOrderResponse;
}

async function getRazorpayPayment(paymentId: string) {
  const auth = getRazorpayAuthHeader();
  if (!auth) return null;

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: auth },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay payment fetch failed: ${text}`);
  }

  return (await response.json()) as RazorpayPaymentResponse;
}

async function captureRazorpayPayment(paymentId: string, amount: number, currency: string) {
  const auth = getRazorpayAuthHeader();
  if (!auth) return null;

  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay capture failed: ${text}`);
  }

  return (await response.json()) as RazorpayPaymentResponse;
}

function verifySignature(orderId: string, paymentId: string, signature: string) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function registerPaymentRoutes(app: Express) {
  app.get("/api/subscriptions/plans", (_req: Request, res: Response) => {
    res.json({
      plans: SUBSCRIPTION_PLANS,
      paymentsConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      firebase: getFirebaseStatus(),
    });
  });

  app.get("/api/subscriptions/status/:deviceId", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      const authUser = await getAuthenticatedUser(req);
      const deviceId = normalizeDeviceId(req.params.deviceId);

      if (!deviceId) {
        return res.status(400).json({ message: "Invalid device ID" });
      }

      if (!db) {
        return res.json({
          active: false,
          configured: false,
          planId: null,
          paidUntil: null,
          message: "Firebase is not configured",
        });
      }

      if (!authUser) {
        return res.json({
          active: false,
          configured: true,
          signInRequired: true,
          planId: null,
          paidUntil: null,
        });
      }

      const snap = await db.collection("subscriptions").doc(authUser.uid).get();
      if (!snap.exists) {
        return res.json({ active: false, configured: true, planId: null, paidUntil: null });
      }

      const data = snap.data() || {};
      const paidUntilDate = data.paidUntil?.toDate?.() instanceof Date ? data.paidUntil.toDate() : null;
      const lifetime = Boolean(data.lifetime);
      const active = lifetime || Boolean(paidUntilDate && paidUntilDate.getTime() > Date.now());

      res.json({
        active,
        configured: true,
        lifetime,
        planId: data.planId || null,
        paidUntil: paidUntilDate ? paidUntilDate.toISOString() : null,
        lastPaymentId: data.lastPaymentId || null,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/razorpay/create-order", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      const auth = getRazorpayAuthHeader();
      const authUser = await getAuthenticatedUser(req);
      const plan = getSubscriptionPlan(String(req.body?.planId || ""));
      const deviceId = normalizeDeviceId(req.body?.deviceId);

      if (!db || !auth) return paymentUnavailable(res);
      if (!authUser) return res.status(401).json({ message: "Google sign-in is required before payment" });
      if (!plan) return res.status(400).json({ message: "Invalid subscription plan" });
      if (!deviceId) return res.status(400).json({ message: "Invalid device ID" });

      const order = await createRazorpayOrder(plan.id, deviceId, authUser);
      if (!order) return paymentUnavailable(res);

      await db.collection("paymentOrders").doc(order.id).set({
        orderId: order.id,
        deviceId,
        userId: authUser.uid,
        userEmail: authUser.email || null,
        planId: plan.id,
        amount: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: "created",
        createdAt: firestoreFieldValue.serverTimestamp(),
      });

      res.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/razorpay/verify", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      const auth = getRazorpayAuthHeader();
      const authUser = await getAuthenticatedUser(req);
      const deviceId = normalizeDeviceId(req.body?.deviceId);
      const plan = getSubscriptionPlan(String(req.body?.planId || ""));
      const orderId = String(req.body?.razorpay_order_id || "");
      const paymentId = String(req.body?.razorpay_payment_id || "");
      const signature = String(req.body?.razorpay_signature || "");

      if (!db || !auth) return paymentUnavailable(res);
      if (!authUser) return res.status(401).json({ message: "Google sign-in is required before payment verification" });
      if (!deviceId || !plan || !orderId || !paymentId || !signature) {
        return res.status(400).json({ message: "Missing payment verification details" });
      }

      const orderRef = db.collection("paymentOrders").doc(orderId);
      const orderSnap = await orderRef.get();
      const orderData = orderSnap.data();

      // Idempotency + security guard: if this order was already verified, return
      // the existing subscription without re-running verification.
      // SECURITY: also assert the paymentId matches the one we already stored —
      // this blocks any attacker who might try to re-use a legitimate order_id
      // with a different (fraudulent) payment_id.
      if (orderSnap.exists && orderData?.status === "verified" && orderData?.userId === authUser.uid) {
        if (orderData?.paymentId && orderData.paymentId !== paymentId) {
          return res.status(400).json({ message: "Payment ID mismatch on already-verified order" });
        }
        const subSnap = await db.collection("subscriptions").doc(authUser.uid).get();
        const subData = subSnap.data() || {};
        const paidUntilDate = subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate() : null;
        const lifetime = Boolean(subData.lifetime);
        return res.json({
          active: lifetime || Boolean(paidUntilDate && paidUntilDate.getTime() > Date.now()),
          lifetime,
          planId: subData.planId || plan.id,
          paidUntil: paidUntilDate ? paidUntilDate.toISOString() : null,
        });
      }

      if (!orderSnap.exists || orderData?.deviceId !== deviceId || orderData?.userId !== authUser.uid || orderData?.planId !== plan.id) {
        await orderRef.set(
          {
            orderId,
            deviceId,
            userId: authUser.uid,
            planId: plan.id,
            paymentId,
            status: "rejected_order_mismatch",
            updatedAt: firestoreFieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return res.status(400).json({ message: "Payment order does not match this device or plan" });
      }

      if (!verifySignature(orderId, paymentId, signature)) {
        await orderRef.set(
          {
            paymentId,
            status: "failed_signature",
            updatedAt: firestoreFieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return res.status(400).json({ message: "Payment verification failed" });
      }

      let payment = await getRazorpayPayment(paymentId);
      if (!payment) return paymentUnavailable(res);

      if (payment.status === "authorized") {
        payment = await captureRazorpayPayment(payment.id, amountToPaise(plan.amount), plan.currency);
      }

      const amountMatches = payment?.amount === amountToPaise(plan.amount);
      const orderMatches = payment?.order_id === orderId;
      const currencyMatches = payment?.currency === plan.currency;
      const captured = payment?.status === "captured";

      if (!payment || !amountMatches || !orderMatches || !currencyMatches || !captured) {
        await orderRef.set(
          {
            paymentId,
            status: "failed_payment_state",
            paymentStatus: payment?.status || null,
            updatedAt: firestoreFieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        return res.status(400).json({ message: "Payment was not captured correctly" });
      }

      // Time-stacking: adds new plan duration on top of any existing active subscription
      const paidUntil = await computeStackedPaidUntil(plan.id, authUser.uid, db);
      const subscriptionPayload = {
        deviceId,
        userId: authUser.uid,
        userEmail: authUser.email || null,
        active: true,
        lifetime: false,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        paidUntil: paidUntil ? firestoreTimestamp.fromDate(paidUntil) : null,
        lastPaymentId: payment.id,
        lastOrderId: orderId,
        paymentMethod: payment.method || null,
        updatedAt: firestoreFieldValue.serverTimestamp(),
      };

      await db.collection("subscriptions").doc(authUser.uid).set(subscriptionPayload, { merge: true });
      await db.collection("subscriptionDevices").doc(deviceId).set(
        {
          deviceId,
          userId: authUser.uid,
          linkedAt: firestoreFieldValue.serverTimestamp(),
          subscription: subscriptionPayload,
        },
        { merge: true },
      );
      await db.collection("users").doc(authUser.uid).set(
        {
          userId: authUser.uid,
          email: authUser.email || null,
          name: authUser.name || null,
          deviceId,
          subscription: subscriptionPayload,
          updatedAt: firestoreFieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      await db.collection("users").doc(authUser.uid).collection("payments").doc(payment.id).set({
        paymentId: payment.id,
        orderId,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        status: "captured",
        razorpayStatus: payment.status,
        method: payment.method || null,
        email: payment.email || null,
        contact: payment.contact || null,
        createdAt: firestoreFieldValue.serverTimestamp(),
      });
      await orderRef.set(
        {
          paymentId: payment.id,
          status: "verified",
          verifiedAt: firestoreFieldValue.serverTimestamp(),
        },
        { merge: true },
      );

      // Fire-and-forget: send Razorpay email receipt to the customer
      notifyPaymentViaEmail(payment.id);

      res.json({
        active: true,
        lifetime: plan.durationDays === null,
        planId: plan.id,
        paidUntil: paidUntil ? paidUntil.toISOString() : null,
        lastPaymentId: payment.id,
      });
    } catch (error) {
      next(error);
    }
  });
}