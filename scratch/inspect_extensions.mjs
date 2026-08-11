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

    console.log("Fetching all sales where es_continuacion is true...");
    const { data: sales, error } = await supabase
      .from("ventas")
      .select("id, codigo_venta, es_continuacion, proyecto_previo_id, proyecto_nombre, creado_en")
      .eq("es_continuacion", true);

    if (error) {
      console.error("Error:", error);
    } else {
      console.log("Extension sales in DB:", JSON.stringify(sales, null, 2));
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
