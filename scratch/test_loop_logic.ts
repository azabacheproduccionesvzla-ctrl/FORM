import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function main() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    const getEnvVal = (key: string) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const supabaseUrl = getEnvVal("SUPABASE_URL")!;
    const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // 1. Preload projects
    async function fetchAllRows(tableName: string, selectFields: string) {
      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data, error } = await supabase
          .from(tableName)
          .select(selectFields)
          .range(from, from + limit - 1);

        if (error) throw error;

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          from += limit;
          if (data.length < limit) hasMore = false;
        } else {
          hasMore = false;
        }
      }
      return allData;
    }

    const dbProjects = await fetchAllRows("proyectos", "id, venta_id, carpeta_dropbox, link_trello, activo, trello_card_id, trello_list_id");
    const projectsMapByCardId = new Map<string, any>();
    for (const p of dbProjects) {
      if (p.trello_card_id) projectsMapByCardId.set(p.trello_card_id, p);
    }

    // 2. Fetch cards from Trello
    const key = getEnvVal("TRELLO_API_KEY")!;
    const token = getEnvVal("TRELLO_TOKEN")!;
    const boardId = getEnvVal("TRELLO_ID_BOARD")!;

    console.log("Fetching cards from Trello...");
    const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}&filter=all&fields=id,name,desc,url,shortUrl,idList,closed,due`;
    const res = await fetch(url);
    const allCards = await res.json() as any[];

    const targetCardId = "66198db40fd91d3385c68cf7";
    const trelloCard = allCards.find(c => c.id === targetCardId);

    if (!trelloCard) {
      console.log(`Card ${targetCardId} not found in Trello board cards.`);
    } else {
      console.log("Found card in Trello response:", {
        id: trelloCard.id,
        name: trelloCard.name,
        closed: trelloCard.closed
      });

      const existingProj = projectsMapByCardId.get(trelloCard.id);
      console.log("projectsMapByCardId.get(trelloCard.id) is:", existingProj);

      if (existingProj) {
        console.log("Path: UPDATE project");
      } else {
        console.log("Path: INSERT project");
      }
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
