/**
 * CREOVA
 * Subscription plan catalog.
 *
 * Feature limits:
 *
 * FREE
 *   Chat   : 10 / day
 *   Image  : 5  / day
 *   Music  : 1  / month
 *   Video  : 1  / month
 *
 * PREMIUM - $8.99 / month
 *   Chat   : 80  / month
 *   Image  : 30  / month
 *   Music  : 5   / month
 *   Video  : 3   / month
 *
 * PRO - $18.99 / month
 *   Chat   : 300 / month
 *   Image  : 100 / month
 *   Music  : 15  / month
 *   Video  : 10  / month
 *
 * The actual usage enforcement must be performed server-side
 * in Supabase. These values are also used by the application
 * to display the plan configuration.
 */

export type SubscriptionPlanId =
  | "free"
  | "premium"
  | "pro";

export type LimitPeriod =
  | "day"
  | "month";

export interface FeatureLimit {
  count: number;
  period: LimitPeriod;
}

export interface SubscriptionFeatureLimits {
  chat: FeatureLimit;
  image: FeatureLimit;
  music: FeatureLimit;
  video: FeatureLimit;
}

export interface SubscriptionPlan {
  id: SubscriptionPlanId;

  name: string;

  translationKey: string;

  monthlyPrice: number;
  yearlyPrice: number;

  currency: "USD";

  /**
   * Legacy/general AI limit kept for compatibility
   * with existing subscription code.
   *
   * The actual feature-specific limits are defined
   * in featureLimits.
   */
  monthlyAiLimit: number;

  monthlyProjectLimit: number;
  storageLimitMb: number;

  featureLimits: SubscriptionFeatureLimits;

  ads: boolean;
  premiumFeatures: boolean;
  prioritySupport: boolean;
}

export const PLANS: Readonly<
  Record<
    SubscriptionPlanId,
    SubscriptionPlan
  >
> = {
  /**
   * ==========================================================
   * FREE
   * ==========================================================
   */
  free: {
    id: "free",
    name: "Free",
    translationKey:
      "premium.plans.free",

    monthlyPrice: 0,
    yearlyPrice: 0,

    currency: "USD",

    /*
     * Kept for compatibility with the existing code.
     *
     * The real Free limits are feature-specific:
     * chat 10/day
     * image 5/day
     * music 1/month
     * video 1/month
     */
    monthlyAiLimit: 10,

    monthlyProjectLimit: 5,
    storageLimitMb: 100,

    featureLimits: {
      chat: {
        count: 10,
        period: "day",
      },

      image: {
        count: 5,
        period: "day",
      },

      music: {
        count: 1,
        period: "month",
      },

      video: {
        count: 1,
        period: "month",
      },
    },

    ads: true,
    premiumFeatures: false,
    prioritySupport: false,
  },

  /**
   * ==========================================================
   * PREMIUM
   * $8.99 / month
   * ==========================================================
   */
  premium: {
    id: "premium",
    name: "Premium",
    translationKey:
      "premium.plans.premium",

    monthlyPrice: 8.99,
    yearlyPrice: 79.99,

    currency: "USD",

    /*
     * Compatibility value.
     * Real limits are feature-specific below.
     */
    monthlyAiLimit: 80,

    monthlyProjectLimit: 100,
    storageLimitMb: 5000,

    featureLimits: {
      chat: {
        count: 80,
        period: "month",
      },

      image: {
        count: 30,
        period: "month",
      },

      music: {
        count: 5,
        period: "month",
      },

      video: {
        count: 3,
        period: "month",
      },
    },

    ads: false,
    premiumFeatures: true,
    prioritySupport: false,
  },

  /**
   * ==========================================================
   * PRO
   * $18.99 / month
   * ==========================================================
   */
  pro: {
    id: "pro",
    name: "Pro",
    translationKey:
      "premium.plans.pro",

    monthlyPrice: 18.99,
    yearlyPrice: 159.99,

    currency: "USD",

    /*
     * Compatibility value.
     * Real limits are feature-specific below.
     */
    monthlyAiLimit: 300,

    monthlyProjectLimit: 500,
    storageLimitMb: 25000,

    featureLimits: {
      chat: {
        count: 300,
        period: "month",
      },

      image: {
        count: 100,
        period: "month",
      },

      music: {
        count: 15,
        period: "month",
      },

      video: {
        count: 10,
        period: "month",
      },
    },

    ads: false,
    premiumFeatures: true,
    prioritySupport: true,
  },
};

export const DEFAULT_PLAN:
  SubscriptionPlanId =
    "free";

export function getPlan(
  planId:
    | SubscriptionPlanId
    | null
    | undefined,
): SubscriptionPlan {
  return (
    PLANS[
      planId ?? DEFAULT_PLAN
    ] ?? PLANS[DEFAULT_PLAN]
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
