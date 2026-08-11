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

    const { data: logs, error } = await supabase
      .from("ventas_logs")
      .select("*")
      .eq("venta_id", "215d8aae-60d1-40b4-b6cb-787bc7fc9b4a")
      .order("creado_en", { ascending: true });

    if (error) {
      console.error("Error fetching logs:", error);
    } else {
      console.log("Logs for Sale:", JSON.stringify(logs, null, 2));
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
