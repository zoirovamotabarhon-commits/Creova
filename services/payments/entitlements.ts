import {
  getPlan,
} from "../../constants/plans";

import type {
  Subscription,
  SubscriptionEntitlements,
} from "../../types/subscription";

export function getEntitlements(
  subscription:
    | Subscription
    | null
    | undefined,
): SubscriptionEntitlements {
  const active =
    subscription?.status === "active" ||
    subscription?.status === "trialing";

  const planId =
    active && subscription
      ? subscription.plan
      : "free";

  const plan =
    getPlan(planId);

  return {
    plan: plan.id,

    premium:
      plan.id === "premium" ||
      plan.id === "pro",

    pro:
      plan.id === "pro",

    removeAds:
      !plan.ads,

    prioritySupport:
      plan.prioritySupport,

    monthlyAiLimit:
      plan.monthlyAiLimit,

    monthlyProjectLimit:
      plan.monthlyProjectLimit,

    storageLimitMb:
      plan.storageLimitMb,
  };
}
