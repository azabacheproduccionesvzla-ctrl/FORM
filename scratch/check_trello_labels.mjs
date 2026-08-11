import fs from "fs";
import path from "path";

async function checkTrelloLabels() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const key = getEnvVal("TRELLO_API_KEY");
    const token = getEnvVal("TRELLO_TOKEN");
    const boardId = getEnvVal("TRELLO_ID_BOARD");

    console.log("Using Board ID:", boardId);

    // Get all labels of the board
    const labelsUrl = `https://api.trello.com/1/boards/${boardId}/labels?key=${key}&token=${token}&limit=100`;
    const response = await fetch(labelsUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch labels: ${response.statusText} (${await response.text()})`);
    }

    const labels = await response.json();
    console.log("\n--- BOARD LABELS ---");
    console.log(JSON.stringify(labels, null, 2));
    console.log("--------------------\n");
  } catch (err) {
    console.error("Failed to check labels:", err);
  }
}

checkTrelloLabels();
