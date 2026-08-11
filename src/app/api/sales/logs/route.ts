import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";

export async function GET(request: Request) {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const saleId = searchParams.get("saleId");

    if (!saleId) {
      return NextResponse.json({ success: false, error: "saleId is required." }, { status: 400 });
    }

    const { data: logs, error } = await supabase
      .from("ventas_logs")
      .select("*")
      .eq("venta_id", saleId)
      .order("creado_en", { ascending: true });

    if (error) {
      console.error("[Logs API] Error fetching logs:", error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      logs: logs || []
    });
  } catch (error: any) {
    console.error("[Logs API] Crash:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
