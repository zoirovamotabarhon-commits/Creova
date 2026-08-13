import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getCoinBalance,
} from "../services/wallet";

export function useWallet() {
  const [
    balance,
    setBalance,
  ] = useState<number>(0);

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
        await getCoinBalance();

      if (!result.success) {
        setError(
          result.error ??
            "Unable to load wallet."
        );
        setLoading(false);
        return;
      }

      setBalance(
        result.balance ?? 0
      );

      setLoading(false);
    }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    balance,
    loading,
    error,
    refresh,
  };
      }
