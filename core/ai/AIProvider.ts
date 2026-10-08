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

  maxTokens?: number;

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
