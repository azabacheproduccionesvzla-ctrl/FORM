import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function POST() {
  
  await new Promise((resolve) => setTimeout(resolve, 800));

  try {
    const cookieStore = await cookies();
    cookieStore.set("azabache_session", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 0, 
      path: "/",
    });

    return NextResponse.json({
      success: true,
      message: "Sesión cerrada correctamente.",
    });
  } catch (error) {
    console.error("Logout API Error:", error);
    return NextResponse.json(
      { success: false, error: "Error al cerrar sesión." },
      { status: 500 }
    );
  }
}
