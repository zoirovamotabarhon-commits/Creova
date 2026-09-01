export type SubscriptionPlan =
  | "free"
  | "premium"
  | "pro";

export type SubscriptionPlanId = SubscriptionPlan;

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

  provider: string | null;
  provider_subscription_id: string | null;

  started_at: string;

  current_period_start: string | null;
  current_period_end: string | null;

  cancelled_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface SubscriptionResponse {
  success: boolean;
  data?: Subscription;
  error?: string;
}

export interface SubscriptionEntitlements {
  plan: SubscriptionPlan;

  premium: boolean;
  pro: boolean;

  removeAds: boolean;
  prioritySupport: boolean;

  monthlyAiLimit: number;
  monthlyProjectLimit: number;
  storageLimitMb: number;
}