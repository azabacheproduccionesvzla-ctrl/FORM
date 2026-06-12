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
        const { data, error } = await supabase
          .from(tableName)
          .select(selectFields)
          .range(from, from + limit - 1);

        if (error) {
          throw error;
        }

        if (data && data.length > 0) {
          allData = [...allData, ...data];
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

    const dbProjects = await fetchAllRows("proyectos", "id, venta_id, carpeta_dropbox, link_trello, activo, trello_card_id, trello_list_id");
    console.log("Total dbProjects:", dbProjects.length);

    const projectsMapByCardId = new Map<string, any>();
    for (const p of dbProjects) {
      if (p.trello_card_id) {
        projectsMapByCardId.set(p.trello_card_id, p);
      }
    }

    const targetCardId = "66198db40fd91d3385c68cf7";
    console.log("Map size:", projectsMapByCardId.size);
    console.log(`Map.has(${targetCardId}):`, projectsMapByCardId.has(targetCardId));
    console.log(`Map.get(${targetCardId}):`, projectsMapByCardId.get(targetCardId));
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
