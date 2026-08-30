export const ENV = {
  supabaseUrl:
    process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ??
    "",

  supabasePublishableKey:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ??
    "",
} as const;

export function isEnvironmentConfigured(): boolean {
  return (
    ENV.supabaseUrl.length > 0 &&
    ENV.supabasePublishableKey.length > 0
  );
}
