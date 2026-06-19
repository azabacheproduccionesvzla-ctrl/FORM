import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function checkColumns() {
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

    // Get table structure or run raw RPC if possible, or just select columns
    // Since anon key cannot query info schema directly, we can do a select on clientes
    const { data, error } = await supabase.from("proyectos").select("*").limit(1);
    if (error) {
      console.error("Select error:", error);
    } else {
      console.log("Returned columns of proyectos:", Object.keys(data[0] || {}));
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

checkColumns();
