import fs from "fs";
import path from "path";

try {
  const envPath = path.resolve(process.cwd(), ".env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const getEnvVal = (key: string) => {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
    return match ? match[1].trim() : null;
  };

  const key = getEnvVal("TRELLO_API_KEY")!;
  const token = getEnvVal("TRELLO_TOKEN")!;
  const boardId = getEnvVal("TRELLO_ID_BOARD")!;

  async function check() {
    const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}&filter=all&fields=id,name,desc,url,shortUrl,idList,closed,due`;
    const res = await fetch(url);
    const cards = await res.json() as any[];

    // Find cards that have name containing "Rediseño de Libro 2025"
    const targetCards = cards.filter(c => c.name.includes("Rediseño de Libro 2025"));
    console.log(`Found ${targetCards.length} target cards.`);
    
    for (const card of targetCards) {
      console.log("\nCard ID:", card.id);
      console.log("Name:", card.name);
      console.log("Name Length:", card.name.length);
      console.log("Url:", card.url);
      console.log("Url Length:", card.url ? card.url.length : 0);
      console.log("ShortUrl:", card.shortUrl);
      console.log("ShortUrl Length:", card.shortUrl ? card.shortUrl.length : 0);
      
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

      console.log("Parsed Dropbox URL:", dropboxUrl);
      console.log("Dropbox URL Length:", dropboxUrl.length);
    }
  }

  check();
} catch (err) {
  console.error("Error:", err);
}
