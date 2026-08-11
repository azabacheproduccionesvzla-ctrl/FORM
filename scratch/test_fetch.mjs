import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function testFetch() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const supabaseUrl = getEnvVal("SUPABASE_URL");
    const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY");
    
    console.log("Connecting to Supabase at:", supabaseUrl);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const saleId = "215d8aae-60d1-40b4-b6cb-787bc7fc9b4a";
    console.log("Fetching sale with ID:", saleId);

    const { data: sale, error: fetchErr } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (
          id,
          nombre,
          email,
          telefono,
          pais,
          empresa,
          link_usuario_plataforma,
          ghl_contact_id
        ),
        setter_principal:usuarios_agencia!setter_principal_id (
          nombre
        ),
        closer_principal:usuarios_agencia!closer_principal_id (
          nombre
        )
      `)
      .eq("id", saleId)
      .single();

    if (fetchErr) {
      console.error("Fetch Error:", fetchErr);
    } else {
      console.log("Fetch Succeeded! Sale found:");
      console.log(JSON.stringify(sale, null, 2));
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

testFetch();
