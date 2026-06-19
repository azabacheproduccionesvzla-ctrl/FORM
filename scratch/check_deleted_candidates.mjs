import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

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

const token = process.env.GHL_ACCESS_TOKEN;
const locationId = process.env.GHL_LOCATION_ID;
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function run() {
  console.log("Fetching GHL active contacts...");
  let allContacts = [];
  let startAfter = null;
  let startAfterId = null;
  let pageCount = 0;

  do {
    let url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`;
    if (startAfter && startAfterId) {
      url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json",
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`GHL API error: ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    const contacts = data.contacts || [];
    allContacts = [...allContacts, ...contacts];
    
    startAfter = data.meta?.startAfter || null;
    startAfterId = data.meta?.startAfterId || null;
    pageCount++;
  } while (startAfter && startAfterId && pageCount < 100);

  console.log(`Retrieved ${allContacts.length} active contacts from GHL.`);
  const ghlFetchedIds = new Set(allContacts.map(c => c.id));

  console.log("Fetching Supabase clients...");
  const { data: dbClients, error } = await supabase.from("clientes").select("*");
  if (error) {
    console.error("Supabase error:", error);
    return;
  }
  console.log(`Retrieved ${dbClients.length} clients from Supabase.`);

  const withGhlId = dbClients.filter(c => c.ghl_contact_id);
  console.log(`Clients with ghl_contact_id in Supabase: ${withGhlId.length}`);

  const missingInGhl = withGhlId.filter(c => !ghlFetchedIds.has(c.ghl_contact_id));
  console.log(`Clients in Supabase that are NOT in GHL (should be deleted): ${missingInGhl.length}`);

  if (missingInGhl.length > 0) {
    console.log("First 10 candidates for deletion:");
    console.table(missingInGhl.slice(0, 10).map(c => ({ id: c.id, nombre: c.nombre, email: c.email, ghl_contact_id: c.ghl_contact_id })));
  }
}

run();
