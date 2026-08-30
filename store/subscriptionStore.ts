import {
  useSyncExternalStore,
} from "react";

import type {
  Subscription,
} from "../types/subscription";

import {
  getSubscription,
} from "../services/payments/subscriptions";

export interface SubscriptionStoreState {
  subscription:
    | Subscription
    | null;

  loading: boolean;
  error: string | null;
}

let state:
  SubscriptionStoreState = {
    subscription: null,
    loading: false,
    error: null,
  };

const listeners =
  new Set<() => void>();

let refreshPromise:
  | Promise<void>
  | null = null;

function emit(): void {
  listeners.forEach(
    (listener) => listener(),
  );
}

function subscribe(
  listener: () => void,
): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): SubscriptionStoreState {
  return state;
}

export function useSubscriptionStore(): SubscriptionStoreState {
  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getSnapshot,
  );
}

export async function refreshSubscription(): Promise<void> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise =
    (async () => {
      state = {
        ...state,
        loading: true,
        error: null,
      };

      emit();

      try {
        const result =
          await getSubscription();

        if (!result.success) {
          state = {
            subscription: null,
            loading: false,
            error:
              result.error ??
              "Unable to load subscription.",
          };
        } else {
          state = {
            subscription:
              result.data ?? null,
            loading: false,
            error: null,
          };
        }

        emit();
      } catch (error) {
        state = {
          subscription: null,
          loading: false,
          error:
            error instanceof Error
              ? error.message
              : "Unable to load subscription.",
        };

        emit();
      }
    })().finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export function clearSubscription(): void {
  state = {
    subscription: null,
    loading: false,
    error: null,
  };

  emit();
}

export function isCurrentUserPremium(): boolean {
  const subscription =
    state.subscription;

  if (!subscription) {
    return false;
  }

  const active =
    subscription.status === "active" ||
    subscription.status === "trialing";

  return (
    active &&
    (
      subscription.plan === "premium" ||
      subscription.plan === "pro"
    )
  );
  }
