import type { GenerationType } from "../../services/generation";

export type AIProviderName = "openai";

export interface AIProviderConfig {
  name: AIProviderName;
  model: string;
}

export const AI_PROVIDERS: Record<AIProviderName, AIProviderConfig> = {
  openai: {
    name: "openai",
    model: "gpt-5.5",
  },
};

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface AIOptions {
  generationType?: GenerationType;
  generationId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;

  /**
   * When supplied, the final user message is sent to the provider
   * as a multimodal text + image message.
   *
   * Supports:
   * - https://...
   * - data:image/...;base64,...
   */
  imageUrl?: string;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIResponse {
  content: string;
  model: string;
  generationId: string;
  usage?: AIUsage;

  /**
   * Where the response was produced.
   * "cloud" is used by the normal AIClient.
   * "local" is used by the HybridRouter.
   */
  routedTo?: "local" | "cloud";
}
