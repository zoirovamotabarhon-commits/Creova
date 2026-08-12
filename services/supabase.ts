import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createClient,
  processLock,
} from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();

const SUPABASE_PUBLISHABLE_KEY =
  process.env
    .EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!SUPABASE_URL) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL is not configured."
  );
}

if (!SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured."
  );
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  }
);
