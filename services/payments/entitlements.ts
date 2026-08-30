/**
 * CREOVA
 * Subscription entitlement calculation.
 *
 * The client never grants Premium access by itself.
 * It only derives UI entitlements from the subscription
 * returned by the trusted backend.
 */

import {
  getPlan,
} from "../../constants/plans";

import type {
  Subscription,
  SubscriptionEntitlements,
} from "../../types/subscription";

function isActiveSubscription(
  subscription:
    | Subscription
    | null
    | undefined,
): boolean {
  return (
    subscription?.status === "active" ||
    subscription?.status === "trialing"
  );
}

export function getEntitlements(
  subscription:
    | Subscription
    | null
    | undefined,
): SubscriptionEntitlements {
  const active =
    isActiveSubscription(
      subscription,
    );

  const planId =
    active && subscription
      ? subscription.plan
      : "free";

  const plan =
    getPlan(planId);

  const premium =
    plan.id === "premium" ||
    plan.id === "pro";

  const pro =
    plan.id === "pro";

  return {
    plan: plan.id,

    premium,

    pro,

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
