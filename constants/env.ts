/**
 * CREOVA
 * Centralized runtime environment configuration.
 *
 * Only public Expo variables belong here.
 * Service-role keys, private provider keys and secrets
 * must never be exposed to the mobile application.
 */

function readPublicEnvironmentVariable(name: string): string {
  const value = process.env[name];

  return typeof value === "string" ? value.trim() : "";
}

export const ENV = {
  supabaseUrl: readPublicEnvironmentVariable(
    "EXPO_PUBLIC_SUPABASE_URL"
  ),
  supabasePublishableKey: readPublicEnvironmentVariable(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  ),
} as const;

export function isEnvironmentConfigured(): boolean {
  return (
    ENV.supabaseUrl.length > 0 &&
    ENV.supabasePublishableKey.length > 0
  );
}

export function getMissingEnvironmentVariables(): string[] {
  const missing: string[] = [];

  if (!ENV.supabaseUrl) {
    missing.push("EXPO_PUBLIC_SUPABASE_URL");
  }

  if (!ENV.supabasePublishableKey) {
    missing.push("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }

  return missing;
}

export function validateEnvironment(): void {
  // Jest testlari paytida enviroment tekshiruvini o'tkazib yuborish
  if (process.env.NODE_ENV === "test") {
    return;
  }

  const missing = getMissingEnvironmentVariables();

  if (missing.length > 0) {
    throw new Error(
      `CREOVA environment is not configured. Missing: ${missing.join(", ")}`
    );
  }
}
