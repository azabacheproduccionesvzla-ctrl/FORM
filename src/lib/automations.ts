import { supabase } from "@/lib/supabase";
import { createDropboxFolder } from "@/lib/dropbox";
import { processTrelloCard, updateTrelloCardDesc, addTrelloCardComment } from "@/lib/trello";
import { createGhlContact, createGhlInvoice, sendGhlMessage } from "@/lib/ghl";
import { getIntegrationConfig } from "@/lib/config_service";
import { updateLocalWorkspaceSheet, getComision, formatExcelDate } from "@/lib/local_sheets";
import { addSaleLog } from "@/lib/logs";
import { appendRowToSheet } from "@/lib/sheets";

function buildManualsInfoText(sale: any): string {
  let list: Array<{ rama: string; categoria: string; servicio: string; enlace: string }> = [];

  if (Array.isArray(sale.manuales_servicios) && sale.manuales_servicios.length > 0) {
    list = sale.manuales_servicios;
  } else if (typeof sale.manuales_servicios === "string") {
    try {
      const parsed = JSON.parse(sale.manuales_servicios);
      if (Array.isArray(parsed) && parsed.length > 0) list = parsed;
    } catch (e) {}
  }

  if (list.length === 0 && sale.manual_servicio) {
    list = [{
      rama: sale.manual_rama || "N/A",
      categoria: sale.manual_categoria || "N/A",
      servicio: sale.manual_servicio || "N/A",
      enlace: sale.manual_enlace || ""
    }];
  }

  if (list.length === 0) return "";

  if (list.length === 1) {
    const s = list[0];
    return ` \n\n**Manual de Servicio:**\n- **Rama:** ${s.rama}\n- **Categoría:** ${s.categoria}\n- **Servicio:** ${s.servicio}${s.enlace ? `\n- **Enlace de manual:** ${s.enlace}` : ""}`;
  }

  const itemsText = list.map(s => 
    `• **${s.servicio}** (${s.rama} / ${s.categoria})${s.enlace ? `\n  - Enlace de manual: ${s.enlace}` : ""}`
  ).join("\n");

  return ` \n\n**Servicios de Producción Adquiridos (${list.length}):**\n${itemsText}`;
}

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
          status_ghl_contacto: "DESACTIVADO",
          status_ghl_factura: "DESACTIVADO",
          status_dropbox: "DESACTIVADO",
          status_trello: "DESACTIVADO",
          status_email: "DESACTIVADO",
          status_whatsapp: "DESACTIVADO",
          status_sheets: "DESACTIVADO"
        })
        .eq("id", saleId);

      await addSaleLog(saleId, "GHL Contacto", "INFO", "Integraciones automáticas desactivadas de forma global.");
      await addSaleLog(saleId, "GHL Factura", "INFO", "Integraciones automáticas desactivadas de forma global.");
      await addSaleLog(saleId, "Dropbox", "INFO", "Integraciones automáticas desactivadas de forma global.");
      await addSaleLog(saleId, "Trello", "INFO", "Integraciones automáticas desactivadas de forma global.");
      await addSaleLog(saleId, "Email", "INFO", "Integraciones automáticas desactivadas de forma global.");
      await addSaleLog(saleId, "WhatsApp", "INFO", "Integraciones automáticas desactivadas de forma global.");
      await addSaleLog(saleId, "Cuadro Maestro", "INFO", "Integraciones automáticas desactivadas de forma global.");
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

    // Identificar si es una extensión
    const isExtension = (sale.es_continuacion && sale.tipo_continuacion === "extension") || sale.tipo_venta === "Extensión de Proyecto";

    // Buscar información del proyecto en base de datos para recuperar recursos existentes
    let projectDb = null;
    try {
      if (sale.es_continuacion && sale.proyecto_previo_id) {
        const { data: projPrev } = await supabase
          .from("proyectos")
          .select("id, trello_card_id, link_trello, carpeta_dropbox")
          .eq("venta_id", sale.proyecto_previo_id)
          .maybeSingle();
        projectDb = projPrev;
      }
      
      if (!projectDb) {
        const { data: projCurrent } = await supabase
          .from("proyectos")
          .select("id, trello_card_id, link_trello, carpeta_dropbox")
          .eq("venta_id", saleId)
          .maybeSingle();
        projectDb = projCurrent;
      }
    } catch (err) {
      console.error("[Automations] Error fetching related project:", err);
    }

    const fechaActual = new Date();
    const fechaVencimiento = new Date(fechaActual.getTime());
    fechaVencimiento.setHours(fechaVencimiento.getHours() + 27);
    fechaVencimiento.setMinutes(fechaVencimiento.getMinutes() + 1);

    const dueDateStr = fechaVencimiento.toISOString();

    let finalCodigoFactura = sale.codigo_factura || "";
    let contactId = clientInfo?.ghl_contact_id || "";

    // 1. GHL Contacto
    if (sale.status_ghl_contacto !== "COMPLETADO") {
      if (config.ghl_factura) {
        try {
          await addSaleLog(saleId, "GHL Contacto", "INFO", "Iniciando búsqueda o creación de contacto en GoHighLevel...");
          await supabase.from("ventas").update({ status_ghl_contacto: "PROCESANDO" }).eq("id", saleId);
          
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
            await addSaleLog(saleId, "GHL Contacto", "SUCCESS", `Contacto sincronizado exitosamente con ID: ${contactId}`);
          } else {
            await addSaleLog(saleId, "GHL Contacto", "SUCCESS", "Contacto verificado en GoHighLevel.");
          }

          await supabase.from("ventas").update({ status_ghl_contacto: "COMPLETADO" }).eq("id", saleId);
        } catch (e: any) {
          const errorMsg = e.message || "Excepción en GHL Contact API";
          await addSaleLog(saleId, "GHL Contacto", "ERROR", `Error al sincronizar contacto: ${errorMsg}`);
          await supabase.from("ventas").update({ status_ghl_contacto: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "GHL Contacto", "INFO", "La integración de GoHighLevel está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_ghl_contacto: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "GHL Contacto", "INFO", "El contacto en GHL ya estaba completado, saltando.");
    }

    // 2. GHL Factura
    if (sale.status_ghl_factura !== "COMPLETADO") {
      if (config.ghl_factura) {
        try {
          await addSaleLog(saleId, "GHL Factura", "INFO", "Iniciando generación de factura borrador en GoHighLevel...");
          await supabase.from("ventas").update({ status_ghl_factura: "PROCESANDO" }).eq("id", saleId);

          const finalContactId = contactId || clientInfo?.ghl_contact_id;
          if (!finalContactId) {
            throw new Error("No se dispone de un ID de contacto de GHL válido para crear la factura.");
          }

          const invoiceData = await createGhlInvoice(finalContactId, {
            projectName: sale.proyecto_nombre,
            amount: sale.monto_total,
            currency: sale.moneda || "usd",
            description: sale.descripcion_operativa || undefined,
            contactName: clientInfo?.nombre || "Cliente",
            contactEmail: clientInfo?.email || undefined
          });

          if (invoiceData) {
            finalCodigoFactura = invoiceData.invoiceNumber;
            await addSaleLog(saleId, "GHL Factura", "SUCCESS", `Factura creada con éxito. Número de factura: ${finalCodigoFactura}`);
            await supabase
              .from("ventas")
              .update({
                codigo_factura: finalCodigoFactura,
                status_ghl_factura: "COMPLETADO"
              })
              .eq("id", saleId);
          } else {
            throw new Error("La respuesta de facturación de GHL no retornó datos de factura válidos.");
          }
        } catch (e: any) {
          const errorMsg = e.message || "Excepción en GHL Invoice API";
          await addSaleLog(saleId, "GHL Factura", "ERROR", `Error al generar factura: ${errorMsg}`);
          await supabase.from("ventas").update({ status_ghl_factura: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "GHL Factura", "INFO", "La integración de GoHighLevel está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_ghl_factura: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "GHL Factura", "INFO", "La factura en GHL ya estaba completada, saltando.");
    }

    let dropboxUrlLink = sale.carpeta_dropbox;

    // 3. Dropbox
    if (sale.status_dropbox !== "COMPLETADO") {
      if (config.dropbox) {
        try {
          if (isExtension) {
            dropboxUrlLink = projectDb?.carpeta_dropbox || sale.carpeta_dropbox || "";
            await addSaleLog(saleId, "Dropbox", "INFO", "Proyecto es una extensión. Usando carpeta existente y saltando creación.");
            await supabase.from("ventas").update({ status_dropbox: "COMPLETADO", carpeta_dropbox: dropboxUrlLink }).eq("id", saleId);
          } else {
            await addSaleLog(saleId, "Dropbox", "INFO", `Creando carpeta en Dropbox para: ${clientInfo?.nombre || "Cliente"} - ${sale.proyecto_nombre}`);
            await supabase.from("ventas").update({ status_dropbox: "PROCESANDO" }).eq("id", saleId);
            const dropboxRes = await createDropboxFolder(clientInfo?.nombre || "Cliente", sale.proyecto_nombre);

            if (dropboxRes.success && dropboxRes.path) {
              dropboxUrlLink = dropboxRes.url || dropboxRes.path;
              await addSaleLog(saleId, "Dropbox", "SUCCESS", `Carpeta creada exitosamente. Enlace: ${dropboxUrlLink}`);
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
                    await addSaleLog(saleId, "Trello", "INFO", "Dropbox completado pos-Trello. Actualizando descripción de tarjeta...");
                    const modoTrabajoUrl = sale.urgente
                      ? "https://gamma.app/docs/h2z3grt8tqs0vql"
                      : "https://gamma.app/docs/Flujo-de-Proyecto-Regular-fmerjwxrcvffc03";
                    const manualInfo = buildManualsInfoText(sale);
                    const trelloDesc = `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""}\nModo de Trabajo: ${modoTrabajoUrl}\nBrief: ${sale.proyecto_brief || "N/A"}\nMaterial: ${dropboxUrlLink}${manualInfo}\n\n🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos. Una evaluación rápida del proyecto nos puede asegurar un desarrollo más fluido y efectivo.${sale.descripcion_operativa ? `\n\n---\n\n${sale.descripcion_operativa}` : ""}`;
                    await updateTrelloCardDesc(finalCardId, trelloDesc);
                    await addSaleLog(saleId, "Trello", "SUCCESS", "Descripción de tarjeta de Trello actualizada con enlace de Dropbox.");
                  }
                } catch (trelloUpdateErr: any) {
                  console.error("[Automations] Error al actualizar descripción de Trello pos-Dropbox:", trelloUpdateErr);
                  await addSaleLog(saleId, "Trello", "ERROR", `Fallo al actualizar descripción post-Dropbox: ${trelloUpdateErr.message}`);
                }
              }
            } else {
              await addSaleLog(saleId, "Dropbox", "ERROR", `Error de Dropbox: ${dropboxRes.error}`);
              await supabase.from("ventas").update({ status_dropbox: "ERROR" }).eq("id", saleId);
            }
          }
        } catch (e: any) {
          await addSaleLog(saleId, "Dropbox", "ERROR", `Excepción al procesar Dropbox: ${e.message}`);
          await supabase.from("ventas").update({ status_dropbox: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "Dropbox", "INFO", "La integración con Dropbox está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_dropbox: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "Dropbox", "INFO", "La carpeta de Dropbox ya estaba completada, saltando.");
    }

    let trelloUrl = sale.link_trello;
    let trelloCardId: string | null = null;

    // 4. Trello
    if (sale.status_trello !== "COMPLETADO") {
      if (config.trello) {
        try {
          if (isExtension) {
            await addSaleLog(saleId, "Trello", "INFO", "Proyecto es una extensión. Buscando tarjeta de Trello previa para agregar comentario...");
            await supabase.from("ventas").update({ status_trello: "PROCESANDO" }).eq("id", saleId);

            const finalTrelloCardId = projectDb?.trello_card_id || 
                                      (projectDb?.link_trello ? projectDb.link_trello.match(/\/c\/([a-zA-Z0-9]+)/)?.[1] : null) ||
                                      (sale.link_trello ? sale.link_trello.match(/\/c\/([a-zA-Z0-9]+)/)?.[1] : null);

            if (finalTrelloCardId) {
              const manualInfo = buildManualsInfoText(sale);
              const notas = sale.notas_internas ? ` - ${sale.notas_internas}` : "";
              const horasInfo = sale.tipo_proyecto === "Por Hora"
                ? "\n- **Modalidad:** Por Hora"
                : "";
              const aviso = "\n\n🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos.";
              const commentText = `Extensión del proyecto${notas}${horasInfo}${manualInfo}${aviso}`;
              const commentRes = await addTrelloCardComment(finalTrelloCardId, commentText);

              if (commentRes.success) {
                trelloUrl = projectDb?.link_trello || sale.link_trello || `https://trello.com/c/${finalTrelloCardId}`;
                trelloCardId = finalTrelloCardId;
                await addSaleLog(saleId, "Trello", "SUCCESS", `Comentario de extensión agregado con éxito en tarjeta: ${trelloUrl}`);
                await supabase.from("ventas").update({ status_trello: "COMPLETADO", link_trello: trelloUrl }).eq("id", saleId);
              } else {
                throw new Error(`Error de Trello al añadir comentario: ${commentRes.error}`);
              }
            } else {
              throw new Error("No se encontró ID de tarjeta de Trello previa para agregar el comentario de la extensión.");
            }
          } else {
            await addSaleLog(saleId, "Trello", "INFO", "Creando tarjeta de operaciones en Trello...");
            await supabase.from("ventas").update({ status_trello: "PROCESANDO" }).eq("id", saleId);
            const modoTrabajoUrl = sale.urgente
              ? "https://gamma.app/docs/h2z3grt8tqs0vql"
              : "https://gamma.app/docs/Flujo-de-Proyecto-Regular-fmerjwxrcvffc03";
            const manualInfo = buildManualsInfoText(sale);
            const trelloDesc = `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""}\nModo de Trabajo: ${modoTrabajoUrl}\nBrief: ${sale.proyecto_brief || "N/A"}\nMaterial: ${dropboxUrlLink || "No creada"}${manualInfo}\n\n🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos. Una evaluación rápida del proyecto nos puede asegurar un desarrollo más fluido y efectivo.${sale.descripcion_operativa ? `\n\n---\n\n${sale.descripcion_operativa}` : ""}`;

            const trelloRes = await processTrelloCard({
              projectName: sale.proyecto_nombre,
              clientName: clientInfo?.nombre || "Cliente",
              desc: trelloDesc,
              urgent: sale.urgente,
              dueDateStr: dueDateStr,
              isExistingProject: sale.es_continuacion,
              montoStr: `${sale.monto_total} ${sale.moneda}`,
              tipoVenta: sale.tipo_venta,
              trelloMembers: config.trello_default_members,
              plataforma: sale.plataforma
            });

            if (trelloRes.success && trelloRes.url) {
              trelloUrl = trelloRes.url;
              trelloCardId = trelloRes.id || null;
              await addSaleLog(saleId, "Trello", "SUCCESS", `Tarjeta creada exitosamente en Trello. URL: ${trelloUrl}`);
              await supabase.from("ventas").update({ status_trello: "COMPLETADO", link_trello: trelloUrl }).eq("id", saleId);
            } else {
              await addSaleLog(saleId, "Trello", "ERROR", `Error de Trello: ${trelloRes.error}`);
              await supabase.from("ventas").update({ status_trello: "ERROR" }).eq("id", saleId);
            }
          }
        } catch (e: any) {
          await addSaleLog(saleId, "Trello", "ERROR", `Excepción al procesar Trello: ${e.message}`);
          await supabase.from("ventas").update({ status_trello: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "Trello", "INFO", "La integración con Trello está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_trello: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "Trello", "INFO", "La tarjeta en Trello ya estaba completada, saltando.");
    }

    const allSetters = [setterName, ...settersExtrasNames].filter(s => s && s !== "N/A");
    const allClosers = [closerName, ...closersExtrasNames].filter(c => c && c !== "N/A");
    const equipoParts = [];
    if (allSetters.length > 0) equipoParts.push(`Setters: ${allSetters.join(", ")}`);
    if (allClosers.length > 0) equipoParts.push(`Closers: ${allClosers.join(", ")}`);
    const equipoStr = equipoParts.join(" | ") || "Ninguno";

    // 5. Email Notificación
    if (sale.status_email !== "COMPLETADO") {
      if (config.ghl_email) {
        try {
          await addSaleLog(saleId, "Email", "INFO", "Preparando envío de email de notificación al equipo...");
          await supabase.from("ventas").update({ status_email: "PROCESANDO" }).eq("id", saleId);

          const emailsConfigStr = config.email_destinatarios || process.env.NOTIFICACION_EMAIL_DESTINATARIOS || "alvarezchristopherve@gmail.com";
          const teamEmails = emailsConfigStr
            .split(",")
            .map(e => e.trim())
            .filter(Boolean);

          const emailTemplate = `<div style="background-color:#f4f5f7;padding:30px 15px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;color:#24292e"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e1e4e8;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);overflow:hidden"><div style="padding:25px 30px;border-bottom:1px solid #e1e4e8;background-color:#fafbfc"><h2 style="margin: 0;color: #24292e;font-size: 20px;font-weight: 600;letter-spacing: -0.5px;"><strong>Nueva Venta Registrada</strong></h2></div><div style="padding:30px 30px 10px 30px"><div style="margin-bottom:20px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;color: #586069;text-transform: uppercase;letter-spacing: 0.5px;font-weight: 600;"><strong>Proyecto</strong></p><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;font-weight: 600;color: #24292e;"><strong>{{PROYECTO_NOMBRE}}</strong></p></div><div style="display:table;width:100%;margin-bottom:20px"><div style="display:table-cell;width:50%"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;color: #586069;text-transform: uppercase;letter-spacing: 0.5px;font-weight: 600;"><strong>Cliente</strong></p><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;font-weight: 500;"><strong>{{CLIENTE_NOMBRE}}</strong></p></div><div style="display:table-cell;width:50%"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;font-weight: 500;color: #22863a;"><strong>{{MONTO}}</strong></p></div></div></div><div style="padding-left: 30px!important;; padding-left:30px!important;padding-left:30px!important;margin:0 30px;border-top:1px solid #e1e4e8"></div><div style="padding:10px 0 20px 0"><table style="width:100%;border-collapse:collapse;margin:0"><tbody><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;width:45%;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Plataforma</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;width:55%;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{PLATAFORMA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Tipo de Proyecto</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{TIPO_PROYECTO}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Tipo de Venta</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{TIPO_VENTA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Tarjeta Trello</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{TRELLO_LINK}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Código de Venta</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{CODIGO_VENTA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Factura GHL</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{CODIGO_FACTURA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Oferta de</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{OFERTA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Equipo de Cierre</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{EQUIPO}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;color:#586069;font-size:13px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Registro</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;color:#586069;font-weight:400;font-size:13px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">{{FECHA_REGISTRO}}</p></td></tr></tbody></table></div></div></div>`;

          const trelloLinkVal = trelloUrl ? `<a href="${trelloUrl}" target="_blank" style="color: #0052cc; text-decoration: underline;">Ver Tarjeta</a>` : "No generada";

          const compiledHtml = emailTemplate
            .replace("{{PROYECTO_NOMBRE}}", sale.proyecto_nombre || "")
            .replace("{{CLIENTE_NOMBRE}}", clientInfo?.nombre || "Cliente")
            .replace("{{MONTO}}", `${sale.monto_total} ${sale.moneda}`)
            .replace("{{PLATAFORMA}}", sale.plataforma || "")
            .replace("{{TIPO_PROYECTO}}", `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""}`)
            .replace("{{TIPO_VENTA}}", sale.tipo_venta || "")
            .replace("{{TRELLO_LINK}}", trelloLinkVal)
            .replace("{{CODIGO_FACTURA}}", finalCodigoFactura || "No disponible")
            .replace("{{CODIGO_VENTA}}", sale.codigo_venta || "")
            .replace("{{OFERTA}}", sale.oferta_presentada || sale.condiciones_acordadas || "N/A")
            .replace("{{EQUIPO}}", equipoStr)
            .replace("{{FECHA_REGISTRO}}", new Date(sale.creado_en).toLocaleString("es-ES"));

          for (const email of teamEmails) {
            await addSaleLog(saleId, "Email", "INFO", `Despachando correo a destinatario: ${email}`);
            const teamContactId = await createGhlContact({
              name: "Notificaciones Azabache",
              email: email
            });

            await sendGhlMessage(
              teamContactId,
              "Email",
              compiledHtml,
              `Nueva Venta Registrada - ${sale.proyecto_nombre}`
            );
            await addSaleLog(saleId, "Email", "SUCCESS", `Email enviado correctamente a: ${email}`);
          }

          await supabase.from("ventas").update({ status_email: "COMPLETADO" }).eq("id", saleId);
        } catch (e: any) {
          await addSaleLog(saleId, "Email", "ERROR", `Error de correo GHL: ${e.message}`);
          await supabase.from("ventas").update({ status_email: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "Email", "INFO", "La integración de Email de Notificación está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_email: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "Email", "INFO", "La notificación de Email ya estaba completada, saltando.");
    }

    // 6. WhatsApp (Zapier)
    if (sale.status_whatsapp !== "COMPLETADO") {
      if (config.zapier_whatsapp) {
        try {
          await addSaleLog(saleId, "WhatsApp", "INFO", "Enviando alerta a WhatsApp grupal mediante Zapier Webhook...");
          await supabase.from("ventas").update({ status_whatsapp: "PROCESANDO" }).eq("id", saleId);

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
            factura: finalCodigoFactura || "No disponible",
            codigo_venta: sale.codigo_venta
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

          await addSaleLog(saleId, "WhatsApp", "SUCCESS", "Mensaje de WhatsApp notificado con éxito vía Zapier.");
          await supabase.from("ventas").update({ status_whatsapp: "COMPLETADO" }).eq("id", saleId);
        } catch (e: any) {
          await addSaleLog(saleId, "WhatsApp", "ERROR", `Fallo al enviar WhatsApp: ${e.message}`);
          await supabase.from("ventas").update({ status_whatsapp: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "WhatsApp", "INFO", "La integración de WhatsApp (Zapier) está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_whatsapp: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "WhatsApp", "INFO", "La notificación de WhatsApp ya estaba completada, saltando.");
    }

    // 7. Cuadro Maestro (Local & Online Sheets)
    if (sale.status_sheets !== "COMPLETADO") {
      if (config.google_sheets) {
        try {
          await addSaleLog(saleId, "Cuadro Maestro", "INFO", "Sincronizando datos en Cuadro Maestro local (archivo CSV) y Google Sheets online...");
          await supabase.from("ventas").update({ status_sheets: "PROCESANDO" }).eq("id", saleId);
          
          // 1. Sincronización local
          await updateLocalWorkspaceSheet();

          // 2. Sincronización online (Google Sheets Webhook)
          const sheetsPayload = {
            etapa: (sale.status_pago || "PAGO ADELANTADO").toUpperCase(),
            plataforma: sale.plataforma,
            codigo_venta: sale.codigo_venta,
            fecha_inicio: formatExcelDate(sale.creado_en),
            cliente: clientInfo?.nombre || "Cliente",
            codigo_cliente: clientInfo?.ghl_contact_id || "",
            proyecto: sale.proyecto_nombre,
            monto_cc: sale.monto_total || 0,
            comision: getComision(sale.plataforma),
            setter_1: setterName,
            setter_2: settersExtrasNames.length > 0 ? settersExtrasNames[0] : "",
            closer_1: closerName,
            closer_2: closersExtrasNames.length > 0 ? closersExtrasNames[0] : "",
            closer_3: closersExtrasNames.length > 1 ? closersExtrasNames[1] : "",
            factura: sale.comprobante_link,
            fecha_pago: sale.fecha_pago || ""
          };

          const sheetsResult = await appendRowToSheet(sheetsPayload);
          if (!sheetsResult.success) {
            throw new Error(`Google Sheets Online error: ${sheetsResult.error}`);
          }

          await addSaleLog(saleId, "Cuadro Maestro", "SUCCESS", "Datos agregados y sincronizados correctamente en Cuadro Maestro local y Google Sheets online.");
          await supabase.from("ventas").update({ status_sheets: "COMPLETADO" }).eq("id", saleId);
        } catch (e: any) {
          await addSaleLog(saleId, "Cuadro Maestro", "ERROR", `Error de sincronización: ${e.message}`);
          await supabase.from("ventas").update({ status_sheets: "ERROR" }).eq("id", saleId);
        }
      } else {
        await addSaleLog(saleId, "Cuadro Maestro", "INFO", "La integración con Cuadro Maestro está desactivada en ajustes.");
        await supabase.from("ventas").update({ status_sheets: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      await addSaleLog(saleId, "Cuadro Maestro", "INFO", "La sincronización del Cuadro Maestro ya estaba completada, saltando.");
    }

    // Registrar proyecto
    try {
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
      } else {
        await supabase
          .from("proyectos")
          .insert([{
            ...projectPayload,
            creado_en: new Date().toISOString()
          }]);
      }
    } catch (e: any) {
      console.error(`[Automations] Error al persistir proyecto en BD:`, e);
    }

    try {
      await updateLocalWorkspaceSheet();
    } catch (localSheetErr) {
      console.error("[Automations] Error al sincronizar Cuadro Maestro local:", localSheetErr);
    }

    console.log(`[Automations] Finalizadas todas las automatizaciones para venta ID: ${saleId}`);
  } catch (err) {
    console.error("[Automations] Error general en el hilo secundario:", err);
  }
}
