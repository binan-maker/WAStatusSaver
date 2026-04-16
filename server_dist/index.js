"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_config = require("dotenv/config");
var import_express = __toESM(require("express"));

// server/routes.ts
var import_node_http = require("node:http");

// server/payment-routes.ts
var import_node_crypto = __toESM(require("node:crypto"));

// shared/subscription-plans.ts
var SUBSCRIPTION_PLANS = [
  {
    id: "monthly",
    title: "1 Month Basic Pro",
    shortTitle: "Monthly",
    amount: 29,
    currency: "INR",
    durationDays: 30,
    badge: "Most Popular",
    description: "Remove all ads for 30 days"
  },
  {
    id: "yearly",
    title: "1 Year Standard Pro",
    shortTitle: "Yearly",
    amount: 149,
    currency: "INR",
    durationDays: 365,
    badge: "Best Value",
    description: "No ads + priority support for a full year"
  }
];
function getSubscriptionPlan(planId) {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}
function amountToPaise(amount) {
  return Math.round(amount * 100);
}

// server/firebase-admin.ts
var import_firebase_admin = __toESM(require("firebase-admin"));
var initializationError = null;
function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    initializationError = "FIREBASE_SERVICE_ACCOUNT_JSON is not configured";
    return null;
  }
  const normalized = raw.trim();
  const candidates = [
    normalized,
    Buffer.from(normalized, "base64").toString("utf8")
  ];
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (typeof parsed.private_key === "string") {
        parsed.private_key = parsed.private_key.replace(/\\n/g, "\n");
      }
      return parsed;
    } catch {
    }
  }
  try {
    const parsed = JSON.parse(normalized.replace(/\\n/g, "\n"));
    return parsed;
  } catch {
    initializationError = "FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON";
    return null;
  }
}
function getFirestoreDb() {
  if (!import_firebase_admin.default.apps.length) {
    const serviceAccount = getServiceAccount();
    if (!serviceAccount) return null;
    try {
      import_firebase_admin.default.initializeApp({
        credential: import_firebase_admin.default.credential.cert(serviceAccount),
        projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id
      });
      initializationError = null;
    } catch (error) {
      initializationError = error instanceof Error ? error.message : "Firebase initialization failed";
      return null;
    }
  }
  return import_firebase_admin.default.firestore();
}
function getFirebaseAuth() {
  if (!getFirestoreDb()) return null;
  return import_firebase_admin.default.auth();
}
function getFirebaseStatus() {
  return {
    configured: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON),
    ready: Boolean(getFirestoreDb()),
    error: initializationError
  };
}
var firestoreTimestamp = import_firebase_admin.default.firestore.Timestamp;
var firestoreFieldValue = import_firebase_admin.default.firestore.FieldValue;

// server/payment-routes.ts
function paymentUnavailable(res) {
  return res.status(503).json({
    message: "Payments are not configured yet",
    missing: {
      razorpayKeyId: !process.env.RAZORPAY_KEY_ID,
      razorpayKeySecret: !process.env.RAZORPAY_KEY_SECRET,
      firebaseServiceAccount: !process.env.FIREBASE_SERVICE_ACCOUNT_JSON
    }
  });
}
function getRazorpayAuthHeader() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) return null;
  return `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString("base64")}`;
}
function normalizeDeviceId(deviceId) {
  if (typeof deviceId !== "string") return "";
  return deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}
