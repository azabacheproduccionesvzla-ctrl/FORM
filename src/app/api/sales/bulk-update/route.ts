import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";
import { updateTrelloCardName } from "@/lib/trello";
import { renameDropboxFolder } from "@/lib/dropbox";
import { updateLocalWorkspaceSheet } from "@/lib/local_sheets";

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const userData = JSON.parse(sessionCookie.value);
    const userId = userData.id;
    const username = userData.username;
    const userRole = userData.role;

    if (userRole === "auditor") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Los auditores no pueden modificar ventas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pin, sales } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Firma de PIN de seguridad es requerida para guardar los cambios." },
        { status: 400 }
      );
    }

    if (!sales || !Array.isArray(sales) || sales.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se enviaron modificaciones para guardar." },
        { status: 400 }
      );
    }

    const { data: operator, error: opError } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("username", username)
      .single();

    if (opError || !operator) {
      return NextResponse.json(
        { success: false, error: "Error al validar el usuario firma. Intente de nuevo." },
        { status: 401 }
      );
    }

    const isPinValid = verifyPin(pin, operator.pin_hash, operator.pin_salt);
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: "PIN de confirmación incorrecto. Cambios no guardados." },
        { status: 401 }
      );
    }

    console.log(`[Bulk Update API] Iniciando guardado de ${sales.length} ventas modificadas por usuario ${username}.`);

    // Procesar cada venta modificada de forma secuencial
    for (const updateObj of sales) {
      const {
        id,
        proyecto_nombre,
        status_pago,
        plataforma,
        monto_total,
        moneda,
        fecha_pago,
        comprobante_link,
        setter_principal_id,
        setters_adicionales_ids,
        closer_principal_id,
        closers_adicionales_ids,
        cliente_id,
        cliente_nombre,
        cliente_ghl_id
      } = updateObj;

      if (!id) continue;

      // 1. Obtener datos antiguos para ver si hay cambios de nombre (para Trello/Dropbox)
      const { data: oldSale, error: findError } = await supabase
        .from("ventas")
        .select(`
          proyecto_nombre,
          creado_en,
          link_trello,
          cliente_id,
          clientes (
            nombre
          )
        `)
        .eq("id", id)
        .single();

      if (findError || !oldSale) {
        console.warn(`[Bulk Update API] Venta ${id} no encontrada, omitiendo.`);
        continue;
      }

      // 2. Actualizar cliente si se editó el nombre o el ghl_contact_id
      if (cliente_id) {
        const clientUpdates: any = {};
        if (cliente_nombre !== undefined) clientUpdates.nombre = cliente_nombre.trim();
        if (cliente_ghl_id !== undefined) clientUpdates.ghl_contact_id = cliente_ghl_id.trim() || null;

        if (Object.keys(clientUpdates).length > 0) {
          await supabase
            .from("clientes")
            .update(clientUpdates)
            .eq("id", cliente_id);
        }
      }

      // 3. Preparar actualizaciones de la venta
      const saleUpdates: any = {
        proyecto_nombre: proyecto_nombre !== undefined ? proyecto_nombre.trim() : undefined,
        status_pago: status_pago !== undefined ? status_pago : undefined,
        plataforma: plataforma !== undefined ? plataforma : undefined,
        monto_total: monto_total !== undefined ? parseFloat(monto_total) : undefined,
        moneda: moneda !== undefined ? moneda : undefined,
        fecha_pago: fecha_pago !== undefined ? (fecha_pago || null) : undefined,
        comprobante_link: comprobante_link !== undefined ? (comprobante_link || null) : undefined,
        setter_principal_id: setter_principal_id !== undefined ? (setter_principal_id || null) : undefined,
        setters_adicionales_ids: setters_adicionales_ids !== undefined ? setters_adicionales_ids : undefined,
        closer_principal_id: closer_principal_id !== undefined ? (closer_principal_id || null) : undefined,
        closers_adicionales_ids: closers_adicionales_ids !== undefined ? closers_adicionales_ids : undefined
      };

      // Limpiar propiedades undefined
      Object.keys(saleUpdates).forEach(key => {
        if (saleUpdates[key] === undefined) {
          delete saleUpdates[key];
        }
      });

      if (Object.keys(saleUpdates).length > 0) {
        await supabase
          .from("ventas")
          .update(saleUpdates)
          .eq("id", id);
      }

      // 4. Renombrado de Trello y Dropbox si corresponde
      try {
        const oldProjectName = oldSale.proyecto_nombre;
        const oldClientName = (oldSale.clientes as any)?.nombre || "";

        const newProjectName = proyecto_nombre !== undefined ? proyecto_nombre.trim() : oldProjectName;
        const newClientName = cliente_nombre !== undefined ? cliente_nombre.trim() : oldClientName;

        if (proyecto_nombre !== undefined && oldProjectName !== newProjectName) {
          // Actualizar en tabla proyectos de Supabase
          await supabase
            .from("proyectos")
            .update({ nombre: newProjectName })
            .eq("venta_id", id);
        }

        if (oldProjectName !== newProjectName || oldClientName !== newClientName) {
          console.log(`[Bulk Rename] Cambio detectado. Proyecto: "${oldProjectName}" -> "${newProjectName}", Cliente: "${oldClientName}" -> "${newClientName}"`);

          let cardId = "";
          if (oldSale.link_trello) {
            const m = oldSale.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
            if (m) cardId = m[1];
          }

          const { data: projDb } = await supabase
            .from("proyectos")
            .select("trello_card_id, link_trello")
            .eq("venta_id", id)
            .maybeSingle();

          let finalCardId = projDb?.trello_card_id || cardId;

          if (!finalCardId && projDb?.link_trello) {
            const m = projDb.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
            if (m) finalCardId = m[1];
          }

          if (!finalCardId && (oldSale as any).proyecto_previo_id) {
            const { data: priorSale } = await supabase
              .from("ventas")
              .select("link_trello")
              .eq("id", (oldSale as any).proyecto_previo_id)
              .maybeSingle();
            if (priorSale?.link_trello) {
              const m = priorSale.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
              if (m) finalCardId = m[1];
            }
          }

          if (!finalCardId && oldSale.cliente_id) {
            const { data: clientProj } = await supabase
              .from("proyectos")
              .select("trello_card_id, link_trello")
              .eq("cliente_id", oldSale.cliente_id)
              .not("trello_card_id", "is", null)
              .maybeSingle();
            if (clientProj?.trello_card_id) {
              finalCardId = clientProj.trello_card_id;
            } else if (clientProj?.link_trello) {
              const m = clientProj.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
              if (m) finalCardId = m[1];
            }
          }

          if (finalCardId) {
            const trelloRes = await updateTrelloCardName(finalCardId, newProjectName, newClientName);
            if (trelloRes.success) {
              console.log(`[Bulk Rename] Tarjeta de Trello (${finalCardId}) renombrada con éxito a "${newProjectName}".`);
            } else {
              console.warn(`[Bulk Rename Warning] No se pudo renombrar tarjeta de Trello (${finalCardId}): ${trelloRes.error}`);
            }
          } else {
            console.warn(`[Bulk Rename Warning] No se encontró un ID de tarjeta de Trello para la venta ${id}.`);
          }

          if (oldClientName && oldProjectName) {
            await renameDropboxFolder(oldClientName, oldProjectName, newClientName, newProjectName, oldSale.creado_en);
          }
        }
      } catch (renameErr) {
        console.error(`[Bulk Rename Exception] Error al renombrar recursos de venta ${id}:`, renameErr);
      }

      // 5. Historial de actividad
      await supabase.from("historial_actividades").insert({
        usuario_id: userId,
        accion_descripcion: `Venta modificada vía Cuadro Maestro: ${id} (${proyecto_nombre || oldSale.proyecto_nombre}) por administrador`,
      });
    }

    // Sincronizar el CSV local
    try {
      await updateLocalWorkspaceSheet();
    } catch (localErr) {
      console.error("[Bulk Update API] Error al sincronizar el CSV local:", localErr);
    }

    return NextResponse.json({
      success: true,
      message: "Todos los cambios del Cuadro Maestro se han guardado exitosamente."
    });

  } catch (error: any) {
    console.error("[Bulk Update API] Crash:", error);
    return NextResponse.json(
      { success: false, error: "Error interno al guardar los cambios en lote." },
      { status: 500 }
    );
  }
}
