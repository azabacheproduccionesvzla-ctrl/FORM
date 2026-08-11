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

    console.log("Querying username: VictoriaR");
    const { data: operator, error: opError } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("username", "VictoriaR")
      .single();

    if (opError) {
      console.error("Error fetching VictoriaR pin:", opError);
    } else {
      console.log("Operator pin data fetched successfully:", operator);
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
