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

    const saleId = "215d8aae-60d1-40b4-b6cb-787bc7fc9b4a";

    console.log(`Updating sale ${saleId}...`);
    const { data, error } = await supabase
      .from("ventas")
      .update({
        codigo_venta: "AZB-VENTA-2026-0004",
        codigo_factura: "000317"
      })
      .eq("id", saleId)
      .select();

    if (error) {
      console.error("Error updating sale:", error);
    } else {
      console.log("Update success:", data);
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
