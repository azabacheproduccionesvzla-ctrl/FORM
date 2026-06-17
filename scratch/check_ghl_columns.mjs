import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function checkColumns() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : null;
    };

    const supabaseUrl = getEnvVal("SUPABASE_URL") || getEnvVal("NEXT_PUBLIC_SUPABASE_URL");
    const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY") || getEnvVal("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    
    console.log("Supabase URL:", supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    console.log("Checking columns on 'ventas' table...");
    const { data: sales, error: salesError } = await supabase
      .from("ventas")
      .select("id, status_ghl_contacto, status_ghl_factura")
      .limit(1);

    if (salesError) {
      console.log("Error querying sales columns:", salesError.message);
    } else {
      console.log("Sales columns query success:", sales);
    }

    console.log("Checking if 'ventas_logs' table exists...");
    const { data: logs, error: logsError } = await supabase
      .from("ventas_logs")
      .select("id")
      .limit(1);

    if (logsError) {
      console.log("Error querying ventas_logs:", logsError.message);
    } else {
      console.log("ventas_logs query success:", logs);
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

checkColumns();
