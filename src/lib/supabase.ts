import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV !== "production") {
    console.warn(
      "Advertencia: Falta configurar SUPABASE_URL y/o SUPABASE_ANON_KEY en tu archivo .env.local"
    );
  }
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export type { UserRole } from "@/lib/crypto";
