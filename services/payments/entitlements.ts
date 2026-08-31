/**
 * CREOVA
 * Subscription entitlement calculation.
 *
 * This module derives UI permissions from the subscription
 * returned by Supabase. It does not grant or create
 * subscription access.
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
  if (!subscription) {
    return false;
  }

  return (
    subscription.status ===
      "active" ||
    subscription.status ===
      "trialing"
  );
}

export function getEntitlements(
  subscription:
    | Subscription
    | null
    | undefined,
): SubscriptionEntitlements {
  const planId =
    subscription?.plan ??
    "free";

  const plan =
    getPlan(planId);

  const active =
    isActiveSubscription(
      subscription,
    );

  const paid =
    planId === "premium" ||
    planId === "pro";

  const premium =
    active && paid;

  const pro =
    active &&
    planId === "pro";

  return {
    plan: plan.id,

    premium,
    pro,

    removeAds:
      premium &&
      !plan.ads,

    prioritySupport:
      premium &&
      plan.prioritySupport,

    monthlyAiLimit:
      plan.monthlyAiLimit,

    monthlyProjectLimit:
      plan.monthlyProjectLimit,

    storageLimitMb:
      plan.storageLimitMb,
  };
}
