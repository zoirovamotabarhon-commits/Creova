import type { GenerationType } from "../../services/generation";

export type AIProviderName = "openai";

export interface AIProviderConfig {
  name: AIProviderName;
  model: string;
}

export const AI_PROVIDERS: Record<
  AIProviderName,
  AIProviderConfig
> = {
  openai: {
    name: "openai",
    model: "gpt-5.6",
  },
};

export interface AIMessage {
  id?: string;

  role:
    | "user"
    | "assistant"
    | "system";

  content: string;
}

export interface AIOptions {
  generationType?: GenerationType;

  generationId?: string;

  temperature?: number;

  maxTokens?: number;

  topP?: number;

  /**
   * Image URL used for multimodal Vision requests.
   *
   * Supported formats:
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

  routedTo?:
    | "local"
    | "cloud";
}
