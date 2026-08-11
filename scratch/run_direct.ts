import fs from "fs";
import path from "path";

// Load environment variables from .env.local
try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const parts = trimmed.split("=");
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join("=").trim();
      process.env[key] = val;
    }
  });
  console.log("Environment variables loaded from .env.local");
} catch (err) {
  console.error("Failed to load .env.local:", err);
}

async function run() {
  const { runVentasAutomations } = await import("../src/lib/automations");
  const saleId = "215d8aae-60d1-40b4-b6cb-787bc7fc9b4a";
  console.log(`Starting runVentasAutomations for ${saleId}...`);
  await runVentasAutomations(saleId);
  console.log("Execution complete!");
}

run();
