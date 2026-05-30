import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    let query = supabase
      .from("clientes")
      .select("*")
      .order("nombre", { ascending: true });

    if (search) {
      query = query.or(
        `nombre.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%,empresa.ilike.%${search}%`
      );
    }

    const { data: clients, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error: any) {
    console.error("GET Clients Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener la lista de clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const token = process.env.GHL_ACCESS_TOKEN;
    const locationId = process.env.GHL_LOCATION_ID;

    if (!token || !locationId) {
      return NextResponse.json(
        { success: false, error: "Las credenciales de GHL no están configuradas." },
        { status: 500 }
      );
    }

    console.log("[Clients Sync] Iniciando sincronización de contactos desde GHL...");
    let allContacts: any[] = [];
    let nextPageId = "";
    let pageCount = 0;

    do {
      let url = `https://services.leadconnectorhq.com/contacts/?locationId=${locationId}&limit=100`;
      if (nextPageId) {
        url += `&nextPageId=${nextPageId}`;
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
        throw new Error(`Error de API GHL: ${res.statusText} - ${errText}`);
      }

      const data = await res.json();
      const contacts = data.contacts || [];
      allContacts = [...allContacts, ...contacts];
      nextPageId = data.meta?.nextPageId || "";
      pageCount++;
    } while (nextPageId && pageCount < 10);

    console.log(`[Clients Sync] Obtenidos ${allContacts.length} contactos de GHL.`);

    const { data: dbClients } = await supabase.from("clientes").select("*");
    const dbClientsMapById = new Map<string, any>();
    const dbClientsMapByEmail = new Map<string, any>();
    const dbClientsMapByName = new Map<string, any>();

    if (dbClients) {
      for (const c of dbClients) {
        if (c.ghl_contact_id) dbClientsMapById.set(c.ghl_contact_id, c);
        if (c.email) dbClientsMapByEmail.set(c.email.toLowerCase().trim(), c);
        if (c.nombre) dbClientsMapByName.set(c.nombre.toLowerCase().trim(), c);
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;

    for (const ghlContact of allContacts) {
      const firstName = ghlContact.firstName || "";
      const lastName = ghlContact.lastName || "";
      const ghlName = (
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
        const updates: any = {};
        if (!matchedClient.ghl_contact_id) updates.ghl_contact_id = ghlContact.id;
        if (!matchedClient.email && ghlEmail) updates.email = ghlEmail;
        if (!matchedClient.telefono && ghlPhone) updates.telefono = ghlPhone;
        if (!matchedClient.empresa && ghlCompany) updates.empresa = ghlCompany;
        if (!matchedClient.pais && ghlCountry) updates.pais = ghlCountry;

        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from("clientes")
            .update(updates)
            .eq("id", matchedClient.id);
          if (!updErr) updatedCount++;
        }
      } else {
        const { error: insErr } = await supabase.from("clientes").insert([
          {
            nombre: ghlName,
            email: ghlEmail || null,
            telefono: ghlPhone || null,
            empresa: ghlCompany || null,
            pais: ghlCountry || null,
            ghl_contact_id: ghlContact.id,
          },
        ]);
        if (!insErr) {
          insertedCount++;
          dbClientsMapByName.set(ghlName.toLowerCase(), { nombre: ghlName });
        }
      }
    }

    console.log(
      `[Clients Sync] Completado. Insertados: ${insertedCount}, Actualizados: ${updatedCount}.`
    );

    return NextResponse.json({
      success: true,
      insertedCount,
      updatedCount,
      totalSynced: allContacts.length,
    });
  } catch (error: any) {
    console.error("POST Sync Clients Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al sincronizar clientes con GHL." },
      { status: 500 }
    );
  }
}
