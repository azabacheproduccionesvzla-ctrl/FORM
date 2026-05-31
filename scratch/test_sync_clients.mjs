import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function testSync() {
  try {
    const envPath = path.resolve(process.cwd(), ".env.local");
    const envContent = fs.readFileSync(envPath, "utf-8");
    
    const getEnvVal = (key) => {
      const match = envContent.match(new RegExp(`^${key}=(.*)$`, "m"));
      return match ? match[1].trim() : null;
    };

    const token = getEnvVal("GHL_ACCESS_TOKEN");
    const locationId = getEnvVal("GHL_LOCATION_ID");
    const supabaseUrl = getEnvVal("SUPABASE_URL");
    const supabaseAnonKey = getEnvVal("SUPABASE_ANON_KEY");

    console.log("Supabase URL:", supabaseUrl);
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    const url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=10`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Version": "2021-07-28",
        "Accept": "application/json"
      }
    });

    const data = await res.json();
    const allContacts = data.contacts || [];
    console.log(`Fetched ${allContacts.length} contacts for testing.`);

    const { data: dbClients, error: fetchErr } = await supabase.from("clientes").select("*");
    if (fetchErr) {
      console.error("Error fetching db clients:", fetchErr);
      return;
    }
    console.log(`DB clients count: ${dbClients?.length}`);

    const dbClientsMapById = new Map();
    const dbClientsMapByEmail = new Map();
    const dbClientsMapByName = new Map();

    for (const c of dbClients) {
      if (c.ghl_contact_id) dbClientsMapById.set(c.ghl_contact_id, c);
      if (c.email) dbClientsMapByEmail.set(c.email.toLowerCase().trim(), c);
      if (c.nombre) dbClientsMapByName.set(c.nombre.toLowerCase().trim(), c);
    }

    let insertedCount = 0;
    let updatedCount = 0;

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
      const ghlPhone = ghlContact.phone || "";
      const ghlCompany = ghlContact.companyName || "";
      const ghlCountry = ghlContact.country || "";

      let matchedClient = dbClientsMapById.get(ghlContact.id);
      if (!matchedClient && ghlEmail) {
        matchedClient = dbClientsMapByEmail.get(ghlEmail);
      }
      if (!matchedClient) {
        matchedClient = dbClientsMapByName.get(ghlName.toLowerCase());
      }

      if (matchedClient) {
        const updates = {};
        if (!matchedClient.ghl_contact_id) updates.ghl_contact_id = ghlContact.id;
        if (!matchedClient.email && ghlEmail) updates.email = ghlEmail;
        if (!matchedClient.telefono && ghlPhone) updates.telefono = ghlPhone;
        if (!matchedClient.empresa && ghlCompany) updates.empresa = ghlCompany;
        if (!matchedClient.pais && ghlCountry) updates.pais = ghlCountry;

        if (Object.keys(updates).length > 0) {
          console.log(`Updating client ${matchedClient.nombre} with updates:`, updates);
          const { data: updatedData, error: updErr } = await supabase
            .from("clientes")
            .update(updates)
            .eq("id", matchedClient.id)
            .select();
          if (updErr) {
            console.error(`Error updating client ${matchedClient.nombre}:`, updErr);
          } else {
            console.log("Update success:", updatedData);
            updatedCount++;
          }
        } else {
          console.log(`Client ${ghlName} already up to date.`);
        }
      } else {
        console.log(`Inserting new client: ${ghlName}`);
        const { data: insertedData, error: insErr } = await supabase.from("clientes").insert([
          {
            nombre: ghlName,
            email: ghlEmail || null,
            telefono: ghlPhone || null,
            empresa: ghlCompany || null,
            pais: ghlCountry || null,
            ghl_contact_id: ghlContact.id,
          },
        ]).select();
        if (insErr) {
          console.error(`Error inserting client ${ghlName}:`, insErr);
        } else {
          console.log("Insert success:", insertedData);
          insertedCount++;
          dbClientsMapByName.set(ghlName.toLowerCase(), { nombre: ghlName });
        }
      }
    }

    console.log(`Sync test finished. Inserted: ${insertedCount}, Updated: ${updatedCount}`);
  } catch (err) {
    console.error("Test sync crashed:", err);
  }
}

testSync();
