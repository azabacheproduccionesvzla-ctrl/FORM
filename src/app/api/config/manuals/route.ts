import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";
import fs from "fs";
import path from "path";

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

const getFilePath = () => path.resolve(process.cwd(), "manuales_produccion.json");

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

    const filePath = getFilePath();
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ success: true, manuals: {} });
    }
    const fileContent = fs.readFileSync(filePath, "utf-8");
    const manuals = JSON.parse(fileContent);
    return NextResponse.json({ success: true, manuals });
  } catch (error: any) {
    console.error("GET Manuals Error:", error);
    return NextResponse.json({ success: false, error: "Error al leer los manuales." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const auth = await checkAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { manuals, pin } = body;

    if (!manuals || !pin) {
      return NextResponse.json({ success: false, error: "Faltan datos requeridos (manuals, pin)." }, { status: 400 });
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

    const filePath = getFilePath();
    fs.writeFileSync(filePath, JSON.stringify(manuals, null, 2), "utf-8");

    await supabase.from("historial_actividades").insert({
      usuario_id: auth.user.id,
      accion_descripcion: "Base de datos de manuales de producción actualizada por el administrador",
    });

    return NextResponse.json({ success: true, message: "Manuales actualizados con éxito." });
  } catch (error: any) {
    console.error("PUT Manuals Error:", error);
    return NextResponse.json({ success: false, error: error.message || "Error al actualizar los manuales." }, { status: 500 });
  }
}
