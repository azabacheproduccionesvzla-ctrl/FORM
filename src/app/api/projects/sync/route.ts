import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabase } from "@/lib/supabase";
import { verifyPin } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {}
    const { pin } = body;

    if (!pin) {
      return NextResponse.json(
        { success: false, error: "Se requiere el PIN de seguridad para iniciar la sincronización." },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get("azabache_session");

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, error: "No autorizado." },
        { status: 401 }
      );
    }

    const userData = JSON.parse(sessionCookie.value);
    if (userData.role !== "admin") {
      return NextResponse.json(
        { success: false, error: "Acceso denegado. Solo administradores pueden realizar esta sincronización." },
        { status: 403 }
      );
    }

    const { data: dbUser, error: fetchErr } = await supabase
      .from("usuarios_agencia")
      .select("pin_hash, pin_salt")
      .eq("id", userData.id)
      .single();

    if (fetchErr || !dbUser) {
      return NextResponse.json(
        { success: false, error: "No se pudo recuperar la información de seguridad del usuario." },
        { status: 403 }
      );
    }

    const isPinValid = verifyPin(pin, dbUser.pin_hash, dbUser.pin_salt);
    if (!isPinValid) {
      return NextResponse.json(
        { success: false, error: "PIN de seguridad incorrecto." },
        { status: 403 }
      );
    }

    const key = process.env.TRELLO_API_KEY;
    const token = process.env.TRELLO_TOKEN;
    let boardId = process.env.TRELLO_ID_BOARD;
    const listNuevos = process.env.TRELLO_ID_LIST_NUEVOS;
    const listRecurrentes = process.env.TRELLO_ID_LIST_RECURRENTES;

    if (!key || !token) {
      return NextResponse.json(
        { success: false, error: "Las credenciales de Trello no están configuradas." },
        { status: 500 }
      );
    }

    // Self-healing: if boardId is missing, or matches the non-existent one, auto-detect it from list
    if (!boardId || boardId === "67484dfb1f7d084e3110eb2b") {
      const targetList = listNuevos || listRecurrentes;
      if (targetList) {
        console.log(`[Projects Sync] Auto-detectando ID del tablero desde la lista: ${targetList}`);
        const listUrl = `https://api.trello.com/1/lists/${targetList}?key=${key}&token=${token}&fields=idBoard`;
        try {
          const listRes = await fetch(listUrl);
          if (listRes.ok) {
            const listData = await listRes.json();
            if (listData.idBoard) {
              boardId = listData.idBoard;
              console.log(`[Projects Sync] Tablero detectado dinámicamente: ${boardId}`);
            }
          }
        } catch (err) {
          console.error("[Projects Sync] Error al intentar auto-detectar tablero:", err);
        }
      }
    }

    if (!boardId) {
      return NextResponse.json(
        { success: false, error: "El ID del tablero no está configurado y no pudo ser auto-detectado." },
        { status: 500 }
      );
    }

    console.log(`[Projects Sync] Obteniendo todas las tarjetas del tablero Trello ID: ${boardId}...`);

    const url = `https://api.trello.com/1/boards/${boardId}/cards?key=${key}&token=${token}&fields=id,name,desc,url,shortUrl,idList,closed,due`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) {
      throw new Error(`Error al obtener tarjetas del tablero ${boardId}: ${res.statusText}`);
    }
    const allCards = await res.json();
    console.log(`[Projects Sync] Sincronizando ${allCards.length} tarjetas del tablero.`);

    let insertedCount = 0;
    let updatedCount = 0;

    for (const card of allCards) {
      let clientName = "";
      let projectName = card.name;

      let parts = card.name.split(" - ");
      if (parts.length < 2) {
        parts = card.name.split("   ");
      }
      if (parts.length < 2) {
        parts = card.name.split("  ");
      }

      if (parts.length >= 2) {
        clientName = parts[parts.length - 1].trim();
        projectName = parts.slice(0, -1).join(" - ").trim();
      }

      if (clientName) {
        clientName = clientName.replace(/^[-\s.¡!¿?]+|[-\s.¡!¿?]+$/g, "").trim();
      }

      let brief = "";
      let dropboxUrl = "";
      if (card.desc) {
        const dbMatch = card.desc.match(/(https?:\/\/(?:www\.)?dropbox\.com\S+)/i);
        if (dbMatch) {
          dropboxUrl = dbMatch[1].replace(/[)\],.;]+$/, "");
        }
        
        const briefMatch = card.desc.match(/Brief:\s*([^\n\r]+)/i);
        if (briefMatch) {
          brief = briefMatch[1].trim();
        }

        const materialMatch = card.desc.match(/Material:\s*([^\n\r]+)/i);
        if (materialMatch && !dropboxUrl) {
          const matVal = materialMatch[1].trim();
          if (matVal.includes("dropbox.com")) {
            const dbUrlInMat = matVal.match(/(https?:\/\/(?:www\.)?dropbox\.com\S+)/i);
            if (dbUrlInMat) {
              dropboxUrl = dbUrlInMat[1].replace(/[)\],.;]+$/, "");
            }
          }
        }
      }

      const { data: existingProj } = await supabase
        .from("proyectos")
        .select("id, venta_id")
        .eq("trello_card_id", card.id)
        .maybeSingle();

      const cardCreatedDate = new Date(parseInt(card.id.substring(0, 8), 16) * 1000).toISOString();

      if (existingProj) {
        const updatePayload: any = {
          trello_list_id: card.idList,
          link_trello: card.shortUrl || card.url,
          activo: !card.closed,
          creado_en: cardCreatedDate,
          actualizado_en: new Date().toISOString()
        };
        if (dropboxUrl) {
          updatePayload.carpeta_dropbox = dropboxUrl;
        }

        const { error: updErr } = await supabase
          .from("proyectos")
          .update(updatePayload)
          .eq("id", existingProj.id);

        if (!updErr) {
          updatedCount++;

          if (existingProj.venta_id) {
            const saleUpdate: any = {};
            if (dropboxUrl) saleUpdate.carpeta_dropbox = dropboxUrl;
            if (brief) saleUpdate.proyecto_brief = brief;
            if (card.due) saleUpdate.deadline = card.due.split("T")[0];

            if (Object.keys(saleUpdate).length > 0) {
              await supabase
                .from("ventas")
                .update(saleUpdate)
                .eq("id", existingProj.venta_id);
            }
          }
        } else {
          console.error(`[Projects Sync] Error actualizando proyecto ${projectName}:`, updErr);
        }
      } else {
        const codeMatch = card.name.match(/(AZ-\d+)/i);
        const codigoVenta = codeMatch ? codeMatch[1].toUpperCase() : null;

        let ventaId = null;
        let clienteId = null;

        if (codigoVenta) {
          const { data: matchedSale } = await supabase
            .from("ventas")
            .select("id, cliente_id")
            .eq("codigo_venta", codigoVenta)
            .maybeSingle();

          if (matchedSale) {
            ventaId = matchedSale.id;
            clienteId = matchedSale.cliente_id;
          }
        }

        if (!clienteId && clientName) {
          const { data: matchedClient } = await supabase
            .from("clientes")
            .select("id")
            .ilike("nombre", clientName)
            .limit(1)
            .maybeSingle();

          if (matchedClient) {
            clienteId = matchedClient.id;
          }
        }

        if (!clienteId) {
          const genericName = "Cliente Trello Sin Clasificar";
          const { data: genClient } = await supabase
            .from("clientes")
            .select("id")
            .eq("nombre", genericName)
            .maybeSingle();

          if (genClient) {
            clienteId = genClient.id;
          } else {
            const { data: newGenClient, error: genClientInsErr } = await supabase
              .from("clientes")
              .insert([{ nombre: genericName }])
              .select()
              .single();

            if (genClientInsErr) {
              console.error(`[Projects Sync] Error insertando cliente genérico:`, genClientInsErr);
            } else if (newGenClient) {
              clienteId = newGenClient.id;
            }
          }
        }

        if (clienteId) {
          const { data: newProj, error: insErr } = await supabase
            .from("proyectos")
            .insert([
              {
                nombre: projectName,
                cliente_id: clienteId,
                venta_id: ventaId,
                trello_card_id: card.id,
                trello_list_id: card.idList,
                link_trello: card.shortUrl || card.url,
                carpeta_dropbox: dropboxUrl || null,
                activo: !card.closed,
                creado_en: cardCreatedDate,
                actualizado_en: new Date().toISOString()
              },
            ])
            .select()
            .single();

          if (!insErr && newProj) {
            insertedCount++;

            if (ventaId) {
              const saleUpdate: any = {};
              if (dropboxUrl) saleUpdate.carpeta_dropbox = dropboxUrl;
              if (brief) saleUpdate.proyecto_brief = brief;
              if (card.due) saleUpdate.deadline = card.due.split("T")[0];

              if (Object.keys(saleUpdate).length > 0) {
                await supabase
                  .from("ventas")
                  .update(saleUpdate)
                  .eq("id", ventaId);
              }
            }
          } else if (insErr) {
            console.error(`[Projects Sync] Error insertando proyecto ${projectName}:`, insErr);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      insertedCount,
      updatedCount,
      totalSynced: allCards.length,
    });
  } catch (error: any) {
    console.error("POST Sync Projects Error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Error al sincronizar proyectos con Trello." },
      { status: 500 }
    );
  }
}
