import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { hashPin, generateSalt } from "@/lib/crypto";


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
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const { data: users, error } = await supabase
      .from("usuarios_agencia")
      .select("id, username, nombre, rol, activo, creado_en")
      .order("nombre", { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    console.error("GET Users Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al obtener la lista de usuarios de Supabase." },
      { status: 500 }
    );
  }
}


export async function POST(request: Request) {
  const auth = await checkAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { username, nombre, rol, pin } = body;

    
    if (!username || !nombre || !rol || !pin) {
      return NextResponse.json(
        { success: false, error: "Todos los campos (usuario, nombre, rol, PIN) son requeridos." },
        { status: 400 }
      );
    }

    if (typeof pin !== "string" || pin.length !== 6 || !/^\d+$/.test(pin)) {
      return NextResponse.json(
        { success: false, error: "El PIN debe tener 6 dígitos numéricos." },
        { status: 400 }
      );
    }

    const cleanUsername = username.trim();

    
    const pinSalt = generateSalt();
    const pinHash = hashPin(pin, pinSalt);

    const { data, error } = await supabase
      .from("usuarios_agencia")
      .insert({
        username: cleanUsername,
        nombre: nombre.trim(),
        rol,
        pin_hash: pinHash,
        pin_salt: pinSalt,
        activo: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") { 
        return NextResponse.json(
          { success: false, error: "El nombre de usuario ya está registrado." },
          { status: 400 }
        );
      }
      throw error;
    }

    
    await supabase.from("historial_actividades").insert({
      usuario_id: auth.user.id,
      accion_descripcion: `Usuario creado: ${data.username} (Rol: ${data.rol})`,
    });

    return NextResponse.json({
      success: true,
      user: { id: data.id, username: data.username, nombre: data.nombre, rol: data.rol },
      message: "Usuario creado exitosamente.",
    });
  } catch (error: any) {
    console.error("POST User Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al crear el usuario en Supabase." },
      { status: 500 }
    );
  }
}


export async function PUT(request: Request) {
  const auth = await checkAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const body = await request.json();
    const { id, username, nombre, rol, activo, pin } = body;

    if (!id || !username || !nombre || !rol) {
      return NextResponse.json(
        { success: false, error: "Campos incompletos para actualizar el usuario." },
        { status: 400 }
      );
    }

    
    const { data: oldUser } = await supabase
      .from("usuarios_agencia")
      .select("username, nombre, rol, activo")
      .eq("id", id)
      .maybeSingle();

    const cleanUsername = username.trim();
    const updateData: any = {
      username: cleanUsername,
      nombre: nombre.trim(),
      rol,
      activo: activo !== undefined ? activo : true,
    };

    let pinChanged = false;
    if (pin && pin.trim() !== "") {
      if (typeof pin !== "string" || pin.length !== 6 || !/^\d+$/.test(pin)) {
        return NextResponse.json(
          { success: false, error: "El nuevo PIN debe tener 6 dígitos numéricos." },
          { status: 400 }
        );
      }
      const pinSalt = generateSalt();
      const pinHash = hashPin(pin, pinSalt);
      updateData.pin_hash = pinHash;
      updateData.pin_salt = pinSalt;
      pinChanged = true;
    }

    const { data: updatedUser, error } = await supabase
      .from("usuarios_agencia")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { success: false, error: "El nombre de usuario ya está en uso." },
          { status: 400 }
        );
      }
      throw error;
    }

    
    let logDescription = `Usuario editado: ${updatedUser.username}`;
    
    if (oldUser) {
      if (oldUser.activo !== updatedUser.activo) {
        logDescription = updatedUser.activo 
          ? `Usuario activado: ${updatedUser.username}` 
          : `Usuario desactivado: ${updatedUser.username}`;
      } else if (pinChanged) {
        logDescription = `PIN cambiado para el usuario: ${updatedUser.username}`;
      } else if (oldUser.rol !== updatedUser.rol) {
        logDescription = `Rol de ${updatedUser.username} cambiado de ${oldUser.rol} a ${updatedUser.rol}`;
      }
    }

    
    await supabase.from("historial_actividades").insert({
      usuario_id: auth.user.id,
      accion_descripcion: logDescription,
    });

    return NextResponse.json({
      success: true,
      user: { id: updatedUser.id, username: updatedUser.username, nombre: updatedUser.nombre, rol: updatedUser.rol, activo: updatedUser.activo },
      message: "Usuario actualizado exitosamente.",
    });
  } catch (error: any) {
    console.error("PUT User Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al actualizar el usuario en Supabase." },
      { status: 500 }
    );
  }
}


export async function DELETE(request: Request) {
  const auth = await checkAdminSession();
  if (!auth.authorized) {
    return NextResponse.json({ success: false, error: auth.error }, { status: auth.status });
  }

  try {
    const { id } = await request.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "ID de usuario es requerido." },
        { status: 400 }
      );
    }

    
    if (auth.user.id === id) {
      return NextResponse.json(
        { success: false, error: "No puedes desactivar tu propio usuario." },
        { status: 400 }
      );
    }

    
    const { data: user, error: fetchError } = await supabase
      .from("usuarios_agencia")
      .select("username")
      .eq("id", id)
      .single();

    if (fetchError || !user) {
      return NextResponse.json(
        { success: false, error: "Usuario no encontrado." },
        { status: 404 }
      );
    }

    
    const { error: updateError } = await supabase
      .from("usuarios_agencia")
      .update({ activo: false })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    
    await supabase.from("historial_actividades").insert({
      usuario_id: auth.user.id,
      accion_descripcion: `Usuario desactivado (Soft Delete): ${user.username}`,
    });

    return NextResponse.json({
      success: true,
      message: "Usuario desactivado correctamente de forma lógica.",
    });
  } catch (error: any) {
    console.error("DELETE (Soft) User Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al desactivar lógicamente el usuario en Supabase." },
      { status: 500 }
    );
  }
}
