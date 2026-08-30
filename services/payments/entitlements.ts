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
    subscription?.status 
