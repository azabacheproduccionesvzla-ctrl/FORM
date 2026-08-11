import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function testConfig() {
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

    const { data, error } = await supabase
      .from("configuraciones")
      .select("valor")
      .eq("clave", "integraciones")
      .maybeSingle();

    if (error) {
      console.error("Query error:", error);
    } else {
      console.log("Config from database:", data);
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

testConfig();
