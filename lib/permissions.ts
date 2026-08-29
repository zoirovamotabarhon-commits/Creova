import type { SubscriptionPlanId } from "../types/subscription";
import type { AIFeature } from "../types/ai";

const PRO_ONLY_FEATURES: AIFeature[] = [
  "video",
];

export function canAccessFeature(
  plan: SubscriptionPlanId,
  feature: AIFeature
): boolean {
  if (PRO_ONLY_FEATURES.includes(feature)) {
    return plan === "pro";
  }

  return true;
}

export function canCreateProject(
  plan: SubscriptionPlanId,
  currentProjectCount: number
): boolean {
  if (plan === "free") {
    return currentProjectCount < 3;
  }

  if (plan === "premium") {
    return currentProjectCount < 20;
  }

  return true;
}
