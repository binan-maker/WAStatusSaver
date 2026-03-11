export const REFERRAL_TIERS = [
  { invites: 1, days: 3, label: '3 Days', icon: '🎁' },
  { invites: 5, days: 15, label: '15 Days', icon: '⭐' },
  { invites: 10, days: 30, label: '1 Month', icon: '🌟' },
  { invites: 25, days: 90, label: '3 Months', icon: '💎' },
  { invites: 50, days: 180, label: '6 Months', icon: '👑' },
  { invites: 100, days: 365, label: '1 Year', icon: '🏆' },
];

export function getRewardForInvites(inviteCount: number) {
  for (let i = REFERRAL_TIERS.length - 1; i >= 0; i--) {
    if (inviteCount >= REFERRAL_TIERS[i].invites) {
      return REFERRAL_TIERS[i];
    }
  }
  return null;
}

export function getNextTier(inviteCount: number) {
  for (const tier of REFERRAL_TIERS) {
    if (inviteCount < tier.invites) {
      return tier;
    }
  }
  return null;
}

export function getProgressToNextTier(inviteCount: number) {
  const next = getNextTier(inviteCount);
  if (!next) return 100;
  const prev = inviteCount > 0 ? getRewardForInvites(inviteCount - 1) : null;
  const prevInvites = prev ? prev.invites : 0;
  const progress = ((inviteCount - prevInvites) / (next.invites - prevInvites)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}
