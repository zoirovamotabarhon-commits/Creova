import type { GenerationType } from "../../services/generation";

export type AIProviderName = 'openai';

export interface AIProviderConfig {
  name: AIProviderName;
  model: string;
}

export const AI_PROVIDERS: Record<AIProviderName, AIProviderConfig> = {
  openai: {
    name: 'openai',
    model: 'gpt-4o-mini',
  },
};

/**
 * A single message in an AI chat conversation, following the standard
 * chat-completion shape (role + content).
 */
export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/**
 * Optional per-request tuning knobs passed into AIClient.chat(). Everything
 * is optional so callers can pass `{}` and get sane server-side defaults.
 */
export interface AIOptions {
  /** Which generation type this chat call belongs to (defaults to "chat"). */
  generationType?: GenerationType;
  /** Reuse an existing generation record instead of creating a new one. */
  generationId?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/** Token-usage breakdown returned by the underlying model provider, if available. */
export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * The normalized response shape returned by AIClient.chat() regardless of
 * which underlying provider/model actually served the request.
 */
export interface AIResponse {
  content: string;
  model: string;
  generationId: string;
  usage?: AIUsage;
}
