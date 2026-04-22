export type CampaignStatus = "ACTIVE" | "BANNED" | "EXHAUSTED";

export type VipDuration =
  | { type: "LIFETIME" }
  | { type: "DAYS"; days: number }
  | { type: "NONE" };

export interface InfluencerCampaign {
  code: string;
  influencerUid: string | null;
  influencerEmail: string | null;
  influencerName: string | null;
  limit: number;
  usedCount: number;
  redeemDurationDays: number;
  status: CampaignStatus;
  vipDuration: VipDuration;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReferralRedeemErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_CODE"
  | "CODE_BANNED"
  | "CODE_EXHAUSTED"
  | "ALREADY_REDEEMED"
  | "ACTIVE_SUBSCRIPTION"
  | "DEVICE_ALREADY_USED"
  | "SELF_REDEEM_BLOCKED"
  | "INVALID_DEVICE"
  | "SERVER_ERROR";

export interface ReferralRedeemSuccess {
  success: true;
  durationDays: number;
  paidUntil: string;
  code: string;
  influencerName: string | null;
  message: string;
}

export interface ReferralRedeemError {
  success: false;
  errorCode: ReferralRedeemErrorCode;
  message: string;
}

export type ReferralRedeemResponse = ReferralRedeemSuccess | ReferralRedeemError;

export function normalizeReferralCode(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32);
}

// ─── Personal referral codes & ladder rewards ──────────────────────────────

export interface RewardLadderTier {
  threshold: number;
  label: string;
  durationDays: number;
}

export const REWARD_LADDER: RewardLadderTier[] = [
  { threshold: 3,   label: "48 Hours Pro",   durationDays: 2 },
  { threshold: 10,  label: "1 Week Pro",     durationDays: 7 },
  { threshold: 50,  label: "1 Month Pro",    durationDays: 30 },
  { threshold: 100, label: "3 Months Pro",   durationDays: 90 },
  { threshold: 500, label: "1.5 Years Pro",  durationDays: 548 },
];

export interface ReferredUserSummary {
  joinedAt: string; // ISO
}

export interface MyReferralResponse {
  code: string;
  referralCount: number;
  rewardsClaimed: string[]; // e.g. ["3","10"]
  referredUsers: ReferredUserSummary[];
  shareUrl: string;       // Short link, e.g. https://svault.me/K3T8N2 — what users actually see
  playStoreUrl: string;   // Full Play Store URL with referrer baked in (fallback)
  deepLink: string;
  ladder: RewardLadderTier[];
  nextTier: RewardLadderTier | null;
  remainingForNext: number;
  // Active reward state
  rewardActive: boolean;
  rewardPaidUntil: string | null;
  rewardLifetime: boolean;
}

export type AttributeInstallErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_CODE"
  | "SELF_REFER_BLOCKED"
  | "ALREADY_ATTRIBUTED"
  | "DEVICE_ALREADY_USED"
  | "INVALID_DEVICE"
  | "SERVER_ERROR";

export interface AttributeInstallSuccess {
  success: true;
  referrerName: string | null;
  message: string;
}
export interface AttributeInstallError {
  success: false;
  errorCode: AttributeInstallErrorCode;
  message: string;
}
export type AttributeInstallResponse = AttributeInstallSuccess | AttributeInstallError;
