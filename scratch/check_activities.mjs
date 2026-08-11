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

    console.log("Fetching recent activities...");
    const { data: acts, error } = await supabase
      .from("historial_actividades")
      .select(`
        id,
        accion_descripcion,
        creado_en,
        usuarios_agencia (
          id,
          nombre,
          username
        )
      `)
      .order("creado_en", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching activities:", error);
    } else {
      console.log("Recent Activities:", JSON.stringify(acts, null, 2));
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
