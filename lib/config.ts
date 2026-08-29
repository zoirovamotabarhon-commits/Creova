export const AI_CONFIG = {
  defaultProvider: "openai",
  model: "gpt-5.5",
  maxTokens: 4096,
  temperature: 0.7,
  timeout: 60000,
} as const;

export const SUPABASE_TABLES = {
  profiles: "profiles",
  wallets: "wallets",
  coinTransactions: "coin_transactions",
  subscriptions: "subscriptions",
  generationHistory: "generation_history",
  adminRoles: "admin_roles",
} as const;

export const SUPPORTED_LANGUAGES = [
  "uz",
  "en",
] as const;

export type SupportedLanguage =
  (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: SupportedLanguage = "uz";
