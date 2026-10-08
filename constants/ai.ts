export const AI_MODELS = {
  default: "gemini-3.8-flash",
  chat: "gemini-3.8-flash",
  vision: "gemini-3.8-flash",
} as const;

export type AIModel =
  (typeof AI_MODELS)[keyof typeof AI_MODELS];

export const AI_TIMEOUT_MS = 60_000;
