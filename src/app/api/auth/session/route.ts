import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const userData = JSON.parse(sessionCookie.value);

    return NextResponse.json({
      authenticated: true,
      user: {
        username: userData.username,
        name: userData.name,
        role: userData.role,
      },
    });
  } catch (error) {
    console.error("Session API Error:", error);
    return NextResponse.json({
      authenticated: false,
      user: null,
    });
  }
}
