import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { amountToPaise, getSubscriptionPlan } from "../../../shared/subscription-plans";
import {
  firestoreFieldValue,
  firestoreTimestamp,
  getFirebaseAuth,
  getFirestoreDb,
} from "../../../server/firebase-admin";

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
    const snap = await db!.collection("subscriptions").doc(userId).get();
    if (snap.exists) {
      const data = snap.data() || {};
      const existingPaidUntil = data.paidUntil?.toDate?.();
      if (existingPaidUntil instanceof Date && existingPaidUntil.getTime() > now) {
        baseTime = existingPaidUntil.getTime();
      }
    }
  } catch {}
  return new Date(baseTime + plan.durationDays * 24 * 60 * 60 * 1000);
}

function buildReceiptNumber(planId: string): string {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const prefix = planId === "yearly" ? "SV-YR" : planId === "quarterly" ? "SV-3M" : "SV-MO";
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
  } catch {}
}

async function createRazorpayOrder(planId: string, deviceId: string, authUser: AuthenticatedUser) {
  const auth = getRazorpayAuthHeader();
  const plan = getSubscriptionPlan(planId);
  if (!auth || !plan) return null;
  const receipt = buildReceiptNumber(plan.id);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: amountToPaise(plan.amount),
      currency: plan.currency,
      receipt,
      notes: { deviceId, planId: plan.id, userId: authUser.uid, userEmail: authUser.email || "", app: "StatusVault", receipt },
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
    headers: { Authorization: auth, "Content-Type": "application/json" },
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

export function registerRazorpayRoutes(app: Express) {
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
        amountINR: plan.amount,
        amountPaise: order.amount,
        currency: order.currency,
        receipt: order.receipt,
        status: "created",
        provider: "razorpay",
        createdAt: firestoreFieldValue.serverTimestamp(),
      });

      res.json({ keyId: process.env.RAZORPAY_KEY_ID, orderId: order.id, amount: order.amount, currency: order.currency, plan });
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
        await orderRef.set({ orderId, deviceId, userId: authUser.uid, planId: plan.id, paymentId, status: "rejected_order_mismatch", updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
        return res.status(400).json({ message: "Payment order does not match this device or plan" });
      }

      if (!verifySignature(orderId, paymentId, signature)) {
        await orderRef.set({ paymentId, status: "failed_signature", updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
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
        await orderRef.set({ paymentId, status: "failed_payment_state", paymentStatus: payment?.status || null, updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
        return res.status(400).json({ message: "Payment was not captured correctly" });
      }

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
        provider: "razorpay",
        updatedAt: firestoreFieldValue.serverTimestamp(),
      };

      await db.collection("subscriptions").doc(authUser.uid).set(subscriptionPayload, { merge: true });
      await db.collection("subscriptionDevices").doc(deviceId).set({ deviceId, userId: authUser.uid, linkedAt: firestoreFieldValue.serverTimestamp(), subscription: subscriptionPayload }, { merge: true });
      await db.collection("users").doc(authUser.uid).set({ userId: authUser.uid, email: authUser.email || null, name: authUser.name || null, deviceId, subscription: subscriptionPayload, updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
      await db.collection("users").doc(authUser.uid).collection("payments").doc(payment.id).set({
        paymentId: payment.id, orderId, planId: plan.id, amount: plan.amount, currency: plan.currency,
        status: "captured", razorpayStatus: payment.status, method: payment.method || null,
        email: payment.email || null, contact: payment.contact || null, provider: "razorpay",
        createdAt: firestoreFieldValue.serverTimestamp(),
      });
      await orderRef.set({ paymentId: payment.id, status: "verified", verifiedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });

      notifyPaymentViaEmail(payment.id);

      res.json({ active: true, lifetime: plan.durationDays === null, planId: plan.id, paidUntil: paidUntil ? paidUntil.toISOString() : null, lastPaymentId: payment.id });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/razorpay/webhook", async (req: Request, res: Response) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(200).json({ status: "webhook_not_configured" });

    const signature = req.header("x-razorpay-signature");
    const rawBody = req.rawBody;
    if (!signature || !rawBody) return res.status(400).json({ message: "Missing signature or body" });

    const expectedSig = crypto.createHmac("sha256", webhookSecret).update(rawBody as Buffer).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body?.event;
    if (event !== "payment.captured") return res.status(200).json({ status: "event_ignored" });

    const payment = req.body?.payload?.payment?.entity;
    if (!payment?.id || !payment?.order_id) return res.status(200).json({ status: "invalid_payload" });

    const db = getFirestoreDb();
    if (!db) return res.status(200).json({ status: "db_unavailable" });

    try {
      const orderSnap = await db.collection("paymentOrders").doc(payment.order_id).get();
      if (!orderSnap.exists) return res.status(200).json({ status: "order_not_found" });

      const orderData = orderSnap.data()!;
      if (orderData.status === "verified") return res.status(200).json({ status: "already_processed" });

      const { userId, planId, deviceId: orderDeviceId } = orderData;
      if (!userId || !planId) return res.status(200).json({ status: "order_missing_data" });

      const plan = getSubscriptionPlan(planId);
      if (!plan) return res.status(200).json({ status: "invalid_plan" });

      if (payment.amount !== amountToPaise(plan.amount) || payment.currency !== plan.currency) {
        await orderSnap.ref.set({ status: "webhook_amount_mismatch", updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
        return res.status(200).json({ status: "amount_mismatch" });
      }

      const paidUntil = await computeStackedPaidUntil(planId, userId, db);
      const subscriptionPayload = {
        deviceId: orderDeviceId || null, userId, active: true, lifetime: false, planId: plan.id,
        amount: plan.amount, currency: plan.currency,
        paidUntil: paidUntil ? firestoreTimestamp.fromDate(paidUntil) : null,
        lastPaymentId: payment.id, lastOrderId: payment.order_id,
        paymentMethod: payment.method || null, provider: "razorpay",
        updatedAt: firestoreFieldValue.serverTimestamp(),
      };

      await db.collection("subscriptions").doc(userId).set(subscriptionPayload, { merge: true });
      await orderSnap.ref.set({ paymentId: payment.id, status: "verified", verifiedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
      await db.collection("users").doc(userId).collection("payments").doc(payment.id).set({
        paymentId: payment.id, orderId: payment.order_id, planId: plan.id, amount: plan.amount,
        currency: plan.currency, status: "captured", razorpayStatus: payment.status,
        source: "webhook", provider: "razorpay", createdAt: firestoreFieldValue.serverTimestamp(),
      });

      console.log(`[Razorpay Webhook] Subscription activated: userId=${userId}, plan=${planId}, until=${paidUntil?.toISOString()}`);
      return res.status(200).json({ status: "subscription_activated" });
    } catch (error) {
      console.error("[Razorpay Webhook] Error:", error);
      return res.status(200).json({ status: "processing_error" });
    }
  });

  app.post("/api/payments/razorpay/recover-order", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      const auth = getRazorpayAuthHeader();
      const authUser = await getAuthenticatedUser(req);
      const orderId = String(req.body?.orderId || "");
      const planId = String(req.body?.planId || "");
      const deviceId = normalizeDeviceId(req.body?.deviceId);

      if (!db || !auth) return paymentUnavailable(res);
      if (!authUser) return res.status(401).json({ message: "Authentication required" });
      if (!orderId || !planId || !deviceId) return res.status(400).json({ message: "Missing required fields" });

      const plan = getSubscriptionPlan(planId);
      if (!plan) return res.status(400).json({ message: "Invalid plan" });

      const orderSnap = await db.collection("paymentOrders").doc(orderId).get();
      if (!orderSnap.exists || orderSnap.data()?.userId !== authUser.uid) {
        return res.status(404).json({ message: "Order not found" });
      }

      const orderData = orderSnap.data()!;

      if (orderData.status === "verified") {
        const subSnap = await db.collection("subscriptions").doc(authUser.uid).get();
        const subData = subSnap.data() || {};
        const paidUntilDate = subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate() : null;
        return res.json({
          active: Boolean(paidUntilDate && paidUntilDate.getTime() > Date.now()),
          status: "already_verified",
          planId: subData.planId || planId,
          paidUntil: paidUntilDate?.toISOString() || null,
          lastPaymentId: subData.lastPaymentId || null,
        });
      }

      const rzpResponse = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { Authorization: auth },
      });

      if (!rzpResponse.ok) return res.json({ status: "no_payment" });

      const rzpData = await rzpResponse.json() as { items: RazorpayPaymentResponse[] };
      const capturedPayment = rzpData.items?.find((p) => p.status === "captured");

      if (!capturedPayment) return res.json({ status: "no_payment" });

      if (capturedPayment.amount !== amountToPaise(plan.amount) || capturedPayment.currency !== plan.currency) {
        return res.status(400).json({ message: "Payment amount mismatch" });
      }

      const paidUntil = await computeStackedPaidUntil(planId, authUser.uid, db);
      const subscriptionPayload = {
        deviceId, userId: authUser.uid, userEmail: authUser.email || null,
        active: true, lifetime: false, planId: plan.id, amount: plan.amount, currency: plan.currency,
        paidUntil: paidUntil ? firestoreTimestamp.fromDate(paidUntil) : null,
        lastPaymentId: capturedPayment.id, lastOrderId: orderId,
        paymentMethod: capturedPayment.method || null, provider: "razorpay",
        updatedAt: firestoreFieldValue.serverTimestamp(),
      };

      await db.collection("subscriptions").doc(authUser.uid).set(subscriptionPayload, { merge: true });
      await orderSnap.ref.set({ paymentId: capturedPayment.id, status: "verified", verifiedAt: firestoreFieldValue.serverTimestamp(), source: "recovery" }, { merge: true });
      await db.collection("users").doc(authUser.uid).collection("payments").doc(capturedPayment.id).set({
        paymentId: capturedPayment.id, orderId, planId: plan.id, amount: plan.amount,
        currency: plan.currency, status: "captured", razorpayStatus: capturedPayment.status,
        method: capturedPayment.method || null, source: "recovery", provider: "razorpay",
        createdAt: firestoreFieldValue.serverTimestamp(),
      });

      console.log(`[Razorpay Recovery] Subscription activated: userId=${authUser.uid}, plan=${planId}, until=${paidUntil?.toISOString()}`);

      return res.json({
        active: true, planId: plan.id, paidUntil: paidUntil ? paidUntil.toISOString() : null,
        lastPaymentId: capturedPayment.id, source: "recovery",
      });
    } catch (error) {
      next(error);
    }
  });
}
