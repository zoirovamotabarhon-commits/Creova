import { supabase } from "./supabase";

export type SubscriptionPlan =
  | "free"
  | "premium"
  | "pro";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "cancelled"
  | "expired";

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  provider?: string | null;
  provider_subscription_id?: string | null;
  started_at: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  cancelled_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SubscriptionResponse {
  success: boolean;
  data?: Subscription;
  error?: string;
}

const PLANS: SubscriptionPlan[] = [
  "free",
  "premium",
  "pro",
];

const STATUSES: SubscriptionStatus[] = [
  "active",
  "trialing",
  "past_due",
  "cancelled",
  "expired",
];

const isPlan = (
  value: unknown
): value is SubscriptionPlan =>
  typeof value === "string" &&
  PLANS.includes(value as SubscriptionPlan);

const isStatus = (
  value: unknown
): value is SubscriptionStatus =>
  typeof value === "string" &&
  STATUSES.includes(
    value as SubscriptionStatus
  );

const normalizeSubscription = (
  value: unknown
): Subscription | null => {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return null;
  }

  const item =
    value as Record<string, unknown>;

  if (
    typeof item.id !== "string" ||
    typeof item.user_id !== "string" ||
    !isPlan(item.plan) ||
    !isStatus(item.status) ||
    typeof item.started_at !== "string" ||
    typeof item.created_at !== "string" ||
    typeof item.updated_at !== "string"
  ) {
    return null;
  }

  return {
    id: item.id,
    user_id: item.user_id,
    plan: item.plan,
    status: item.status,
    provider:
      typeof item.provider === "string"
        ? item.provider
        : null,
    provider_subscription_id:
      typeof item.provider_subscription_id ===
      "string"
        ? item.provider_subscription_id
        : null,
    started_at: item.started_at,
    current_period_start:
      typeof item.current_period_start ===
      "string"
        ? item.current_period_start
        : null,
    current_period_end:
      typeof item.current_period_end ===
      "string"
        ? item.current_period_end
        : null,
    cancelled_at:
      typeof item.cancelled_at === "string"
        ? item.cancelled_at
        : null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
};

export async function getSubscription(): Promise<SubscriptionResponse> {
  try {
    const {
      data: userData,
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return {
        success: false,
        error: userError.message,
      };
    }

    const user = userData.user;

    if (!user) {
      return {
        success: false,
        error: "Authentication required.",
      };
    }

    const {
      data,
      error,
    } = await supabase
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
        ].join(", ")
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data) {
      return {
        success: false,
        error: "Subscription not found.",
      };
    }

    const subscription =
      normalizeSubscription(data);

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
    console.error(
      "getSubscription error:",
      error
    );

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
  const result = await getSubscription();

  if (!result.success || !result.data) {
    return {
      success: false,
      error:
        result.error ??
        "Unable to load subscription.",
    };
  }

  return {
    success: true,
    plan: result.data.plan,
    status: result.data.status,
  };
}

export async function isPremiumUser(): Promise<{
  success: boolean;
  premium?: boolean;
  error?: string;
}> {
  const result = await getSubscription();

  if (!result.success || !result.data) {
    return {
      success: false,
      error:
        result.error ??
        "Unable to check subscription.",
    };
  }

  const premium =
    result.data.status === "active" ||
    result.data.status === "trialing";

  return {
    success: true,
    premium:
      premium &&
      (
        result.data.plan === "premium" ||
        result.data.plan === "pro"
      ),
  };
  }
