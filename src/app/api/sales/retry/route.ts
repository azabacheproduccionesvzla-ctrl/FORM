import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { runVentasAutomations } from "@/lib/automations";

export async function POST(request: Request) {
  try {
    
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const { saleId } = await request.json();

    if (!saleId) {
      return NextResponse.json({ success: false, error: "saleId is required" }, { status: 400 });
    }

    
    runVentasAutomations(saleId).catch(err => {
      console.error("[Retry Endpoint] Error en la promesa:", err);
    });

    return NextResponse.json({ success: true, message: "Reintento iniciado en segundo plano." });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
