import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";
import { getIntegrationConfig, updateIntegrationConfig } from "@/lib/config_service";

async function checkAdminSession() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return { authorized: false, status: 401, error: "No autenticado." };
    }

    const userData = JSON.parse(sessionCookie.value);
    const hasAdminRole = userData.role === "admin";

    if (!hasAdminRole) {
      return { authorized: false, status: 403, error: "Acceso denegado. Se requieren permisos de administración." };
    }

    return { authorized: true, user: userData };
  } catch (error) {
    return { authorized: false, status: 500, error: "Error de servidor al validar sesión." };
  }
}

export async function GET() {
  try {
    const config = await getIntegrationConfig();
    return NextResponse.json({ success: true, config });
  } catch (error) {
    return NextResponse.json({ success: false, error: "Error al obtener la configuración." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { config, pin } = body;

    if (!config || !pin) {
      return NextResponse.json({ success: false, error: "Faltan datos requeridos (config, pin)." }, { status: 400 });
    }

    const { data: dbUser, error: fetchErr } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("id", auth.user.id)
      .single();

    if (fetchErr || !dbUser) {
      return NextResponse.json({ success: false, error: "No se pudo recuperar la información de seguridad del usuario." }, { status: 403 });
    }

    const isPinValid = verifyPin(pin, dbUser.pin_hash, dbUser.pin_salt);
    if (!isPinValid) {
      return NextResponse.json({ success: false, error: "PIN de seguridad incorrecto." }, { status: 403 });
    }

    const saveSuccess = await updateIntegrationConfig(config);
    if (!saveSuccess) {
      throw new Error("No se pudo guardar la configuración.");
    }

    await supabase.from("historial_actividades").insert({
      usuario_id: auth.user.id,
      accion_descripcion: `Configuración de integraciones actualizada: Dropbox(${config.dropbox ? "SI" : "NO"}), Trello(${config.trello ? "SI" : "NO"}), GHL Email(${config.ghl_email ? "SI" : "NO"}), GHL Factura(${config.ghl_factura ? "SI" : "NO"}), WhatsApp(${config.zapier_whatsapp ? "SI" : "NO"}), Sheets(${config.google_sheets ? "SI" : "NO"})`,
    });

    return NextResponse.json({ success: true, message: "Configuración actualizada con éxito." });
  } catch (error: any) {
    console.error("PUT Config Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Error al actualizar la configuración." }, { status: 500 });
  }
}
