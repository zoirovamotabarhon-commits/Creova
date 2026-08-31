import { useState, useCallback } from 'react';
import { AIRouter } from '../core/router/AIRouter';
import { AgentContext } from '../core/agents/AgentContext';
import { AIMessage } from '../core/ai/AIProvider';

export interface UseAIOptions {
  projectId?: string;
  conversationId?: string;
}

export function useAI(options: UseAIOptions = {}) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);

  const router = new AIRouter();

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      setLoading(true);
      setError(null);

      const userMessage: AIMessage = { role: 'user', content: input };
      const updatedHistory = [...messages, userMessage];
      setMessages(updatedHistory);

      try {
        const context: AgentContext = {
          projectId: options.projectId,
          conversationId: options.conversationId,
          history: messages,
        };

        const response = await router.routeAndExecute(input, context);

        const assistantMessage: AIMessage = {
          role: 'assistant',
          content: response.content,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        return response;
      } catch (err: any) {
        const errorMessage = err.message || 'An error occurred while processing AI request.';
        setError(errorMessage);
        console.error('useAI Error:', err);
      } finally {
        setLoading(false);
      }
    },
    [messages, options.projectId, options.conversationId]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    clearMessages,
  };
}
