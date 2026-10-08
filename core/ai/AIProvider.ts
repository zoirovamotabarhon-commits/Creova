import type { GenerationType } from "../../services/generation";

export type AIProviderName = "gemini";

export interface AIProviderConfig {
  name: AIProviderName;
  model: string;
}

export const AI_PROVIDERS: Record<
  AIProviderName,
  AIProviderConfig
> = {
  gemini: {
    name: "gemini",
    model: "gemini-3.8-flash",
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

  /**
   * Kept for backward compatibility with
   * existing callers.
   *
   * Gemini 3.8 Flash does not send these
   * values to the API.
   */
  temperature?: number;

  maxTokens?: number;

  /**
   * Kept for backward compatibility.
   *
   * Gemini 3.8 Flash does not send topP
   * to the API.
   */
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
