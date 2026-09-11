import {
  useCallback,
  useMemo,
  useState,
} from "react";

import { AIRouter } from "../core/router/AIRouter";
import type { AgentContext } from "../core/agents/AgentContext";
import type { AIMessage } from "../core/ai/AIProvider";
import { useAuthContext } from "../providers/AuthProvider";

export interface UseAIOptions {
  projectId?: string;
  conversationId?: string;
  imageUrl?: string;
}

export function useAI(
  options: UseAIOptions = {}
) {
  const { user } = useAuthContext();

  const [loading, setLoading] =
    useState<boolean>(false);

  const [error, setError] =
    useState<string | null>(null);

  const [messages, setMessages] =
    useState<AIMessage[]>([]);

  const router = useMemo(
    () => new AIRouter(),
    []
  );

  const sendMessage = useCallback(
    async (input: string) => {
      if (!input.trim()) return;

      if (!user) {
        setError(
          "You must be signed in to use AI features."
        );
        return;
      }

      setLoading(true);
      setError(null);

      const userMessage: AIMessage = {
        role: "user",
        content: input,
      };

      const updatedHistory = [
        ...messages,
        userMessage,
      ];

      setMessages(updatedHistory);

      try {
        const context: AgentContext = {
          userId: user.id,
          imageUrl: options.imageUrl,
          metadata: {
            projectId: options.projectId,
            conversationId: options.conversationId,
          },
        };

        const response =
          await router.routeAndExecute(
            input,
            context
          );

        const assistantMessage: AIMessage = {
          role: "assistant",
          content: response.content,
        };

        setMessages((prev) => [
          ...prev,
          assistantMessage,
        ]);

        return response;
      } catch (err: unknown) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An error occurred while processing AI request.";

        setError(errorMessage);

        console.error(
          "useAI Error:",
          err
        );
      } finally {
        setLoading(false);
      }
    },
    [
      messages,
      options.projectId,
      options.conversationId,
      options.imageUrl,
      user,
      router,
    ]
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
