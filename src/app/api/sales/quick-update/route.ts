import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { updateTrelloCardFields } from "@/lib/trello";
import { renameDropboxFolderDirect } from "@/lib/dropbox";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const { saleId, action, trelloTitle, trelloDesc, dropboxFolder } = await request.json();

    if (!saleId || !action) {
      return NextResponse.json({ success: false, error: "Missing saleId or action." }, { status: 400 });
    }

    // Fetch sale details
    const { data: sale, error: saleErr } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (
          id,
          nombre
        )
      `)
      .eq("id", saleId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ success: false, error: "Venta no encontrada." }, { status: 404 });
    }

    if (action === "trello") {
      if (!trelloTitle) {
        return NextResponse.json({ success: false, error: "trelloTitle is required." }, { status: 400 });
      }

      let cardId = "";
      if (sale.link_trello) {
        const match = sale.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
        if (match) cardId = match[1];
      }

      const { data: proj } = await supabase
        .from("proyectos")
        .select("trello_card_id")
        .eq("venta_id", saleId)
        .maybeSingle();

      const finalCardId = proj?.trello_card_id || cardId;

      if (!finalCardId) {
        return NextResponse.json({ success: false, error: "No se encontró ID de tarjeta de Trello para esta venta." }, { status: 400 });
      }

      console.log(`[Quick Update API] Actualizando Trello Card ID: ${finalCardId}`);
      const trelloRes = await updateTrelloCardFields(finalCardId, {
        name: trelloTitle,
        desc: trelloDesc || ""
      });

      if (!trelloRes.success) {
        return NextResponse.json({ success: false, error: trelloRes.error || "Error al actualizar Trello." }, { status: 500 });
      }

      return NextResponse.json({ success: true, message: "Tarjeta de Trello actualizada con éxito." });
    }

    if (action === "dropbox") {
      if (!dropboxFolder) {
        return NextResponse.json({ success: false, error: "dropboxFolder is required." }, { status: 400 });
      }

      const oldClientName = sale.clientes?.nombre || "Cliente";
      const oldProjectName = sale.proyecto_nombre || "";
      const creadoEn = sale.creado_en;

      // Construct old folder name using the same cleaning rules
      const cleanOldClient = oldClientName.replace(/[\/\\:*?"<>|]/g, "_").trim();
      const cleanOldProjRaw = oldProjectName
        .replace(/^azabache\s+producciones\s*-\s*/i, "")
        .replace(/^azabache\s+producciones\s*/i, "")
        .trim();
      const cleanOldProj = cleanOldProjRaw.replace(/[\/\\:*?"<>|]/g, "_").trim();
      const oldFolderName = `${cleanOldClient} - ${cleanOldProj}`;

      console.log(`[Quick Update API] Renombrando Dropbox de "${oldFolderName}" a "${dropboxFolder}"`);
      let dropboxRes = await renameDropboxFolderDirect(oldFolderName, dropboxFolder, creadoEn);

      if (!dropboxRes.success && dropboxRes.error === "not_found") {
        // Construct old raw folder name (keeping "Azabache Producciones" prefix if it was there originally)
        const cleanOldProjRaw = oldProjectName.replace(/[\/\\:*?"<>|]/g, "_").trim();
        const oldFolderNameRaw = `${cleanOldClient} - ${cleanOldProjRaw}`;
        console.log(`[Quick Update API] Carpeta limpia no encontrada. Intentando con nombre original raw: "${oldFolderNameRaw}"`);
        dropboxRes = await renameDropboxFolderDirect(oldFolderNameRaw, dropboxFolder, creadoEn);
      }

      if (!dropboxRes.success) {
        const friendlyError = dropboxRes.error === "not_found"
          ? `No se encontró la carpeta de origen en Dropbox. Rutas intentadas: "${oldFolderName}" y "${cleanOldClient} - ${oldProjectName.replace(/[\/\\:*?"<>|]/g, "_").trim()}"`
          : (dropboxRes.error || "Error al renombrar carpeta en Dropbox.");
        return NextResponse.json({ success: false, error: friendlyError }, { status: 500 });
      }

      // Split the new folder name to update database fields if formatted as "Client - Project"
      const parts = dropboxFolder.split(" - ");
      const newClientName = parts[0]?.trim();
      const newProjectName = parts.slice(1).join(" - ").trim() || dropboxFolder;

      if (newProjectName) {
        // Update project name in ventas
        await supabase
          .from("ventas")
          .update({ proyecto_nombre: newProjectName })
          .eq("id", saleId);

        // Update project name in proyectos
        await supabase
          .from("proyectos")
          .update({ nombre: newProjectName })
          .eq("venta_id", saleId);
      }

      if (newClientName && sale.cliente_id) {
        // Update client name in clientes table
        await supabase
          .from("clientes")
          .update({ nombre: newClientName })
          .eq("id", sale.cliente_id);
      }

      return NextResponse.json({ success: true, message: "Carpeta de Dropbox renombrada con éxito y base de datos actualizada." });
    }

    return NextResponse.json({ success: false, error: "Acción no reconocida." }, { status: 400 });

  } catch (error: any) {
    console.error("[Quick Update API] Crash:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