async function getAuthenticatedUser(req) {
  const auth = getFirebaseAuth();
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!auth || !token) return null;
  try {
    const decoded = await auth.verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: typeof decoded.email === "string" ? decoded.email : void 0,
      name: typeof decoded.name === "string" ? decoded.name : void 0
    };
  } catch {
    return null;
  }
}
async function computeStackedPaidUntil(planId, userId, db) {
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
        baseTime = existingPaidUntil.getTime();
      }
    }
  } catch {
  }
  return new Date(baseTime + plan.durationDays * 24 * 60 * 60 * 1e3);
}
function buildReceiptNumber(planId) {
  const suffix = Date.now().toString(36).toUpperCase().slice(-6);
  const prefix = planId === "yearly" ? "SV-YR" : "SV-MO";
  return `${prefix}-${suffix}`;
}
async function notifyPaymentViaEmail(paymentId) {
  const auth = getRazorpayAuthHeader();
  if (!auth) return;
  try {
    await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/notify/email`, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" }
    });
  } catch {
  }
}
async function createRazorpayOrder(planId, deviceId, authUser) {
  const auth = getRazorpayAuthHeader();
  const plan = getSubscriptionPlan(planId);
  if (!auth || !plan) return null;
  const receipt = buildReceiptNumber(plan.id);
  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json"
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
        receipt
      }
    })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay order creation failed: ${text}`);
  }
  return await response.json();
}
async function getRazorpayPayment(paymentId) {
  const auth = getRazorpayAuthHeader();
  if (!auth) return null;
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
    headers: { Authorization: auth }
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay payment fetch failed: ${text}`);
  }
  return await response.json();
}
async function captureRazorpayPayment(paymentId, amount, currency) {
  const auth = getRazorpayAuthHeader();
  if (!auth) return null;
  const response = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/capture`, {
    method: "POST",
    headers: {
      Authorization: auth,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ amount, currency })
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Razorpay capture failed: ${text}`);
  }
  return await response.json();
}
function verifySignature(orderId, paymentId, signature) {
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keySecret) return false;
  const expected = import_node_crypto.default.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (expectedBuffer.length !== signatureBuffer.length) return false;
  return import_node_crypto.default.timingSafeEqual(expectedBuffer, signatureBuffer);
}
function registerPaymentRoutes(app2) {
  app2.get("/api/subscriptions/plans", (_req, res) => {
    res.json({
      plans: SUBSCRIPTION_PLANS,
      paymentsConfigured: Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET),
      firebase: getFirebaseStatus()
    });
  });
  app2.get("/api/subscriptions/status/:deviceId", async (req, res, next) => {
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
          message: "Firebase is not configured"
        });
      }
      if (!authUser) {
        return res.json({
          active: false,
          configured: true,
          signInRequired: true,
          planId: null,
          paidUntil: null
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
        lastPaymentId: data.lastPaymentId || null
      });
    } catch (error) {
      next(error);
    }
  });
  app2.post("/api/payments/razorpay/create-order", async (req, res, next) => {
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
        createdAt: firestoreFieldValue.serverTimestamp()
      });
      res.json({
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        plan
      });
    } catch (error) {
      next(error);
    }
  });
  app2.post("/api/payments/razorpay/verify", async (req, res, next) => {
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
          paidUntil: paidUntilDate ? paidUntilDate.toISOString() : null
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
            updatedAt: firestoreFieldValue.serverTimestamp()
          },
          { merge: true }
        );
        return res.status(400).json({ message: "Payment order does not match this device or plan" });
      }
      if (!verifySignature(orderId, paymentId, signature)) {
        await orderRef.set(
          {
            paymentId,
            status: "failed_signature",
            updatedAt: firestoreFieldValue.serverTimestamp()
          },
          { merge: true }
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
            updatedAt: firestoreFieldValue.serverTimestamp()
          },
          { merge: true }
        );
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
        updatedAt: firestoreFieldValue.serverTimestamp()
      };
      await db.collection("subscriptions").doc(authUser.uid).set(subscriptionPayload, { merge: true });
      await db.collection("subscriptionDevices").doc(deviceId).set(
        {
          deviceId,
          userId: authUser.uid,
          linkedAt: firestoreFieldValue.serverTimestamp(),
          subscription: subscriptionPayload
        },
        { merge: true }
      );
      await db.collection("users").doc(authUser.uid).set(
        {
          userId: authUser.uid,
          email: authUser.email || null,
          name: authUser.name || null,
          deviceId,
          subscription: subscriptionPayload,
          updatedAt: firestoreFieldValue.serverTimestamp()
        },
        { merge: true }
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
        createdAt: firestoreFieldValue.serverTimestamp()
      });
      await orderRef.set(
        {
          paymentId: payment.id,
          status: "verified",
          verifiedAt: firestoreFieldValue.serverTimestamp()
        },
        { merge: true }
      );
      notifyPaymentViaEmail(payment.id);
      res.json({
        active: true,
        lifetime: plan.durationDays === null,
        planId: plan.id,
        paidUntil: paidUntil ? paidUntil.toISOString() : null,
        lastPaymentId: payment.id
      });
    } catch (error) {
      next(error);
    }
  });
  app2.post("/api/payments/razorpay/webhook", async (req, res) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return res.status(200).json({ status: "webhook_not_configured" });
    }
    const signature = req.header("x-razorpay-signature");
    const rawBody = req.rawBody;
    if (!signature || !rawBody) {
      return res.status(400).json({ message: "Missing signature or body" });
    }
    const expectedSig = import_node_crypto.default.createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !import_node_crypto.default.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(400).json({ message: "Invalid webhook signature" });
    }
    const event = req.body?.event;
    if (event !== "payment.captured") {
      return res.status(200).json({ status: "event_ignored" });
    }
    const payment = req.body?.payload?.payment?.entity;
    if (!payment?.id || !payment?.order_id) {
      return res.status(200).json({ status: "invalid_payload" });
    }
    const db = getFirestoreDb();
    if (!db) return res.status(200).json({ status: "db_unavailable" });
    try {
      const orderSnap = await db.collection("paymentOrders").doc(payment.order_id).get();
      if (!orderSnap.exists) {
        console.log(`[Webhook] Order ${payment.order_id} not found`);
        return res.status(200).json({ status: "order_not_found" });
      }
      const orderData = orderSnap.data();
      if (orderData.status === "verified") {
        return res.status(200).json({ status: "already_processed" });
      }
      const { userId, planId, deviceId: orderDeviceId } = orderData;
      if (!userId || !planId) {
        return res.status(200).json({ status: "order_missing_data" });
      }
      const plan = getSubscriptionPlan(planId);
      if (!plan) return res.status(200).json({ status: "invalid_plan" });
      if (payment.amount !== amountToPaise(plan.amount) || payment.currency !== plan.currency) {
        await orderSnap.ref.set(
          { status: "webhook_amount_mismatch", updatedAt: firestoreFieldValue.serverTimestamp() },
          { merge: true }
        );
        return res.status(200).json({ status: "amount_mismatch" });
      }
      const paidUntil = await computeStackedPaidUntil(planId, userId, db);
      const subscriptionPayload = {
        deviceId: orderDeviceId || null,
        userId,
        active: true,
        lifetime: false,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        paidUntil: paidUntil ? firestoreTimestamp.fromDate(paidUntil) : null,
        lastPaymentId: payment.id,
        lastOrderId: payment.order_id,
        paymentMethod: payment.method || null,
        updatedAt: firestoreFieldValue.serverTimestamp()
      };
      await db.collection("subscriptions").doc(userId).set(subscriptionPayload, { merge: true });
      await orderSnap.ref.set(
        { paymentId: payment.id, status: "verified", verifiedAt: firestoreFieldValue.serverTimestamp() },
        { merge: true }
      );
      await db.collection("users").doc(userId).collection("payments").doc(payment.id).set({
        paymentId: payment.id,
        orderId: payment.order_id,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        status: "captured",
        razorpayStatus: payment.status,
        source: "webhook",
        createdAt: firestoreFieldValue.serverTimestamp()
      });
      console.log(`[Webhook] Subscription activated: userId=${userId}, plan=${planId}, until=${paidUntil?.toISOString()}`);
      return res.status(200).json({ status: "subscription_activated" });
    } catch (error) {
      console.error("[Webhook] Error:", error);
      return res.status(200).json({ status: "processing_error" });
    }
  });
  app2.post("/api/payments/razorpay/recover-order", async (req, res, next) => {
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
      const orderData = orderSnap.data();
      if (orderData.status === "verified") {
        const subSnap = await db.collection("subscriptions").doc(authUser.uid).get();
        const subData = subSnap.data() || {};
        const paidUntilDate = subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate() : null;
        return res.json({
          active: Boolean(paidUntilDate && paidUntilDate.getTime() > Date.now()),
          status: "already_verified",
          planId: subData.planId || planId,
          paidUntil: paidUntilDate?.toISOString() || null,
          lastPaymentId: subData.lastPaymentId || null
        });
      }
      const rzpResponse = await fetch(`https://api.razorpay.com/v1/orders/${orderId}/payments`, {
        headers: { Authorization: auth }
      });
      if (!rzpResponse.ok) {
        return res.json({ status: "no_payment" });
      }
      const rzpData = await rzpResponse.json();
      const capturedPayment = rzpData.items?.find((p) => p.status === "captured");
      if (!capturedPayment) {
        return res.json({ status: "no_payment" });
      }
      if (capturedPayment.amount !== amountToPaise(plan.amount) || capturedPayment.currency !== plan.currency) {
        return res.status(400).json({ message: "Payment amount mismatch" });
      }
      const paidUntil = await computeStackedPaidUntil(planId, authUser.uid, db);
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
        lastPaymentId: capturedPayment.id,
        lastOrderId: orderId,
        paymentMethod: capturedPayment.method || null,
        updatedAt: firestoreFieldValue.serverTimestamp()
      };
      await db.collection("subscriptions").doc(authUser.uid).set(subscriptionPayload, { merge: true });
      await db.collection("paymentOrders").doc(orderId).set(
        { paymentId: capturedPayment.id, status: "verified", verifiedAt: firestoreFieldValue.serverTimestamp() },
        { merge: true }
      );
      await db.collection("users").doc(authUser.uid).collection("payments").doc(capturedPayment.id).set({
        paymentId: capturedPayment.id,
        orderId,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        status: "captured",
        razorpayStatus: capturedPayment.status,
        source: "recovery",
        createdAt: firestoreFieldValue.serverTimestamp()
      });
      notifyPaymentViaEmail(capturedPayment.id);
      return res.json({
        active: true,
        status: "recovered",
        planId: plan.id,
        paidUntil: paidUntil?.toISOString() || null,
        lastPaymentId: capturedPayment.id
      });
    } catch (error) {
      next(error);
    }
  });
}

