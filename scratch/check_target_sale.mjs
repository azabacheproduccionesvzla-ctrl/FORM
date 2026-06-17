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

    console.log("Searching for sale AZB-VENTA-2026-0010...");
    const { data: sales, error: saleErr } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (*)
      `)
      .eq("codigo_venta", "AZB-VENTA-2026-0010");

    if (saleErr) {
      console.error("Error fetching sale:", saleErr);
      return;
    }

    if (!sales || sales.length === 0) {
      console.log("No sale found with code AZB-VENTA-2026-0010.");
      return;
    }

    const sale = sales[0];
    console.log("Target Sale Data:\n", JSON.stringify(sale, null, 2));

    console.log("\nFetching logs for sale ID:", sale.id);
    const { data: logs, error: logErr } = await supabase
      .from("ventas_logs")
      .select("*")
      .eq("venta_id", sale.id)
      .order("creado_en", { ascending: true });

    if (logErr) {
      console.error("Error fetching logs:", logErr);
      return;
    }

    console.log("\nSystem Execution Logs:");
    logs.forEach(log => {
      console.log(`[${log.creado_en}] [${log.tipo_sistema}] [${log.estado}] ${log.mensaje}`);
    });

  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
