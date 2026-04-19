import type { SubscriptionPlan } from "@/shared/subscription-plans";

export type GooglePlayPlan = SubscriptionPlan & {
  googlePlayProductId: string;
};

export const GOOGLE_PLAY_PLANS: GooglePlayPlan[] = [
  {
    id: "monthly",
    title: "1 Month Basic Pro",
    shortTitle: "Monthly",
    amount: 29,
    currency: "INR",
    durationDays: 30,
    badge: "Most Popular",
    description: "Remove all ads for 30 days",
    googlePlayProductId: "statusvault_pro_monthly",
  },
  {
    id: "quarterly",
    title: "3 Months Pro",
    shortTitle: "3 Months",
    amount: 79,
    currency: "INR",
    durationDays: 90,
    badge: "Great Deal",
    description: "Ad-free for 3 full months",
    googlePlayProductId: "statusvault_pro_quarterly",
  },
  {
    id: "yearly",
    title: "1 Year Standard Pro",
    shortTitle: "Yearly",
    amount: 149,
    currency: "INR",
    durationDays: 365,
    badge: "Best Value",
    description: "No ads + priority support for a full year",
    googlePlayProductId: "statusvault_pro_yearly",
  },
];

export const GOOGLE_PLAY_PRODUCT_IDS = GOOGLE_PLAY_PLANS.map(
  (p) => p.googlePlayProductId,
);

export function getPlanByProductId(productId: string): GooglePlayPlan | undefined {
  return GOOGLE_PLAY_PLANS.find((p) => p.googlePlayProductId === productId);
}
