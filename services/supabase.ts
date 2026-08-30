import "react-native-url-polyfill/auto";

import AsyncStorage from
  "@react-native-async-storage/async-storage";

import {
  createClient,
  processLock,
} from "@supabase/supabase-js";

import { ENV } from "../constants/env";

if (!ENV.supabaseUrl) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_URL is not configured.",
  );
}

if (!ENV.supabasePublishableKey) {
  throw new Error(
    "EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not configured.",
  );
}

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabasePublishableKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);
