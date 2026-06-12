import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";
import { syncGhlClients } from "@/lib/sync";

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

    let clients: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;

    while (hasMore) {
      let query = supabase
        .from("clientes")
        .select("*")
        .order("nombre", { ascending: true })
        .range(from, from + limit - 1);

      if (search) {
        query = query.or(
          `nombre.ilike.%${search}%,email.ilike.%${search}%,telefono.ilike.%${search}%,empresa.ilike.%${search}%`
        );
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data && data.length > 0) {
        clients = [...clients, ...data];
        from += limit;
        if (data.length < limit) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }
    }

    return NextResponse.json({
      success: true,
      clients,
    });
  } catch (error: any) {
    console.error("GET Clients Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener la lista de clientes." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {}
    const { pin } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Se requiere el PIN de seguridad para iniciar la sincronización." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    if (userData.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo administradores pueden realizar esta sincronización." },
        { status: 403 }
      );
    }

    const { data: dbUser, error: fetchErr } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("id", userData.id)
      .single();

    if (fetchErr || !dbUser) {
      return NextResponse.json(
        { success: false, error: "No se pudo recuperar la información de seguridad del usuario." },
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

    // Call the central sync helper
    const result = await syncGhlClients();

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || "Error al sincronizar clientes." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      insertedCount: result.insertedCount,
      updatedCount: result.updatedCount,
      totalSynced: result.totalSynced,
    });
  } catch (error: any) {
    console.error("POST Sync Clients Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al sincronizar clientes con GHL." },
      { status: 500 }
    );
  }
}
