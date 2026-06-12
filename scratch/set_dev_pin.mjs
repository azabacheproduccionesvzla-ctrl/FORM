import fs from "fs";
import path from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

function generateSalt() {
  return crypto.randomBytes(16).toString("hex");
}

function hashPin(pin, salt) {
  return crypto.scryptSync(pin, salt, 64).toString("hex");
}

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

  const pin = "123456";
  const salt = generateSalt();
  const hash = hashPin(pin, salt);

  const { data, error } = await supabase
    .from("usuarios_agencia")
    .update({ pin_hash: hash, pin_salt: salt })
    .eq("username", "admin_dev")
    .select();

  if (error) throw error;
  console.log("Updated user admin_dev pin to 123456:", data);
} catch (err) {
  console.error("Error setting pin:", err);
}
