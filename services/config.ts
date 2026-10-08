export const AI_CONFIG = {
  defaultProvider: "gemini",

  model: "gemini-3.8-flash",

  maxTokens: 4096,

  timeout: 60000,
} as const;

export const GEMINI_MODEL =
  AI_CONFIG.model;

export const APP_CONFIG = {
  appName: "CREOVA",

  version: "1.0.0",
} as const;
