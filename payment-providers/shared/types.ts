import type { SubscriptionPlanId } from "@/shared/subscription-plans";

export type SubscriptionStatus = {
  active: boolean;
  configured?: boolean;
  lifetime?: boolean;
  planId?: string | null;
  paidUntil?: string | null;
  lastPaymentId?: string | null;
  message?: string;
  cachedAt?: number;
};

export type PaymentProviderHookOptions = {
  deviceId: string | null;
  user: { uid: string; email?: string | null; displayName?: string | null } | null;
  getIdToken: (force?: boolean) => Promise<string | null>;
  onPaymentSuccess: (planId: SubscriptionPlanId, status: SubscriptionStatus) => void;
  refresh: (force?: boolean) => Promise<void>;
};

export type PaymentProviderHookResult = {
  plans: import("@/shared/subscription-plans").SubscriptionPlan[];
  payingPlanId: SubscriptionPlanId | null;
  paymentJustSucceeded: boolean;
  successPlanId: SubscriptionPlanId | null;
  isRecoveringPayment: boolean;
  providerName: string;
  startPayment: (planId: SubscriptionPlanId) => Promise<boolean>;
  dismissPaymentSuccess: () => void;
};
