import fs from "fs";
import path from "path";

async function testTrello() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const key = getEnvVal("TRELLO_API_KEY");
    const token = getEnvVal("TRELLO_TOKEN");
    const listNuevos = getEnvVal("TRELLO_ID_LIST_NUEVOS");

    console.log("Key:", key ? "Configured" : "Missing");
    console.log("Token:", token ? "Configured" : "Missing");
    console.log("List Nuevos:", listNuevos);

    const url = `https://api.trello.com/1/lists/${listNuevos}/cards?key=${key}&token=${token}&fields=id,name,desc,url,shortUrl,idList,closed,due`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      console.error("Failed to fetch cards:", res.statusText);
      return;
    }

    const cards = await res.json();
    console.log(`Fetched ${cards.length} cards from Trello.`);

    if (cards.length > 0) {
      const card = cards[0];
      console.log(`\nSample Card [${card.name}]:`);
      console.log("Due:", card.due);
      console.log("Desc:", card.desc);

      // Run parser
      let brief = "";
      let dropboxUrl = "";
      if (card.desc) {
        const dbMatch = card.desc.match(/(https?:\/\/(?:www\.)?dropbox\.com\S+)/i);
        if (dbMatch) {
          dropboxUrl = dbMatch[1].replace(/[)\],.;]+$/, "");
        }
        
        const briefMatch = card.desc.match(/Brief:\s*([^\n\r]+)/i);
        if (briefMatch) {
          brief = briefMatch[1].trim();
        }
      }

      console.log("--- Extracted Info ---");
      console.log("Parsed Dropbox Url:", dropboxUrl || "Not Found");
      console.log("Parsed Brief:", brief || "Not Found");
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
}

testTrello();
