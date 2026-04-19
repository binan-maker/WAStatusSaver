import type { Express, Request, Response } from "express";
import { GOOGLE_PLAY_PLANS } from "../client/plans";
import {
  firestoreFieldValue,
  firestoreTimestamp,
  getFirebaseAuth,
  getFirestoreDb,
} from "../../../server/firebase-admin";

type AuthenticatedUser = {
  uid: string;
  email?: string;
  name?: string;
};

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
  durationDays: number,
  userId: string,
  db: ReturnType<typeof getFirestoreDb>,
): Promise<Date> {
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
  return new Date(baseTime + durationDays * 24 * 60 * 60 * 1000);
}

async function verifyGooglePlayPurchase(purchaseToken: string, productId: string): Promise<boolean> {
  const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME || "com.binan.statussaver";

  if (!serviceAccountJson) {
    console.warn("[Google Play] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON not set — skipping purchase verification");
    return true;
  }

  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    const jwtHeader = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = Buffer.from(JSON.stringify({
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/androidpublisher",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    })).toString("base64url");

    const crypto = await import("node:crypto");
    const sign = crypto.createSign("RSA-SHA256");
    sign.update(`${jwtHeader}.${jwtPayload}`);
    const jwtSignature = sign.sign(serviceAccount.private_key, "base64url");
    const jwt = `${jwtHeader}.${jwtPayload}.${jwtSignature}`;

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });
    const tokenData = await tokenRes.json() as { access_token?: string };
    if (!tokenData.access_token) return false;

    const verifyRes = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}/purchases/subscriptions/${productId}/tokens/${purchaseToken}`,
      { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
    );

    if (!verifyRes.ok) return false;
    const purchaseData = await verifyRes.json() as { paymentState?: number; cancelReason?: number };
    return purchaseData.paymentState === 1;
  } catch (err) {
    console.error("[Google Play] Verification error:", err);
    return false;
  }
}

export function registerGooglePlayRoutes(app: Express) {
  app.post("/api/payments/google-play/verify", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      const authUser = await getAuthenticatedUser(req);
      const deviceId = normalizeDeviceId(req.body?.deviceId);
      const purchaseToken = String(req.body?.purchaseToken || "");
      const productId = String(req.body?.productId || "");
      const planId = String(req.body?.planId || "");

      if (!db) return res.status(503).json({ message: "Database not configured" });
      if (!authUser) return res.status(401).json({ message: "Google sign-in is required" });
      if (!purchaseToken || !productId || !planId || !deviceId) {
        return res.status(400).json({ message: "Missing purchase details" });
      }

      const plan = GOOGLE_PLAY_PLANS.find((p) => p.id === planId && p.googlePlayProductId === productId);
      if (!plan) return res.status(400).json({ message: "Invalid plan or product ID" });

      const idempotencyKey = `${authUser.uid}_${purchaseToken}`;
      const existingSnap = await db.collection("googlePlayOrders").doc(idempotencyKey).get();
      if (existingSnap.exists && existingSnap.data()?.status === "verified") {
        const subSnap = await db.collection("subscriptions").doc(authUser.uid).get();
        const subData = subSnap.data() || {};
        const paidUntilDate = subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate() : null;
        return res.json({
          active: Boolean(paidUntilDate && paidUntilDate.getTime() > Date.now()),
          planId: subData.planId || planId,
          paidUntil: paidUntilDate ? paidUntilDate.toISOString() : null,
        });
      }

      const isValid = await verifyGooglePlayPurchase(purchaseToken, productId);
      if (!isValid) {
        await db.collection("googlePlayOrders").doc(idempotencyKey).set({
          purchaseToken, productId, planId, userId: authUser.uid,
          status: "verification_failed",
          createdAt: firestoreFieldValue.serverTimestamp(),
        }, { merge: true });
        return res.status(400).json({ message: "Purchase verification failed" });
      }

      const paidUntil = await computeStackedPaidUntil(plan.durationDays, authUser.uid, db);
      const subscriptionPayload = {
        deviceId,
        userId: authUser.uid,
        userEmail: authUser.email || null,
        active: true,
        lifetime: false,
        planId: plan.id,
        amount: plan.amount,
        currency: plan.currency,
        paidUntil: firestoreTimestamp.fromDate(paidUntil),
        lastPaymentId: purchaseToken,
        provider: "google-play",
        updatedAt: firestoreFieldValue.serverTimestamp(),
      };

      await db.collection("subscriptions").doc(authUser.uid).set(subscriptionPayload, { merge: true });
      await db.collection("googlePlayOrders").doc(idempotencyKey).set({
        purchaseToken, productId, planId, userId: authUser.uid, deviceId,
        status: "verified", verifiedAt: firestoreFieldValue.serverTimestamp(),
        paidUntil: firestoreTimestamp.fromDate(paidUntil),
        createdAt: firestoreFieldValue.serverTimestamp(),
      }, { merge: true });
      await db.collection("users").doc(authUser.uid).set({
        userId: authUser.uid, email: authUser.email || null, name: authUser.name || null,
        deviceId, subscription: subscriptionPayload, updatedAt: firestoreFieldValue.serverTimestamp(),
      }, { merge: true });
      await db.collection("users").doc(authUser.uid).collection("payments").doc(purchaseToken.slice(0, 60)).set({
        purchaseToken, productId, planId: plan.id, amount: plan.amount, currency: plan.currency,
        status: "verified", provider: "google-play", createdAt: firestoreFieldValue.serverTimestamp(),
      });

      console.log(`[Google Play] Subscription activated: userId=${authUser.uid}, plan=${planId}, until=${paidUntil.toISOString()}`);

      return res.json({
        active: true,
        planId: plan.id,
        paidUntil: paidUntil.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/payments/google-play/webhook", async (req: Request, res: Response) => {
    try {
      const messageData = req.body?.message?.data;
      if (!messageData) return res.status(200).json({ status: "no_data" });

      const decoded = JSON.parse(Buffer.from(messageData, "base64").toString("utf-8"));
      const { subscriptionNotification } = decoded;
      if (!subscriptionNotification) return res.status(200).json({ status: "ignored" });

      const { purchaseToken, subscriptionId, notificationType } = subscriptionNotification;
      if (!purchaseToken || !subscriptionId) return res.status(200).json({ status: "invalid_payload" });

      const SUBSCRIPTION_RENEWED = 4;
      const SUBSCRIPTION_CANCELED = 3;
      const SUBSCRIPTION_REVOKED = 12;
      const SUBSCRIPTION_EXPIRED = 13;

      const db = getFirestoreDb();
      if (!db) return res.status(200).json({ status: "db_unavailable" });

      const plan = GOOGLE_PLAY_PLANS.find((p) => p.googlePlayProductId === subscriptionId);
      if (!plan) return res.status(200).json({ status: "unknown_product" });

      if ([SUBSCRIPTION_CANCELED, SUBSCRIPTION_REVOKED, SUBSCRIPTION_EXPIRED].includes(notificationType)) {
        console.log(`[Google Play Webhook] Subscription event ${notificationType} for product ${subscriptionId}`);
        return res.status(200).json({ status: "event_noted" });
      }

      if (notificationType === SUBSCRIPTION_RENEWED) {
        console.log(`[Google Play Webhook] Subscription renewed for product ${subscriptionId}`);
        return res.status(200).json({ status: "renewal_noted" });
      }

      return res.status(200).json({ status: "event_ignored" });
    } catch (err) {
      console.error("[Google Play Webhook] Error:", err);
      return res.status(200).json({ status: "processing_error" });
    }
  });
}
