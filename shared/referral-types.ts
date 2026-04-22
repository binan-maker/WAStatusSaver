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
