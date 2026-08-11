import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "placeholder_anon_key";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "Advertencia: Falta configurar SUPABASE_URL y/o SUPABASE_ANON_KEY en tu archivo .env.local"
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export type { UserRole } from "@/lib/crypto";
