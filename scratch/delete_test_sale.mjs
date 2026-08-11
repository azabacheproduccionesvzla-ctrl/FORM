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

    console.log("Deleting test sale: bff6a082-fb24-4bae-a6ff-d57251852019");
    const { error } = await supabase
      .from("ventas")
      .delete()
      .eq("id", "bff6a082-fb24-4bae-a6ff-d57251852019");

    if (error) {
      console.error("Delete failed:", error);
    } else {
      console.log("Delete succeeded.");
    }
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
