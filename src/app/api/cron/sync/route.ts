import { NextRequest, NextResponse } from "next/server";
import { syncTrelloProjects, syncGhlClients } from "@/lib/sync";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // Security check for production environments using CRON_SECRET
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.warn("[Cron Sync] Solicitud de cron no autorizada.");
      return new Response("Unauthorized", { status: 401 });
    }

    console.log("[Cron Sync] Iniciando sincronización automática programada (medianoche)...");

    // Execute Trello projects and GHL clients synchronizations in parallel
    const [trelloResult, ghlResult] = await Promise.all([
      syncTrelloProjects(),
      syncGhlClients()
    ]);

    console.log("[Cron Sync] Sincronización completada.");
    console.log("Trello Result:", trelloResult);
    console.log("GHL Result:", ghlResult);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      trello: {
        success: trelloResult.success,
        inserted: trelloResult.insertedCount,
        updated: trelloResult.updatedCount,
        total: trelloResult.totalSynced,
        error: trelloResult.error || null
      },
      ghl: {
        success: ghlResult.success,
        inserted: ghlResult.insertedCount,
        updated: ghlResult.updatedCount,
        total: ghlResult.totalSynced,
        error: ghlResult.error || null
      }
    });
  } catch (error: any) {
    console.error("[Cron Sync] Error en ejecución automática:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Error interno del servidor durante la sincronización."
      },
      { status: 500 }
    );
  }
}
