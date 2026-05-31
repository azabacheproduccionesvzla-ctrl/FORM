import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";

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
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {}
    const { pin } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Se requiere el PIN de seguridad para iniciar la sincronización." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    if (userData.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo administradores pueden realizar esta sincronización." },
        { status: 403 }
      );
    }

    const { data: dbUser, error: fetchErr } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("id", userData.id)
      .single();

    if (fetchErr || !dbUser) {
      return NextResponse.json(
        { success: false, error: "No se pudo recuperar la información de seguridad del usuario." },
        { status: 403 }
      );
    }

    const isPinValid = verifyPin(pin, dbUser.pin_hash, dbUser.pin_salt);
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: "PIN de seguridad incorrecto." },
        { status: 403 }
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
    let startAfter: number | null = null;
    let startAfterId: string | null = null;
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
        throw new Error(`Error de API GHL: ${res.statusText} - ${errText}`);
      }

      const data = await res.json();
      const contacts = data.contacts || [];
      allContacts = [...allContacts, ...contacts];
      
      startAfter = data.meta?.startAfter || null;
      startAfterId = data.meta?.startAfterId || null;
      pageCount++;
    } while (startAfter && startAfterId && pageCount < 10);

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
        ghlContact.contactName ||
        ghlContact.name ||
        [firstName, lastName].filter(Boolean).join(" ") ||
        `GHL - ${ghlContact.id}`
      ).trim();

      const ghlEmail = ghlContact.email ? ghlContact.email.toLowerCase().trim() : "";
      const ghlPhone = ghlContact.phone || "";
      const ghlCompany = ghlContact.companyName || "";
      const ghlCountry = ghlContact.country || "";

      // Try to parse platform profile link from customFields
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
        const updates: any = {};
        if (!matchedClient.ghl_contact_id) updates.ghl_contact_id = ghlContact.id;
        if (!matchedClient.email && ghlEmail) updates.email = ghlEmail;
        if (!matchedClient.telefono && ghlPhone) updates.telefono = ghlPhone;
        if (!matchedClient.empresa && ghlCompany) updates.empresa = ghlCompany;
        if (!matchedClient.pais && ghlCountry) updates.pais = ghlCountry;
        if (!matchedClient.link_usuario_plataforma && ghlPlatformLink) updates.link_usuario_plataforma = ghlPlatformLink;

        if (ghlContact.dateAdded) {
          try {
            const ghlDateStr = new Date(ghlContact.dateAdded).toISOString();
            const dbDateStr = new Date(matchedClient.creado_en).toISOString();
            if (ghlDateStr !== dbDateStr) {
              updates.creado_en = ghlContact.dateAdded;
            }
          } catch (e) {
            console.error(`[Clients Sync] Error al procesar fecha para el cliente ${matchedClient.nombre}:`, e);
          }
        }

        if (Object.keys(updates).length > 0) {
          const { error: updErr } = await supabase
            .from("clientes")
            .update(updates)
            .eq("id", matchedClient.id);
          if (updErr) {
            console.error(`[Clients Sync] Error actualizando cliente ${matchedClient.nombre}:`, updErr);
          } else {
            updatedCount++;
          }
        }
      } else {
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
          console.error(`[Clients Sync] Error insertando cliente ${ghlName}:`, insErr);
        } else {
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
