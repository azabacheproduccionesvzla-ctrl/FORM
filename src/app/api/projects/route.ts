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

    let projects: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("proyectos")
        .select(`
          *,
          clientes (
            id,
            nombre,
            empresa,
            email,
            telefono,
            pais,
            link_usuario_plataforma
          ),
          ventas (
            id,
            codigo_venta,
            monto_total,
            moneda,
            fecha_pago,
            creado_en,
            urgente,
            proyecto_brief,
            descripcion_operativa,
            deadline,
            tipo_proyecto
          )
        `)
        .order("creado_en", { ascending: false })
        .range(from, from + limit - 1);

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        projects = [...projects, ...data];
        from += limit;
        if (data.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    let filteredProjects = projects || [];
    if (search) {
      const lowerSearch = search.toLowerCase();
      filteredProjects = filteredProjects.filter((p: any) => {
        const matchProjName = p.nombre?.toLowerCase().includes(lowerSearch);
        const matchClientName = p.clientes?.nombre?.toLowerCase().includes(lowerSearch);
        const matchClientCompany = p.clientes?.empresa?.toLowerCase().includes(lowerSearch);
        const matchVentaCode = p.ventas?.codigo_venta?.toLowerCase().includes(lowerSearch);
        return matchProjName || matchClientName || matchClientCompany || matchVentaCode;
      });
    }

    return NextResponse.json({
      success: true,
      projects: filteredProjects,
    });
  } catch (error: any) {
    console.error("GET Projects Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener los proyectos." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autenticado." },
        { status: 401 }
      );
    }

    let userData: any = {};
    try {
      userData = JSON.parse(sessionCookie.value);
    } catch (e) {
      return NextResponse.json(
        { success: false, error: "Sesión inválida." },
        { status: 401 }
      );
    }

    const userRole = (userData.role || userData.rol || "").toLowerCase().trim();
    if (userRole !== "admin" && userRole !== "auditor") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo administradores y auditores pueden habilitar o deshabilitar proyectos." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { id, activo, pin } = body;

    if (!id || typeof activo !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Se requiere ID de proyecto y estado activo válido." },
        { status: 400 }
      );
    }

    if (!pin || typeof pin !== "string" || pin.length !== 6 || !/^\d+$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: "Se requiere el PIN de seguridad de 6 dígitos para autorizar este cambio." },
        { status: 400 }
      );
    }

    // Verify user PIN against database
    const { data: dbUser, error: fetchErr } = await supabase
      .from("usuarios_agencia")
      .select("id, pin_hash, pin_salt, activo, rol")
      .eq("id", userData.id)
      .single();

    if (fetchErr || !dbUser || !dbUser.activo) {
      return NextResponse.json(
        { success: false, error: "No se pudo recuperar la información del usuario o la cuenta está inactiva." },
        { status: 403 }
      );
    }

    const dbRole = (dbUser.rol || "").toLowerCase().trim();
    if (dbRole !== "admin" && dbRole !== "auditor") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo administradores y auditores pueden habilitar o deshabilitar proyectos." },
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

    const { data, error } = await supabase
      .from("proyectos")
      .update({
        activo,
        actualizado_en: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      project: data,
      message: `Proyecto ${activo ? "habilitado" : "deshabilitado"} exitosamente.`
    });
  } catch (error: any) {
    console.error("PATCH Project Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al actualizar el estado del proyecto." },
      { status: 500 }
    );
  }
}


