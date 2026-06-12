import fs from "fs";
import path from "path";

// 1. Load env vars
try {
  const envPath = path.resolve(".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    envContent.split("\n").forEach(line => {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = match[2] || "";
        if (value.startsWith('"') && value.endsWith('"')) {
          value = value.substring(1, value.length - 1);
        } else if (value.startsWith("'") && value.endsWith("'")) {
          value = value.substring(1, value.length - 1);
        }
        process.env[key] = value.trim();
      }
    });
  }
} catch (e) {
  console.error("Error reading .env.local:", e);
}

// 2. Import sync function
import { syncTrelloProjects } from "../src/lib/sync.js";

async function runTest() {
  console.log("Starting Trello Sync...");
  const start = Date.now();
  const res = await syncTrelloProjects();
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`Finished Trello Sync in ${duration}s`);
  console.log("Result:", JSON.stringify(res, null, 2));
}

runTest();
