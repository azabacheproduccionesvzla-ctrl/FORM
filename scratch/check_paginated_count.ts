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

    async function fetchAllRows(tableName: string, selectFields: string) {
      let allData: any[] = [];
      let from = 0;
      const limit = 1000;
      let hasMore = true;

      while (hasMore) {
        console.log(`Querying ${tableName} range ${from} to ${from + limit - 1}...`);
        const { data, error } = await supabase
          .from(tableName)
          .select(selectFields)
          .range(from, from + limit - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
          console.log(`Fetched ${data.length} rows.`);
          from += limit;
          if (data.length < limit) {
            hasMore = false;
          }
        } else {
          hasMore = false;
        }
      }
      return allData;
    }

    const projects = await fetchAllRows("proyectos", "id, trello_card_id");
    console.log("Total projects fetched:", projects.length);
    
    const ids = projects.map(p => p.trello_card_id).filter(Boolean);
    console.log("Total non-null card IDs:", ids.length);

    const targetCardId = "613bcd4d7ae8ea052ca748b9";
    const foundCard = projects.find(p => p.trello_card_id === targetCardId);
    console.log(`Is target card ${targetCardId} in fetched projects?:`, !!foundCard);
    if (foundCard) {
      console.log("Found card details:", foundCard);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
