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

    // 1. Fetch sale details from DB
    const { data: sale, error: saleErr } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes (
          id,
          nombre
        )
      `)
      .eq("id", saleId)
      .single();

    if (saleErr || !sale) {
      return NextResponse.json({ success: false, error: "Venta no encontrada." }, { status: 404 });
    }

    // Extract Trello card ID
    let cardId = "";
    if (sale.link_trello) {
      const match = sale.link_trello.match(/\/c\/([a-zA-Z0-9]+)/);
      if (match) cardId = match[1];
    }

    const { data: proj } = await supabase
      .from("proyectos")
      .select("trello_card_id")
      .eq("venta_id", saleId)
      .maybeSingle();

    const finalCardId = proj?.trello_card_id || cardId;

    if (!finalCardId) {
      // Trello not set, just return current db values
      return NextResponse.json({
        success: true,
        synchronized: false,
        trelloTitle: "",
        trelloDesc: ""
      });
    }

    // 2. Fetch live Trello Card from Trello API
    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;

    if (!key || !token) {
      return NextResponse.json({ success: false, error: "Credenciales de Trello no configuradas en el servidor." }, { status: 500 });
    }

    console.log(`[Sync Trello Card API] Fetching card ${finalCardId} from Trello API...`);
    const trelloRes = await fetch(`https://api.trello.com/1/cards/${finalCardId}?key=${key}&token=${token}`);
    
    if (!trelloRes.ok) {
      console.warn(`[Sync Trello Card API] Failed to fetch Trello card: ${trelloRes.statusText}`);
      return NextResponse.json({
        success: true,
        synchronized: false,
        error: `No se pudo obtener la tarjeta de Trello: ${trelloRes.statusText}`
      });
    }

    const cardData = await trelloRes.json();
    const liveTitle = cardData.name || "";
    const liveDesc = cardData.desc || "";

    // 3. Parse Trello title: "[Clean Project Name] - [Client Name]"
    const parts = liveTitle.split(" - ");
    const parsedProject = parts[0]?.trim();
    const parsedClient = parts.slice(1).join(" - ").trim();

    // Check and update database if differences exist
    let dbUpdated = false;

    if (parsedProject && parsedProject !== sale.proyecto_nombre) {
      console.log(`[Sync Trello Card API] Updating project name in DB to: "${parsedProject}"`);
      await supabase.from("ventas").update({ proyecto_nombre: parsedProject }).eq("id", saleId);
      await supabase.from("proyectos").update({ nombre: parsedProject }).eq("venta_id", saleId);
      dbUpdated = true;
    }

    if (parsedClient && sale.clientes && parsedClient !== sale.clientes.nombre) {
      console.log(`[Sync Trello Card API] Updating client name in DB to: "${parsedClient}"`);
      await supabase.from("clientes").update({ nombre: parsedClient }).eq("id", sale.clientes.id);
      dbUpdated = true;
    }

    return NextResponse.json({
      success: true,
      synchronized: true,
      dbUpdated,
      trelloTitle: liveTitle,
      trelloDesc: liveDesc
    });

  } catch (error: any) {
    console.error("[Sync Trello Card API] Crash:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
