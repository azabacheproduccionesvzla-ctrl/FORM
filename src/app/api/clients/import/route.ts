import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

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

    let importedClients = 0;
    let errors: string[] = [];
    const results: any[] = [];

    // Process each row
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      try {
        const clientName = row.cliente_nombre?.trim();
        if (!clientName) {
          errors.push(`Fila ${rowNum}: El nombre del cliente es obligatorio.`);
          continue;
        }

        // Search for existing client (case-insensitive)
        const { data: existingClient } = await supabase
          .from("clientes")
          .select("*")
          .ilike("nombre", clientName)
          .maybeSingle();

        let clientObj = existingClient;
        const mappedSetterId = findUser(row.setter_username) || registrarUserId;

        if (!existingClient) {
          // Verify we have email or phone for new client
          const email = row.cliente_email?.trim() || null;
          const phone = row.cliente_telefono?.trim() || null;

          if (!email && !phone) {
            errors.push(`Fila ${rowNum}: El nuevo cliente "${clientName}" debe tener al menos correo electrónico o teléfono.`);
            continue;
          }

          // Insert new client
          const { data: newClient, error: clientInsErr } = await supabase
            .from("clientes")
            .insert({
              nombre: clientName,
              telefono: phone,
              email: email,
              pais: row.cliente_pais?.trim() || null,
              empresa: row.cliente_empresa?.trim() || null,
              link_usuario_plataforma: row.cliente_link_usuario?.trim() || null,
              setter_original_id: mappedSetterId
            })
            .select()
            .single();

          if (clientInsErr) {
            errors.push(`Fila ${rowNum}: Error al crear cliente "${clientName}": ${clientInsErr.message}`);
            continue;
          }
          clientObj = newClient;
          importedClients++;
        } else {
          // If client exists, fill in missing fields if present in import row
          const updates: any = {};
          if (!clientObj.telefono && row.cliente_telefono) updates.telefono = row.cliente_telefono.trim();
          if (!clientObj.email && row.cliente_email) updates.email = row.cliente_email.trim().toLowerCase();
          if (!clientObj.pais && row.cliente_pais) updates.pais = row.cliente_pais.trim();
          if (!clientObj.empresa && row.cliente_empresa) updates.empresa = row.cliente_empresa.trim();
          if (!clientObj.link_usuario_plataforma && row.cliente_link_usuario) {
            updates.link_usuario_plataforma = row.cliente_link_usuario.trim();
          }

          if (Object.keys(updates).length > 0) {
            await supabase
              .from("clientes")
              .update(updates)
              .eq("id", clientObj.id);
            clientObj = { ...clientObj, ...updates };
          }
        }

        results.push({
          row: rowNum,
          status: "SUCCESS",
          message: `Cliente "${clientName}" importado correctamente.`
        });

      } catch (rowErr: any) {
        errors.push(`Fila ${rowNum}: Excepción inesperada: ${rowErr.message || rowErr}`);
      }
    }

    return NextResponse.json({
      success: true,
      importedClients,
      totalProcessed: rows.length,
      errors,
      results
    });

  } catch (error: any) {
    console.error("POST Import Clients Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al procesar la importación." },
      { status: 500 }
    );
  }
}
