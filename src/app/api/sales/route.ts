import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";
import { runVentasAutomations } from "@/lib/automations";
import { updateTrelloCardName } from "@/lib/trello";
import { renameDropboxFolder } from "@/lib/dropbox";
import { updateLocalWorkspaceSheet } from "@/lib/local_sheets";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    const { role, id: userId } = userData;

    const { searchParams } = new URL(request.url);
    const clienteId = searchParams.get("cliente_id");
    const userFilterId = searchParams.get("usuario_registro_id");

    let query = supabase.from("ventas").select(`
      *,
      clientes (
        nombre,
        email,
        telefono,
        pais,
        empresa,
        link_usuario_plataforma,
        setter_original_id,
        ghl_contact_id
      ),
      registrador:usuarios_agencia!usuario_registro_id (
        nombre
      ),
      setter_principal:usuarios_agencia!setter_principal_id (
        nombre
      ),
      closer_principal:usuarios_agencia!closer_principal_id (
        nombre
      )
    `);

    if (clienteId) {
      query = query.eq("cliente_id", clienteId);
    }

    // Excluir ventas marcadas como ELIMINADA (soft delete)
    query = query.neq("estado_interno", "ELIMINADA");

    if (role === "ventas") {
      query = query.eq("usuario_registro_id", userId);
    } else if (userFilterId) {
      query = query.eq("usuario_registro_id", userFilterId);
    }

    const { data: sales, error } = await query.order("creado_en", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      sales,
    });
  } catch (error: any) {
    console.error("GET Sales Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener la lista de ventas de Supabase." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    const registrarUserId = userData.id;
    const registrarUsername = userData.username;
    const registrarRole = userData.role;

    console.log("[POST Sales API] Session User Data:", { registrarUserId, registrarUsername, registrarRole });

    if (registrarRole === "auditor") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Los auditores no pueden registrar ventas." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { pin } = body;

    console.log("[POST Sales API] Request body keys:", Object.keys(body));

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Firma de PIN de seguridad es requerida para confirmar la venta." },
        { status: 400 }
      );
    }

    const { data: operator, error: opError } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("username", registrarUsername)
      .single();

    if (opError || !operator) {
      console.error("[POST Sales API] Operator validation error:", opError, "Operator data:", operator);
      return NextResponse.json(
        { success: false, error: "Error al validar el usuario firma. Intente de nuevo." },
        { status: 401 }
      );
    }

    const isPinValid = verifyPin(pin, operator.pin_hash, operator.pin_salt);
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: "PIN de confirmación incorrecto. Venta no registrada." },
        { status: 401 }
      );
    }

    const {
      es_continuacion,
      tipo_continuacion,
      proyecto_previo_id,
      proyecto_id,
      tipo_venta,
      tipo_proyecto,
      tipo_proyecto_otro,
      status_pago,
      plataforma,
      
      cliente_nuevo,
      cliente_id,
      cliente_nombre,
      cliente_telefono,
      cliente_email,
      cliente_pais,
      cliente_empresa,
      cliente_link_usuario,
      actualizar_cliente,

      proyecto_nombre,
      proyecto_link,
      proyecto_brief,
      descripcion_operativa,
      deadline,
      urgente,
      motivo_urgencia,

      moneda,
      moneda_otra,
      monto_total,
      monto_explicacion,
      monto_pagado,
      comision_total,
      fecha_pago,
      fecha_liberacion_pendiente,
      comprobante_link,
      comprobante_no_aplica,

      setter_principal_id,
      setters_adicionales_ids,
      closer_principal_id,
      closers_adicionales_ids,

      tipo_cierre,
      notas_internas,
      manual_rama,
      manual_categoria,
      manual_servicio,
      manual_enlace,
      manuales_servicios
    } = body;

    if (!proyecto_nombre || !tipo_venta || !tipo_proyecto || !status_pago || !plataforma || !tipo_cierre || monto_total === undefined) {
      return NextResponse.json(
        { success: false, error: "Faltan campos obligatorios del proyecto o financieros." },
        { status: 400 }
      );
    }

    let finalClienteId = cliente_id;
    let finalClienteNombre = "";

    if (cliente_nuevo) {
      if (!cliente_nombre) {
        return NextResponse.json(
          { success: false, error: "El nombre del cliente nuevo es requerido." },
          { status: 400 }
        );
      }

      finalClienteNombre = cliente_nombre.trim();

      const { data: existingClient } = await supabase
        .from("clientes")
        .select("id, nombre")
        .eq("nombre", finalClienteNombre)
        .maybeSingle();

      if (existingClient) {
        finalClienteId = existingClient.id;
      } else {
        const { data: newClient, error: clientErr } = await supabase
          .from("clientes")
          .insert({
            nombre: finalClienteNombre,
            telefono: cliente_telefono?.trim() || null,
            email: cliente_email?.trim() || null,
            pais: cliente_pais?.trim() || null,
            empresa: cliente_empresa?.trim() || null,
            link_usuario_plataforma: cliente_link_usuario?.trim() || null,
            setter_original_id: setter_principal_id || null
          })
          .select()
          .single();

        if (clientErr) {
          throw clientErr;
        }
        finalClienteId = newClient.id;
      }
    } else {
      if (!cliente_id) {
        return NextResponse.json(
          { success: false, error: "ID del cliente es obligatorio para clientes existentes." },
          { status: 400 }
        );
      }

      const { data: clientData } = await supabase
        .from("clientes")
        .select("nombre, setter_original_id")
        .eq("id", cliente_id)
        .single();

      finalClienteNombre = clientData?.nombre || "Cliente";

      if (clientData && !clientData.setter_original_id && setter_principal_id) {
        await supabase
          .from("clientes")
          .update({ setter_original_id: setter_principal_id })
          .eq("id", cliente_id);
      }

      if (actualizar_cliente) {
        const { error: clientUpdateErr } = await supabase
          .from("clientes")
          .update({
            telefono: cliente_telefono?.trim() || null,
            email: cliente_email?.trim() || null,
            pais: cliente_pais?.trim() || null,
            empresa: cliente_empresa?.trim() || null,
            link_usuario_plataforma: cliente_link_usuario?.trim() || null
          })
          .eq("id", cliente_id);

        if (clientUpdateErr) {
          throw clientUpdateErr;
        }
      }
    }

    const insertData: any = {
      es_continuacion: !!es_continuacion,
      tipo_continuacion: es_continuacion ? tipo_continuacion : null,
      proyecto_previo_id: es_continuacion ? (proyecto_previo_id || null) : null,
      tipo_venta,
      tipo_proyecto,
      tipo_proyecto_otro: tipo_proyecto === "Otro" ? tipo_proyecto_otro : null,
      status_pago,
      plataforma,
      cliente_id: finalClienteId,
      proyecto_nombre: proyecto_nombre.trim(),
      proyecto_link: proyecto_link?.trim() || null,
      proyecto_brief: proyecto_brief?.trim() || null,
      descripcion_operativa: descripcion_operativa || null,
      carpeta_dropbox: null,
      deadline: deadline || null,
      urgente: !!urgente,
      motivo_urgencia: urgente ? motivo_urgencia : null,
      moneda,
      moneda_otra: moneda === "Otra" ? moneda_otra : null,
      monto_total: parseFloat(monto_total),
      monto_explicacion: moneda !== "USD" ? monto_explicacion : null,
      monto_pagado: status_pago === "Pago Parcial" || tipo_venta === "Pago Parcial" ? parseFloat(monto_pagado || 0) : null,
      comision_total: status_pago === "Pago Parcial" || tipo_venta === "Pago Parcial" ? parseFloat(comision_total || 0) : null,
      fecha_pago: fecha_pago || null,
      fecha_liberacion_pendiente: !!fecha_liberacion_pendiente,
      comprobante_link: comprobante_no_aplica ? null : (comprobante_link || null),
      comprobante_no_aplica: !!comprobante_no_aplica,
      setter_principal_id: setter_principal_id || null,
      setters_adicionales_ids: setters_adicionales_ids || null,
      closer_principal_id: closer_principal_id || null,
      closers_adicionales_ids: closers_adicionales_ids || null,
      tipo_cierre,
      oferta_presentada: null,
      condiciones_acordadas: null,
      notas_internas: notas_internas || null,
      usuario_registro_id: registrarUserId,
      estado_interno: "Registrada",
      status_trello: "PENDIENTE",
      status_ghl_contacto: "PENDIENTE",
      status_ghl_factura: "PENDIENTE",
      status_dropbox: "PENDIENTE",
      status_whatsapp: "PENDIENTE",
      status_email: "PENDIENTE",
      status_sheets: "PENDIENTE",
      manual_rama: manual_rama || (Array.isArray(manuales_servicios) && manuales_servicios[0]?.rama) || null,
      manual_categoria: manual_categoria || (Array.isArray(manuales_servicios) && manuales_servicios[0]?.categoria) || null,
      manual_servicio: manual_servicio || (Array.isArray(manuales_servicios) ? manuales_servicios.map((s: any) => s.servicio).join(", ") : null),
      manual_enlace: manual_enlace || (Array.isArray(manuales_servicios) && manuales_servicios[0]?.enlace) || null,
      manuales_servicios: manuales_servicios || null
    };



    const { data: salesInserted, error: salesErr } = await supabase
      .from("ventas")
      .insert(insertData)
      .select()
      .single();

    if (salesErr) {
      throw salesErr;
    }

    if (proyecto_id) {
      const updateData: any = {
        cliente_id: finalClienteId,
        venta_id: salesInserted.id
      };

      const { error: projUpdateErr } = await supabase
        .from("proyectos")
        .update(updateData)
        .eq("id", proyecto_id);

      if (projUpdateErr) {
        console.error("[Sales API] Error updating proyecto client/sale:", projUpdateErr);
      }

      if (proyecto_previo_id) {
        await supabase
          .from("ventas")
          .update({ cliente_id: finalClienteId })
          .eq("id", proyecto_previo_id);
      }
    }

    try {
      await runVentasAutomations(salesInserted.id);
    } catch (err) {
      console.error("[Automations] Error en la ejecución de runVentasAutomations:", err);
    }

    // Query updated sale to send to frontend
    const { data: finalSale } = await supabase
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
          setter_original_id
        ),
        registrador:usuarios_agencia!usuario_registro_id (
          nombre
        ),
        setter_principal:usuarios_agencia!setter_principal_id (
          nombre
        ),
        closer_principal:usuarios_agencia!closer_principal_id (
          nombre
        )
      `)
      .eq("id", salesInserted.id)
      .single();

    const saleToSend = finalSale || salesInserted;

    await supabase.from("historial_actividades").insert({
      usuario_id: registrarUserId,
      accion_descripcion: `Venta registrada: ${saleToSend.codigo_venta} para ${finalClienteNombre} (Monto: ${monto_total} ${moneda})`,
    });

    try {
      await updateLocalWorkspaceSheet();
    } catch (localErr) {
      console.error("[Sales API] Error updating local sheet after POST:", localErr);
    }

    return NextResponse.json({
      success: true,
      sale: saleToSend,
      message: "Venta registrada exitosamente."
    });
  } catch (error: any) {
    console.error("POST Sale Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al registrar la venta en Supabase." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    const userId = userData.id;
    const username = userData.username;
    const userRole = userData.role;

    const body = await request.json();
    const { id, pin, regenerateIntegrations } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de la venta es requerido para actualizar." },
        { status: 400 }
      );
    }

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Firma de PIN de seguridad es requerida para modificar la venta." },
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
        { success: false, error: "PIN de confirmación incorrecto. Venta no modificada." },
        { status: 401 }
      );
    }

    const { data: saleData, error: findError } = await supabase
      .from("ventas")
      .select(`
        usuario_registro_id,
        codigo_venta,
        proyecto_nombre,
        creado_en,
        link_trello,
        carpeta_dropbox,
        cliente_id,
        clientes (
          nombre
        )
      `)
      .eq("id", id)
      .single();

    if (findError || !saleData) {
      return NextResponse.json(
        { success: false, error: "No se encontró la venta especificada." },
        { status: 404 }
      );
    }

    if (userRole === "ventas" && saleData.usuario_registro_id !== userId) {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo puedes modificar tus propias ventas." },
        { status: 403 }
      );
    }

    const {
      proyecto_nombre,
      proyecto_link,
      proyecto_brief,
      descripcion_operativa,
      carpeta_dropbox,
      deadline,
      urgente,
      motivo_urgencia,
      moneda,
      moneda_otra,
      monto_total,
      monto_explicacion,
      monto_pagado,
      comision_total,
      fecha_pago,
      fecha_liberacion_pendiente,
      comprobante_link,
      comprobante_no_aplica,
      setter_principal_id,
      setters_adicionales_ids,
      closer_principal_id,
      closers_adicionales_ids,
      tipo_cierre,
      notas_internas,
      status_trello,
      status_ghl_contacto,
      status_ghl_factura,
      status_dropbox,
      status_whatsapp,
      status_email,
      status_sheets,
      link_trello,
      estado_interno,
      cliente_id,
      cliente_nombre,
      cliente_email,
      cliente_telefono,
      cliente_pais,
      cliente_empresa,
      cliente_link_usuario,
      manual_rama,
      manual_categoria,
      manual_servicio,
      manual_enlace,
      manuales_servicios
    } = body;

    if (cliente_id) {
      const updateClientData: any = {};
      if (cliente_nombre !== undefined) updateClientData.nombre = cliente_nombre.trim();
      if (cliente_email !== undefined) updateClientData.email = cliente_email?.trim() || null;
      if (cliente_telefono !== undefined) updateClientData.telefono = cliente_telefono?.trim() || null;
      if (cliente_pais !== undefined) updateClientData.pais = cliente_pais?.trim() || null;
      if (cliente_empresa !== undefined) updateClientData.empresa = cliente_empresa?.trim() || null;
      if (cliente_link_usuario !== undefined) updateClientData.link_usuario_plataforma = cliente_link_usuario?.trim() || null;

      if (Object.keys(updateClientData).length > 0) {
        await supabase
          .from("clientes")
          .update(updateClientData)
          .eq("id", cliente_id);
      }
    }

    const updateSaleData: any = {
      proyecto_nombre: proyecto_nombre ? proyecto_nombre.trim() : undefined,
      proyecto_link: proyecto_link !== undefined ? (proyecto_link ? proyecto_link.trim() : null) : undefined,
      proyecto_brief: proyecto_brief !== undefined ? (proyecto_brief ? proyecto_brief.trim() : null) : undefined,
      descripcion_operativa: descripcion_operativa !== undefined ? descripcion_operativa : undefined,
      carpeta_dropbox: carpeta_dropbox !== undefined ? carpeta_dropbox : undefined,
      deadline: deadline !== undefined ? (deadline || null) : undefined,
      urgente: urgente !== undefined ? !!urgente : undefined,
      motivo_urgencia: urgente ? motivo_urgencia : null,
      moneda: moneda || undefined,
      moneda_otra: moneda === "Otra" ? moneda_otra : null,
      monto_total: monto_total !== undefined ? parseFloat(monto_total) : undefined,
      monto_explicacion: moneda !== "USD" ? monto_explicacion : null,
      monto_pagado: monto_pagado !== undefined ? (monto_pagado ? parseFloat(monto_pagado) : null) : undefined,
      comision_total: comision_total !== undefined ? (comision_total ? parseFloat(comision_total) : null) : undefined,
      fecha_pago: fecha_pago !== undefined ? (fecha_pago || null) : undefined,
      fecha_liberacion_pendiente: fecha_liberacion_pendiente !== undefined ? !!fecha_liberacion_pendiente : undefined,
      comprobante_link: comprobante_no_aplica ? null : (comprobante_link || null),
      comprobante_no_aplica: comprobante_no_aplica !== undefined ? !!comprobante_no_aplica : undefined,
      setter_principal_id: setter_principal_id !== undefined ? (setter_principal_id || null) : undefined,
      setters_adicionales_ids: setters_adicionales_ids !== undefined ? setters_adicionales_ids : undefined,
      closer_principal_id: closer_principal_id !== undefined ? (closer_principal_id || null) : undefined,
      closers_adicionales_ids: closers_adicionales_ids !== undefined ? closers_adicionales_ids : undefined,
      tipo_cierre: tipo_cierre || undefined,
      notas_internas: notas_internas !== undefined ? notas_internas : undefined,
      status_trello: status_trello || undefined,
      status_ghl_contacto: status_ghl_contacto || undefined,
      status_ghl_factura: status_ghl_factura || undefined,
      status_dropbox: status_dropbox || undefined,
      status_whatsapp: status_whatsapp || undefined,
      status_email: status_email || undefined,
      status_sheets: status_sheets || undefined,
      link_trello: link_trello !== undefined ? link_trello : undefined,
      estado_interno: estado_interno || undefined,
      manual_rama: manual_rama !== undefined ? manual_rama : (Array.isArray(manuales_servicios) && manuales_servicios[0]?.rama) || undefined,
      manual_categoria: manual_categoria !== undefined ? manual_categoria : (Array.isArray(manuales_servicios) && manuales_servicios[0]?.categoria) || undefined,
      manual_servicio: manual_servicio !== undefined ? manual_servicio : (Array.isArray(manuales_servicios) ? manuales_servicios.map((s: any) => s.servicio).join(", ") : undefined),
      manual_enlace: manual_enlace !== undefined ? manual_enlace : (Array.isArray(manuales_servicios) && manuales_servicios[0]?.enlace) || undefined,
      manuales_servicios: manuales_servicios !== undefined ? manuales_servicios : undefined
    };

    Object.keys(updateSaleData).forEach(key => {
      if (updateSaleData[key] === undefined) {
        delete updateSaleData[key];
      }
    });

    const { data: updatedSale, error: updateErr } = await supabase
      .from("ventas")
      .update(updateSaleData)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      throw updateErr;
    }

    try {
      const oldProjectName = saleData.proyecto_nombre;
      const oldClientName = (saleData.clientes as any)?.nombre || "";

      const newProjectName = proyecto_nombre !== undefined ? proyecto_nombre.trim() : oldProjectName;
      const newClientName = cliente_nombre !== undefined ? cliente_nombre.trim() : oldClientName;

      if (proyecto_nombre !== undefined && oldProjectName !== newProjectName) {
        await supabase
          .from("proyectos")
          .update({ nombre: newProjectName })
          .eq("venta_id", id);
        console.log(`[Rename] Proyecto DB unificado renombrado de "${oldProjectName}" a "${newProjectName}"`);
      }

      if (oldProjectName !== newProjectName || oldClientName !== newClientName) {
        console.log(`[Rename] Detectados cambios en nombres. Proyecto: "${oldProjectName}" -> "${newProjectName}", Cliente: "${oldClientName}" -> "${newClientName}"`);

        let cardId = "";
        if (saleData.link_trello) {
          const m = saleData.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
          if (m) cardId = m[1];
        }

        const { data: projDb } = await supabase
          .from("proyectos")
          .select("trello_card_id")
          .eq("venta_id", id)
          .maybeSingle();

        const finalCardId = projDb?.trello_card_id || cardId;

        if (finalCardId) {
          await updateTrelloCardName(finalCardId, newProjectName, newClientName);
          console.log(`[Rename] Tarjeta de Trello renombrada con éxito.`);
        }

        if (oldClientName && oldProjectName) {
          await renameDropboxFolder(oldClientName, oldProjectName, newClientName, newProjectName, saleData.creado_en);
          console.log(`[Rename] Carpeta de Dropbox renombrada con éxito.`);
        }
      }
    } catch (renameErr) {
      console.error("[Rename Exception] Error al renombrar recursos externos en PUT:", renameErr);
    }

    await supabase.from("historial_actividades").insert({
      usuario_id: userId,
      accion_descripcion: `Venta modificada: ${updatedSale.codigo_venta} para ${cliente_nombre || "Cliente"} (Monto: ${monto_total || updatedSale.monto_total} ${moneda || updatedSale.moneda})`,
    });

    if (regenerateIntegrations) {
      console.log(`[PUT Sale] Regeneración explícita de integraciones solicitada para venta ID: ${id}`);
      try {
        await runVentasAutomations(id);
      } catch (autoErr) {
        console.error("[PUT Sale] Error al regenerar integraciones:", autoErr);
      }
    }

    try {
      await updateLocalWorkspaceSheet();
    } catch (localErr) {
      console.error("[Sales API] Error updating local sheet after PUT:", localErr);
    }

    return NextResponse.json({
      success: true,
      sale: updatedSale,
      message: "Venta modificada exitosamente."
    });
  } catch (error: any) {
    console.error("PUT Sale Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar la venta en Supabase." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    const { role, id: userId, username } = userData;

    if (role !== "admin" && role !== "auditor") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo administradores y gestores pueden eliminar ventas." },
        { status: 403 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {}

    const { searchParams } = new URL(request.url);
    const id = body.id || searchParams.get("id");
    const pin = body.pin || searchParams.get("pin");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de la venta es requerido." },
        { status: 400 }
      );
    }

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Firma de PIN de seguridad es requerida para eliminar la venta." },
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
        { success: false, error: "PIN de confirmación incorrecto. Venta no eliminada." },
        { status: 401 }
      );
    }

    const { data: saleData } = await supabase
      .from("ventas")
      .select("codigo_venta, proyecto_nombre")
      .eq("id", id)
      .single();

    // Soft delete: actualizar estado interno y estado de integraciones a ELIMINADA/ELIMINADO
    const { error } = await supabase
      .from("ventas")
      .update({
        estado_interno: "ELIMINADA",
        status_trello: "ELIMINADO",
        status_dropbox: "ELIMINADO",
        status_ghl_contacto: "ELIMINADO",
        status_ghl_factura: "ELIMINADO",
        status_whatsapp: "ELIMINADO",
        status_email: "ELIMINADO",
        status_sheets: "ELIMINADO"
      })
      .eq("id", id);

    if (error) {
      throw error;
    }

    // Desactivar proyecto asociado en DB si existe
    await supabase
      .from("proyectos")
      .update({ activo: false })
      .eq("venta_id", id);

    await supabase.from("historial_actividades").insert({
      usuario_id: userId,
      accion_descripcion: `Venta eliminada/archivada: ${saleData?.codigo_venta || "N/A"} (${saleData?.proyecto_nombre || "N/A"}) por ${role}`,
    });

    try {
      await updateLocalWorkspaceSheet();
    } catch (localErr) {
      console.error("[Sales API] Error updating local sheet after DELETE:", localErr);
    }

    return NextResponse.json({
      success: true,
      message: "Venta eliminada exitosamente."
    });
  } catch (error: any) {
    console.error("DELETE Sale Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al eliminar la venta en la base de datos." },
      { status: 500 }
    );
  }
}