// server/user-routes.ts
function registerUserRoutes(app2) {
  app2.post("/api/users/delete-account", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const firebaseAuth = getFirebaseAuth();
    const db = getFirestoreDb();
    if (!firebaseAuth || !db) {
      return res.status(503).json({ error: "Firebase not configured on the server" });
    }
    let uid;
    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: "Invalid or expired ID token" });
    }
    try {
      const deletionScheduledAt = /* @__PURE__ */ new Date();
      deletionScheduledAt.setDate(deletionScheduledAt.getDate() + 30);
      await db.collection("users").doc(uid).set(
        {
          pendingDeletion: true,
          deletionScheduledAt: deletionScheduledAt.toISOString(),
          deletionRequestedAt: (/* @__PURE__ */ new Date()).toISOString()
        },
        { merge: true }
      );
      await db.collection("deletionQueue").doc(uid).set({
        uid,
        scheduledAt: deletionScheduledAt.toISOString(),
        requestedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "pending"
      });
      return res.json({
        success: true,
        message: "Account scheduled for deletion in 30 days.",
        deletionScheduledAt: deletionScheduledAt.toISOString()
      });
    } catch (err) {
      console.error("Error scheduling account deletion:", err);
      return res.status(500).json({ error: "Failed to schedule account deletion" });
    }
  });
  app2.post("/api/users/cancel-deletion", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing or invalid Authorization header" });
    }
    const idToken = authHeader.split("Bearer ")[1];
    const firebaseAuth = getFirebaseAuth();
    const db = getFirestoreDb();
    if (!firebaseAuth || !db) {
      return res.status(503).json({ error: "Firebase not configured on the server" });
    }
    let uid;
    try {
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      uid = decoded.uid;
    } catch {
      return res.status(401).json({ error: "Invalid or expired ID token" });
    }
    try {
      await db.collection("users").doc(uid).set(
        {
          pendingDeletion: false,
          deletionScheduledAt: null,
          deletionRequestedAt: null
        },
        { merge: true }
      );
      await db.collection("deletionQueue").doc(uid).delete();
      return res.json({ success: true, message: "Account deletion cancelled." });
    } catch (err) {
      console.error("Error cancelling account deletion:", err);
      return res.status(500).json({ error: "Failed to cancel account deletion" });
    }
  });
}

