export const AI_MODELS = {
  default: 'gpt-4o-mini',
  chat: 'gpt-4o-mini',
  vision: 'gpt-4o',
} as const;

export type AIModel = (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const AI_TIMEOUT_MS = 60_000;
