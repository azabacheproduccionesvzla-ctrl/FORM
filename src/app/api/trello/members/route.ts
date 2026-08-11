import { NextResponse } from "next/server";
import { getTrelloBoardMembers } from "@/lib/trello";
import { cookies } from "next/headers";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json({ success: false, error: "No autenticado." }, { status: 401 });
    }

    const members = await getTrelloBoardMembers();
    return NextResponse.json({ success: true, members });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
