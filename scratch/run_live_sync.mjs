import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

async function runLiveSync() {
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

    console.log("Starting GHL contact retrieval...");
    let allContacts = [];
    let startAfter = null;
    let startAfterId = null;
    let pageCount = 0;

    // Fetching with limit=100 and up to 100 pages
    do {
      let url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`;
      if (startAfter && startAfterId) {
        url += `&startAfter=${startAfter}&startAfterId=${startAfterId}`;
      }

      console.log(`Fetching page ${pageCount + 1}...`);
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
      console.log(`Fetched ${contacts.length} contacts on page ${pageCount + 1}. Total fetched so far: ${allContacts.length}`);
      
      startAfter = data.meta?.startAfter || null;
      startAfterId = data.meta?.startAfterId || null;
      pageCount++;
    } while (startAfter && startAfterId && pageCount < 100);

    console.log(`Total retrieved GHL contacts: ${allContacts.length}`);

    // Pre-cache supabase clients
    const { data: dbClients, error: fetchErr } = await supabase.from("clientes").select("*");
    if (fetchErr) throw fetchErr;

    console.log(`Total Supabase clients pre-loaded: ${dbClients.length}`);

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

    console.log("Analyzing differences...");

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

      let ghlPlatformLink = "";
      if (ghlContact.customFields && Array.isArray(ghlContact.customFields)) {
        for (const field of ghlContact.customFields) {
          const val = String(field.value || "");
          if (val.startsWith("http") && (
            val.includes("workana.com") || 
            val.includes("freelancer.com") || 
            val.includes("upwork.com") || 
            val.includes("fiverr.com")
          )) {
            ghlPlatformLink = val;
            break;
          }
        }
      }

      let matchedClient = dbClientsMapById.get(ghlContact.id);
      if (!matchedClient && ghlEmail) {
        matchedClient = dbClientsMapByEmail.get(ghlEmail);
      }
      if (!matchedClient) {
        matchedClient = dbClientsMapByName.get(ghlName.toLowerCase());
      }

      if (matchedClient) {
        const updates = {};
        
        if (!matchedClient.ghl_contact_id) {
          updates.ghl_contact_id = ghlContact.id;
        }
        if (ghlName && matchedClient.nombre !== ghlName) {
          updates.nombre = ghlName;
        }
        if (ghlEmail && matchedClient.email !== ghlEmail) {
          updates.email = ghlEmail;
        }
        if (ghlPhone && matchedClient.telefono !== ghlPhone) {
          updates.telefono = ghlPhone;
        }
        if (ghlCompany && matchedClient.empresa !== ghlCompany) {
          updates.empresa = ghlCompany;
        }
        if (ghlCountry && matchedClient.pais !== ghlCountry) {
          updates.pais = ghlCountry;
        }
        if (ghlPlatformLink && matchedClient.link_usuario_plataforma !== ghlPlatformLink) {
          updates.link_usuario_plataforma = ghlPlatformLink;
        }

        if (Object.keys(updates).length > 0) {
          console.log(`[Update] Client "${matchedClient.nombre}" needs updates:`, updates);
          const { error: updErr } = await supabase
            .from("clientes")
            .update(updates)
            .eq("id", matchedClient.id);
          if (updErr) {
            console.error(`[Update Error] failed for ${matchedClient.nombre}:`, updErr.message);
          } else {
            updatedCount++;
          }
        }
      } else {
        console.log(`[Insert] New client found: "${ghlName}"`);
        const { error: insErr } = await supabase.from("clientes").insert([
          {
            nombre: ghlName,
            email: ghlEmail || null,
            telefono: ghlPhone || null,
            empresa: ghlCompany || null,
            pais: ghlCountry || null,
            link_usuario_plataforma: ghlPlatformLink || null,
            ghl_contact_id: ghlContact.id,
            creado_en: ghlContact.dateAdded || new Date().toISOString(),
          },
        ]);
        if (insErr) {
          console.error(`[Insert Error] failed for ${ghlName}:`, insErr.message);
        } else {
          insertedCount++;
          dbClientsMapByName.set(ghlName.toLowerCase(), { nombre: ghlName });
        }
      }
    }

    console.log(`Sync complete. Inserted: ${insertedCount}, Updated: ${updatedCount}`);
  } catch (err) {
    console.error("Sync crashed:", err);
  }
}

runLiveSync();
