import type { Express, Request, Response } from "express";
import {
  getFirestoreDb,
  firestoreFieldValue,
  firestoreTimestamp,
} from "./config/firebase-admin";
import { getAuthenticatedUser } from "../payment-providers/shared/server-utils";
import {
  normalizeReferralCode,
  REWARD_LADDER,
  type AttributeInstallResponse,
  type CampaignStatus,
  type InfluencerCampaign,
  type MyReferralResponse,
  type ReferralRedeemResponse,
  type RewardLadderTier,
  type VipDuration,
} from "../shared/referral-types";

const CAMPAIGN_COLLECTION = "influencer_campaigns";
const REDEMPTION_COLLECTION = "referral_redemptions";
const DEVICE_COLLECTION = "referral_devices";
const SUBSCRIPTION_COLLECTION = "subscriptions";
const USER_COLLECTION = "users";
const USER_REFERRAL_COLLECTION = "user_referrals";        // {uid} → personal stats
const REFERRAL_CODE_COLLECTION = "referral_codes";         // {CODE} → uid (reverse lookup)
const INSTALL_DEVICE_COLLECTION = "referral_install_devices"; // {deviceId} → who used it

const PLAY_STORE_PACKAGE = "com.binan.statussaver";

/**
 * Build the canonical short-link base URL.
 * Production should set PUBLIC_BASE_URL=https://svault.me (or whatever short
 * domain is registered). In Replit dev/preview we derive it from the request
 * host so links opened from a phone hit the same proxy URL the app talks to.
 */
function getShortLinkBase(req: Request): string {
  const env = (process.env.PUBLIC_BASE_URL || "").trim();
  if (env) return env.replace(/\/+$/, "");
  // Honour proxy headers (Replit + most CDNs strip the original scheme/host).
  const proto = (req.get("x-forwarded-proto") || req.protocol || "https").split(",")[0].trim();
  const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
  return host ? `${proto}://${host}` : "";
}

function buildPlayStoreUrl(code: string | null): string {
  const base = `https://play.google.com/store/apps/details?id=${PLAY_STORE_PACKAGE}`;
  if (!code) return base;
  return `${base}&referrer=${encodeURIComponent(`ref=${code}`)}`;
}

