import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key: string) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const keys = [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "TRELLO_API_KEY",
      "TRELLO_TOKEN",
      "TRELLO_ID_BOARD",
      "TRELLO_ID_LIST_NUEVOS",
      "TRELLO_ID_LIST_RECURRENTES"
    ];

    keys.forEach(k => {
      const val = getEnvVal(k);
      if (val) process.env[k] = val;
    });
  }
} catch (e) {
  console.error("Error leyendo .env.local:", e);
}

// 2. Run test
async function runTest() {
  console.log("Starting Trello Sync...");
  const { syncTrelloProjects } = await import("../src/lib/sync");
  const start = Date.now();
  const res = await syncTrelloProjects();
  const duration = ((Date.now() - start) / 1000).toFixed(2);
  console.log(`Finished Trello Sync in ${duration}s`);
  console.log("Result:", JSON.stringify(res, null, 2));
}

runTest();
