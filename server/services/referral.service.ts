import { v4 as uuidv4 } from 'uuid';

// In-memory store (replace with PostgreSQL in production)
const referrals = new Map<string, {
  installId: string;
  referralCode: string;
  invitedBy: string | null;
  timestamp: number;
  verified: boolean;
}>();

const userRewards = new Map<string, {
  friendsInvited: number;
  adFreeUntil: number;
}>();

export class ReferralService {
  // Generate unique referral code for new user
  static generateReferralCode(): string {
    return 'REF' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  // Verify incoming user has valid inviter
  static verifyReferral(installId: string, inviterCode: string): boolean {
    // Check if inviter code exists
    let inviterFound = false;
    for (const ref of referrals.values()) {
      if (ref.referralCode === inviterCode) {
        inviterFound = true;
        break;
      }
    }

    if (!inviterFound) return false;

    // Register new user as invited
    referrals.set(installId, {
      installId,
      referralCode: this.generateReferralCode(),
      invitedBy: inviterCode,
      timestamp: Date.now(),
      verified: true,
    });

    // Award inviter
    const current = userRewards.get(inviterCode) || { friendsInvited: 0, adFreeUntil: 0 };
    current.friendsInvited += 1;
    current.adFreeUntil = Math.max(current.adFreeUntil, Date.now() + 30 * 24 * 60 * 60 * 1000);
    userRewards.set(inviterCode, current);

    return true;
  }

  // Get or create referral for device
  static getOrCreateReferral(deviceId: string): { code: string; isNew: boolean } {
    let ref = referrals.get(deviceId);
    if (ref) {
      return { code: ref.referralCode, isNew: false };
    }

    const code = this.generateReferralCode();
    referrals.set(deviceId, {
      installId: deviceId,
      referralCode: code,
      invitedBy: null,
      timestamp: Date.now(),
      verified: false,
    });

    return { code, isNew: true };
  }

  // Get user rewards
  static getUserRewards(referralCode: string) {
    return userRewards.get(referralCode) || { friendsInvited: 0, adFreeUntil: 0 };
  }

  // Get all referral data (for admin/debug)
  static getAllReferrals() {
    return Array.from(referrals.values());
  }
}
