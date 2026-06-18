import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { runVentasAutomations } from "@/lib/automations";
import { updateLocalWorkspaceSheet } from "@/lib/local_sheets";

export async function POST(request: NextRequest) {
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

    if (registrarRole === "auditor") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Los auditores no pueden importar datos." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { rows } = body;

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { success: false, error: "No se proporcionaron filas para importar." },
        { status: 400 }
      );
    }

    // 1. Fetch agency users to map setter/closer case-insensitively by username or full name
    const { data: users, error: usersErr } = await supabase
      .from("usuarios_agencia")
      .select("id, username, nombre")
      .eq("activo", true);

    if (usersErr) {
      throw new Error(`Error al cargar usuarios de agencia: ${usersErr.message}`);
    }

    const findUser = (nameOrUsername: string | null | undefined): string | null => {
      if (!nameOrUsername) return null;
      const clean = nameOrUsername.trim().toLowerCase();
      // Match by username
      const byUser = users?.find(u => u.username.toLowerCase() === clean);
      if (byUser) return byUser.id;
      // Match by full name
      const byName = users?.find(u => u.nombre.toLowerCase() === clean);
      if (byName) return byName.id;
      return null;
    };

    // 2. Fetch or create generic default client "Cliente Trello Sin Clasificar"
    const genericName = "Cliente Trello Sin Clasificar";
    let { data: defaultClient, error: clientFindErr } = await supabase
      .from("clientes")
      .select("id")
      .ilike("nombre", genericName)
      .maybeSingle();

    if (clientFindErr) {
      throw new Error(`Error al buscar cliente genérico por defecto: ${clientFindErr.message}`);
    }

    let defaultClientId: string;

    if (!defaultClient) {
      const { data: newGenClient, error: clientInsErr } = await supabase
        .from("clientes")
        .insert([{ nombre: genericName }])
        .select()
        .single();

      if (clientInsErr) {
        throw new Error(`Error al crear cliente genérico por defecto: ${clientInsErr.message}`);
      }
      defaultClientId = newGenClient.id;
    } else {
      defaultClientId = defaultClient.id;
    }

    let importedSales = 0;
    let errors: string[] = [];
    const results: any[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        const projectName = row.proyecto_nombre?.trim();
        if (!projectName) {
          errors.push(`Fila ${rowNum}: El nombre del proyecto/venta es obligatorio.`);
          continue;
        }

        const mappedSetterId = findUser(row.setter_username) || registrarUserId;
        const mappedCloserId = findUser(row.closer_username) || registrarUserId;

        // Prepare insert data for the sale record
        const insertData: any = {
          es_continuacion: false,
          tipo_venta: row.tipo_venta?.trim() || "Nueva Venta",
          tipo_proyecto: row.tipo_proyecto?.trim() || "Precio Fijo",
          status_pago: row.status_pago?.trim() || "Pago Adelantado",
          plataforma: row.plataforma?.trim() || "Workana",
          cliente_id: defaultClientId,
          proyecto_nombre: projectName,
          proyecto_link: row.proyecto_link?.trim() || null,
          proyecto_brief: row.proyecto_brief?.trim() || null,
          moneda: row.moneda?.trim() || "USD",
          monto_total: parseFloat(row.monto_total) || 0,
          comprobante_no_aplica: true,
          setter_principal_id: mappedSetterId,
          closer_principal_id: mappedCloserId,
          usuario_registro_id: registrarUserId,
          estado_interno: "Registrada",
          status_trello: "PENDIENTE",
          status_ghl_contacto: "PENDIENTE",
          status_ghl_factura: "PENDIENTE",
          status_dropbox: "PENDIENTE",
          status_whatsapp: "PENDIENTE",
          status_email: "PENDIENTE",
          status_sheets: "PENDIENTE"
        };

        const { data: saleInserted, error: saleErr } = await supabase
          .from("ventas")
          .insert(insertData)
          .select()
          .single();

        if (saleErr) {
          errors.push(`Fila ${rowNum}: Error al registrar venta/proyecto "${projectName}": ${saleErr.message}`);
          continue;
        }

        importedSales++;

        // Trigger background integrations
        runVentasAutomations(saleInserted.id).catch(automationErr => {
          console.error(`[Import Background Automations] Error en venta ID ${saleInserted.id}:`, automationErr);
        });

        results.push({
          row: rowNum,
          status: "SUCCESS",
          message: `Proyecto "${projectName}" importado y asignado a "${genericName}".`
        });

      } catch (rowErr: any) {
        errors.push(`Fila ${rowNum}: Excepción inesperada: ${rowErr.message || rowErr}`);
      }
    }

    // Update local maestro sheet once at the end if any sales were imported
    if (importedSales > 0) {
      try {
        await updateLocalWorkspaceSheet();
      } catch (sheetErr) {
        console.error("[Import Projects API] Error updating local Maestro sheet:", sheetErr);
      }
    }

    return NextResponse.json({
      success: true,
      importedSales,
      totalProcessed: rows.length,
      errors,
      results
    });

  } catch (error: any) {
    console.error("POST Import Projects Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar la importación de proyectos." },
      { status: 500 }
    );
  }
}
