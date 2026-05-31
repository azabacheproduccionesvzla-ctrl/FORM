import { supabase } from "@/lib/supabase";
import { createDropboxFolder } from "@/lib/dropbox";
import { processTrelloCard } from "@/lib/trello";
import { createGhlContact, createGhlInvoice, sendGhlMessage } from "@/lib/ghl";
import { appendRowToSheet } from "@/lib/sheets";
import { getIntegrationConfig } from "@/lib/config_service";

export async function runVentasAutomations(saleId: string) {
  try {
    console.log(`[Automations] Iniciando automatizaciones para venta ID: ${saleId}`);

    const config = await getIntegrationConfig();

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
      if (config.ghl_factura) {
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

          console.log(`[Automations] Contacto creado con ID: ${contactId}. Generando Factura...`);
          const invoiceData = await createGhlInvoice(contactId, {
            projectName: sale.proyecto_nombre,
            amount: sale.monto_total,
            currency: sale.moneda || "usd",
            description: sale.descripcion_operativa || undefined
          });

          finalCodigoVenta = invoiceData.invoiceNumber;
          console.log(`[Automations] Factura creada. Nuevo código de venta: ${finalCodigoVenta}`);

          await supabase
            .from("ventas")
            .update({
              codigo_venta: finalCodigoVenta,
              status_ghl: "COMPLETADO"
            })
            .eq("id", saleId);

        } catch (e: any) {
          ghlError = e.message || "Excepción en GHL API";
          console.error(`[Automations] Error en GHL (Contacto/Factura):`, e);
          await supabase.from("ventas").update({ status_ghl: "ERROR" }).eq("id", saleId);
        }
      } else {
        console.log(`[Automations] Integración GHL Factura desactivada, marcando como DESACTIVADO.`);
        await supabase.from("ventas").update({ status_ghl: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] GHL ya estaba completado, saltando.`);
    }

    let dropboxUrlLink = sale.carpeta_dropbox;

    if (sale.status_dropbox !== "COMPLETADO") {
      if (config.dropbox) {
        try {
          await supabase.from("ventas").update({ status_dropbox: "PROCESANDO" }).eq("id", saleId);
          console.log(`[Automations] Creando carpeta en Dropbox para ${clientInfo?.nombre || ""} ${sale.proyecto_nombre}`);
          const dropboxRes = await createDropboxFolder(clientInfo?.nombre || "Cliente", `${finalCodigoVenta} - ${sale.proyecto_nombre}`);

          if (dropboxRes.success && dropboxRes.path) {
            dropboxUrlLink = dropboxRes.url || dropboxRes.path;
            console.log(`[Automations] Dropbox completado. Path: ${dropboxRes.path}`);
            await supabase.from("ventas").update({ status_dropbox: "COMPLETADO", carpeta_dropbox: dropboxUrlLink }).eq("id", saleId);
          } else {
            console.error(`[Automations] Dropbox error: ${dropboxRes.error}`);
            await supabase.from("ventas").update({ status_dropbox: "ERROR" }).eq("id", saleId);
          }
        } catch (e: any) {
          console.error(`[Automations] Dropbox excepción:`, e);
          await supabase.from("ventas").update({ status_dropbox: "ERROR" }).eq("id", saleId);
        }
      } else {
        console.log(`[Automations] Integración Dropbox desactivada, marcando como DESACTIVADO.`);
        await supabase.from("ventas").update({ status_dropbox: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] Dropbox ya estaba completado, saltando.`);
    }

    let trelloUrl = sale.link_trello;
    let trelloCardId: string | null = null;

    if (sale.status_trello !== "COMPLETADO") {
      if (config.trello) {
        try {
          await supabase.from("ventas").update({ status_trello: "PROCESANDO" }).eq("id", saleId);
          console.log(`[Automations] Procesando tarjeta en Trello`);
          const trelloDesc = `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""} \n\n  Brief: ${sale.proyecto_brief || "N/A"} \n Material: ${dropboxUrlLink || "No creada"} \n\n 🔔 Recuerda que, si necesitas algo o tienes dudas, puedes avisarnos. Una evaluación rápida del proyecto nos puede asegurar un desarrollo más fluido y efectivo.`;

          const trelloRes = await processTrelloCard({
            projectName: `${finalCodigoVenta} - ${sale.proyecto_nombre}`,
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
        console.log(`[Automations] Integración Trello desactivada, marcando como DESACTIVADO.`);
        await supabase.from("ventas").update({ status_trello: "DESACTIVADO" }).eq("id", saleId);
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
      if (config.ghl_email) {
        try {
          await supabase.from("ventas").update({ status_email: "PROCESANDO" }).eq("id", saleId);
          console.log(`[Automations] Enviando notificación de email al equipo`);

          const teamEmails = (process.env.NOTIFICACION_EMAIL_DESTINATARIOS || "alvarezchristopherve@gmail.com")
            .split(",")
            .map(e => e.trim())
            .filter(Boolean);

          const emailTemplate = `<div style="background-color:#f4f5f7;padding:30px 15px;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;color:#24292e"><div style="max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #e1e4e8;border-radius:8px;box-shadow:0 1px 3px rgba(0,0,0,0.05);overflow:hidden"><div style="padding:25px 30px;border-bottom:1px solid #e1e4e8;background-color:#fafbfc"><h2 style="margin: 0;color: #24292e;font-size: 20px;font-weight: 600;letter-spacing: -0.5px;"><strong>Nueva Venta Registrada</strong></h2></div><div style="padding:30px 30px 10px 30px"><div style="margin-bottom:20px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;color: #586069;text-transform: uppercase;letter-spacing: 0.5px;font-weight: 600;"><strong>Proyecto</strong></p><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;font-weight: 600;color: #24292e;"><strong>{{PROYECTO_NOMBRE}}</strong></p></div><div style="display:table;width:100%;margin-bottom:20px"><div style="display:table-cell;width:50%"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;color: #586069;text-transform: uppercase;letter-spacing: 0.5px;font-weight: 600;"><strong>Cliente</strong></p><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;font-weight: 500;"><strong>{{CLIENTE_NOMBRE}}</strong></p></div><div style="display:table-cell;width:50%"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;color: #586069;text-transform: uppercase;letter-spacing: 0.5px;font-weight: 600;"><strong>Monto</strong></p><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;font-weight: 500;color: #22863a;"><strong>{{MONTO}}</strong></p></div></div></div><div style="padding-left: 30px!important;; padding-left:30px!important;padding-left:30px!important;margin:0 30px;border-top:1px solid #e1e4e8"></div><div style="padding:10px 0 20px 0"><table style="width:100%;border-collapse:collapse;margin:0"><tbody><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;width:45%;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Plataforma</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;width:55%;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{PLATAFORMA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Tipo de Proyecto</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{TIPO_PROYECTO}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Tipo de Venta</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{TIPO_VENTA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Tarjeta Trello</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{TRELLO_LINK}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Oferta de</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{OFERTA}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#586069;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Equipo de Cierre</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;border-bottom:1px solid #f0f3f6;color:#24292e;font-weight:500;font-size:14px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;"><strong>{{EQUIPO}}</strong></p></td></tr><tr><td colspan="1" rowspan="1" style="padding:15px 30px;color:#586069;font-size:13px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">Registro</p></td><td colspan="1" rowspan="1" style="padding:15px 30px;color:#586069;font-weight:400;font-size:13px"><p style="margin:0px;font-family:verdana,geneva,sans-serif;font-size:16px; margin: 0px;font-family: verdana,geneva,sans-serif;font-size: 16px;">{{FECHA_REGISTRO}}</p></td></tr></tbody></table></div></div></div>`;

          const trelloLinkVal = trelloUrl ? `<a href="${trelloUrl}" target="_blank" style="color: #0052cc; text-decoration: underline;">Ver Tarjeta</a>` : "No generada";

          const compiledHtml = emailTemplate
            .replace("{{PROYECTO_NOMBRE}}", sale.proyecto_nombre || "")
            .replace("{{CLIENTE_NOMBRE}}", clientInfo?.nombre || "Cliente")
            .replace("{{MONTO}}", `${sale.monto_total} ${sale.moneda}`)
            .replace("{{PLATAFORMA}}", sale.plataforma || "")
            .replace("{{TIPO_PROYECTO}}", `${sale.tipo_proyecto}${sale.tipo_proyecto_otro ? ` (${sale.tipo_proyecto_otro})` : ""}`)
            .replace("{{TIPO_VENTA}}", sale.tipo_venta || "")
            .replace("{{TRELLO_LINK}}", trelloLinkVal)
            .replace("{{OFERTA}}", sale.oferta_presentada || sale.condiciones_acordadas || "N/A")
            .replace("{{EQUIPO}}", equipoStr)
            .replace("{{FECHA_REGISTRO}}", new Date(sale.creado_en).toLocaleString("es-ES"));

          for (const email of teamEmails) {
            console.log(`[Automations] Enviando email de equipo a: ${email}`);
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
          }

          await supabase.from("ventas").update({ status_email: "COMPLETADO" }).eq("id", saleId);
        } catch (e: any) {
          console.error(`[Automations] Error en email equipo GHL:`, e);
          await supabase.from("ventas").update({ status_email: "ERROR" }).eq("id", saleId);
        }
      } else {
        console.log(`[Automations] Integración GHL Email desactivada, marcando como DESACTIVADO.`);
        await supabase.from("ventas").update({ status_email: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] Email ya estaba completado, saltando.`);
    }

    if (sale.status_whatsapp !== "COMPLETADO") {
      if (config.zapier_whatsapp) {
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
        console.log(`[Automations] Integración Zapier WhatsApp desactivada, marcando como DESACTIVADO.`);
        await supabase.from("ventas").update({ status_whatsapp: "DESACTIVADO" }).eq("id", saleId);
      }
    } else {
      console.log(`[Automations] WhatsApp ya estaba completado, saltando.`);
    }

    try {
      console.log(`[Automations] Enviando datos a Google Sheets`);
      const sheetsPayload = {
        status_pago: sale.status_pago,
        plataforma: sale.plataforma,
        codigo_venta: finalCodigoVenta,
        fecha_registro_formateada: new Date(sale.creado_en).toLocaleString(),
        cliente_nombre: clientInfo?.nombre || "Cliente",
        contact_id: contactId,
        proyecto_nombre: sale.proyecto_nombre,
        monto_total: sale.monto_total,
        moneda: sale.moneda,
        setter_principal_nombre: setterName,
        setters_adicionales_nombres: settersExtrasNames,
        closer_principal_nombre: closerName,
        closers_adicionales_nombres: closersExtrasNames,
        comprobante_link: sale.comprobante_link,
        fecha_pago: sale.fecha_pago
      };

      await appendRowToSheet(sheetsPayload);
    } catch (e: any) {
      console.error(`[Automations] Sheets excepción:`, e);
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
