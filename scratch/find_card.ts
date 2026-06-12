import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key: string) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const supabaseUrl = getEnvVal("SUPABASE_URL")!;
    const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const { data: dbProj, error } = await supabase
      .from("proyectos")
      .select("id, nombre, trello_card_id")
      .eq("trello_card_id", "6836385f62a68c17e7b71dcb")
      .maybeSingle();

    if (error) {
      console.error("Query error:", error);
    } else {
      console.log("Found card in DB:", dbProj);
    }
  } catch (err) {
    console.error("Err:", err);
  }
}

main();
