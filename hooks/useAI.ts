import { useCallback, useState } from 'react';
import { AIClient, AIGenerateInput } from '../core/ai/AIClient';

export function useAI() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const client = new AIClient();

  const generate = useCallback(
    async (input: AIGenerateInput) => {
      setLoading(true);
      setError(null);

      try {
        return await client.generate(input);
      } catch (err) {
        const normalized =
          err instanceof Error
            ? err
            : new Error('AI request failed');

        setError(normalized);
        throw normalized;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    generate,
    loading,
    error,
  };
}
