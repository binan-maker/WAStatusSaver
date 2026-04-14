export type SubscriptionPlanId = "monthly" | "yearly" | "twoyear";

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
    id: "yearly",
    title: "1 Year Standard Pro",
    shortTitle: "Yearly",
    amount: 149,
    currency: "INR",
    durationDays: 365,
    badge: "Best Value",
    description: "No ads + priority support for a full year",
  },
  {
    id: "twoyear",
    title: "2 Years Premium Pro",
    shortTitle: "2 Years",
    amount: 249,
    currency: "INR",
    durationDays: 730,
    badge: "Early Access",
    description: "No ads + priority support + early access to new features",
  },
];

export function getSubscriptionPlan(planId: string): SubscriptionPlan | undefined {
  return SUBSCRIPTION_PLANS.find((plan) => plan.id === planId);
}

export function amountToPaise(amount: number): number {
  return Math.round(amount * 100);
}
