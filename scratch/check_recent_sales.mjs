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

    const { data: sales, error } = await supabase
      .from("ventas")
      .select("id, codigo_venta, codigo_factura, creado_en, proyecto_nombre")
      .order("creado_en", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching sales:", error);
    } else {
      console.log("Recent Sales:", JSON.stringify(sales, null, 2));
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
