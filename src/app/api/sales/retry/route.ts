import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { runVentasAutomations } from "@/lib/automations";
import { updateLocalWorkspaceSheet } from "@/lib/local_sheets";

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

    
    try {
      await runVentasAutomations(saleId);
    } catch (err) {
      console.error("[Retry Endpoint] Error en la ejecución de runVentasAutomations:", err);
    }

    try {
      await updateLocalWorkspaceSheet();
    } catch (localErr) {
      console.error("[Retry Endpoint] Error updating local sheet:", localErr);
    }

    return NextResponse.json({ success: true, message: "Reintento de automatizaciones completado." });

  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
