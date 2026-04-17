export type SubscriptionPlanId = "monthly" | "quarterly" | "yearly";

export type SubscriptionPlan = {
  id: SubscriptionPlanId;
  title: string;
  shortTitle: string;
  amount: number;
  currency: "INR";
  durationDays: number;
  badge: string;
  description: string;
};

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "monthly",
    title: "1 Month Basic Pro",
    shortTitle: "Monthly",
    amount: 29,
    currency: "INR",
    durationDays: 30,
    badge: "Most Popular",
    description: "Remove all ads for 30 days",
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
  },
];

export function getSubscriptionPlan(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}

export function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}
