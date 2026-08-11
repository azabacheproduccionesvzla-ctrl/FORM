import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

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
