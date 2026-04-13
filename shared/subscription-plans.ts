export type SubscriptionPlanId = "monthly" | "yearly" | "lifetime";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  title: string;
  shortTitle: string;
  amount: number;
  currency: "INR";
  durationDays: number | null;
  badge: string;
  description: string;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "monthly",
    title: "1 Month Ad-Free",
    shortTitle: "Monthly",
    amount: 30,
    currency: "INR",
    durationDays: 30,
    badge: "Most Popular",
    description: "Remove all ads for 30 days",
  },
  {
    id: "yearly",
    title: "1 Year Ad-Free",
    shortTitle: "Yearly",
    amount: 199,
    currency: "INR",
    durationDays: 365,
    badge: "Best Value",
    description: "Save more with one full year",
  },
  {
    id: "lifetime",
    title: "Lifetime Ad-Free",
    shortTitle: "Lifetime",
    amount: 499,
    currency: "INR",
    durationDays: null,
    badge: "One Time",
    description: "Pay once and remove ads forever",
  },
];

export function getSubscriptionPlan(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}

export function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}