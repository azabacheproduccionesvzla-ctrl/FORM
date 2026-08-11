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

    console.log("Querying username: undefined");
    const { data: operator1, error: opError1 } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("username", undefined)
      .single();

    console.log("Result for undefined:", { data: operator1, error: opError1 });

    console.log("\nQuerying username: null");
    const { data: operator2, error: opError2 } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("username", null)
      .single();

    console.log("Result for null:", { data: operator2, error: opError2 });

  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
