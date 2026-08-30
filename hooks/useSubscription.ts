import {
  useEffect,
} from "react";

import {
  clearSubscription,
  getCurrentEntitlements,
  refreshSubscription,
  useSubscriptionStore,
} from "../store/subscriptionStore";

export function useSubscription() {
  const state =
    useSubscriptionStore();

  useEffect(() => {
    void refreshSubscription();
  }, []);

  const entitlements =
    getCurrentEntitlements();

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
      entitlements.premium,

    isPro:
      entitlements.pro,

    removeAds:
      entitlements.removeAds,

    prioritySupport:
      entitlements.prioritySupport,

    monthlyAiLimit:
      entitlements.monthlyAiLimit,

    monthlyProjectLimit:
      entitlements.monthlyProjectLimit,

    storageLimitMb:
      entitlements.storageLimitMb,

    entitlements,
  };
}
