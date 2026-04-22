import type { Express, Request, Response } from "express";
import {
  getFirestoreDb,
  firestoreFieldValue,
  firestoreTimestamp,
} from "./config/firebase-admin";
import { getAuthenticatedUser } from "../payment-providers/shared/server-utils";
import {
  normalizeReferralCode,
  type CampaignStatus,
  type InfluencerCampaign,
  type ReferralRedeemResponse,
  type VipDuration,
} from "../shared/referral-types";

const CAMPAIGN_COLLECTION = "influencer_campaigns";
const REDEMPTION_COLLECTION = "referral_redemptions";
const DEVICE_COLLECTION = "referral_devices";
const SUBSCRIPTION_COLLECTION = "subscriptions";
const USER_COLLECTION = "users";

function getAdminEmails(): Set<string> {
  const set = new Set<string>(["ahmedsameerbinan1@gmail.com"]);
  const raw = process.env.ADMIN_EMAILS || "";
  raw.split(",").forEach((e) => {
    const v = e.trim().toLowerCase();
    if (v) set.add(v);
  });
  return set;
}

async function requireAdmin(req: Request, res: Response) {
  const authUser = await getAuthenticatedUser(req);
  if (!authUser?.email) {
    res.status(401).json({ message: "Authentication required" });
    return null;
  }
  const admins = getAdminEmails();
  if (!admins.has(authUser.email.toLowerCase())) {
    res.status(403).json({ message: "Admin access required" });
    return null;
  }
  return authUser;
}

function normalizeDeviceId(deviceId: unknown): string {
  if (typeof deviceId !== "string") return "";
  return deviceId.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
}

function parseVipDuration(input: unknown): VipDuration {
  if (!input || typeof input !== "object") return { type: "NONE" };
  const obj = input as Record<string, unknown>;
  if (obj.type === "LIFETIME") return { type: "LIFETIME" };
  if (obj.type === "DAYS" && typeof obj.days === "number" && obj.days > 0) {
    return { type: "DAYS", days: Math.floor(obj.days) };
  }
  return { type: "NONE" };
}

function campaignFromDoc(doc: FirebaseFirestore.DocumentSnapshot): InfluencerCampaign | null {
  if (!doc.exists) return null;
  const d = doc.data() || {};
  return {
    code: doc.id,
    influencerUid: typeof d.influencerUid === "string" ? d.influencerUid : null,
    influencerEmail: typeof d.influencerEmail === "string" ? d.influencerEmail : null,
    influencerName: typeof d.influencerName === "string" ? d.influencerName : null,
    limit: typeof d.limit === "number" ? d.limit : 0,
    usedCount: typeof d.usedCount === "number" ? d.usedCount : 0,
    redeemDurationDays: typeof d.redeemDurationDays === "number" ? d.redeemDurationDays : 90,
    status: (d.status as CampaignStatus) || "ACTIVE",
    vipDuration: parseVipDuration(d.vipDuration),
    notes: typeof d.notes === "string" ? d.notes : null,
    createdAt: d.createdAt?.toDate?.()?.toISOString?.() || new Date(0).toISOString(),
    updatedAt: d.updatedAt?.toDate?.()?.toISOString?.() || new Date(0).toISOString(),
  };
}

