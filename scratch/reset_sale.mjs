import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// 1. Cargar variables de entorno
try {
  const envPath = path.resolve(".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.error("Error leyendo .env.local:", e);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function resetSale() {
  const saleId = "215d8aae-60d1-40b4-b6cb-787bc7fc9b4a";
  console.log(`Resetting statuses for sale ${saleId} to PENDIENTE...`);
  
  const { error } = await supabase
    .from("ventas")
    .update({
      status_ghl: "PENDIENTE",
      status_email: "PENDIENTE"
    })
    .eq("id", saleId);

  if (error) {
    console.error("Error resetting sale:", error);
  } else {
    console.log("Sale statuses reset successfully!");
  }
}

resetSale();
