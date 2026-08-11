import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function run() {
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

    console.log("Fetching users from usuarios_agencia...");
    const { data: users, error } = await supabase
      .from("usuarios_agencia")
      .select("id, nombre, username, rol, activo");

    if (error) {
      console.error("Error fetching users:", error);
    } else {
      console.log("Users:", users);
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
