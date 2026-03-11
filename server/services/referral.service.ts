import { v4 as uuidv4 } from 'uuid';

const TIER_REWARDS = {
  1: { days: 3 },
  5: { days: 15 },
  10: { days: 30 },
  25: { days: 90 },
  50: { days: 180 },
  100: { days: 365 },
};

// In-memory store (replace with PostgreSQL in production)
const referrals = new Map<string, {
  installId: string;
  referralCode: string;
  invitedBy: string | null;
  timestamp: number;
  verified: boolean;
  firstAppOpen: number | null;
}>();

const userRewards = new Map<string, {
  friendsInvited: number;
  verifiedFriendsOpened: number;
  adFreeUntil: number;
  lastRewardUnlock: number;
}>();

const deviceRegistry = new Set<string>(); // Anti-cheat: track all devices

export class ReferralService {
  // Generate unique referral code for new user
  static generateReferralCode(): string {
    return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Verify incoming user has valid inviter (ANTI-CHEAT)
  static verifyReferral(installId: string, inviterCode: string): { success: boolean; message: string } {
    // Check if device already registered (anti-cheat)
    if (deviceRegistry.has(installId)) {
      return { success: false, message: 'Device already registered' };
    }

    // Check if inviter code exists
    let inviterFound = false;
    for (const ref of referrals.values()) {
      if (ref.referralCode === inviterCode) {
        inviterFound = true;
        break;
      }
    }

    if (!inviterFound) {
      return { success: false, message: 'Invalid referral code' };
    }

    // Register new device
    deviceRegistry.add(installId);
    referrals.set(installId, {
      installId,
      referralCode: this.generateReferralCode(),
      invitedBy: inviterCode,
      timestamp: Date.now(),
      verified: true,
      firstAppOpen: null,
    });

    return { success: true, message: 'Referral verified. Reward unlocks on first app open.' };
  }

  // Track first app open - THIS IS WHEN REWARD IS ACTUALLY GRANTED
  static trackFirstAppOpen(installId: string): { rewardGranted: boolean; days: number; inviterCode: string | null } {
    const ref = referrals.get(installId);
    if (!ref || ref.firstAppOpen) {
      return { rewardGranted: false, days: 0, inviterCode: null };
    }

    // Mark first app open
    ref.firstAppOpen = Date.now();

    if (!ref.invitedBy) {
      return { rewardGranted: false, days: 0, inviterCode: null };
    }

    // Award the inviter NOW (after invited person opened app)
    const inviterCode = ref.invitedBy;
    const current = userRewards.get(inviterCode) || {
      friendsInvited: 0,
      verifiedFriendsOpened: 0,
      adFreeUntil: 0,
      lastRewardUnlock: 0,
    };

    current.verifiedFriendsOpened += 1;

    // Calculate reward based on tier
    let rewardDays = 0;
    if (current.verifiedFriendsOpened === 1) rewardDays = 3;
    else if (current.verifiedFriendsOpened === 5) rewardDays = 15;
    else if (current.verifiedFriendsOpened === 10) rewardDays = 30;
    else if (current.verifiedFriendsOpened === 25) rewardDays = 90;
    else if (current.verifiedFriendsOpened === 50) rewardDays = 180;
    else if (current.verifiedFriendsOpened === 100) rewardDays = 365;

    // Grant reward (add to existing ad-free time)
    if (rewardDays > 0) {
      const now = Date.now();
      const currentAdFree = current.adFreeUntil > now ? current.adFreeUntil : now;
      current.adFreeUntil = currentAdFree + rewardDays * 24 * 60 * 60 * 1000;
      current.lastRewardUnlock = Date.now();
    }

    userRewards.set(inviterCode, current);

    return {
      rewardGranted: rewardDays > 0,
      days: rewardDays,
      inviterCode,
    };
  }

  // Get or create referral for device
  static getOrCreateReferral(deviceId: string): { code: string; isNew: boolean } {
    let ref = referrals.get(deviceId);
    if (ref) {
      return { code: ref.referralCode, isNew: false };
    }

    const code = this.generateReferralCode();
    deviceRegistry.add(deviceId);
    referrals.set(deviceId, {
      installId: deviceId,
      referralCode: code,
      invitedBy: null,
      timestamp: Date.now(),
      verified: false,
      firstAppOpen: null,
    });

    return { code, isNew: true };
  }

  // Get user rewards
  static getUserRewards(referralCode: string) {
    return userRewards.get(referralCode) || {
      friendsInvited: 0,
      verifiedFriendsOpened: 0,
      adFreeUntil: 0,
      lastRewardUnlock: 0,
    };
  }

  // Get all referral data (for admin/debug)
  static getAllReferrals() {
    return Array.from(referrals.values());
  }
}
