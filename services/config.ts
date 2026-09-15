export const AI_CONFIG = {
  defaultProvider: "openai",

  model: "gpt-5.6",

  maxTokens: 4096,

  temperature: 0.7,

  timeout: 60000,
} as const;

export const OPENAI_MODEL =
  AI_CONFIG.model;

export const APP_CONFIG = {
  appName: "CREOVA",

  version: "1.0.0",
} as const;
