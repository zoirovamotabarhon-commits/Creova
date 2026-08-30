export type SubscriptionPlanId =
  | "free"
  | "premium"
  | "pro";

export interface SubscriptionPlan {
  id: SubscriptionPlanId;
  name: string;

  monthlyPrice: number;
  yearlyPrice: number;
  currency: string;

  monthlyAiLimit: number;
  monthlyProjectLimit: number;
  storageLimitMb: number;

  ads: boolean;
  premiumFeatures: boolean;
  prioritySupport: boolean;
}

export const PLANS: Record<
  SubscriptionPlanId,
  SubscriptionPlan
> = {
  free: {
    id: "free",
    name: "Free",

    monthlyPrice: 0,
    yearlyPrice: 0,
    currency: "USD",

    monthlyAiLimit: 10,
    monthlyProjectLimit: 5,
    storageLimitMb: 100,

    ads: true,
    premiumFeatures: false,
    prioritySupport: false,
  },

  premium: {
    id: "premium",
    name: "Premium",

    monthlyPrice: 9.99,
    yearlyPrice: 79.99,
    currency: "USD",

    monthlyAiLimit: 500,
    monthlyProjectLimit: 100,
    storageLimitMb: 5000,

    ads: false,
    premiumFeatures: true,
    prioritySupport: false,
  },

  pro: {
    id: "pro",
    name: "Pro",

    monthlyPrice: 19.99,
    yearlyPrice: 159.99,
    currency: "USD",

    monthlyAiLimit: 2000,
    monthlyProjectLimit: 500,
    storageLimitMb: 25000,

    ads: false,
    premiumFeatures: true,
    prioritySupport: true,
  },
};

export const DEFAULT_PLAN: SubscriptionPlanId =
  "free";

export function getPlan(
  planId:
    | SubscriptionPlanId
    | null
    | undefined,
): SubscriptionPlan {
  return (
    PLANS[planId ?? DEFAULT_PLAN] ??
    PLANS[DEFAULT_PLAN]
  );
}

export function isPaidPlan(
  planId:
    | SubscriptionPlanId
    | null
    | undefined,
): boolean {
  return (
    planId === "premium" ||
    planId === "pro"
  );
}

export function isPremiumOrHigher(
  planId:
    | SubscriptionPlanId
    | null
    | undefined,
): boolean {
  return isPaidPlan(planId);
    }
