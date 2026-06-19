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

    console.log("Checking relrowsecurity for tables...");
    const { data, error } = await supabase.rpc("inspect_rls"); // wait, if RPC doesn't exist, we can use a direct sql query or write a test inserting/selecting under different roles.
    
    // Instead of RPC, we can just run a select from a dummy table or run a query if we have an endpoint.
    // Wait, let's see if we can do custom SQL query via RPC. Does Supabase allow executing SQL? Usually no, unless there is a custom function.
    // Let's check if we can check it by trying to select users using the anon key vs service role key (if service role key is in .env.local).
    // Let's check if process.env.SUPABASE_SERVICE_ROLE_KEY or process.env.SUPABASE_ANON_KEY are in .env.local.
    console.log("Reading .env.local keys...");
    console.log("URL:", supabaseUrl);
    console.log("ANON_KEY starts with:", supabaseAnonKey?.substring(0, 15));
    
  } catch (err) {
    console.error("Crash:", err);
  }
}

run();