async function activateInfluencerVip(
  uid: string,
  email: string | null,
  name: string | null,
  vipDuration: VipDuration,
  campaignCode: string,
) {
  const db = getFirestoreDb();
  if (!db) return;
  if (vipDuration.type === "NONE") return;

  const subRef = db.collection(SUBSCRIPTION_COLLECTION).doc(uid);
  const snap = await subRef.get();
  const existing = snap.exists ? snap.data() || {} : {};

  if (vipDuration.type === "LIFETIME") {
    await subRef.set(
      {
        active: true,
        lifetime: true,
        planId: "influencer-lifetime",
        provider: "influencer",
        userId: uid,
        userEmail: email || existing.userEmail || null,
        amount: 0,
        currency: "INR",
        lastPaymentId: `influencer-vip:${campaignCode}`,
        influencerVipFromCampaign: campaignCode,
        updatedAt: firestoreFieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return;
  }

  // DAYS
  const now = Date.now();
  const existingPaidUntil = existing.paidUntil?.toDate?.() instanceof Date ? existing.paidUntil.toDate().getTime() : 0;
  const baseTime = Math.max(now, existingPaidUntil);
  const newPaidUntil = new Date(baseTime + vipDuration.days * 86400 * 1000);

  await subRef.set(
    {
      active: true,
      lifetime: false,
      paidUntil: firestoreTimestamp.fromDate(newPaidUntil),
      planId: "influencer-vip",
      provider: "influencer",
      userId: uid,
      userEmail: email || existing.userEmail || null,
      amount: 0,
      currency: "INR",
      lastPaymentId: `influencer-vip:${campaignCode}`,
      influencerVipFromCampaign: campaignCode,
      updatedAt: firestoreFieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

export function registerReferralRoutes(app: Express) {
  // ─────────────────────────────────────────────────────────────────
  // ADMIN: List all campaigns
  // ─────────────────────────────────────────────────────────────────
  app.get("/api/admin/influencer-campaigns", async (req: Request, res: Response, next) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Firebase not configured" });

      const snap = await db.collection(CAMPAIGN_COLLECTION).orderBy("createdAt", "desc").get();
      const campaigns = snap.docs.map(campaignFromDoc).filter(Boolean);
      res.json({ campaigns });
    } catch (err) {
      next(err);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ADMIN: Create a campaign
  // body: { code, limit, redeemDurationDays?, vipDuration?, influencerUid?, influencerEmail?, influencerName?, notes? }
  // ─────────────────────────────────────────────────────────────────
  app.post("/api/admin/influencer-campaigns", async (req: Request, res: Response, next) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Firebase not configured" });

      const code = normalizeReferralCode(req.body?.code);
      if (!code || code.length < 3) {
        return res.status(400).json({ message: "Code must be at least 3 alphanumeric characters" });
      }

      const limit = Number(req.body?.limit);
      if (!Number.isFinite(limit) || limit <= 0 || limit > 1_000_000) {
        return res.status(400).json({ message: "Limit must be a positive integer (1 – 1,000,000)" });
      }

      const redeemDurationDays = Number(req.body?.redeemDurationDays ?? 90);
      if (!Number.isFinite(redeemDurationDays) || redeemDurationDays <= 0 || redeemDurationDays > 36500) {
        return res.status(400).json({ message: "redeemDurationDays must be 1 – 36500" });
      }

      const vipDuration = parseVipDuration(req.body?.vipDuration);

      const ref = db.collection(CAMPAIGN_COLLECTION).doc(code);
      const existing = await ref.get();
      if (existing.exists) {
        return res.status(409).json({ message: `Campaign code "${code}" already exists` });
      }

      const payload = {
        influencerUid: typeof req.body?.influencerUid === "string" ? req.body.influencerUid : null,
        influencerEmail: typeof req.body?.influencerEmail === "string" ? req.body.influencerEmail.toLowerCase() : null,
        influencerName: typeof req.body?.influencerName === "string" ? req.body.influencerName : null,
        limit: Math.floor(limit),
        usedCount: 0,
        redeemDurationDays: Math.floor(redeemDurationDays),
        status: "ACTIVE" as CampaignStatus,
        vipDuration,
        notes: typeof req.body?.notes === "string" ? req.body.notes : null,
        createdAt: firestoreFieldValue.serverTimestamp(),
        updatedAt: firestoreFieldValue.serverTimestamp(),
        createdBy: admin.email || admin.uid,
      };

      await ref.set(payload);

      // If we have an influencer UID and they get VIP immediately, activate it.
      if (payload.influencerUid && vipDuration.type !== "NONE") {
        await activateInfluencerVip(
          payload.influencerUid,
          payload.influencerEmail,
          payload.influencerName,
          vipDuration,
          code,
        );
      }

      const fresh = await ref.get();
      res.json({ campaign: campaignFromDoc(fresh) });
    } catch (err) {
      next(err);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ADMIN: Update a campaign (limit / status / duration / vip / notes)
  // ─────────────────────────────────────────────────────────────────
  app.patch("/api/admin/influencer-campaigns/:code", async (req: Request, res: Response, next) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Firebase not configured" });

      const code = normalizeReferralCode(req.params.code);
      const ref = db.collection(CAMPAIGN_COLLECTION).doc(code);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Campaign not found" });

      const updates: Record<string, unknown> = { updatedAt: firestoreFieldValue.serverTimestamp() };

      if (req.body?.limit !== undefined) {
        const lim = Number(req.body.limit);
        if (!Number.isFinite(lim) || lim <= 0) {
          return res.status(400).json({ message: "Invalid limit" });
        }
        updates.limit = Math.floor(lim);
        // If new limit > usedCount and previously EXHAUSTED, re-activate
        const current = snap.data() || {};
        if (current.status === "EXHAUSTED" && Math.floor(lim) > (current.usedCount || 0)) {
          updates.status = "ACTIVE";
        }
      }

      if (req.body?.status !== undefined) {
        const s = String(req.body.status).toUpperCase();
        if (!["ACTIVE", "BANNED", "EXHAUSTED"].includes(s)) {
          return res.status(400).json({ message: "Invalid status" });
        }
        updates.status = s;
      }

      if (req.body?.redeemDurationDays !== undefined) {
        const d = Number(req.body.redeemDurationDays);
        if (!Number.isFinite(d) || d <= 0) {
          return res.status(400).json({ message: "Invalid redeemDurationDays" });
        }
        updates.redeemDurationDays = Math.floor(d);
      }

      if (req.body?.vipDuration !== undefined) {
        updates.vipDuration = parseVipDuration(req.body.vipDuration);
      }

      if (req.body?.notes !== undefined) {
        updates.notes = typeof req.body.notes === "string" ? req.body.notes : null;
      }

      if (req.body?.influencerUid !== undefined) {
        updates.influencerUid = typeof req.body.influencerUid === "string" ? req.body.influencerUid : null;
      }
      if (req.body?.influencerEmail !== undefined) {
        updates.influencerEmail = typeof req.body.influencerEmail === "string" ? req.body.influencerEmail.toLowerCase() : null;
      }
      if (req.body?.influencerName !== undefined) {
        updates.influencerName = typeof req.body.influencerName === "string" ? req.body.influencerName : null;
      }

      await ref.set(updates, { merge: true });

      // If admin requested VIP grant be re-applied (e.g. influencer just signed up)
      if (req.body?.applyVipNow === true) {
        const merged = (await ref.get()).data() || {};
        if (merged.influencerUid) {
          await activateInfluencerVip(
            merged.influencerUid,
            merged.influencerEmail || null,
            merged.influencerName || null,
            parseVipDuration(merged.vipDuration),
            code,
          );
        }
      }

      const fresh = await ref.get();
      res.json({ campaign: campaignFromDoc(fresh) });
    } catch (err) {
      next(err);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // ADMIN: Convenience: BAN / UNBAN
  // ─────────────────────────────────────────────────────────────────
  app.post("/api/admin/influencer-campaigns/:code/ban", async (req: Request, res: Response, next) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Firebase not configured" });
      const code = normalizeReferralCode(req.params.code);
      const ref = db.collection(CAMPAIGN_COLLECTION).doc(code);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Campaign not found" });
      await ref.set({ status: "BANNED", updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
      res.json({ campaign: campaignFromDoc(await ref.get()) });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/admin/influencer-campaigns/:code/unban", async (req: Request, res: Response, next) => {
    try {
      const admin = await requireAdmin(req, res);
      if (!admin) return;
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Firebase not configured" });
      const code = normalizeReferralCode(req.params.code);
      const ref = db.collection(CAMPAIGN_COLLECTION).doc(code);
      const snap = await ref.get();
      if (!snap.exists) return res.status(404).json({ message: "Campaign not found" });
      const data = snap.data() || {};
      const newStatus: CampaignStatus = (data.usedCount || 0) >= (data.limit || 0) ? "EXHAUSTED" : "ACTIVE";
      await ref.set({ status: newStatus, updatedAt: firestoreFieldValue.serverTimestamp() }, { merge: true });
      res.json({ campaign: campaignFromDoc(await ref.get()) });
    } catch (err) {
      next(err);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // PUBLIC: Inspect a campaign without redeeming (lets the UI pre-validate)
  // ─────────────────────────────────────────────────────────────────
  app.get("/api/referrals/lookup/:code", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Firebase not configured" });
      const code = normalizeReferralCode(req.params.code);
      if (!code) return res.status(400).json({ message: "Invalid code" });
      const snap = await db.collection(CAMPAIGN_COLLECTION).doc(code).get();
      const camp = campaignFromDoc(snap);
      if (!camp || camp.status === "BANNED") {
        return res.status(404).json({ message: "Code not found" });
      }
      res.json({
        code: camp.code,
        influencerName: camp.influencerName,
        redeemDurationDays: camp.redeemDurationDays,
        slotsRemaining: Math.max(0, camp.limit - camp.usedCount),
        status: camp.status,
      });
    } catch (err) {
      next(err);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // USER: Redeem a referral code (THE main flow)
  // body: { code, deviceId }
  // ─────────────────────────────────────────────────────────────────
  app.post("/api/referrals/redeem", async (req: Request, res: Response, next) => {
    const fail = (status: number, body: ReferralRedeemResponse) => res.status(status).json(body);

    try {
      const db = getFirestoreDb();
      if (!db) {
        return fail(503, { success: false, errorCode: "SERVER_ERROR", message: "Service unavailable" });
      }

      const authUser = await getAuthenticatedUser(req);
      if (!authUser) {
        return fail(401, {
          success: false,
          errorCode: "AUTH_REQUIRED",
          message: "Sign in with Google to redeem a referral code",
        });
      }

      const code = normalizeReferralCode(req.body?.code);
      if (!code) {
        return fail(400, { success: false, errorCode: "INVALID_CODE", message: "Enter a valid referral code" });
      }

      const deviceId = normalizeDeviceId(req.body?.deviceId);
      if (!deviceId) {
        return fail(400, { success: false, errorCode: "INVALID_DEVICE", message: "Device identifier missing" });
      }

      const campaignRef = db.collection(CAMPAIGN_COLLECTION).doc(code);
      const userRef = db.collection(USER_COLLECTION).doc(authUser.uid);
      const subRef = db.collection(SUBSCRIPTION_COLLECTION).doc(authUser.uid);
      const deviceRef = db.collection(DEVICE_COLLECTION).doc(deviceId);
      const redemptionRef = db.collection(REDEMPTION_COLLECTION).doc(`${authUser.uid}_${code}`);

      // Run a transaction to atomically validate and write all docs.
      const result = await db.runTransaction(async (tx) => {
        const [campaignSnap, userSnap, subSnap, deviceSnap, redemptionSnap] = await Promise.all([
          tx.get(campaignRef),
          tx.get(userRef),
          tx.get(subRef),
          tx.get(deviceRef),
          tx.get(redemptionRef),
        ]);

        if (!campaignSnap.exists) {
          return { ok: false as const, code: "INVALID_CODE" as const, message: "That referral code does not exist" };
        }
        const campaign = campaignSnap.data() || {};
        const status: CampaignStatus = campaign.status || "ACTIVE";
        const limit: number = typeof campaign.limit === "number" ? campaign.limit : 0;
        const usedCount: number = typeof campaign.usedCount === "number" ? campaign.usedCount : 0;
        const redeemDurationDays: number = typeof campaign.redeemDurationDays === "number" ? campaign.redeemDurationDays : 90;

        if (status === "BANNED") {
          return { ok: false as const, code: "CODE_BANNED" as const, message: "This referral code has been disabled" };
        }
        if (status === "EXHAUSTED" || usedCount >= limit) {
          return { ok: false as const, code: "CODE_EXHAUSTED" as const, message: "This giveaway is full. Try another code or buy a plan" };
        }

        if (campaign.influencerUid && campaign.influencerUid === authUser.uid) {
          return { ok: false as const, code: "SELF_REDEEM_BLOCKED" as const, message: "You cannot redeem your own referral code" };
        }

        // Already redeemed this exact code? (idempotent re-tap)
        if (redemptionSnap.exists) {
          return { ok: false as const, code: "ALREADY_REDEEMED" as const, message: "You have already used this referral code" };
        }

        // User-level one-time check
        const userData = userSnap.exists ? userSnap.data() || {} : {};
        if (userData.referralClaimed === true) {
          return {
            ok: false as const,
            code: "ALREADY_REDEEMED" as const,
            message: "You have already claimed a referral gift on this account",
          };
        }

        // Device-level anti-spoof
        if (deviceSnap.exists) {
          const deviceData = deviceSnap.data() || {};
          if (deviceData.uid && deviceData.uid !== authUser.uid) {
            return {
              ok: false as const,
              code: "DEVICE_ALREADY_USED" as const,
              message: "This device has already claimed a referral reward",
            };
          }
          if (deviceData.uid === authUser.uid) {
            // Same user same device — fall through to ALREADY_REDEEMED check via redemptionRef above.
            return { ok: false as const, code: "ALREADY_REDEEMED" as const, message: "This device has already claimed a referral" };
          }
        }

        // Active subscription guard
        const subData = subSnap.exists ? subSnap.data() || {} : {};
        const lifetime = Boolean(subData.lifetime);
        const paidUntilDate = subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate() : null;
        const hasActive = lifetime || (paidUntilDate && paidUntilDate.getTime() > Date.now());
        if (hasActive) {
          return {
            ok: false as const,
            code: "ACTIVE_SUBSCRIPTION" as const,
            message: "You already have an active Pro plan. Wait for it to expire before redeeming a code",
          };
        }

        // ── ALL CHECKS PASSED — perform writes ──
        const now = new Date();
        const newPaidUntil = new Date(now.getTime() + redeemDurationDays * 86400 * 1000);
        const newUsedCount = usedCount + 1;
        const willExhaust = newUsedCount >= limit;

        // 1. Subscription
        tx.set(
          subRef,
          {
            active: true,
            lifetime: false,
            paidUntil: firestoreTimestamp.fromDate(newPaidUntil),
            planId: "referral-quarterly",
            provider: "referral",
            userId: authUser.uid,
            userEmail: authUser.email || subData.userEmail || null,
            amount: 0,
            currency: "INR",
            lastPaymentId: `referral:${code}`,
            referralCode: code,
            referralRedeemedAt: firestoreFieldValue.serverTimestamp(),
            updatedAt: firestoreFieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        // 2. User profile flag
        tx.set(
          userRef,
          {
            referralClaimed: true,
            referralCode: code,
            referralRedeemedAt: firestoreFieldValue.serverTimestamp(),
            referralDeviceId: deviceId,
            updatedAt: firestoreFieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        // 3. Device fingerprint (anti-spoof)
        tx.set(deviceRef, {
          uid: authUser.uid,
          email: authUser.email || null,
          code,
          claimedAt: firestoreFieldValue.serverTimestamp(),
        });

        // 4. Redemption ledger entry (idempotency key)
        tx.set(redemptionRef, {
          uid: authUser.uid,
          email: authUser.email || null,
          code,
          deviceId,
          durationDays: redeemDurationDays,
          paidUntil: firestoreTimestamp.fromDate(newPaidUntil),
          createdAt: firestoreFieldValue.serverTimestamp(),
        });

        // 5. Campaign counter + auto-EXHAUSTED status
        tx.set(
          campaignRef,
          {
            usedCount: firestoreFieldValue.increment(1),
            ...(willExhaust ? { status: "EXHAUSTED" as CampaignStatus } : {}),
            updatedAt: firestoreFieldValue.serverTimestamp(),
          },
          { merge: true },
        );

        return {
          ok: true as const,
          durationDays: redeemDurationDays,
          paidUntil: newPaidUntil.toISOString(),
          influencerName: typeof campaign.influencerName === "string" ? campaign.influencerName : null,
        };
      });

      if (!result.ok) {
        const httpStatus =
          result.code === "INVALID_CODE" ? 404 :
          result.code === "CODE_BANNED" || result.code === "CODE_EXHAUSTED" ? 410 :
          result.code === "ACTIVE_SUBSCRIPTION" ? 409 :
          result.code === "ALREADY_REDEEMED" || result.code === "DEVICE_ALREADY_USED" ? 409 :
          result.code === "SELF_REDEEM_BLOCKED" ? 403 :
          400;
        return fail(httpStatus, { success: false, errorCode: result.code, message: result.message });
      }

      const okResp: ReferralRedeemResponse = {
        success: true,
        code,
        durationDays: result.durationDays,
        paidUntil: result.paidUntil,
        influencerName: result.influencerName,
        message: `Pro activated for ${result.durationDays} days`,
      };
      res.json(okResp);
    } catch (err) {
      console.error("Referral redeem error:", err);
      next(err);
    }
  });
}
