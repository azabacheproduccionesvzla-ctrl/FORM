import fs from "fs";
import path from "path";

async function checkTrello() {
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

    console.log("Key:", key ? "Configured" : "Missing");
    console.log("Token:", token ? "Configured" : "Missing");
    console.log("Board ID:", boardId);

    // Test board access
    const boardUrl = `https://api.trello.com/1/boards/${boardId}?key=${key}&token=${token}`;
    const boardRes = await fetch(boardUrl);
    console.log("Board status:", boardRes.status, boardRes.statusText);
    const boardBody = await boardRes.text();
    console.log("Board response:", boardBody);

    // List all boards for the token
    const memberUrl = `https://api.trello.com/1/members/me/boards?key=${key}&token=${token}&fields=id,name`;
    const memberRes = await fetch(memberUrl);
    console.log("\nMember boards status:", memberRes.status, memberRes.statusText);
    if (memberRes.ok) {
      const boards = await memberRes.json();
      console.log("Available boards:", JSON.stringify(boards, null, 2));
    } else {
      console.log("Failed to get member boards:", await memberRes.text());
    }

  } catch (err) {
    console.error("Test failed:", err);
  }
}

checkTrello();
