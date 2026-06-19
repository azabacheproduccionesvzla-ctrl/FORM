import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 });
    }

    console.log("[GHL Webhook] Payload recibido:", JSON.stringify(body));

    // Support multiple GHL webhook payload shapes
    const ghlId = body.id || body.contact_id || body.contact?.id;
    if (!ghlId) {
      return NextResponse.json({ success: false, error: "No Contact ID found in payload" }, { status: 400 });
    }

    // Check if delete event
    const eventType = (body.type || body.event || "").toLowerCase();
    if (eventType === "contactdelete" || eventType === "contact_delete") {
      console.log(`[GHL Webhook] Detectado evento de eliminación para el ID de GHL: ${ghlId}`);
      
      const { data: matchedClient, error: findErr } = await supabase
        .from("clientes")
        .select("*")
        .eq("ghl_contact_id", ghlId)
        .maybeSingle();

      if (findErr) {
        console.error("[GHL Webhook] Error al buscar cliente por GHL ID:", findErr);
        return NextResponse.json({ success: false, error: findErr.message }, { status: 500 });
      }

      if (!matchedClient) {
        console.log(`[GHL Webhook] No se encontró ningún cliente con ghl_contact_id: ${ghlId}. No es necesario eliminar.`);
        return NextResponse.json({ success: true, action: "none", message: "Client not found in Supabase" });
      }

      let fallbackClientId: string | null = null;
      const fallbackClientName = "Cliente Eliminado (Historial)";
      const { data: dbClients, error: clientsErr } = await supabase
        .from("clientes")
        .select("id")
        .eq("nombre", fallbackClientName);

      if (clientsErr) {
        console.error("[GHL Webhook] Error al consultar cliente de historial:", clientsErr);
      }

      const matchedFallback = dbClients && dbClients.length > 0 ? dbClients[0] : null;
      if (matchedFallback) {
        fallbackClientId = matchedFallback.id;
      } else {
        const { data: newFallback, error: fallbackErr } = await supabase
          .from("clientes")
          .insert([{ nombre: fallbackClientName }])
          .select()
          .single();
        if (fallbackErr) {
          console.error("[GHL Webhook] Error al crear cliente de historial:", fallbackErr);
        } else if (newFallback) {
          fallbackClientId = newFallback.id;
        }
      }

      if (fallbackClientId) {
        // Consultar ventas asociadas
        const { data: salesForDeleted } = await supabase
          .from("ventas")
          .select("id, cliente_id, notas_internas")
          .eq("cliente_id", matchedClient.id);

        // Consultar proyectos asociados
        const { data: projectsForDeleted } = await supabase
          .from("proyectos")
          .select("id, cliente_id")
          .eq("cliente_id", matchedClient.id);

        // Reasignar ventas
        if (salesForDeleted && salesForDeleted.length > 0) {
          for (const sale of salesForDeleted) {
            const clientInfoStr = `${matchedClient.nombre || "Sin Nombre"}${matchedClient.email ? ` (Email: ${matchedClient.email})` : ""}${matchedClient.telefono ? ` (Tel: ${matchedClient.telefono})` : ""}`;
            const oldNotes = sale.notas_internas || "";
            const newNotes = `[Cliente original: ${clientInfoStr}]\n${oldNotes}`.trim();

            await supabase
              .from("ventas")
              .update({
                cliente_id: fallbackClientId,
                notas_internas: newNotes
              })
              .eq("id", sale.id);
          }
        }

        // Reasignar proyectos
        if (projectsForDeleted && projectsForDeleted.length > 0) {
          for (const proj of projectsForDeleted) {
            await supabase
              .from("proyectos")
              .update({
                cliente_id: fallbackClientId
              })
              .eq("id", proj.id);
          }
        }

        // Eliminar cliente
        const { error: delErr } = await supabase
          .from("clientes")
          .delete()
          .eq("id", matchedClient.id);

        if (delErr) {
          console.error("[GHL Webhook] Error al eliminar cliente:", delErr);
          return NextResponse.json({ success: false, error: delErr.message }, { status: 500 });
        }

        console.log(`[GHL Webhook] Cliente eliminado y reasignado con éxito: ${matchedClient.nombre} (ID: ${matchedClient.id})`);
        return NextResponse.json({ success: true, action: "deleted", id: matchedClient.id });
      } else {
        console.error("[GHL Webhook] No se pudo obtener ni crear el cliente de historial.");
        return NextResponse.json({ success: false, error: "Failed to establish fallback client" }, { status: 500 });
      }
    }

    const firstName = body.firstName || body.first_name || body.contact?.firstName || body.contact?.first_name || "";
    const lastName = body.lastName || body.last_name || body.contact?.lastName || body.contact?.last_name || "";
    
    const ghlName = (
      body.contactName ||
      body.name ||
      body.contact?.contactName ||
      body.contact?.name ||
      [firstName, lastName].filter(Boolean).join(" ") ||
      `GHL - ${ghlId}`
    ).trim();

    const ghlEmail = (body.email || body.contact?.email || "").toLowerCase().trim();
    const ghlPhone = body.phone || body.contact?.phone || "";
    const ghlCompany = body.companyName || body.company_name || body.contact?.companyName || body.contact?.company_name || "";
    const ghlCountry = body.country || body.contact?.country || "";

    // Parse platform link from customFields
    let ghlPlatformLink = "";
    const customFields = body.customFields || body.contact?.customFields || [];
    if (Array.isArray(customFields)) {
      for (const field of customFields) {
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

    // Match client
    let matchedClient = null;

    // 1. Match by GHL ID
    const { data: clientById } = await supabase
      .from("clientes")
      .select("*")
      .eq("ghl_contact_id", ghlId)
      .maybeSingle();

    matchedClient = clientById;

    // 2. Match by Email if not matched by ID
    if (!matchedClient && ghlEmail) {
      const { data: clientByEmail } = await supabase
        .from("clientes")
        .select("*")
        .eq("email", ghlEmail)
        .maybeSingle();
      matchedClient = clientByEmail;
    }

    // 3. Match by Name if not matched by Email or ID
    if (!matchedClient) {
      const { data: clientByName } = await supabase
        .from("clientes")
        .select("*")
        .eq("nombre", ghlName)
        .maybeSingle();
      matchedClient = clientByName;
    }

    if (matchedClient) {
      // Update
      const updates: any = {
        ghl_contact_id: ghlId
      };

      if (ghlName) updates.nombre = ghlName;
      if (ghlEmail) updates.email = ghlEmail;
      if (ghlPhone) updates.telefono = ghlPhone;
      if (ghlCompany) updates.empresa = ghlCompany;
      if (ghlCountry) updates.pais = ghlCountry;
      if (ghlPlatformLink) updates.link_usuario_plataforma = ghlPlatformLink;

      const { error: updErr } = await supabase
        .from("clientes")
        .update(updates)
        .eq("id", matchedClient.id);

      if (updErr) {
        console.error("[GHL Webhook] Error al actualizar cliente:", updErr);
        return NextResponse.json({ success: false, error: updErr.message }, { status: 500 });
      }

      console.log(`[GHL Webhook] Cliente actualizado con éxito: ${ghlName} (ID: ${matchedClient.id})`);
      return NextResponse.json({ success: true, action: "updated", id: matchedClient.id });
    } else {
      // Insert new client
      const { data: newClient, error: insErr } = await supabase
        .from("clientes")
        .insert({
          nombre: ghlName,
          email: ghlEmail || null,
          telefono: ghlPhone || null,
          empresa: ghlCompany || null,
          pais: ghlCountry || null,
          link_usuario_plataforma: ghlPlatformLink || null,
          ghl_contact_id: ghlId,
          creado_en: body.dateAdded || body.contact?.dateAdded || new Date().toISOString()
        })
        .select()
        .single();

      if (insErr) {
        console.error("[GHL Webhook] Error al insertar cliente:", insErr);
        return NextResponse.json({ success: false, error: insErr.message }, { status: 500 });
      }

      console.log(`[GHL Webhook] Cliente creado con éxito: ${ghlName} (ID: ${newClient.id})`);
      return NextResponse.json({ success: true, action: "inserted", id: newClient.id });
    }
  } catch (error: any) {
    console.error("[GHL Webhook] Excepción general:", error);
    return NextResponse.json({ success: false, error: error.message || "Internal Server Error" }, { status: 500 });
  }
}
