import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  getGenerationHistory,
  GenerationHistoryItem,
  GenerationType,
} from "../services/history";

export function useGenerationHistory(
  type?: GenerationType
) {
  const [data, setData] = useState<
    GenerationHistoryItem[]
  >([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(
    null
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await getGenerationHistory({
      type,
      limit: 100,
    });

    if (!result.success) {
      setError(
        result.error ?? "Unable to load history."
      );
      setData([]);
      setLoading(false);
      return;
    }

    setData(result.data ?? []);
    setLoading(false);
  }, [type]);

  useEffect(() => {
    let active = true;

    const loadHistory = async () => {
      if (!active) return;

      setLoading(true);
      setError(null);

      try {
        const result = await getGenerationHistory({
          type,
          limit: 100,
        });

        if (!active) return;

        if (!result.success) {
          setError(
            result.error ??
              "Unable to load history."
          );
          setData([]);
          return;
        }

        setData(result.data ?? []);
      } catch (err) {
        if (!active) return;

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load history."
        );
        setData([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      active = false;
    };
  }, [type]);

  return {
    data,
    loading,
    error,
    refresh,
  };
}