import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";

export async function POST(request: Request) {
  
  await new Promise((resolve) => setTimeout(resolve, 800));

  try {
    const body = await request.json();
    const { username, pin } = body;

    
    if (!username || typeof username !== "string") {
      return NextResponse.json(
        { success: false, error: "El nombre de usuario es requerido." },
        { status: 400 }
      );
    }

    const exactUsername = username.trim();

    
    const { data: user, error: dbError } = await supabase
      .from("usuarios_agencia")
      .select("*")
      .eq("username", exactUsername)
      .eq("activo", true)
      .maybeSingle();

    if (dbError) {
      console.error("Supabase Database Error:", dbError);
      return NextResponse.json(
        { success: false, error: "Error de conexión con la base de datos de Supabase." },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Este usuario no está registrado o está inactivo." },
        { status: 404 }
      );
    }

    
    if (pin === undefined) {
      return NextResponse.json({
        success: true,
        step: 2,
        name: user.nombre, 
        message: "Usuario verificado. Ingrese su PIN de seguridad.",
      });
    }

    
    if (typeof pin !== "string" || pin.length !== 6 || !/^\d+$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: "El PIN debe ser un código de 6 dígitos numéricos." },
        { status: 400 }
      );
    }

    
    const isPinValid = verifyPin(pin, user.pin_hash, user.pin_salt);

    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: "PIN de seguridad incorrecto. Intente de nuevo." },
        { status: 401 }
      );
    }

    
    const sessionData = {
      id: user.id,
      username: user.username,
      name: user.nombre,
      role: user.rol, 
      authenticatedAt: new Date().toISOString(),
    };

    const cookieStore = await cookies();
    cookieStore.set("azabache_session", JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7, 
      path: "/",
    });

    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        name: user.nombre,
        role: user.rol,
      },
      message: "Autenticación exitosa en Supabase. Iniciando sesión...",
    });
  } catch (error) {
    console.error("Auth API Route Error:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor. Intente más tarde." },
      { status: 500 }
    );
  }
}
