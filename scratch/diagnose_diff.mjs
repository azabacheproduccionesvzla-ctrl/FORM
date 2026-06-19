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

async function fetchAllRows(tableName, selectFields) {
  let allData = [];
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

async function run() {
  console.log("Fetching active GHL contacts...");
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

  console.log(`GHL Contacts count: ${allContacts.length}`);

  console.log("Fetching all Supabase clients...");
  const dbClients = await fetchAllRows("clientes", "*");
  console.log(`Supabase Clients count: ${dbClients.length}`);

  // Maps
  const dbClientsMapById = new Map();
  const dbClientsMapByEmail = new Map();
  const dbClientsMapByName = new Map();

  for (const c of dbClients) {
    if (c.ghl_contact_id) dbClientsMapById.set(c.ghl_contact_id, c);
    if (c.email) dbClientsMapByEmail.set(c.email.toLowerCase().trim(), c);
    if (c.nombre) dbClientsMapByName.set(c.nombre.toLowerCase().trim(), c);
  }

  let matchedById = 0;
  let matchedByEmail = 0;
  let matchedByName = 0;
  let unmatched = [];

  for (const ghlContact of allContacts) {
    const firstName = ghlContact.firstName || "";
    const lastName = ghlContact.lastName || "";
    const ghlName = (
      ghlContact.contactName ||
      ghlContact.name ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      `GHL - ${ghlContact.id}`
    ).trim();

    const ghlEmail = ghlContact.email ? ghlContact.email.toLowerCase().trim() : "";

    let matched = false;
    if (dbClientsMapById.has(ghlContact.id)) {
      matchedById++;
      matched = true;
    } else if (ghlEmail && dbClientsMapByEmail.has(ghlEmail)) {
      matchedByEmail++;
      matched = true;
    } else if (dbClientsMapByName.has(ghlName.toLowerCase())) {
      matchedByName++;
      matched = true;
    }

    if (!matched) {
      unmatched.push({ id: ghlContact.id, name: ghlName, email: ghlEmail });
    }
  }

  console.log("\n--- MATCHING ANALYSIS ---");
  console.log(`Matched by GHL ID: ${matchedById}`);
  console.log(`Matched by Email: ${matchedByEmail}`);
  console.log(`Matched by Name: ${matchedByName}`);
  console.log(`Total Matched: ${matchedById + matchedByEmail + matchedByName}`);
  console.log(`Unmatched (Missing in Supabase): ${unmatched.length}`);

  if (unmatched.length > 0) {
    console.log("\nFirst 10 unmatched GHL contacts:");
    console.table(unmatched.slice(0, 10));

    // Try to insert one to see if there's any RLS policy or constraint error
    const testTarget = unmatched[0];
    console.log(`\nAttempting to insert unmatched client: ${testTarget.name}...`);
    const { data: insData, error: insErr } = await supabase
      .from("clientes")
      .insert([{
        nombre: testTarget.name,
        email: testTarget.email || null,
        ghl_contact_id: testTarget.id
      }])
      .select();

    if (insErr) {
      console.error("❌ Insertion failed with error:", insErr);
    } else {
      console.log("✅ Insertion succeeded! Inserted object:", insData);
      // Clean it up
      await supabase.from("clientes").delete().eq("id", insData[0].id);
      console.log("Cleaned up testing insert.");
    }
  }
}

run();
