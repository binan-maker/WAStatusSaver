import type { Express, Request, Response } from "express";
import { SUBSCRIPTION_PLANS } from "../shared/subscription-plans";
import { getFirebaseAuth, getFirebaseStatus, getFirestoreDb } from "./config/firebase-admin";
import { registerPaymentRoutes, PROVIDER_NAME } from "../payment-providers/server";

type AuthenticatedUser = {
  uid: string;
  email?: string;
};

const TEST_ACCOUNT_EMAILS = new Set([
  "ahmedsameerbinan1@gmail.com",
]);

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
    };
  } catch {
    return null;
  }
}

function normalizeDeviceId(deviceId: unknown) {
  if (typeof deviceId !== "string") return "";
  return deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

export function registerAllPaymentRoutes(app: Express) {
  app.get("/api/subscriptions/plans", (_req: Request, res: Response) => {
    res.json({
      plans: SUBSCRIPTION_PLANS,
      provider: PROVIDER_NAME,
      firebase: getFirebaseStatus(),
    });
  });

  app.get("/api/subscriptions/status/:deviceId", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      const authUser = await getAuthenticatedUser(req);
      const deviceId = normalizeDeviceId(req.params.deviceId);

      if (!deviceId) return res.status(400).json({ message: "Invalid device ID" });

      if (!db) {
        return res.json({ active: false, configured: false, planId: null, paidUntil: null, message: "Firebase is not configured" });
      }

      if (!authUser) {
        return res.json({ active: false, configured: true, signInRequired: true, planId: null, paidUntil: null });
      }

      if (authUser.email && TEST_ACCOUNT_EMAILS.has(authUser.email.toLowerCase())) {
        return res.json({ active: true, configured: true, lifetime: true, planId: "lifetime", paidUntil: null });
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
        provider: data.provider || null,
      });
    } catch (error) {
      next(error);
    }
  });

  registerPaymentRoutes(app);
}
