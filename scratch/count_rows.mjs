import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function countRows() {
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

    const [clientsRes, projectsRes, salesRes] = await Promise.all([
      supabase.from("clientes").select("id", { count: "exact", head: true }),
      supabase.from("proyectos").select("id", { count: "exact", head: true }),
      supabase.from("ventas").select("id", { count: "exact", head: true })
    ]);

    console.log("Clientes count:", clientsRes.count);
    console.log("Proyectos count:", projectsRes.count);
    console.log("Ventas count:", salesRes.count);
  } catch (err) {
    console.error("Error counts:", err);
  }
}

countRows();
