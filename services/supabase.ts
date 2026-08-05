import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://krlvzkfevvgorhwaplcb.supabase.co";

const supabaseAnonKey = "sb_publishable_tAth3o5tfcb7s5_XmGsnUg_PD-mkrhD";

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);
