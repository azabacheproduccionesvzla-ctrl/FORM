import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const getEnvVal = (key) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match ? match[1].trim() : null;
  };

  const supabaseUrl = getEnvVal("SUPABASE_URL");
  const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY");
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: users, error } = await supabase
    .from("usuarios_agencia")
    .select("id, username, nombre, rol, activo");
  if (error) throw error;
  console.log("Active users:", users);
} catch (err) {
  console.error("Error:", err);
}
