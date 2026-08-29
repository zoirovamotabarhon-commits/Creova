export const STORAGE_KEYS = {
  theme: "creova.theme",
  language: "creova.language",
  onboardingSeen: "creova.onboarding_seen",
} as const;

export type StorageKey =
  (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
