/**
 * CREOVA
 * Centralized runtime environment configuration.
 *
 * Public Expo environment variables are safe to expose to the
 * mobile application. Private API keys, service-role keys and
 * provider secrets must NEVER be placed here.
 */

const getEnvironmentVariable = (
  name: string,
): string => {
  const value = process.env[name];

  return typeof value === "string"
    ? value.trim()
    : "";
};

export const ENV = {
  SUPABASE_URL:
    getEnvironmentVariable(
      "EXPO_PUBLIC_SUPABASE_URL",
    ),

  SUPABASE_PUBLISHABLE_KEY:
    getEnvironmentVariable(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    ),
} as const;

export function isEnvironmentConfigured(): boolean {
  return (
    ENV.SUPABASE_URL.length > 0 &&
    ENV.SUPABASE_PUBLISHABLE_KEY.length > 0
  );
}

export function validateEnvironment(): void {
  const missing: string[] = [];

  if (!ENV.SUPABASE_URL) {
    missing.push(
      "EXPO_PUBLIC_SUPABASE_URL",
    );
  }

  if (
    !ENV.SUPABASE_PUBLISHABLE_KEY
  ) {
    missing.push(
      "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    );
  }

  if (missing.length > 0) {
    throw new Error(
      `CREOVA environment is not configured. Missing: ${missing.join(
        ", ",
      )}`,
    );
  }
}
