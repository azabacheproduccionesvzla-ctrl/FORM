import { supabase } from "@/lib/supabase";
import { createDropboxFolder } from "@/lib/dropbox";
import { processTrelloCard, updateTrelloCardDesc } from "@/lib/trello";
import { createGhlContact, createGhlInvoice, sendGhlMessage } from "@/lib/ghl";
import { appendRowToSheet } from "@/lib/sheets";
import { getIntegrationConfig } from "@/lib/config_service";

export async function runVentasAutomations(saleId: string) {
  try {
    console.log(`[Automations] Iniciando automatizaciones para venta ID: ${saleId}`);

    const config = await getIntegrationConfig();
    const integrationsEnabled = !!(config.dropbox || config.trello || config.ghl_factura || config.ghl_email || config.zapier_whatsapp || config.google_sheets);

    if (!integrationsEnabled) {
      console.log(`[Automations] Integraciones automáticas desactivadas de forma global. Marcando estados como DESACTIVADO.`);
      await supabase
        .from("ventas")
        .update({
          status_ghl: "DESACTIVADO",
          status_dropbox: "DESACTIVADO",
          status_trello: "DESACTIVADO",
          status_email: "DESACTIVADO",
          status_whatsapp: "DESACTIVADO",
          status_sheets: "DESACTIVADO"
        })
        .eq("id", saleId);
      return;
    }

    const { data: sale, error: fetchErr } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (
          id,
          nombre,
          email,
          telefono,
          pais,
          empresa,
          link_usuario_plataforma,
          ghl_contact_id
        ),
        setter_principal:usuarios_agencia!setter_principal_id (
          nombre
        ),
        closer_principal:usuarios_agencia!closer_principal_id (
          nombre
        )
      `)
      .eq("id", saleId)
      .single();

    if (fetchErr || !sale) {
      console.error(`[Automations] Error al obtener detalles de venta ${saleId}:`, fetchErr);
      return;
    }

    const clientInfo = sale.clientes;
    const setterName = sale.setter_principal?.nombre || "N/A";
    const closerName = sale.closer_principal?.nombre || "N/A";

    let settersExtrasNames: string[] = [];
    let closersExtrasNames: string[] = [];
    try {
      if (sale.setters_adicionales_ids && sale.setters_adicionales_ids.length > 0) {
        const { data: setts } = await supabase.from("usuarios_agencia").select("nombre").in("id", sale.setters_adicionales_ids);
        settersExtrasNames = setts?.map(s => s.nombre) || [];
      }
      if (sale.closers_adicionales_ids && sale.closers_adicionales_ids.length > 0) {
        const { data: closers } = await supabase.from("usuarios_agencia").select("nombre").in("id", sale.closers_adicionales_ids);
        closersExtrasNames = closers?.map(c => c.nombre) || [];
      }
    } catch (err) {
      console.error("[Automations] Error querying extra setters/closers:", err);
    }

    const fechaActual = new Date();
    const fechaVencimiento = new Date(fechaActual.getTime());
    fechaVencimiento.setHours(fechaVencimiento.getHours() + 27);
    fechaVencimiento.setMinutes(fechaVencimiento.getMinutes() + 1);

    const dueDateStr = fechaVencimiento.toISOString();

    let finalCodigoVenta = sale.codigo_venta;
    let contactId = "";
    let ghlError = null;

    if (sale.status_ghl !== "COMPLETADO") {
      try {
        await supabase.from("ventas").update({ status_ghl: "PROCESANDO" }).eq("id", saleId);
        console.log(`[Automations] Creando/Buscando Contacto en GHL`);
        contactId = await createGhlContact({
          name: clientInfo?.nombre || "Cliente",
          email: clientInfo?.email || undefined,
          phone: clientInfo?.telefono || undefined,
          companyName: clientInfo?.empresa || undefined,
          country: clientInfo?.pais || undefined
        });

        if (contactId && sale.cliente_id) {
          await supabase
            .from("clientes")
            .update({ ghl_contact_id: contactId })
            .eq("id", sale.cliente_id);
          console.log(`[Automations] Guardado ghl_contact_id: ${contactId} en cliente: ${sale.cliente_id}`);
        }

        console.log(`[Automations] Contacto creado/actualizado con ID: ${contactId} en GHL (se disparará workflow mediante la etiqueta 'nueva_venta').`);
        
        await supabase
          .from("ventas")
          .update({
            status_ghl: "COMPLETADO"
          })
          .eq("id", saleId);

      } catch (e: any) {
        ghlError = e.message || "Excepción en GHL API";
        console.error(`[Automations] Error en GHL (Contacto/Factura):`, e);
        await supabase.from("ventas").update({ status_ghl: "ERROR" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] GHL ya estaba completado, saltando.`);
    }

    let dropboxUrlLink = sale.carpeta_dropbox;

    if (sale.status_dropbox !== "COMPLETADO") {
      try {
        await supabase.from("ventas").update({ status_dropbox: "PROCESANDO" }).eq("id", saleId);
        console.log(`[Automations] Creando carpeta en Dropbox para ${clientInfo?.nombre || "Cliente"} - ${sale.proyecto_nombre}`);
        const dropboxRes = await createDropboxFolder(clientInfo?.nombre || "Cliente", sale.proyecto_nombre);

        if (dropboxRes.success && dropboxRes.path) {
          dropboxUrlLink = dropboxRes.url || dropboxRes.path;
          console.log(`[Automations] Dropbox completado. Path: ${dropboxRes.path}`);
          await supabase.from("ventas").update({ status_dropbox: "COMPLETADO", carpeta_dropbox: dropboxUrlLink }).eq("id", saleId);

          if (sale.status_trello === "COMPLETADO") {
            try {
              let cardId = "";
              if (sale.link_trello) {
                const match = sale.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
                if (match) cardId = match[1];
              }

              const { data: projDb } = await supabase
                .from("proyectos")
                .select("trello_card_id")
                .eq("venta_id", saleId)
                .maybeSingle();

              const finalCardId = projDb?.trello_card_id || cardId;

              if (finalCardId) {
                console.log(`[Automations] Dropbox completado y Trello ya estaba completado. Actualizando descripción de la tarjeta ${finalCardId}...`);
                const trelloDesc = `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""} \n\n  Brief: ${sale.proyecto_brief || "N/A"} \n Material: ${dropboxUrlLink} \n\n 🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos. Una evaluación rápida del proyecto nos puede asegurar un desarrollo más fluido y efectivo.${sale.descripcion_operativa ? `\n\n---\n\n${sale.descripcion_operativa}` : ""}`;
                await updateTrelloCardDesc(finalCardId, trelloDesc);
                console.log(`[Automations] Descripción de tarjeta de Trello actualizada con el link de Dropbox.`);
              }
            } catch (trelloUpdateErr) {
              console.error("[Automations] Error al actualizar descripción de Trello pos-Dropbox:", trelloUpdateErr);
            }
          }
        } else {
          console.error(`[Automations] Dropbox error: ${dropboxRes.error}`);
          await supabase.from("ventas").update({ status_dropbox: "ERROR" }).eq("id", saleId);
        }
      } catch (e: any) {
        console.error(`[Automations] Dropbox excepción:`, e);
        await supabase.from("ventas").update({ status_dropbox: "ERROR" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] Dropbox ya estaba completado, saltando.`);
    }

    let trelloUrl = sale.link_trello;
    let trelloCardId: string | null = null;

    if (sale.status_trello !== "COMPLETADO") {
      try {
        await supabase.from("ventas").update({ status_trello: "PROCESANDO" }).eq("id", saleId);
        console.log(`[Automations] Procesando tarjeta en Trello`);
        const trelloDesc = `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""} \n\n  Brief: ${sale.proyecto_brief || "N/A"} \n Material: ${dropboxUrlLink || "No creada"} \n\n 🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos. Una evaluación rápida del proyecto nos puede asegurar un desarrollo más fluido y efectivo.${sale.descripcion_operativa ? `\n\n---\n\n${sale.descripcion_operativa}` : ""}`;

        const trelloRes = await processTrelloCard({
          projectName: sale.proyecto_nombre,
          clientName: clientInfo?.nombre || "Cliente",
          desc: trelloDesc,
          urgent: sale.urgente,
          dueDateStr: dueDateStr,
          isExistingProject: sale.es_continuacion,
          montoStr: `${sale.monto_total} ${sale.moneda}`,
          tipoVenta: sale.tipo_venta
        });

        if (trelloRes.success && trelloRes.url) {
          trelloUrl = trelloRes.url;
          trelloCardId = trelloRes.id || null;
          console.log(`[Automations] Trello completado. URL: ${trelloUrl}`);
          await supabase.from("ventas").update({ status_trello: "COMPLETADO", link_trello: trelloUrl }).eq("id", saleId);
        } else {
          console.error(`[Automations] Trello error: ${trelloRes.error}`);
          await supabase.from("ventas").update({ status_trello: "ERROR" }).eq("id", saleId);
        }
      } catch (e: any) {
        console.error(`[Automations] Trello excepción:`, e);
        await supabase.from("ventas").update({ status_trello: "ERROR" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] Trello ya estaba completado, saltando.`);
    }

    const allSetters = [setterName, ...settersExtrasNames].filter(s => s && s !== "N/A");
    const allClosers = [closerName, ...closersExtrasNames].filter(c => c && c !== "N/A");
    const equipoParts = [];
    if (allSetters.length > 0) equipoParts.push(`Setters: ${allSetters.join(", ")}`);
    if (allClosers.length > 0) equipoParts.push(`Closers: ${allClosers.join(", ")}`);
    const equipoStr = equipoParts.join(" | ") || "Ninguno";

    if (sale.status_email !== "COMPLETADO") {
      try {
        console.log(`[Automations] Omitiendo envío directo de email, se ejecutará vía workflow en GHL para el contacto.`);
        await supabase.from("ventas").update({ status_email: "COMPLETADO" }).eq("id", saleId);
      } catch (e: any) {
        console.error(`[Automations] Error al actualizar status de email:`, e);
        await supabase.from("ventas").update({ status_email: "ERROR" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] Email ya estaba completado, saltando.`);
    }

    if (sale.status_whatsapp !== "COMPLETADO") {
      try {
        await supabase.from("ventas").update({ status_whatsapp: "PROCESANDO" }).eq("id", saleId);
        console.log(`[Automations] Enviando mensaje WhatsApp vía Zapier`);

        const zapierUrl = process.env.ZAPIER_WHATSAPP_WEBHOOK_URL;
        if (!zapierUrl) {
          throw new Error("ZAPIER_WHATSAPP_WEBHOOK_URL is not defined in environment variables.");
        }

        const zapierPayload = {
          titulo: "*NUEVA VENTA REGISTRADA*",
          plataforma: sale.plataforma || "",
          proyecto: sale.proyecto_nombre || "",
          cliente: clientInfo?.nombre || "Cliente",
          oferta: sale.oferta_presentada || sale.condiciones_acordadas || "N/A",
          equipo: equipoStr,
          monto: `${sale.monto_total} ${sale.moneda}`,
          factura: finalCodigoVenta
        };

        const zapierRes = await fetch(zapierUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(zapierPayload)
        });

        if (!zapierRes.ok) {
          const errText = await zapierRes.text();
          throw new Error(`Zapier webhook error ${zapierRes.status}: ${errText}`);
        }

        console.log(`[Automations] Zapier WhatsApp enviado exitosamente`);
        await supabase.from("ventas").update({ status_whatsapp: "COMPLETADO" }).eq("id", saleId);
      } catch (e: any) {
        console.error(`[Automations] Error en WhatsApp Zapier:`, e);
        await supabase.from("ventas").update({ status_whatsapp: "ERROR" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] WhatsApp ya estaba completado, saltando.`);
    }

    if (sale.status_sheets !== "COMPLETADO") {
      try {
        await supabase.from("ventas").update({ status_sheets: "PROCESANDO" }).eq("id", saleId);
        console.log(`[Automations] Enviando datos a Google Sheets`);
        const sheetsPayload = {
          status_pago: sale.status_pago,
          plataforma: sale.plataforma,
          codigo_venta: finalCodigoVenta,
          fecha_registro_formateada: new Date(sale.creado_en).toLocaleString("es-ES", { timeZone: "America/Caracas" }),
          cliente_nombre: clientInfo?.nombre || "Cliente",
          contact_id: contactId || sale.clientes?.ghl_contact_id || "",
          proyecto_nombre: sale.proyecto_nombre,
          monto_total: sale.monto_total,
          moneda: sale.moneda,
          setter_principal_nombre: setterName || "",
          setters_adicionales_nombres: settersExtrasNames || [],
          closer_principal_nombre: closerName || "",
          closers_adicionales_nombres: closersExtrasNames || [],
          comprobante_link: sale.comprobante_link || "",
          fecha_pago: sale.fecha_pago || ""
        };

        const sheetRes = await appendRowToSheet(sheetsPayload);
        if (!sheetRes.success) {
          throw new Error(sheetRes.error || "Error al insertar fila en Google Sheets");
        }
        await supabase.from("ventas").update({ status_sheets: "COMPLETADO" }).eq("id", saleId);
      } catch (e: any) {
        console.error(`[Automations] Sheets excepción:`, e);
        await supabase.from("ventas").update({ status_sheets: "ERROR" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] Google Sheets ya estaba completado, saltando.`);
    }

    try {
      console.log(`[Automations] Registrando/actualizando proyecto en base de datos`);
      const finalTrelloCardId = trelloCardId || (trelloUrl ? trelloUrl.match(/\/c\/([a-zA-Z0-9]+)/)?.[1] : null);

      const { data: existingProj } = await supabase
        .from("proyectos")
        .select("id")
        .eq("venta_id", saleId)
        .maybeSingle();

      const projectPayload = {
        nombre: sale.proyecto_nombre,
        cliente_id: sale.cliente_id,
        venta_id: saleId,
        trello_card_id: finalTrelloCardId || undefined,
        link_trello: trelloUrl || undefined,
        carpeta_dropbox: dropboxUrlLink || undefined,
        activo: true,
        actualizado_en: new Date().toISOString()
      };

      if (existingProj) {
        await supabase
          .from("proyectos")
          .update(projectPayload)
          .eq("id", existingProj.id);
        console.log(`[Automations] Proyecto actualizado en BD: ${existingProj.id}`);
      } else {
        const { data: newProj, error: insertProjErr } = await supabase
          .from("proyectos")
          .insert([{
            ...projectPayload,
            creado_en: new Date().toISOString()
          }])
          .select();
        if (insertProjErr) {
          console.error("[Automations] Error al insertar proyecto en BD:", insertProjErr);
        } else {
          console.log(`[Automations] Proyecto registrado en BD exitosamente`);
        }
      }
    } catch (e: any) {
      console.error(`[Automations] Error al persistir proyecto en BD:`, e);
    }

    console.log(`[Automations] Finalizadas todas las automatizaciones para venta ID: ${saleId}`);
  } catch (err) {
    console.error("[Automations] Error general en el hilo secundario:", err);
  }
}
