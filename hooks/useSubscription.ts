import { useEffect } from "react";

import {
  clearSubscription,
  isCurrentUserPremium,
  refreshSubscription,
  useSubscriptionStore,
} from "../store/subscriptionStore";

export function useSubscription() {
  const state =
    useSubscriptionStore();

  useEffect(() => {
    void refreshSubscription();
  }, []);

  return {
    subscription:
      state.subscription,

    loading:
      state.loading,

    error:
      state.error,

    refresh:
      refreshSubscription,

    clear:
      clearSubscription,

    isPremium:
      isCurrentUserPremium(),
  };
}
