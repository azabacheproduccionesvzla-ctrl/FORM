import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

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

  const { data: dbProjects } = await supabase.from("proyectos").select("id, nombre, trello_card_id");
  console.log("Supabase Projects Count:", dbProjects?.length);
  
  if (dbProjects && dbProjects.length > 0) {
    const populated = dbProjects.filter(p => p.trello_card_id);
    console.log("Populated trello_card_id count:", populated.length);
    console.log("Sample populated:", populated.slice(0, 5));
  }
} catch (err) {
  console.error("Error:", err);
}