// server/routes.ts
async function registerRoutes(app2) {
  registerPaymentRoutes(app2);
  registerUserRoutes(app2);
  const httpServer = (0, import_node_http.createServer)(app2);
  return httpServer;
}

// server/index.ts
var fs = __toESM(require("fs"));
var path = __toESM(require("path"));
var app = (0, import_express.default)();
var log = console.log;
function setupCors(app2) {
  app2.use((req, res, next) => {
    const origins = /* @__PURE__ */ new Set();
    if (process.env.REPLIT_DEV_DOMAIN) {
      origins.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    }
    if (process.env.REPLIT_DOMAINS) {
      process.env.REPLIT_DOMAINS.split(",").forEach((d) => {
        origins.add(`https://${d.trim()}`);
      });
    }
    const origin = req.header("origin");
    const isLocalhost = origin?.startsWith("http://localhost:") || origin?.startsWith("http://127.0.0.1:");
    if (origin && (origins.has(origin) || isLocalhost)) {
      res.header("Access-Control-Allow-Origin", origin);
      res.header(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, OPTIONS"
      );
      res.header("Access-Control-Allow-Headers", "Content-Type");
      res.header("Access-Control-Allow-Credentials", "true");
    }
    if (req.method === "OPTIONS") {
      return res.sendStatus(200);
    }
    next();
  });
}
function setupBodyParsing(app2) {
  app2.use(
    import_express.default.json({
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      }
    })
  );
  app2.use(import_express.default.urlencoded({ extended: false }));
}
function setupRequestLogging(app2) {
  app2.use((req, res, next) => {
    const start = Date.now();
    const path2 = req.path;
    let capturedJsonResponse = void 0;
    const originalResJson = res.json;
    res.json = function(bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };
    res.on("finish", () => {
      if (!path2.startsWith("/api")) return;
      const duration = Date.now() - start;
      let logLine = `${req.method} ${path2} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    });
    next();
  });
}
function getAppName() {
  try {
    const appJsonPath = path.resolve(process.cwd(), "app.json");
    const appJsonContent = fs.readFileSync(appJsonPath, "utf-8");
    const appJson = JSON.parse(appJsonContent);
    return appJson.expo?.name || "App Landing Page";
  } catch {
    return "App Landing Page";
  }
}
function serveExpoManifest(platform, res) {
  const manifestPath = path.resolve(
    process.cwd(),
    "static-build",
    platform,
    "manifest.json"
  );
  if (!fs.existsSync(manifestPath)) {
    return res.status(404).json({ error: `Manifest not found for platform: ${platform}` });
  }
  res.setHeader("expo-protocol-version", "1");
  res.setHeader("expo-sfv-version", "0");
  res.setHeader("content-type", "application/json");
  const manifest = fs.readFileSync(manifestPath, "utf-8");
  res.send(manifest);
}
function serveLandingPage({
  req,
  res,
  landingPageTemplate,
  appName
}) {
  const forwardedProto = req.header("x-forwarded-proto");
  const protocol = forwardedProto || req.protocol || "https";
  const forwardedHost = req.header("x-forwarded-host");
  const host = forwardedHost || req.get("host");
  const baseUrl = `${protocol}://${host}`;
  const expsUrl = `${host}`;
  log(`baseUrl`, baseUrl);
  log(`expsUrl`, expsUrl);
  const html = landingPageTemplate.replace(/BASE_URL_PLACEHOLDER/g, baseUrl).replace(/EXPS_URL_PLACEHOLDER/g, expsUrl).replace(/APP_NAME_PLACEHOLDER/g, appName);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(html);
}
function configureExpoAndLanding(app2) {
  const templatePath = path.resolve(
    process.cwd(),
    "server",
    "templates",
    "landing-page.html"
  );
  const landingPageTemplate = fs.readFileSync(templatePath, "utf-8");
  const appName = getAppName();
  log("Serving static Expo files with dynamic manifest routing");
  app2.use((req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    if (req.path !== "/" && req.path !== "/manifest") {
      return next();
    }
    const platform = req.header("expo-platform");
    if (platform && (platform === "ios" || platform === "android")) {
      return serveExpoManifest(platform, res);
    }
    if (req.path === "/") {
      return serveLandingPage({
        req,
        res,
        landingPageTemplate,
        appName
      });
    }
    next();
  });
  app2.use("/assets", import_express.default.static(path.resolve(process.cwd(), "assets")));
  app2.use(import_express.default.static(path.resolve(process.cwd(), "static-build")));
  log("Expo routing: Checking expo-platform header on / and /manifest");
}
function setupErrorHandler(app2) {
  app2.use((err, _req, res, next) => {
    const error = err;
    const status = error.status || error.statusCode || 500;
    const message = error.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) {
      return next(err);
    }
    return res.status(status).json({ message });
  });
}
(async () => {
  setupCors(app);
  setupBodyParsing(app);
  setupRequestLogging(app);
  configureExpoAndLanding(app);
  const server = await registerRoutes(app);
  setupErrorHandler(app);
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0"
    },
    () => {
      log(`express server serving on port ${port}`);
    }
  );
})();