const SHORT_CODE_RE = /^[A-Z0-9_-]{3,16}$/;

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
  // PUBLIC: Short-link redirect /s/:code → Play Store with ?referrer=ref%3DCODE
  // Used by every shared status caption, social bio links, etc.
  // Renders a tiny HTML bouncer with both a meta-refresh AND a JS redirect so
  // it works inside browsers that strip 302s for in-app webviews.
  // ─────────────────────────────────────────────────────────────────
  app.get("/s/:code", (req: Request, res: Response) => {
    const rawParam = req.params.code;
    const raw = (typeof rawParam === "string" ? rawParam : "").trim().toUpperCase();
    const code = SHORT_CODE_RE.test(raw) ? raw : null;
    const target = buildPlayStoreUrl(code);

    res.set("Cache-Control", "public, max-age=300");
    // 302 first — fast happy path for normal browsers.
    res.status(302).set("Location", target).type("html").send(
      `<!doctype html><html><head>
<meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=${target}"/>
<title>Opening StatusVault…</title>
<style>body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0e1a;color:#e5e7eb;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center}a{color:#00c48c}</style>
</head><body>
<div>
  <h2>Opening StatusVault on Google Play…</h2>
  <p>If nothing happens, <a href="${target}">tap here</a>.</p>
</div>
<script>location.replace(${JSON.stringify(target)});</script>
</body></html>`
    );
  });

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

  // ─────────────────────────────────────────────────────────────────
  // USER: Get my personal referral code, count, and ladder progress
  // ─────────────────────────────────────────────────────────────────
  app.get("/api/referrals/me", async (req: Request, res: Response, next) => {
    try {
      const db = getFirestoreDb();
      if (!db) return res.status(503).json({ message: "Service unavailable" });
      const authUser = await getAuthenticatedUser(req);
      if (!authUser) return res.status(401).json({ message: "Sign in required" });

      const userRef = db.collection(USER_REFERRAL_COLLECTION).doc(authUser.uid);
      let snap = await userRef.get();
      let data = snap.exists ? snap.data() || {} : {};

      // Lazy-create profile + unique code on first call
      if (!data.myCode) {
        const newCode = await mintUniqueReferralCode(db, authUser.uid);
        await userRef.set({
          myCode: newCode,
          referralCount: 0,
          rewardsClaimed: [],
          referredUserIds: [],
          referredJoinedAt: [],
          createdAt: firestoreFieldValue.serverTimestamp(),
          updatedAt: firestoreFieldValue.serverTimestamp(),
          ownerEmail: authUser.email || null,
        }, { merge: true });
        snap = await userRef.get();
        data = snap.data() || {};
      }

      const code: string = data.myCode;
      const referralCount: number = typeof data.referralCount === "number" ? data.referralCount : 0;
      const rewardsClaimed: string[] = Array.isArray(data.rewardsClaimed) ? data.rewardsClaimed : [];

      // Build referredUsers join timestamps (cap to most recent 50 for payload size)
      const joinedAtArr: any[] = Array.isArray(data.referredJoinedAt) ? data.referredJoinedAt : [];
      const referredUsers = joinedAtArr.slice(-50).map((ts) => ({
        joinedAt: ts?.toDate?.()?.toISOString?.() || (typeof ts === "string" ? ts : new Date(0).toISOString()),
      }));

      // Find next tier
      const nextTier = REWARD_LADDER.find((t) => referralCount < t.threshold) || null;
      const remainingForNext = nextTier ? Math.max(0, nextTier.threshold - referralCount) : 0;

      // Read current subscription to surface reward state
      const subSnap = await db.collection(SUBSCRIPTION_COLLECTION).doc(authUser.uid).get();
      const subData = subSnap.exists ? subSnap.data() || {} : {};
      const lifetime = Boolean(subData.lifetime);
      const paidUntilDate = subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate() : null;
      const rewardActive = lifetime || (paidUntilDate ? paidUntilDate.getTime() > Date.now() : false);

      const base = getShortLinkBase(req);
      const playStoreUrl = buildPlayStoreUrl(code);
      // Short link → /s/:code → 302 → playStoreUrl. Falls back to the
      // long URL only if we somehow couldn't determine our own host.
      const shareUrl = base ? `${base}/s/${code}` : playStoreUrl;
      const deepLink = `statusvault://invite?ref=${code}`;

      const payload: MyReferralResponse = {
        code,
        referralCount,
        rewardsClaimed,
        referredUsers,
        shareUrl,
        playStoreUrl,
        deepLink,
        ladder: REWARD_LADDER,
        nextTier,
        remainingForNext,
        rewardActive,
        rewardPaidUntil: paidUntilDate ? paidUntilDate.toISOString() : null,
        rewardLifetime: lifetime,
      };
      res.json(payload);
    } catch (err) {
      console.error("/api/referrals/me error:", err);
      next(err);
    }
  });

  // ─────────────────────────────────────────────────────────────────
  // USER: Attribute the install of THIS signed-in user to a referrer
  //   body: { code, deviceId }
  //   Called once after sign-in if the app captured a pending ref code
  //   from a deep-link or manual entry.
  // ─────────────────────────────────────────────────────────────────
  app.post("/api/referrals/attribute-install", async (req: Request, res: Response, next) => {
    const fail = (status: number, body: AttributeInstallResponse) => res.status(status).json(body);
    try {
      const db = getFirestoreDb();
      if (!db) return fail(503, { success: false, errorCode: "SERVER_ERROR", message: "Service unavailable" });

      const authUser = await getAuthenticatedUser(req);
      if (!authUser) return fail(401, { success: false, errorCode: "AUTH_REQUIRED", message: "Sign in required" });

      const code = normalizeReferralCode(req.body?.code);
      if (!code || code.length < 3) {
        return fail(400, { success: false, errorCode: "INVALID_CODE", message: "Invalid referral code" });
      }
      const deviceId = normalizeDeviceId(req.body?.deviceId);
      if (!deviceId) {
        return fail(400, { success: false, errorCode: "INVALID_DEVICE", message: "Device id missing" });
      }

      // Resolve code → referrer uid
      const codeSnap = await db.collection(REFERRAL_CODE_COLLECTION).doc(code).get();
      if (!codeSnap.exists) {
        return fail(404, { success: false, errorCode: "INVALID_CODE", message: "Referral code not found" });
      }
      const referrerUid: string | undefined = codeSnap.data()?.uid;
      if (!referrerUid) {
        return fail(404, { success: false, errorCode: "INVALID_CODE", message: "Referral code not found" });
      }
      if (referrerUid === authUser.uid) {
        return fail(403, { success: false, errorCode: "SELF_REFER_BLOCKED", message: "You cannot refer yourself" });
      }

      const meRef = db.collection(USER_REFERRAL_COLLECTION).doc(authUser.uid);
      const referrerRef = db.collection(USER_REFERRAL_COLLECTION).doc(referrerUid);
      const installDeviceRef = db.collection(INSTALL_DEVICE_COLLECTION).doc(deviceId);

      const txResult = await db.runTransaction(async (tx) => {
        const [meSnap, deviceSnap, referrerSnap] = await Promise.all([
          tx.get(meRef),
          tx.get(installDeviceRef),
          tx.get(referrerRef),
        ]);

        const meData = meSnap.exists ? meSnap.data() || {} : {};
        if (meData.referrerUid && typeof meData.referrerUid === "string") {
          return { ok: false as const, code: "ALREADY_ATTRIBUTED" as const, message: "Your install is already attributed" };
        }
        if (deviceSnap.exists) {
          return { ok: false as const, code: "DEVICE_ALREADY_USED" as const, message: "This device has already been credited" };
        }

        const now = firestoreFieldValue.serverTimestamp();

        // Mark me as attributed
        tx.set(meRef, {
          referrerUid,
          attributedAt: now,
          attributedDeviceId: deviceId,
          ownerEmail: authUser.email || meData.ownerEmail || null,
          // Preserve existing personal-code fields if present
          referralCount: typeof meData.referralCount === "number" ? meData.referralCount : 0,
          rewardsClaimed: Array.isArray(meData.rewardsClaimed) ? meData.rewardsClaimed : [],
          updatedAt: now,
        }, { merge: true });

        // Increment referrer's count + log my join
        tx.set(referrerRef, {
          referralCount: firestoreFieldValue.increment(1),
          referredUserIds: firestoreFieldValue.arrayUnion(authUser.uid),
          referredJoinedAt: firestoreFieldValue.arrayUnion(firestoreTimestamp.now()),
          updatedAt: now,
        }, { merge: true });

        // Mark device used
        tx.set(installDeviceRef, {
          uid: authUser.uid,
          referrerUid,
          code,
          createdAt: now,
        });

        const referrerName = referrerSnap.exists ? (referrerSnap.data()?.ownerEmail || null) : null;
        return { ok: true as const, referrerName };
      });

      if (!txResult.ok) {
        const status = txResult.code === "ALREADY_ATTRIBUTED" || txResult.code === "DEVICE_ALREADY_USED" ? 409 : 400;
        return fail(status, { success: false, errorCode: txResult.code, message: txResult.message });
      }

      // Apply ladder rewards to referrer (outside the txn — reads sub doc)
      try {
        await applyLadderRewards(referrerUid);
      } catch (e) {
        console.error("applyLadderRewards failed:", e);
      }

      const okResp: AttributeInstallResponse = {
        success: true,
        referrerName: txResult.referrerName,
        message: "Install attributed. Your friend just got closer to a free reward 🎉",
      };
      res.json(okResp);
    } catch (err) {
      console.error("/api/referrals/attribute-install error:", err);
      next(err);
    }
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function generateRandomCode(len = 6): string {
  // Avoid lookalike chars (0/O, 1/I)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

async function mintUniqueReferralCode(
  db: FirebaseFirestore.Firestore,
  uid: string,
): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const candidate = generateRandomCode(attempt < 4 ? 6 : 7);
    const ref = db.collection(REFERRAL_CODE_COLLECTION).doc(candidate);
    // Don't collide with existing influencer codes either
    const [codeSnap, campSnap] = await Promise.all([
      ref.get(),
      db.collection(CAMPAIGN_COLLECTION).doc(candidate).get(),
    ]);
    if (!codeSnap.exists && !campSnap.exists) {
      await ref.set({ uid, createdAt: firestoreFieldValue.serverTimestamp() });
      return candidate;
    }
  }
  throw new Error("Failed to mint unique referral code after 8 attempts");
}

async function applyLadderRewards(referrerUid: string): Promise<void> {
  const db = getFirestoreDb();
  if (!db) return;

  const userRef = db.collection(USER_REFERRAL_COLLECTION).doc(referrerUid);
  const subRef = db.collection(SUBSCRIPTION_COLLECTION).doc(referrerUid);

  const userSnap = await userRef.get();
  if (!userSnap.exists) return;
  const userData = userSnap.data() || {};
  const referralCount: number = typeof userData.referralCount === "number" ? userData.referralCount : 0;
  const claimed: string[] = Array.isArray(userData.rewardsClaimed) ? userData.rewardsClaimed : [];
  const ownerEmail: string | null = typeof userData.ownerEmail === "string" ? userData.ownerEmail : null;

  // Find tiers crossed but not yet claimed
  const newTiers = REWARD_LADDER.filter(
    (t) => referralCount >= t.threshold && !claimed.includes(String(t.threshold)),
  );
  if (newTiers.length === 0) return;

  // Read current subscription
  const subSnap = await subRef.get();
  const subData = subSnap.exists ? subSnap.data() || {} : {};
  const wasLifetime = Boolean(subData.lifetime);
  const existingPaidUntil =
    subData.paidUntil?.toDate?.() instanceof Date ? subData.paidUntil.toDate().getTime() : 0;

  // If the user already has lifetime (e.g. paid for it), don't downgrade —
  // just record the claim so it doesn't fire repeatedly.
  let cursor = Math.max(Date.now(), existingPaidUntil);

  // Stack rewards: every reward extends the running cursor
  for (const tier of newTiers) {
    cursor += tier.durationDays * 86400 * 1000;
  }

  const newPaidUntil = new Date(cursor);
  const lastTier = newTiers[newTiers.length - 1];
  const lastLabel = lastTier.label;

  // Update subscription. We always set provider="referral_ladder" so the
  // payment-history can attribute it; this won't conflict with paid plans
  // because we only ever EXTEND paidUntil, never shorten.
  if (!wasLifetime) {
    await subRef.set({
      active: true,
      lifetime: false,
      paidUntil: firestoreTimestamp.fromDate(newPaidUntil),
      planId: "referral-ladder",
      provider: "referral_ladder",
      userId: referrerUid,
      userEmail: ownerEmail || subData.userEmail || null,
      amount: 0,
      currency: "INR",
      lastPaymentId: `referral-ladder:${lastTier.threshold}`,
      referralLadderTier: lastTier.threshold,
      referralLadderLabel: lastLabel,
      updatedAt: firestoreFieldValue.serverTimestamp(),
    }, { merge: true });
  }

  // Mark these tiers as claimed
  await userRef.set({
    rewardsClaimed: firestoreFieldValue.arrayUnion(...newTiers.map((t) => String(t.threshold))),
    lastRewardAppliedAt: firestoreFieldValue.serverTimestamp(),
    lastRewardLabel: lastLabel,
    updatedAt: firestoreFieldValue.serverTimestamp(),
  }, { merge: true });
}
