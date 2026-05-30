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
    const activeOnly = searchParams.get("activeOnly") !== "false";

    let query = supabase
      .from("proyectos")
      .select(`
        *,
        clientes (
          id,
          nombre,
          empresa,
          email,
          telefono
        ),
        ventas (
          id,
          codigo_venta,
          monto_total,
          moneda,
          fecha_pago,
          creado_en
        )
      `)
      .order("creado_en", { ascending: false });

    if (activeOnly) {
      query = query.eq("activo", true);
    }

    const { data: projects, error } = await query;

    if (error) {
      throw error;
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
