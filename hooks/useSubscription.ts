import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getSubscription,
  Subscription,
} from "../services/subscription";

export function useSubscription() {
  const [
    subscription,
    setSubscription,
  ] = useState<
    Subscription | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(null);

  const refresh =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      const result =
        await getSubscription();

      if (!result.success) {
        setError(
          result.error ??
            "Unable to load subscription."
        );
        setSubscription(null);
        setLoading(false);
        return;
      }

      setSubscription(
        result.data ?? null
      );

      setLoading(false);
    }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    subscription,
    loading,
    error,
    refresh,
    isPremium:
      subscription?.status ===
        "active" &&
      (
        subscription.plan ===
          "premium" ||
        subscription.plan === "pro"
      ),
  };
    }
