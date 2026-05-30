import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET() {
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

    
    let query = supabase
      .from("historial_actividades")
      .select(`
        id,
        accion_descripcion,
        creado_en,
        usuarios_agencia (
          nombre,
          username
        )
      `);

    if (role === "ventas") {
      query = query.eq("usuario_id", userId);
    }

    const { data: activities, error } = await query
      .order("creado_en", { ascending: false })
      .limit(20);

    if (error) {
      throw error;
    }

    return NextResponse.json({
      success: true,
      activities,
    });
  } catch (error: any) {
    console.error("GET Activities Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener el historial de actividades de Supabase." },
      { status: 500 }
    );
  }
}
