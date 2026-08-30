import { supabase } from "../supabase";

import type {
  Subscription,
  SubscriptionPlan,
  SubscriptionStatus,
  SubscriptionResponse,
} from "../../types/subscription";

const PLANS: readonly SubscriptionPlan[] = [
  "free",
  "premium",
  "pro",
];

const STATUSES:
  readonly SubscriptionStatus[] = [
    "active",
    "trialing",
    "past_due",
    "cancelled",
    "expired",
  ];

function isPlan(
  value: unknown,
): value is SubscriptionPlan {
  return (
    typeof value === "string" &&
    PLANS.includes(
      value as SubscriptionPlan,
    )
  );
}

function isStatus(
  value: unknown,
): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    STATUSES.includes(
      value as SubscriptionStatus,
    )
  );
}

function normalizeSubscription(
  value: unknown,
): Subscription | null {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  const row =
    value as Record<
      string,
      unknown
    >;

  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    !isPlan(row.plan) ||
    !isStatus(row.status) ||
    typeof row.started_at !== "string" ||
    typeof row.created_at !== "string" ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: row.id,
    user_id: row.user_id,

    plan: row.plan,
    status: row.status,

    provider:
      typeof row.provider === "string"
        ? row.provider
        : null,

    provider_subscription_id:
      typeof row.provider_subscription_id ===
      "string"
        ? row.provider_subscription_id
        : null,

    started_at: row.started_at,

    current_period_start:
      typeof row.current_period_start ===
      "string"
        ? row.current_period_start
        : null,

    current_period_end:
      typeof row.current_period_end ===
      "string"
        ? row.current_period_end
        : null,

    cancelled_at:
      typeof row.cancelled_at ===
      "string"
        ? row.cancelled_at
        : null,

    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSubscription(): Promise<SubscriptionResponse> {
  try {
    const {
      data,
      error,
    } = await supabase.auth.getUser();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error:
          "Authentication required.",
      };
    }

    const {
      data: row,
      error: subscriptionError,
    } =
      await supabase
        .from("subscriptions")
        .select(
          [
            "id",
            "user_id",
            "plan",
            "status",
            "provider",
            "provider_subscription_id",
            "started_at",
            "current_period_start",
            "current_period_end",
            "cancelled_at",
            "created_at",
            "updated_at",
          ].join(", "),
        )
        .eq(
          "user_id",
          data.user.id,
        )
        .maybeSingle();

    if (subscriptionError) {
      return {
        success: false,
        error:
          subscriptionError.message,
      };
    }

    if (!row) {
      return {
        success: false,
        error:
          "Subscription not found.",
      };
    }

    const subscription =
      normalizeSubscription(row);

    if (!subscription) {
      return {
        success: false,
        error:
          "Subscription data is invalid.",
      };
    }

    return {
      success: true,
      data: subscription,
    };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to load subscription.",
    };
  }
}

export async function getSubscriptionPlan(): Promise<{
  success: boolean;
  plan?: SubscriptionPlan;
  status?: SubscriptionStatus;
  error?: string;
}> {
  const result =
    await getSubscription();

  if (
    !result.success ||
    !result.data
  ) {
    return {
      success: false,
      error:
        result.error ??
        "Unable to load subscription.",
    };
  }

  return {
    success: true,
    plan:
      result.data.plan,
    status:
      result.data.status,
  };
}

export async function isPremiumUser(): Promise<{
  success: boolean;
  premium?: boolean;
  error?: string;
}> {
  const result =
    await getSubscription();

  if (
    !result.success ||
    !result.data
  ) {
    return {
      success: false,
      error:
        result.error ??
        "Unable to check subscription.",
    };
  }

  const active =
    result.data.status === "active" ||
    result.data.status === "trialing";

  const paid =
    result.data.plan === "premium" ||
    result.data.plan === "pro";

  return {
    success: true,
    premium:
      active && paid,
  };
    }
