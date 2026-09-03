import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { ENV, validateEnvironment } from "../constants/env";

// Jest test muhitida polyfill xatolik bermasligi uchun shartli yuklash
if (process.env.NODE_ENV !== "test") {
  require("react-native-url-polyfill/auto");
}

validateEnvironment();

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
  }
);
