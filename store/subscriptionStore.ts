import {
  useSyncExternalStore,
} from "react";

import type {
  Subscription,
} from "../types/subscription";

import {
  getSubscription,
} from "../services/payments/subscriptions";

import {
  getEntitlements,
} from "../services/payments/entitlements";

export interface SubscriptionStoreState {
  subscription:
    | Subscription
    | null;

  loading: boolean;
  error: string | null;
}

const INITIAL_STATE: SubscriptionStoreState = {
  subscription: null,
  loading: false,
  error: null,
};

let state: SubscriptionStoreState =
  INITIAL_STATE;

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

          emit();
          return;
        }

        state = {
          subscription:
            result.data ?? null,
          loading: false,
          error: null,
        };

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
    ...INITIAL_STATE,
  };

  emit();
}

export function getSubscriptionState(): SubscriptionStoreState {
  return state;
}

export function getCurrentSubscription():
  | Subscription
  | null {
  return state.subscription;
}

export function getCurrentEntitlements() {
  return getEntitlements(
    state.subscription,
  );
}

export function isCurrentUserPremium(): boolean {
  return getCurrentEntitlements()
    .premium;
}
