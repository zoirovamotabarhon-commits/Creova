import {
  PLANS,
  type SubscriptionPlanId,
} from "../../constants/plans";

export type BillingPeriod =
  | "monthly"
  | "yearly";

export interface SubscriptionProduct {
  id: SubscriptionPlanId;
  name: string;

  monthlyPrice: number;
  yearlyPrice: number;

  currency: string;

  monthlyProductId:
    | string
    | null;

  yearlyProductId:
    | string
    | null;
}

export function getProduct(
  planId: SubscriptionPlanId,
): SubscriptionProduct {
  const plan = PLANS[planId];

  return {
    id: plan.id,
    name: plan.name,

    monthlyPrice:
      plan.monthlyPrice,

    yearlyPrice:
      plan.yearlyPrice,

    currency:
      plan.currency,

    monthlyProductId:
      plan.id === "free"
        ? null
        : `creova_${plan.id}_monthly`,

    yearlyProductId:
      plan.id === "free"
        ? null
        : `creova_${plan.id}_yearly`,
  };
}

export function getProducts(): SubscriptionProduct[] {
  return (
    Object.keys(PLANS) as SubscriptionPlanId[]
  ).map(getProduct);
}

export function getProductId(
  planId: SubscriptionPlanId,
  period: BillingPeriod,
): string | null {
  if (planId === "free") {
    return null;
  }

  return `creova_${planId}_${period}`;
                    }
